0) What this pack does

Fills the empty setup.md with clear install/usage.

Adds unit tests for the linter.

Adds JSDoc to key server.mjs functions.

Bonus: Policy Drift Sentinel + Role Matrix Fuzzer (keeps future changes honest).

1) mcp/safe-exec/setup.md
# SafeExec++ — Setup & Operations

## Prereqs
- Node 20+  • TRAE IDE with MCP  • (Optional) Docker Desktop

## Install
```bash
cd mcp/safe-exec
npm i

Wire into TRAE

Add to .trae/mcp.json:

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
    }
  ]
}

Daily use

Plan → approve → apply for anything stateful: safe_plan → safe_apply_plan.

Trivial checks may use safe_run (e.g., node -v).

Validate policy locally
node mcp/safe-exec/policy-linter.mjs --validate --policy mcp/safe-exec/policy.json --schema mcp/safe-exec/policy.schema.json
node mcp/safe-exec/policy-linter.mjs --analyze  --policy mcp/safe-exec/policy.json --fail-on=high

Troubleshooting

“Policy invalid”: fix schema errors; re-run.

“Fence violation”: keep cwd under SAFEEXEC_WORKDIR.

Timeouts: raise SAFEEXEC_TIMEOUT_MS (prefer ≤10m except admin).


---

## 2) Unit tests for the linter
Create `mcp/safe-exec/tests/linter.spec.mjs`:
```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("mcp", "safe-exec");
const policy = JSON.parse(fs.readFileSync(path.join(root,"policy.json"),"utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(root,"policy.schema.json"),"utf8"));

const utilsPath = path.join(process.cwd(), "mcp", "safe-exec", "policy-utils.mjs");
const { validateWithSchema, analyzePolicy, simulateGate } = await import(utilsPath);

test("schema: policy matches schema", () => {
  const r = validateWithSchema(policy, schema);
  assert.equal(r.valid, true, JSON.stringify(r.errors, null, 2));
});

test("deny-flags: unsafe-perm flagged high", () => {
  const p = { ...policy, denyFlags: [...new Set([...(policy.denyFlags||[]), "--unsafe-perm"])] };
  const rep = analyzePolicy(p);
  assert.ok(rep.findings.some(f => f.severity === "high" && /unsafe-perm/i.test(f.message)));
});

test("roles: reviewer cannot run npm", () => {
  assert.throws(
    () => simulateGate({ cmd: "npm", args: ["--version"], cwd: process.cwd(), role: "reviewer", policy }),
    /not allowed for role/i
  );
});

test("git push denied by per-binary rules", () => {
  assert.throws(
    () => simulateGate({ cmd: "git", args: ["push"], cwd: process.cwd(), role: "builder", policy }),
    /denied flags/i
  );
});


Add scripts (merge with your package.json):

{
  "scripts": {
    "test": "node --test mcp/safe-exec/tests/**/*.mjs"
  }
}


Run:

npm test

3) JSDoc for key functions (minimal, no logic changes)

Add these comment blocks in mcp/safe-exec/server.mjs above the functions:

/** Append structured JSON to the SafeExec audit log. */
function jlog(evt) { ... }

/** Read and parse a JSON file; throws on errors. */
function mustReadJSON(file) { ... }

/**
 * Replace placeholders (e.g., {WORKSPACE}) inside a policy object.
 * @template T
 * @param {T} policy
 * @param {string} fencePath
 * @returns {T}
 */
function hydratePolicy(policy, fencePath) { ... }

/**
 * Ensure candidate path is within workspace fence.
 * @param {string} base
 * @param {string} candidate
 * @returns {boolean}
 */
function ensureInsideFence(base, candidate) { ... }

/**
 * True if any arg triggers deny flags (exact or prefix like "-rf" in "-rfv").
 * @param {string[]} args
 * @param {string[]} denyFlags
 */
function hasDenyFlag(args, denyFlags) { ... }

/**
 * Validate a request against policy (fence, role, allowed binary, deny flags).
 * @throws {Error} on violation
 */
function gate({ cmd, args, cwd, role, policy }) { ... }

/**
 * Spawn child without shell; timeout; optional background.
 * @returns {Promise<{code:number|null,signal:string|null,duration_ms:number,stdout:string,stderr:string}>}
 */
async function runChild({ cmd, args = [], cwd, env, background = false }) { ... }

4) Bonus: Policy Drift Sentinel

