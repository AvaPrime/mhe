1) mcp/safe-exec/setup.md (new)
# SafeExec++ — Setup & Operations Guide

This document is the authoritative setup guide for the SafeExec++ policy-enforced MCP server and its policy linting toolchain.

## What you get
- **SafeExec++ MCP** (`server.mjs`): role-aware execution with deny-flags, workspace fencing, plan/apply flow, audit logs.
- **Policy Linter MCP & CLI**: schema validation, security/best-practice analysis, PR comments.
- **CI & Pre-commit**: automatic policy checks and diff reviews.

---

## Prerequisites
- Node.js ≥ 20
- (Optional) Docker Desktop (for isolated runs)
- TRAE IDE with MCP enabled

---

## Directory layout


mcp/safe-exec/
server.mjs
policy.json
policy.schema.json
policy-linter.mjs
pr-policy-checker.mjs
policy-utils.mjs
POLICY_LINTING_GUIDE.md
setup.md <-- this file
package.json
tests/ <-- (added by this pack)


---

## Install
```bash
cd mcp/safe-exec
npm i


If you use the coverage flow:

npm i -D c8

Configure TRAE

Project-local .trae/mcp.json (example):

{
  "mcpServers": [
    {
      "name": "safe-exec",
      "command": ["node", "mcp/safe-exec/server.mjs"],
      "env": {
        "SAFEEXEC_ROLE": "builder",
        "SAFEEXEC_WORKDIR": "${workspaceFolder}",
        "SAFEEXEC_TIMEOUT_MS": "600000",
        "SAFEEXEC_LOG": "${workspaceFolder}/.logs/safeexec.log.jsonl",
        "SAFEEXEC_POLICY": "${workspaceFolder}/mcp/safe-exec/policy.json",
        "SAFEEXEC_SCHEMA": "${workspaceFolder}/mcp/safe-exec/policy.schema.json"
      }
    },
    {
      "name": "policy-linter",
      "command": ["node", "mcp/safe-exec/policy-linter.mjs"],
      "env": {
        "POLICY_PATH": "${workspaceFolder}/mcp/safe-exec/policy.json",
        "POLICY_SCHEMA": "${workspaceFolder}/mcp/safe-exec/policy.schema.json"
      }
    }
  ]
}

Daily usage (agents)

Plan then apply for anything that mutates state or touches the network:

safe_plan → returns { plan_id, approval_token, commandline, expires_at }

Await human approval

safe_apply_plan with the returned IDs

Read-only or trivial checks may use safe_run (node -v, rg --version)

For PRs: the CI workflow validates policy.json, analyzes risk deltas, and comments.

Policy editing workflow

Edit mcp/safe-exec/policy.json

Validate locally:

node mcp/safe-exec/policy-linter.mjs --validate --policy mcp/safe-exec/policy.json --schema mcp/safe-exec/policy.schema.json
node mcp/safe-exec/policy-linter.mjs --analyze --policy mcp/safe-exec/policy.json --fail-on=high


Open a PR; CI will run schema checks, tests, and post a diff/risk comment.

Error Handling & Configuration

SafeExec++ includes enhanced error handling with configurable timeouts and retry mechanisms:

### Configuration Files
- `config/error-handling.json`: Error handling configuration
- `lib/error-handler.js`: Error handling utilities

### Key Features
- **Configurable Timeouts**: Environment-specific timeout settings
- **Retry Mechanisms**: Exponential backoff with jitter
- **Circuit Breaker**: Prevents cascading failures
- **Preflight Checks**: Validates environment before execution
- **Health Monitoring**: Tracks system health and performance

### Environment Variables
```bash
# Error handling configuration
SAFEEXEC_ERROR_CONFIG="./config/error-handling.json"
SAFEEXEC_ENVIRONMENT="development"  # or "production"
SAFEEXEC_CIRCUIT_BREAKER_ENABLED="true"
```

## Troubleshooting

### Common Issues

**Policy invalid**: CI/Server prints Ajv errors. Fix to schema, commit.

**Denied flag**: Remove or change args; if required, propose a minimal policy change.

**Fence violations**: Ensure cwd stays under SAFEEXEC_WORKDIR.

**Timeouts**: 
- Check `config/error-handling.json` for timeout settings
- Adjust environment-specific timeouts (development vs production)
- Use circuit breaker settings to prevent cascading failures

**Version Conflicts**:
- Run `node scripts/version-manager.js --validate` to check compatibility
- Use `node scripts/version-manager.js --update` to sync versions
- Check `.safeexec-version` for current configuration

**Error Handling**:
- Review error logs in the configured log directory
- Check circuit breaker status if commands are being rejected
- Verify preflight checks are passing
- Monitor retry attempts and backoff patterns

Monitoring Integration

SafeExec++ integrates with the unified monitoring system:
- Logs are forwarded to the central monitoring dashboard
- Metrics are collected for performance analysis
- Alerts are configured for critical failures
- Health checks are performed regularly

### Monitoring Commands
```bash
# Start unified monitoring
node ../monitoring/unified-monitor.js --start

