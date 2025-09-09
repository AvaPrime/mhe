import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

export class TestHelper {
  constructor() {
    this.tempFiles = [];
    this.processes = [];
  }

  // Create temporary test policy
  createTestPolicy(overrides = {}) {
    const defaultPolicy = {
      workspaceFence: PROJECT_ROOT,
      roles: {
        test: {
          allowedBinaries: ["echo", "node", "npm", "git"]
        }
      },
      denyFlags: ["-rf", "--force"],
      perBinary: {
        git: {
          denyFlags: ["--force", "push"]
        }
      }
    };
    
    const policy = { ...defaultPolicy, ...overrides };
    const policyPath = path.join(PROJECT_ROOT, "tests", "legacy", "temp-policy.json");
    fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2));
    this.tempFiles.push(policyPath);
    return policyPath;
  }

  // Start SafeExec server for testing
  async startSafeExec(policyPath) {
    const serverPath = path.join(PROJECT_ROOT, "services", "mcp", "components", "safe-exec", "server.mjs");
    const logPath = path.join(PROJECT_ROOT, "tests", "legacy", "safeexec-test.log.jsonl");
    
    const env = {
      ...process.env,
      SAFEEXEC_POLICY: policyPath,
      SAFEEXEC_LOG: logPath,
      SAFEEXEC_ROLE: "test",
      SAFEEXEC_WORKDIR: PROJECT_ROOT
    };

    const child = spawn("node", [serverPath], {
      env,
      stdio: "pipe",
      cwd: PROJECT_ROOT
    });

    this.processes.push(child);
    this.tempFiles.push(logPath);

    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("SafeExec startup timeout")), 5000);
      
      child.stderr.on("data", (data) => {
        if (data.toString().includes("ready")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      
      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return { process: child, logPath };
  }

  // Test MCP tool call
  async callTool(process, toolName, args) {
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      }
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Tool call timeout")), 10000);
      
      let response = "";
      const onData = (data) => {
        response += data.toString();
        try {
          const parsed = JSON.parse(response);
          if (parsed.id === request.id) {
            clearTimeout(timeout);
            process.stdout.off("data", onData);
            resolve(parsed);
          }
        } catch {
          // Continue accumulating response
        }
      };

      process.stdout.on("data", onData);
      process.stdin.write(JSON.stringify(request) + "\n");
    });
  }

  // Read SafeExec logs
  readLogs(logPath) {
    if (!fs.existsSync(logPath)) return [];
    const content = fs.readFileSync(logPath, "utf8");
    return content.split("\n")
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  // Test Desktop Commander integration
  async testDesktopCommanderIntegration() {
    const dcVersionPath = path.join(PROJECT_ROOT, ".dc-version");
    const mcpConfigPath = path.join(PROJECT_ROOT, ".trae", "mcp.json");
    
    // Create test files
    fs.writeFileSync(dcVersionPath, "1.2.3\n");
    this.tempFiles.push(dcVersionPath);
    
    const mcpConfig = {
      mcpServers: {
        "desktop-commander": {
          command: "npx",
          args: ["desktop-commander@1.2.3"]
        }
      }
    };
    
    fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true });
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
    this.tempFiles.push(mcpConfigPath);
    
    // Test version sync
    const syncScript = path.join(PROJECT_ROOT, "scripts", "version-sync.mjs");
    const result = await this.runCommand("node", [syncScript]);
    
    return result.code === 0;
  }

  // Run command helper
  async runCommand(cmd, args, options = {}) {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd: PROJECT_ROOT,
        stdio: "pipe",
        ...options
      });

      let stdout = "", stderr = "";
      child.stdout?.on("data", (data) => stdout += data.toString());
      child.stderr?.on("data", (data) => stderr += data.toString());

      child.on("close", (code) => {
        resolve({ code, stdout, stderr });
      });
    });
  }

  // Cleanup test resources
  cleanup() {
    // Kill processes
    for (const proc of this.processes) {
      try {
        proc.kill("SIGTERM");
      } catch {}
    }
    
    // Remove temp files
    for (const file of this.tempFiles) {
      try {
        fs.unlinkSync(file);
      } catch {}
    }
    
    this.processes = [];
    this.tempFiles = [];
  }
}

export function createTestSuite(name, tests) {
  return {
    name,
    async run() {
      console.log(`\n=== ${name} ===`);
      const helper = new TestHelper();
      let passed = 0, failed = 0;
      
      try {
        for (const [testName, testFn] of Object.entries(tests)) {
          try {
            console.log(`  ${testName}...`);
            await testFn(helper);
            console.log(`  ✓ ${testName}`);
            passed++;
          } catch (err) {
            console.error(`  ✗ ${testName}: ${err.message}`);
            failed++;
          }
        }
      } finally {
        helper.cleanup();
      }
      
      console.log(`\nResults: ${passed} passed, ${failed} failed`);
      return { passed, failed };
    }
  };
}