Keeps runtime in lockstep with repo policy.

mcp/safe-exec/policy-lock.mjs:

import fs from "node:fs";
import crypto from "node:crypto";
const cmd = process.argv[2]; // "check" | "update"
const lockPath = "mcp/safe-exec/.policy.lock";
const policyPath = "mcp/safe-exec/policy.json";
const sha = data => crypto.createHash("sha256").update(data).digest("hex");

const policy = fs.readFileSync(policyPath, "utf8");
const hash = sha(policy);

if (cmd === "update") {
  fs.writeFileSync(lockPath, hash + "\n");
  console.log("Updated .policy.lock:", hash);
  process.exit(0);
}

if (cmd === "check") {
  if (!fs.existsSync(lockPath)) {
    console.error("No .policy.lock; run: node mcp/safe-exec/policy-lock.mjs update");
    process.exit(2);
  }
  const want = fs.readFileSync(lockPath, "utf8").trim();
  if (want !== hash) {
    console.error("Policy drift detected.\n expected:", want, "\n actual:  ", hash);
    process.exit(1);
  }
  console.log("Policy lock OK:", hash);
  process.exit(0);
}

console.error("Usage: node mcp/safe-exec/policy-lock.mjs <check|update>");
process.exit(2);


CI snippet (add a step after validation):

- name: Policy lock
  run: |
    node mcp/safe-exec/policy-lock.mjs check


When you intentionally change policy.json, update the lock:

node mcp/safe-exec/policy-lock.mjs update

5) Bonus: Role Matrix Fuzzer (sanity net)

mcp/safe-exec/tests/roles-matrix.spec.mjs:

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const { simulateGate } = await import(path.join(process.cwd(),"mcp","safe-exec","policy-utils.mjs"));
const policy = JSON.parse(fs.readFileSync(path.join("mcp","safe-exec","policy.json"),"utf8"));

const roles = Object.keys(policy.roles);
const probes = [
  { cmd: "node", args: ["-v"] },
  { cmd: "rg", args: ["--version"] },
  { cmd: "git", args: ["push"] }, // should fail
];

for (const role of roles) {
  test(`matrix: role=${role}`, () => {
    for (const p of probes) {
      const run = () => simulateGate({ ...p, cwd: process.cwd(), role, policy });
      if (p.cmd === "git" && p.args[0] === "push" && role !== "admin") {
        assert.throws(run, /denied|not allowed/i);
      } else {
        try { run(); } catch (e) {
          // Allowed binaries differ per role; we only assert "no false negatives" for benign probes.
          if (["node","rg"].includes(p.cmd)) throw e;
        }
      }
    }
  });
}

6) Runbook (hand this to your agent)
# Runbook — SafeExec++ Closeout

1) Create/overwrite:
   - mcp/safe-exec/setup.md
   - mcp/safe-exec/tests/linter.spec.mjs
   - mcp/safe-exec/tests/roles-matrix.spec.mjs
   - mcp/safe-exec/policy-lock.mjs
   - Add JSDoc comments in server.mjs (as shown)

2) Install:
   - cd mcp/safe-exec && npm i

3) Test:
   - npm test

4) Validate:
   - node mcp/safe-exec/policy-linter.mjs --validate --policy mcp/safe-exec/policy.json --schema mcp/safe-exec/policy.schema.json
   - node mcp/safe-exec/policy-linter.mjs --analyze --policy mcp/safe-exec/policy.json --fail-on=high

5) Initialize policy lock:
   - node mcp/safe-exec/policy-lock.mjs update
   - git add mcp/safe-exec/.policy.lock

6) Commit + PR:
   - Branch: chore/safeexec-closeout-pack
   - Message: "docs: setup.md • test: linter+matrix • docs: JSDoc • ci: policy lock"