# Check SafeExec health
node ../monitoring/unified-monitor.js --health safeexec

# View recent logs
node ../monitoring/unified-monitor.js --logs safeexec --tail 100
```

## Security defaults (opinionated)

denyFlags: --unsafe-perm, --allow-root, --privileged, -rf, -fr, --no-sandbox, --disable-sandbox

Per-binary deny (examples): git (push, --force, --hard), bash/sh (-c)

Roles: reviewer (read), validator (tests/linters), builder (implementation), admin (exceptions, always via plan/apply)

Happy forging. Guardrails on, creativity up.


---

# 2) Unit tests for the linter (new)

**a) `mcp/safe-exec/tests/linter.spec.mjs`**
```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "mcp", "safe-exec");
const policyPath = path.join(root, "policy.json");
const schemaPath = path.join(root, "policy.schema.json");

// dynamic import to avoid caching across tests
async function load(module) { return import(path.join(root, module)); }

test("schema: policy.json matches policy.schema.json", async () => {
  const { validateWithSchema } = await load("policy-utils.mjs");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const res = validateWithSchema(policy, schema);
  assert.equal(res.valid, true, `Schema errors: ${JSON.stringify(res.errors, null, 2)}`);
});

test("analyzer: denies global dangerous flags", async () => {
  const { analyzePolicy } = await load("policy-utils.mjs");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));

  // simulate a dangerous flag present in policy (should be denied)
  policy.denyFlags = Array.from(new Set([...(policy.denyFlags || []), "--unsafe-perm"]));
  const report = analyzePolicy(policy);

  const high = report.findings.filter(f => f.severity === "high");
  assert.ok(high.some(f => /unsafe-perm/i.test(f.message)), "Expected high finding for --unsafe-perm");
});

test("roles: unknown role rejected by runtime gate", async () => {
  const { simulateGate } = await load("policy-utils.mjs");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  assert.throws(
    () => simulateGate({ cmd: "git", args: ["status"], cwd: process.cwd(), role: "ghost", policy }),
    /Unknown role/i
  );
});

test("roles: reviewer cannot run npm", async () => {
  const { simulateGate } = await load("policy-utils.mjs");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  assert.throws(
    () => simulateGate({ cmd: "npm", args: ["--version"], cwd: process.cwd(), role: "reviewer", policy }),
    /not allowed for role/i
  );
});

test("per-binary: git push is denied by perBinary flags", async () => {
  const { simulateGate } = await load("policy-utils.mjs");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  assert.throws(
    () => simulateGate({ cmd: "git", args: ["push"], cwd: process.cwd(), role: "builder", policy }),
    /denied flags/i
  );
});


b) (optional) add one focused test for the diff reviewer
mcp/safe-exec/tests/diff.spec.mjs

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

async function load(module) { return import(path.join(process.cwd(), "mcp", "safe-exec", module)); }

test("diff reviewer flags newly-added dangerous binary", async () => {
  const { reviewPolicyDiff } = await load("policy-utils.mjs");
  const before = { roles: { builder: { allowedBinaries: ["node"] } }, denyFlags: [] };
  const after = { roles: { builder: { allowedBinaries: ["node","bash"] } }, denyFlags: [] };
  const summary = reviewPolicyDiff(before, after);
  const high = summary.findings.filter(f => f.severity === "high");
  assert.ok(high.some(f => /bash/i.test(f.message)), "Expected high risk finding for bash allow-list expansion");
});


c) package.json script additions (augment your existing file)

{
  "scripts": {
    "test": "node --test mcp/safe-exec/tests/**/*.mjs",
    "coverage": "c8 --reporter=text --reporter=lcov npm test"
  },
  "devDependencies": {
    "c8": "^9.1.0"
  }
}


Run locally:

npm run test
# or with coverage
npm run coverage

3) JSDoc for server.mjs (non-invasive patch)

Apply this unified diff to add documentation above the key functions (no logic changes). Save as patches/server-jsdoc.patch and run git apply patches/server-jsdoc.patch.

