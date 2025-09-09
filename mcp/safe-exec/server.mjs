#!/usr/bin/env node
import { StdioServerTransport, Server } from "@modelcontextprotocol/sdk/server/index.js";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Enhanced error handling imports
let errorHandler;
try {
  const { ErrorHandler } = await import("../lib/error-handler.js");
  errorHandler = new ErrorHandler();
} catch {
  // Fallback if error handler not available
  errorHandler = { 
    shouldRetry: () => false, 
    recordFailure: () => {}, 
    recordSuccess: () => {},
    isCircuitOpen: () => false
  };
}

// ---------- Configuration ----------
const ROLE = process.env.SAFEEXEC_ROLE || "builder";
const WORKDIR_ENV = process.env.SAFEEXEC_WORKDIR || process.cwd();
const MAX_MS = Math.max(1000, parseInt(process.env.SAFEEXEC_TIMEOUT_MS || "600000", 10));
const LOG_PATH = process.env.SAFEEXEC_LOG || path.join(process.cwd(), "safeexec.log.jsonl");
const POLICY_PATH = process.env.SAFEEXEC_POLICY || path.join(process.cwd(), "mcp", "safe-exec", "policy.json");
const MAX_RETRIES = parseInt(process.env.SAFEEXEC_MAX_RETRIES || "3", 10);
const RETRY_DELAY_MS = parseInt(process.env.SAFEEXEC_RETRY_DELAY_MS || "1000", 10);

// In-memory plan store (ephemeral per process)
const plans = new Map(); // planId -> { cmd, args, cwd, env, role, expiresAt }

// ---------- Utilities ----------
function jlog(evt) {
  try { 
    const logEntry = { ts: new Date().toISOString(), pid: process.pid, ...evt };
    fs.appendFileSync(LOG_PATH, JSON.stringify(logEntry) + "\n"); 
  }
  catch (err) {
    console.error("[safeexec] Log write failed:", err.message);
  }
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

async function runChildWithRetry({ cmd, args = [], cwd, env, background = false, retries = MAX_RETRIES }) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await runChild({ cmd, args, cwd, env, background });
      
      // Success or non-retryable failure
      if (result.code === 0 || !errorHandler.shouldRetry(result.code, attempt)) {
        return result;
      }
      
      // Retryable failure
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt); // Exponential backoff
        jlog({ kind: "retry", cmd, args, cwd, attempt: attempt + 1, delay_ms: delay, code: result.code });
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        jlog({ kind: "retry_exhausted", cmd, args, cwd, final_code: result.code });
        return result;
      }
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
      jlog({ kind: "retry_error", cmd, args, cwd, attempt: attempt + 1, delay_ms: delay, error: err.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function runChild({ cmd, args = [], cwd, env, background = false }) {
  const cmdKey = `${cmd}:${cwd}`;
  
  // Circuit breaker check
  if (errorHandler.isCircuitOpen(cmdKey)) {
    const err = new Error(`Circuit breaker open for ${cmd} in ${cwd}`);
    jlog({ kind: "circuit_open", cmd, args, cwd, error: err.message });
    throw err;
  }

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

  const timer = setTimeout(() => { 
    try { 
      child.kill("SIGKILL"); 
      jlog({ kind: "timeout", cmd, args, cwd, timeout_ms: MAX_MS });
    } catch {} 
  }, MAX_MS);

  return new Promise(resolve => {
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const dur = Date.now() - started;
      const result = { code, signal, duration_ms: dur, stdout: background ? "" : stdout, stderr: background ? "" : stderr };
      
      // Record success/failure for circuit breaker
      if (code === 0) {
        errorHandler.recordSuccess(cmdKey);
      } else {
        errorHandler.recordFailure(cmdKey);
      }
      
      jlog({ kind: "exit", cmd, args, cwd, code, signal, dur, bytesOut: stdout.length, bytesErr: stderr.length });
      resolve(result);
    });
    
    child.on("error", (err) => {
      clearTimeout(timer);
      errorHandler.recordFailure(cmdKey);
      jlog({ kind: "spawn_error", cmd, args, cwd, error: err.message });
      resolve({ code: -1, signal: null, duration_ms: Date.now() - started, stdout: "", stderr: err.message });
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
    const result = await runChildWithRetry({
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
    const result = await runChildWithRetry({ cmd, args, cwd, env, background: false });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (name === "safe_start_process") {
    const cmd = a.cmd; const args = a.args || [];
    const cwd = a.cwd || WORKDIR_ENV; const env = cleanEnv(a.env || {});
    const role = a.role || ROLE;
    gate({ cmd, args, cwd, role, policy });
    const result = await runChildWithRetry({ cmd, args, cwd, env, background: true });
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
