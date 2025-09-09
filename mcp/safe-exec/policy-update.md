SafeExec MCP — Policy + Roles + Dry-Run Planner

Adds:

policy.json with deny-flags (e.g., --unsafe-perm, -rf) and role-based allow-lists

An explicit dry-run planner (safe_plan) and a separate apply step (safe_apply_plan)

Tight workspace fencing, timeouts, and JSONL audit logs

Files to add / update
1) mcp/safe-exec/policy.json
{
  "$schema": "https://example.com/mcp-safe-exec-policy.schema.json",
  "workspaceFence": "{WORKSPACE}",

  "denyFlags": [
    "--unsafe-perm",
    "--allow-root",
    "--privileged",
    "-rf",
    "-fr",
    "--no-sandbox",
    "--disable-sandbox"
  ],

  "roles": {
    "builder": {
      "allowedBinaries": ["node", "npm", "pnpm", "yarn", "python", "uv", "pip", "rg", "git", "go", "bash", "sh"]
    },
    "validator": {
      "allowedBinaries": ["node", "npm", "pnpm", "python", "uv", "pip", "rg", "git"]
    },
    "reviewer": {
      "allowedBinaries": ["rg", "git"]
    },
    "admin": {
      "allowedBinaries": ["node", "npm", "pnpm", "yarn", "python", "uv", "pip", "rg", "git", "go", "bash", "sh", "docker", "docker-compose"]
    }
  },

  "perBinary": {
    "git": {
      "denyFlags": ["push", "reset", "clean", "filter-repo", "rebase", "--force", "--hard"],
      "notes": "Require human approval before any remote mutation or destructive local ops."
    },
    "npm": {
      "denyFlags": ["--unsafe-perm", "--force"]
    },
    "pnpm": {
      "denyFlags": ["--unsafe-perm", "--force"]
    },
    "bash": {
      "denyFlags": ["-c"]  // discourage shell string eval; prefer explicit args
    },
    "sh": {
      "denyFlags": ["-c"]
    },
    "docker": {
      "denyFlags": ["--privileged"]
    }
  }
}


workspaceFence will be replaced at runtime with ${workspaceFolder} (or your chosen path) so policies travel with the repo.

2) mcp/safe-exec/server.mjs (replace your earlier file with this one)
#!/usr/bin/env node
import { StdioServerTransport, Server } from "@modelcontextprotocol/sdk/server/index.js";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ---------- Configuration ----------
const ROLE = process.env.SAFEEXEC_ROLE || "builder";
const WORKDIR_ENV = process.env.SAFEEXEC_WORKDIR || process.cwd();
const MAX_MS = Math.max(1000, parseInt(process.env.SAFEEXEC_TIMEOUT_MS || "600000", 10));
const LOG_PATH = process.env.SAFEEXEC_LOG || path.join(process.cwd(), "safeexec.log.jsonl");
const POLICY_PATH = process.env.SAFEEXEC_POLICY || path.join(process.cwd(), "mcp", "safe-exec", "policy.json");

// In-memory plan store (ephemeral per process)
const plans = new Map(); // planId -> { cmd, args, cwd, env, role, expiresAt }

// ---------- Utilities ----------
function jlog(evt) {
  try { fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...evt }) + "\n"); }
  catch (_) {}
}

function mustReadJSON(file) {
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw);
}

function hydratePolicy(policy, fencePath) {
  const json = JSON.stringify(policy);
  return JSON.parse(json.replaceAll("{WORKSPACE}", fencePath));
}

function ensureInsideFence(base, candidate) {
  const baseAbs = path.resolve(base);
  const candAbs = path.resolve(candidate);
  return candAbs === baseAbs || candAbs.startsWith(baseAbs + path.sep);
}

function hasDenyFlag(args, denyFlags) {
  // match exact tokens and prefix forms (e.g., `-rf` embedded in `-rfv`)
  const set = new Set(denyFlags);
  return args.some(a => set.has(a) || denyFlags.some(df => a === df || (df.length > 1 && a.startsWith(df))));
}

function mkPlanId() {
  return crypto.randomBytes(8).toString("hex");
}

