1) Files to add
mcp/safe-exec/policy-lock.mjs — policy drift sentinel
#!/usr/bin/env node
/**
 * Policy Drift Sentinel
 * Modes:
 *   update  -> writes .policy.lock with sha256(policy.json)
 *   check   -> fails if .policy.lock != working tree hash
 *   ci      -> like check + (if git present) verify lock == HEAD version
 *
 * Exit codes: 0 OK, 1 mismatch, 2 missing lock, 3 IO/schema error, 127 missing git (ci-mode only)
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";

const POLICY = process.env.POLICY_PATH || "mcp/safe-exec/policy.json";
const LOCK   = process.env.POLICY_LOCK || "mcp/safe-exec/.policy.lock";

const mode = process.argv[2]; // update | check | ci

function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }

function haveGit() {
  try { execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" }); return true; } catch { return false; }
}
function headPolicy() {
  try { return execSync(`git show HEAD:${POLICY.replace(/\\/g,"/")}`, { encoding: "utf8" }); }
  catch { return null; }
}

function loadLock() {
  if (!fs.existsSync(LOCK)) return null;
  const raw = read(LOCK);
  try { return JSON.parse(raw); } catch { return { hash: raw.trim() }; } // legacy plain-hash support
}

function saveLock(hash, extras = {}) {
  const payload = { hash, policyPath: POLICY, generatedAt: new Date().toISOString(), ...extras };
  write(LOCK, JSON.stringify(payload, null, 2) + "\n");
  console.log("[policy-lock] updated", payload);
}

function main() {
  const pol = read(POLICY);
  const hash = sha256(pol);

  if (mode === "update") return void saveLock(hash);

  const lock = loadLock();
  if (!lock) { console.error("[policy-lock] missing lock, run: node", process.argv[1], "update"); process.exit(2); }

  if (lock.hash !== hash) {
    console.error("[policy-lock] drift: working-tree hash != lock\n expected:", lock.hash, "\n actual:  ", hash);
    process.exit(1);
  }

  if (mode === "ci") {
    if (!haveGit()) { console.error("[policy-lock] git not available in CI for HEAD check"); process.exit(127); }
    const head = headPolicy();
    if (head) {
      const headHash = sha256(head);
      if (headHash !== lock.hash) {
        console.error("[policy-lock] drift: HEAD != lock\n head:   ", headHash, "\n lock:   ", lock.hash);
        process.exit(1);
      }
    }
  }

  console.log("[policy-lock] OK:", hash);
}

try { main(); } catch (e) { console.error("[policy-lock] error:", e?.message || e); process.exit(3); }

mcp/safe-exec/tests/roles-matrix.spec.mjs — role matrix fuzzer
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "mcp", "safe-exec");
const policy = JSON.parse(fs.readFileSync(path.join(ROOT, "policy.json"), "utf8"));

// The utils should expose a synchronous gate for policy-only checks
const { simulateGate } = await import(path.join(ROOT, "policy-utils.mjs"));

// Deterministic probes: benign + risky
const benign = [
  { cmd: "node", args: ["-v"] },
  { cmd: "rg",   args: ["--version"] }
];
const risky  = [
  { cmd: "git",  args: ["push"] },           // remote mutation
  { cmd: "bash", args: ["-c", "echo x"] },   // shell string eval (usually denied)
];

const roles = Object.keys(policy.roles || {});

for (const role of roles) {
  test(`role matrix: ${role}`, () => {
    // Benign commands SHOULD pass when binary is allowed for the role
    for (const p of benign) {
      const run = () => simulateGate({ ...p, cwd: process.cwd(), role, policy });
      const allowed = (policy.roles[role].allowedBinaries || []).includes(p.cmd);
      if (allowed) {
        assert.doesNotThrow(run, `expected benign ${p.cmd} to be allowed for ${role}`);
      } else {
        assert.throws(run, /not allowed for role|Unknown role|escapes/, `expected ${p.cmd} to be blocked for ${role}`);
      }
    }

    // Risky commands SHOULD be blocked for non-admin roles (by deny flags or per-binary rules)
    for (const p of risky) {
      const run = () => simulateGate({ ...p, cwd: process.cwd(), role, policy });
      if (role !== "admin") {
        assert.throws(run, /denied|not allowed|reject/i, `expected risky ${p.cmd} to be blocked for ${role}`);
      }
    }
  });
}

// Global regression: if denyFlags contains "-rf", it must block typical patterns
test("denyFlags regression: blocks '-rf' style args", () => {
  const df = new Set(policy.denyFlags || []);
  df.add("-rf");
  const patched = { ...policy, denyFlags: [...df] };
  assert.throws(
    () => simulateGate({ cmd: "bash", args: ["-rf"], cwd: process.cwd(), role: "builder", policy: patched }),
    /denied/i
  );
});

2) Makefile targets

Append to your top-level Makefile:

policy-lock-update:
	node mcp/safe-exec/policy-lock.mjs update

policy-lock-check:
	node mcp/safe-exec/policy-lock.mjs check

policy-lock-ci:
	node mcp/safe-exec/policy-lock.mjs ci

test-matrix:
	node --test mcp/safe-exec/tests/roles-matrix.spec.mjs

3) CI: add sentinel + matrix to your workflow

In .github/workflows/policy-lint.yml (after schema/analysis/tests), add:

- name: Policy lock (drift sentinel)
  run: node mcp/safe-exec/policy-lock.mjs ci

- name: Role matrix fuzzer
  run: node --test mcp/safe-exec/tests/roles-matrix.spec.mjs


This extends the pipeline that already validates/lints your policy and comments on PRs. 

setup

4) Optional pre-commit hook (local fast-fail)

scripts/precommit-policy-lock.sh

#!/usr/bin/env bash
set -euo pipefail
CHANGED=$(git diff --cached --name-only -- mcp/safe-exec/policy.json || true)
[ -z "$CHANGED" ] && exit 0
node mcp/safe-exec/policy-lock.mjs check


Enable:

chmod +x scripts/precommit-policy-lock.sh
ln -sf ../../scripts/precommit-policy-lock.sh .git/hooks/pre-commit

5) Doc nits to append

Add this “Drift & Matrix” block to both setup docs so future readers know what’s enforcing things:

### Drift & Matrix (safety nets)

- **Policy Drift Sentinel** — blocks merges when `mcp/safe-exec/policy.json` in the working tree or at `HEAD` diverges from the recorded `.policy.lock`.
  - Update the lock when you intentionally change policy:
    ```bash
    npm run policy:lock:update   # or make policy-lock-update
    ```
- **Role Matrix Fuzzer** — runs a deterministic matrix over roles/binaries/denyFlags to catch regressions early:
  ```bash
  npm run test:matrix    # or make test-matrix


These integrate with CI (policy-lock ci, role matrix test) and with pre-commit locally for fast feedback.


*In the advanced SafeExec++ guide, tuck this under “Tests / CI”.* :contentReference[oaicite:3]{index=3}  
*In the basic SafeExec guide, place under “First-run checklist”.* :contentReference[oaicite:4]{index=4}

---

# 6) NPM scripts (quality-of-life)

Augment `mcp/safe-exec/package.json`:

```json
{
  "scripts": {
    "policy:lock:update": "node mcp/safe-exec/policy-lock.mjs update",
    "policy:lock:check": "node mcp/safe-exec/policy-lock.mjs check",
    "test:matrix": "node --test mcp/safe-exec/tests/roles-matrix.spec.mjs"
  }
}

Hand-off runbook (agent-ready)

Create the two files above.

Add Makefile targets & NPM scripts.

Wire CI steps into policy-lint.yml.

(Optional) Enable the pre-commit hook.

Update both setup docs with the “Drift & Matrix” block.

Run:

npm run policy:lock:update
npm run test:matrix


Open PR: chore(safeexec): add policy drift sentinel + role matrix fuzzer.