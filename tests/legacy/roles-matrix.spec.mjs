#!/usr/bin/env node
import { TestHelper, createTestSuite } from "./helpers.mjs";
import fs from "node:fs";
import path from "node:path";

/**
 * Role Matrix Fuzzer - Tests security boundaries across role/deny-flag combinations
 * Validates least-privilege enforcement and policy compliance
 */
const roleMatrixTests = createTestSuite("Role Matrix Security Fuzzer", {
  async "admin role bypasses most restrictions"(helper) {
    const policy = {
      version: "1.0",
      roles: {
        admin: {
          allowedBinaries: ["echo", "ls", "cat", "mkdir", "rm"],
          denyFlags: ["-rf"],
          workdirPolicy: "anywhere"
        }
      },
      globalDenyFlags: ["-rf", "--force"]
    };
    
    const policyPath = helper.createTestPolicy(policy);
    const { process: safeexec } = await helper.startSafeExec(policyPath, "admin");
    
    // Admin should be able to run allowed commands
    const echoResult = await helper.callTool(safeexec, "safe_run", {
      cmd: "echo",
      args: ["admin", "test"]
    });
    
    if (echoResult.error) {
      throw new Error(`Admin echo failed: ${echoResult.error.message}`);
    }
    
    // But still blocked by deny flags
    const rmResult = await helper.callTool(safeexec, "safe_run", {
      cmd: "rm",
      args: ["-rf", "test"]
    });
    
    if (!rmResult.error || !rmResult.error.message.includes("denied flags")) {
      throw new Error("Admin should still be blocked by deny flags");
    }
  },

  async "builder role has restricted access"(helper) {
    const policy = {
      version: "1.0",
      roles: {
        builder: {
          allowedBinaries: ["echo", "node", "npm"],
          denyFlags: ["-rf", "--unsafe"],
          workdirPolicy: "fence"
        }
      },
      globalDenyFlags: ["-rf", "--force"]
    };
    
    const policyPath = helper.createTestPolicy(policy);
    const { process: safeexec } = await helper.startSafeExec(policyPath, "builder");
    
    // Builder can run allowed commands
    const nodeResult = await helper.callTool(safeexec, "safe_run", {
      cmd: "node",
      args: ["--version"]
    });
    
    if (nodeResult.error) {
      throw new Error(`Builder node failed: ${nodeResult.error.message}`);
    }
    
    // Builder blocked from system commands
    const lsResult = await helper.callTool(safeexec, "safe_run", {
      cmd: "ls",
      args: ["/"]
    });
    
    if (!lsResult.error || !lsResult.error.message.includes("not allowed")) {
      throw new Error("Builder should be blocked from system commands");
    }
  },

  async "guest role has minimal access"(helper) {
    const policy = {
      version: "1.0",
      roles: {
        guest: {
          allowedBinaries: ["echo"],
          denyFlags: ["*"],  // Deny all flags
          workdirPolicy: "fence"
        }
      },
      globalDenyFlags: ["-rf", "--force"]
    };
    
    const policyPath = helper.createTestPolicy(policy);
    const { process: safeexec } = await helper.startSafeExec(policyPath, "guest");
    
    // Guest can only run basic echo
    const echoResult = await helper.callTool(safeexec, "safe_run", {
      cmd: "echo",
      args: ["hello"]
    });
    
    if (echoResult.error) {
      throw new Error(`Guest echo failed: ${echoResult.error.message}`);
    }
    
    // Guest blocked from any flags
    const echoFlagResult = await helper.callTool(safeexec, "safe_run", {
      cmd: "echo",
      args: ["-n", "test"]
    });
    
    if (!echoFlagResult.error || !echoFlagResult.error.message.includes("denied flags")) {
      throw new Error("Guest should be blocked from all flags");
    }
  },

  async "role inheritance and override behavior"(helper) {
    const policy = {
      version: "1.0",
      roles: {
        base: {
          allowedBinaries: ["echo"],
          denyFlags: ["-v"],
          workdirPolicy: "fence"
        },
        extended: {
          inherits: "base",
          allowedBinaries: ["echo", "cat"],
          denyFlags: ["-v", "-f"]  // Extends base deny flags
        }
      },
      globalDenyFlags: ["-rf"]
    };
    
    const policyPath = helper.createTestPolicy(policy);
    const { process: safeexec } = await helper.startSafeExec(policyPath, "extended");
    
    // Extended role can use inherited + new binaries
    const catResult = await helper.callTool(safeexec, "safe_run", {
      cmd: "cat",
      args: [policyPath]
    });
    
    if (catResult.error) {
      throw new Error(`Extended role cat failed: ${catResult.error.message}`);
    }
    
    // But still blocked by inherited deny flags
    const verboseResult = await helper.callTool(safeexec, "safe_run", {
      cmd: "echo",
      args: ["-v", "test"]
    });
    
    if (!verboseResult.error || !verboseResult.error.message.includes("denied flags")) {
      throw new Error("Extended role should inherit base deny flags");
    }
  },

  async "fuzzer tests random role/command combinations"(helper) {
    const policy = {
      version: "1.0",
      roles: {
        fuzzer: {
          allowedBinaries: ["echo", "cat", "ls"],
          denyFlags: ["-r", "-f", "--force"],
          workdirPolicy: "fence"
        }
      },
      globalDenyFlags: ["-rf", "--dangerous"]
    };
    
    const policyPath = helper.createTestPolicy(policy);
    const { process: safeexec } = await helper.startSafeExec(policyPath, "fuzzer");
    
    const testCases = [
      // Valid cases
      { cmd: "echo", args: ["test"], shouldPass: true },
      { cmd: "cat", args: [policyPath], shouldPass: true },
      { cmd: "ls", args: ["."], shouldPass: true },
      
      // Invalid binaries
      { cmd: "rm", args: ["test"], shouldPass: false, reason: "not allowed" },
      { cmd: "mkdir", args: ["test"], shouldPass: false, reason: "not allowed" },
      
      // Denied flags
      { cmd: "echo", args: ["-r", "test"], shouldPass: false, reason: "denied flags" },
      { cmd: "ls", args: ["-f", "."], shouldPass: false, reason: "denied flags" },
      { cmd: "cat", args: ["--force", "file"], shouldPass: false, reason: "denied flags" },
      
      // Global deny flags
      { cmd: "echo", args: ["-rf", "test"], shouldPass: false, reason: "denied flags" },
      { cmd: "ls", args: ["--dangerous", "."], shouldPass: false, reason: "denied flags" }
    ];
    
    for (const testCase of testCases) {
      const result = await helper.callTool(safeexec, "safe_run", {
        cmd: testCase.cmd,
        args: testCase.args
      });
      
      if (testCase.shouldPass) {
        if (result.error) {
          throw new Error(`Expected ${testCase.cmd} ${testCase.args.join(' ')} to pass, but got: ${result.error.message}`);
        }
      } else {
        if (!result.error) {
          throw new Error(`Expected ${testCase.cmd} ${testCase.args.join(' ')} to fail`);
        }
        if (!result.error.message.includes(testCase.reason)) {
          throw new Error(`Expected error to contain '${testCase.reason}', got: ${result.error.message}`);
        }
      }
    }
  },

  async "workdir policy enforcement"(helper) {
    const policy = {
      version: "1.0",
      roles: {
        fenced: {
          allowedBinaries: ["echo", "ls"],
          denyFlags: [],
          workdirPolicy: "fence"
        },
        anywhere: {
          allowedBinaries: ["echo", "ls"],
          denyFlags: [],
          workdirPolicy: "anywhere"
        }
      }
    };
    
    const policyPath = helper.createTestPolicy(policy);
    
    // Test fenced role
    const { process: fencedExec } = await helper.startSafeExec(policyPath, "fenced");
    
    // Should work in current directory
    const fencedResult = await helper.callTool(fencedExec, "safe_run", {
      cmd: "echo",
      args: ["fenced", "test"]
    });
    
    if (fencedResult.error) {
      throw new Error(`Fenced role failed in workdir: ${fencedResult.error.message}`);
    }
    
    fencedExec.kill();
    
    // Test anywhere role
    const { process: anywhereExec } = await helper.startSafeExec(policyPath, "anywhere");
    
    const anywhereResult = await helper.callTool(anywhereExec, "safe_run", {
      cmd: "echo",
      args: ["anywhere", "test"]
    });
    
    if (anywhereResult.error) {
      throw new Error(`Anywhere role failed: ${anywhereResult.error.message}`);
    }
  },

  async "stress test with rapid role switching"(helper) {
    const policy = {
      version: "1.0",
      roles: {
        role1: { allowedBinaries: ["echo"], denyFlags: [], workdirPolicy: "fence" },
        role2: { allowedBinaries: ["cat"], denyFlags: [], workdirPolicy: "fence" },
        role3: { allowedBinaries: ["ls"], denyFlags: [], workdirPolicy: "fence" }
      }
    };
    
    const policyPath = helper.createTestPolicy(policy);
    
    // Start multiple SafeExec instances with different roles
    const instances = [];
    for (let i = 1; i <= 3; i++) {
      const { process: safeexec } = await helper.startSafeExec(policyPath, `role${i}`);
      instances.push({ process: safeexec, role: `role${i}` });
    }
    
    try {
      // Test each instance can only run its allowed commands
      const role1Result = await helper.callTool(instances[0].process, "safe_run", {
        cmd: "echo",
        args: ["role1"]
      });
      if (role1Result.error) {
        throw new Error(`Role1 echo failed: ${role1Result.error.message}`);
      }
      
      const role2Result = await helper.callTool(instances[1].process, "safe_run", {
        cmd: "cat",
        args: [policyPath]
      });
      if (role2Result.error) {
        throw new Error(`Role2 cat failed: ${role2Result.error.message}`);
      }
      
      const role3Result = await helper.callTool(instances[2].process, "safe_run", {
        cmd: "ls",
        args: ["."]
      });
      if (role3Result.error) {
        throw new Error(`Role3 ls failed: ${role3Result.error.message}`);
      }
      
      // Test cross-role command blocking
      const crossResult = await helper.callTool(instances[0].process, "safe_run", {
        cmd: "cat",  // role1 can't run cat
        args: ["test"]
      });
      if (!crossResult.error || !crossResult.error.message.includes("not allowed")) {
        throw new Error("Cross-role command should be blocked");
      }
      
    } finally {
      // Clean up all instances
      instances.forEach(({ process }) => {
        try { process.kill(); } catch {}
      });
    }
  }
});

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  roleMatrixTests.run().then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  }).catch((err) => {
    console.error("Role matrix test suite failed:", err);
    process.exit(1);
  });
}

export { roleMatrixTests };