function cleanEnv(env) {
  const copy = { ...process.env, ...env };
  // optionally strip secrets by key name heuristic
  for (const k of Object.keys(copy)) {
    if (/token|secret|password|key/i.test(k)) {
      // leave as-is; but we do not log values
    }
  }
  return copy;
}

async function runChild({ cmd, args = [], cwd, env, background = false }) {
  const child = spawn(cmd, args, {
    cwd,
    env,
    stdio: background ? "ignore" : "pipe",
    shell: false,
    detached: false
  });

  const started = Date.now();
  let stdout = "", stderr = "";
  if (!background) {
    child.stdout?.on("data", d => { stdout += d.toString(); });
    child.stderr?.on("data", d => { stderr += d.toString(); });
  }

  const timer = setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, MAX_MS);

  return new Promise(resolve => {
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const dur = Date.now() - started;
      jlog({ kind: "exit", cmd, args, cwd, code, signal, dur, bytesOut: stdout.length, bytesErr: stderr.length });
      resolve({ code, signal, duration_ms: dur, stdout: background ? "" : stdout, stderr: background ? "" : stderr });
    });
    if (background) {
      jlog({ kind: "background", cmd, args, cwd });
      resolve({ code: 0, signal: null, duration_ms: 0, stdout: "", stderr: "" });
    }
  });
}

// ---------- Policy gate ----------
function gate({ cmd, args, cwd, role, policy }) {
  const fence = policy.workspaceFence || WORKDIR_ENV;

  if (!ensureInsideFence(fence, cwd)) {
    const msg = `CWD '${cwd}' escapes workspace fence '${fence}'`;
    jlog({ kind: "reject", reason: msg, cmd, args, cwd, role });
    throw new Error(msg);
  }

  const roleSpec = policy.roles?.[role];
  if (!roleSpec) {
    const msg = `Unknown role '${role}'`;
    jlog({ kind: "reject", reason: msg, cmd, args, cwd, role });
    throw new Error(msg);
  }

  const allowed = new Set(roleSpec.allowedBinaries || []);
  if (!allowed.has(cmd)) {
    const msg = `Command '${cmd}' is not allowed for role '${role}'`;
    jlog({ kind: "reject", reason: msg, cmd, args, cwd, role });
    throw new Error(msg);
  }

  // Global deny flags
  if (hasDenyFlag(args, policy.denyFlags || [])) {
    const msg = `Arguments contain denied flags (global)`;
    jlog({ kind: "reject", reason: msg, cmd, args, cwd, role });
    throw new Error(msg);
  }

  // Per-binary deny flags
  const per = policy.perBinary?.[cmd];
  if (per && hasDenyFlag(args, per.denyFlags || [])) {
    const msg = `Arguments contain denied flags for '${cmd}'`;
    jlog({ kind: "reject", reason: msg, cmd, args, cwd, role });
    throw new Error(msg);
  }

  return { fence };
}

// ---------- MCP server ----------
const server = new Server(
  { name: "mcp-safe-exec", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

const tools = [
  {
    name: "safe_plan",
    description: "Dry-run planner: validates against policy and returns the exact command that WOULD run; requires apply step.",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { type: "string", description: "Binary to run" },
        args: { type: "array", items: { type: "string" }, default: [] },
        cwd: { type: "string", description: "Working directory (must be within workspace)", default: WORKDIR_ENV },
        env: { type: "object", additionalProperties: { type: "string" }, default: {} },
        role: { type: "string", description: "Agent role (builder|validator|reviewer|admin)", default: ROLE },
        background: { type: "boolean", default: false },
        ttl_ms: { type: "number", default: 5 * 60 * 1000 }
      },
      required: ["cmd"]
    }
  },
  {
    name: "safe_apply_plan",
    description: "Execute a previously planned command by ID after human approval.",
    inputSchema: {
      type: "object",
      properties: {
        plan_id: { type: "string" },
        approval_token: { type: "string", description: "Echo back the token returned by safe_plan" }
      },
      required: ["plan_id", "approval_token"]
    }
  },
  {
    name: "safe_run",
    description: "Convenience: validate against policy and execute immediately (use for trivial, non-destructive ops).",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { type: "string" },
        args: { type: "array", items: { type: "string" }, default: [] },
        cwd: { type: "string", default: WORKDIR_ENV },
        env: { type: "object", additionalProperties: { type: "string" }, default: {} },
        role: { type: "string", default: ROLE }
      },
      required: ["cmd"]
    }
  },
  {
    name: "safe_start_process",
    description: "Validate and start an allowed binary in background (fire-and-forget).",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { type: "string" },
        args: { type: "array", items: { type: "string" }, default: [] },
        cwd: { type: "string", default: WORKDIR_ENV },
        env: { type: "object", additionalProperties: { type: "string" }, default: {} },
        role: { type: "string", default: ROLE }
      },
      required: ["cmd"]
    }
  }
];