*** a/mcp/safe-exec/server.mjs
--- b/mcp/safe-exec/server.mjs
@@
+/**
+ * Append a structured JSON line to the SafeExec audit log.
+ * @param {object} evt - Arbitrary serializable event payload.
+ */
 function jlog(evt) {
   try { fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...evt }) + "\n"); }
   catch (_) {}
 }
 
@@
+/**
+ * Load a JSON file from disk and parse into an object.
+ * Throws if the file is missing or malformed.
+ * @param {string} file
+ * @returns {any}
+ */
 function mustReadJSON(file) {
   const raw = fs.readFileSync(file, "utf8");
   return JSON.parse(raw);
 }
 
@@
+/**
+ * Replace placeholder tokens (e.g., {WORKSPACE}) inside a policy object.
+ * @template T
+ * @param {T} policy
+ * @param {string} fencePath
+ * @returns {T}
+ */
 function hydratePolicy(policy, fencePath) {
   const json = JSON.stringify(policy);
   return JSON.parse(json.replaceAll("{WORKSPACE}", fencePath));
 }
 
@@
+/**
+ * Ensure candidate path is inside the workspace fence.
+ * @param {string} base - Fence root.
+ * @param {string} candidate - Candidate cwd or path.
+ * @returns {boolean}
+ */
 function ensureInsideFence(base, candidate) {
   const baseAbs = path.resolve(base);
   const candAbs = path.resolve(candidate);
   return candAbs === baseAbs || candAbs.startsWith(baseAbs + path.sep);
 }
 
@@
+/**
+ * Check whether any argument triggers a deny flag.
+ * Exact token match or simple prefix (e.g., "-rf" in "-rfv").
+ * @param {string[]} args
+ * @param {string[]} denyFlags
+ * @returns {boolean}
+ */
 function hasDenyFlag(args, denyFlags) {
   const set = new Set(denyFlags);
   return args.some(a => set.has(a) || denyFlags.some(df => a === df || (df.length > 1 && a.startsWith(df))));
 }
 
@@
+/**
+ * Validate command execution request against policy.
+ * Ensures cwd within fence, role exists, binary allowed, and deny flags not used.
+ * @param {{cmd:string,args:string[],cwd:string,role:string,policy:any}} p
+ * @returns {{fence:string}}
+ * @throws {Error} when validation fails
+ */
 function gate({ cmd, args, cwd, role, policy }) {
   const fence = policy.workspaceFence || WORKDIR_ENV;
   if (!ensureInsideFence(fence, cwd)) {
     const msg = `CWD '${cwd}' escapes workspace fence '${fence}'`;
     jlog({ kind: "reject", reason: msg, cmd, args, cwd, role });
@@
 }
 
@@
+/**
+ * Spawn a child process without shell, with timeout and optional background mode.
+ * Collects stdio for foreground runs and writes audit events.
+ * @param {{cmd:string,args?:string[],cwd:string,env:NodeJS.ProcessEnv,background?:boolean}} opts
+ * @returns {Promise<{code:number|null, signal:string|null, duration_ms:number, stdout:string, stderr:string}>}
+ */
 async function runChild({ cmd, args = [], cwd, env, background = false }) {
   const child = spawn(cmd, args, {
     cwd,
     env,
     stdio: background ? "ignore" : "pipe",


If you prefer not to use a patch: paste the JSDoc comments above each function in your file.

4) Runbook (hand to your agent)
# Runbook — SafeExec++ Setup Finalization

1) Create/overwrite:
   - mcp/safe-exec/setup.md (from this message)
   - mcp/safe-exec/tests/linter.spec.mjs
   - mcp/safe-exec/tests/diff.spec.mjs (optional)
   - package.json script additions (merge with existing)
   - patches/server-jsdoc.patch (apply with `git apply`)

2) Install deps:
   - `cd mcp/safe-exec && npm i`
   - optional coverage: `npm i -D c8`

3) Apply JSDoc patch:
   - `git apply patches/server-jsdoc.patch` (or copy JSDoc blocks manually)

4) Run tests:
   - `npm test`  (or `npm run coverage`)

5) Validate policy:
   - `node mcp/safe-exec/policy-linter.mjs --validate --policy mcp/safe-exec/policy.json --schema mcp/safe-exec/policy.schema.json`
   - `node mcp/safe-exec/policy-linter.mjs --analyze --policy mcp/safe-exec/policy.json --fail-on=high`

6) Commit + PR:
   - Branch: `chore/safeexec-docs-tests-jsdoc`
   - Commit message: `docs(tutor): add setup.md; test(linter): unit tests; docs(server): JSDoc`
