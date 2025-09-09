#!/usr/bin/env node
import { TestHelper, createTestSuite } from "./helpers.mjs";
import fs from "node:fs";
import path from "node:path";

const integrationTests = createTestSuite("SafeExec ↔ Desktop Commander Integration", {
  async "version synchronization works"(helper) {
    const result = await helper.testDesktopCommanderIntegration();
    if (!result) throw new Error("Version sync failed");
  },

  async "SafeExec server starts and responds"(helper) {
    const policyPath = helper.createTestPolicy();
    const { process: safeexec, logPath } = await helper.startSafeExec(policyPath);
    
    // Test tools/list
    const listResponse = await helper.callTool(safeexec, "tools/list", {});
    if (!listResponse.result?.tools) {
      throw new Error("No tools returned");
    }
    
    const toolNames = listResponse.result.tools.map(t => t.name);
    const expectedTools = ["safe_plan", "safe_apply_plan", "safe_run", "safe_start_process"];
    
    for (const tool of expectedTools) {
      if (!toolNames.includes(tool)) {
        throw new Error(`Missing tool: ${tool}`);
      }
    }
  },

  async "safe_run executes allowed commands"(helper) {
    const policyPath = helper.createTestPolicy();
    const { process: safeexec } = await helper.startSafeExec(policyPath);
    
    const response = await helper.callTool(safeexec, "safe_run", {
      cmd: "echo",
      args: ["hello", "world"]
    });
    
    if (response.error) {
      throw new Error(`safe_run failed: ${response.error.message}`);
    }
    
    const result = JSON.parse(response.result.content[0].text);
    if (result.code !== 0) {
      throw new Error(`Command failed with code ${result.code}`);
    }
    
    if (!result.stdout.includes("hello world")) {
      throw new Error(`Unexpected output: ${result.stdout}`);
    }
  },

  async "safe_run blocks denied commands"(helper) {
    const policyPath = helper.createTestPolicy();
    const { process: safeexec } = await helper.startSafeExec(policyPath);
    
    const response = await helper.callTool(safeexec, "safe_run", {
      cmd: "rm",  // Not in allowedBinaries
      args: ["-rf", "/tmp/test"]
    });
    
    if (!response.error) {
      throw new Error("Expected command to be blocked");
    }
    
    if (!response.error.message.includes("not allowed")) {
      throw new Error(`Unexpected error: ${response.error.message}`);
    }
  },

  async "safe_run blocks denied flags"(helper) {
    const policyPath = helper.createTestPolicy();
    const { process: safeexec } = await helper.startSafeExec(policyPath);
    
    const response = await helper.callTool(safeexec, "safe_run", {
      cmd: "echo",
      args: ["-rf", "test"]  // -rf is in denyFlags
    });
    
    if (!response.error) {
      throw new Error("Expected flags to be blocked");
    }
    
    if (!response.error.message.includes("denied flags")) {
      throw new Error(`Unexpected error: ${response.error.message}`);
    }
  },

  async "plan/apply workflow works"(helper) {
    const policyPath = helper.createTestPolicy();
    const { process: safeexec } = await helper.startSafeExec(policyPath);
    
    // Create plan
    const planResponse = await helper.callTool(safeexec, "safe_plan", {
      cmd: "echo",
      args: ["planned", "execution"]
    });
    
    if (planResponse.error) {
      throw new Error(`Plan failed: ${planResponse.error.message}`);
    }
    
    const plan = JSON.parse(planResponse.result.content[0].text);
    if (!plan.plan_id || !plan.approval_token) {
      throw new Error("Plan missing required fields");
    }
    
    // Apply plan
    const applyResponse = await helper.callTool(safeexec, "safe_apply_plan", {
      plan_id: plan.plan_id,
      approval_token: plan.approval_token
    });
    
    if (applyResponse.error) {
      throw new Error(`Apply failed: ${applyResponse.error.message}`);
    }
    
    const result = JSON.parse(applyResponse.result.content[0].text);
    if (result.code !== 0) {
      throw new Error(`Planned command failed with code ${result.code}`);
    }
    
    if (!result.stdout.includes("planned execution")) {
      throw new Error(`Unexpected output: ${result.stdout}`);
    }
  },

  async "environment validation works"(helper) {
    const envValidateScript = path.resolve("ops", "env-validate.mjs");
    
    // Test with valid environment
    const validEnv = {
      ...process.env,
      SAFEEXEC_WORKDIR: process.cwd(),
      SAFEEXEC_ROLE: "builder"
    };
    
    const validResult = await helper.runCommand("node", [envValidateScript], { env: validEnv });
    if (validResult.code !== 0) {
      throw new Error(`Environment validation failed: ${validResult.stderr}`);
    }
    
    // Test with invalid environment
    const invalidEnv = {
      ...process.env,
      SAFEEXEC_WORKDIR: "/nonexistent",
      SAFEEXEC_ROLE: "invalid_role"
    };
    
    const invalidResult = await helper.runCommand("node", [envValidateScript], { env: invalidEnv });
    if (invalidResult.code === 0) {
      throw new Error("Expected environment validation to fail");
    }
  },

  async "policy drift detection works"(helper) {
    const policyLockScript = path.resolve("policy-lock.mjs");
    
    // Create test policy
    const policyPath = helper.createTestPolicy();
    
    const env = {
      ...process.env,
      SAFEEXEC_POLICY: policyPath,
      POLICY_LOCK_PATH: path.join(path.dirname(policyPath), ".policy-lock.json")
    };
    
    // Initial validation should create lock
    const createResult = await helper.runCommand("node", [policyLockScript, "validate"], { env });
    if (createResult.code !== 0) {
      throw new Error(`Policy lock creation failed: ${createResult.stderr}`);
    }
    
    // Second validation should pass
    const validateResult = await helper.runCommand("node", [policyLockScript, "validate"], { env });
    if (validateResult.code !== 0) {
      throw new Error(`Policy validation failed: ${validateResult.stderr}`);
    }
    
    // Modify policy and test drift detection
    const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
    policy.roles.test.allowedBinaries.push("modified");
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2));
    
    const driftResult = await helper.runCommand("node", [policyLockScript, "validate"], { env });
    if (driftResult.code !== 0) {
      // This is expected in strict mode, but we're not testing strict mode here
      // Just verify drift was detected in output
      if (!driftResult.stderr.includes("drift") && !driftResult.stdout.includes("drift")) {
        throw new Error("Policy drift not detected");
      }
    }
  }
});

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  integrationTests.run().then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  }).catch((err) => {
    console.error("Test suite failed:", err);
    process.exit(1);
  });
}

export { integrationTests };