server.setRequestHandler("tools/list", async () => ({ tools }));

server.setRequestHandler("tools/call", async (req) => {
  const { name, arguments: a } = req.params;

  // Load + hydrate policy on every call (cheap, ensures live edits)
  const policyRaw = mustReadJSON(POLICY_PATH);
  const policy = hydratePolicy(policyRaw, WORKDIR_ENV);

  if (name === "safe_plan") {
    const cmd = a.cmd; const args = a.args || [];
    const cwd = a.cwd || WORKDIR_ENV;
    const env = a.env || {};
    const role = a.role || ROLE;
    const background = !!a.background;
    const ttl_ms = Math.max(1000, a.ttl_ms || 300000);

    gate({ cmd, args, cwd, role, policy });

    const plan_id = mkPlanId();
    const approval_token = mkPlanId();
    const expiresAt = Date.now() + ttl_ms;
    plans.set(plan_id, { cmd, args, cwd, env, role, background, expiresAt, approval_token });
    jlog({ kind: "plan", plan_id, role, cmd, args, cwd, background, ttl_ms });

    const preview = {
      plan_id,
      approval_token,
      role,
      cwd,
      commandline: [cmd, ...args].join(" "),
      env_keys: Object.keys(env),
      background,
      expires_at: new Date(expiresAt).toISOString()
    };
    return { content: [{ type: "text", text: JSON.stringify(preview, null, 2) }] };
  }

  if (name === "safe_apply_plan") {
    const { plan_id, approval_token } = a;
    const plan = plans.get(plan_id);
    if (!plan) throw new Error(`Unknown or expired plan '${plan_id}'`);
    if (plan.approval_token !== approval_token) throw new Error("Approval token mismatch");
    if (Date.now() > plan.expiresAt) {
      plans.delete(plan_id);
      throw new Error("Plan expired");
    }

    // Validate again against current policy before execution
    gate({ cmd: plan.cmd, args: plan.args, cwd: plan.cwd, role: plan.role, policy });

    const env = cleanEnv(plan.env);
    jlog({ kind: "apply", plan_id, role: plan.role, cmd: plan.cmd, args: plan.args, cwd: plan.cwd });
    const result = await runChild({
      cmd: plan.cmd, args: plan.args, cwd: plan.cwd, env, background: plan.background
    });
    plans.delete(plan_id);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (name === "safe_run") {
    const cmd = a.cmd; const args = a.args || [];
    const cwd = a.cwd || WORKDIR_ENV; const env = cleanEnv(a.env || {});
    const role = a.role || ROLE;
    gate({ cmd, args, cwd, role, policy });
    const result = await runChild({ cmd, args, cwd, env, background: false });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (name === "safe_start_process") {
    const cmd = a.cmd; const args = a.args || [];
    const cwd = a.cwd || WORKDIR_ENV; const env = cleanEnv(a.env || {});
    const role = a.role || ROLE;
    gate({ cmd, args, cwd, role, policy });
    const result = await runChild({ cmd, args, cwd, env, background: true });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  throw new Error(`Unknown tool ${name}`);
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  jlog({ kind: "ready", role: ROLE, workdir: WORKDIR_ENV, max_ms: MAX_MS, log: LOG_PATH, policy: POLICY_PATH });
}).catch((e) => {
  jlog({ kind: "fatal", error: String(e) });
  process.exit(1);
});

3) (Optional) Container for SafeExec++ — docker/safe-exec/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY mcp/safe-exec/package.json ./package.json
RUN npm i --omit=dev
COPY mcp/safe-exec/server.mjs ./server.mjs
COPY mcp/safe-exec/policy.json ./policy.json
ENV SAFEEXEC_WORKDIR=/workspace \
    SAFEEXEC_TIMEOUT_MS=600000 \
    SAFEEXEC_POLICY=/app/policy.json
ENTRYPOINT ["node","/app/server.mjs"]


If you’re already using the earlier compose file, this replaces the SafeExec service build context.

Wire into TRAE

Stdio (Node)

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
        "SAFEEXEC_POLICY": "${workspaceFolder}/mcp/safe-exec/policy.json"
      }
    }
  ]
}


Docker

{
  "mcpServers": [
    {
      "name": "safe-exec-docker",
      "command": ["docker","compose","run","--rm","safe-exec"],
      "env": { "WORKSPACE": "${workspaceFolder}" }
    }
  ]
}


docker-compose service (if not already added)

  safe-exec:
    build: ./docker/safe-exec
    stdin_open: true
    tty: true
    volumes:
      - ${WORKSPACE:?set WORKSPACE}:/workspace
      - safeexec_logs:/logs
    environment:
      SAFEEXEC_ROLE: ${SAFEEXEC_ROLE:-builder}
      SAFEEXEC_WORKDIR: /workspace
      SAFEEXEC_TIMEOUT_MS: ${SAFEEXEC_TIMEOUT_MS:-600000}
      SAFEEXEC_LOG: /logs/safeexec.log.jsonl
      SAFEEXEC_POLICY: /app/policy.json
volumes:
  safeexec_logs:

Strengthen project rules

Append to .trae/project_rules.md:

## SafeExec++ policy
- **Always** use `safe_plan` → wait for human approval → `safe_apply_plan` for any command that can modify state, access the network, or touch git/remotes.
- `safe_run` allowed only for trivial reads (e.g., `node -v`, `rg --version`).
- Roles:
  - `builder`: implementation tasks; default.
  - `validator`: tests/linters.
  - `reviewer`: read-only inspection.
  - `admin`: exceptional ops with explicit human approval.
- If a command is rejected (deny-flag or not in allow-list), propose the minimal policy change and explain the risk.

Makefile helpers
safeexec-install:
	cd mcp/safe-exec && npm i

safeexec-run:
	node mcp/safe-exec/server.mjs

safeexec-plan:
	@echo 'Use via MCP: tools.safe_plan -> safe_apply_plan (see docs)'

safeexec-docker-build:
	docker compose build safe-exec

safeexec-docker-up:
	WORKSPACE=$$(pwd) docker compose run --rm safe-exec

How the planner works

Plan
Call safe_plan with { cmd, args, cwd?, env?, role?, background? }.

Validates against policy.json (role allow-list + deny-flags + fence).

Returns { plan_id, approval_token, commandline, cwd, role, expires_at }.

Approve
A human copies the plan_id and approval_token (or your agent asks you to confirm).
You (or the agent, once approved) call safe_apply_plan with those values.

Execute
The server validates again against the current policy (so edits take effect), runs the command, logs JSONL, and returns exit code/stdout/stderr.

Plans expire by default after 5 minutes (configurable via ttl_ms). They’re kept in-memory only—perfect for PR-scoped runs.

Example agent prompts

“Plan a build with pnpm install --frozen-lockfile in the project root using role builder. Show me the plan. After I reply ‘approved’, apply the plan.”

“Plan git status (validator role). Apply immediately if allowed.”

Notes

Deny-flags check both exact tokens and simple prefixes (e.g., -rf catches -rfv).

To allow shell idioms, add bash/sh to role allow-lists and remove -c from their per-binary deny-flags (not recommended).

For repo-wide policy, keep policy.json under version control; edits become part of code review.

Hand-off to your agent

Create/replace the files above.

Run make safeexec-install.

Add SafeExec server to .trae/mcp.json (stdio or docker).

Test:

safe_plan → node -v (role=reviewer), then safe_apply_plan.

safe_plan → git push should be rejected (deny-flags/policy).

Open PR: chore(safe-exec): role-aware policy + dry-run planner.

