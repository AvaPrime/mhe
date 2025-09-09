SafeExec MCP — Allow-List Wrapper for Desktop Commander

An MCP server exposing safe_run and safe_start_process tools.
Enforces: allow-list, no-shell by default, working-dir fence, max duration, stdout/stderr capture, and structured logs.

Why add this?

Desktop Commander is powerful. SafeExec is a small guard standing in front of it:

Only approved binaries can run (node, python, git, rg, … by default).

No implicit shells → drastically lowers injection risk.

Per-command timeout; clean kill on overrun.

Audit log (JSONL) for every call.

Keep both servers:

Desktop Commander → FS ops, search, editing, proc mgmt.

SafeExec → all shell execution.

Files to add

Create these files in your repo.

1) mcp/safe-exec/package.json
{
  "name": "mcp-safe-exec",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "mcp-safe-exec": "./server.mjs"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.1.0"
  }
}

2) mcp/safe-exec/server.mjs
#!/usr/bin/env node
import { StdioServerTransport, Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_ALLOWED = (process.env.SAFEEXEC_ALLOWED || "node,npm,pnpm,yarn,python,uv,pip,rg,git,go,bun,deno,bash,sh")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const WORKDIR = process.env.SAFEEXEC_WORKDIR || process.cwd();
const MAX_MS = Math.max(1000, parseInt(process.env.SAFEEXEC_TIMEOUT_MS || "600000", 10)); // default 10 min
const LOG_PATH = process.env.SAFEEXEC_LOG || path.join(process.cwd(), "safeexec.log.jsonl");

// basic append-only audit log
function log(evt) {
  try { fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...evt }) + "\n"); }
  catch (_) {}
}

function inWorkspace(p) {
  const target = path.resolve(WORKDIR, p || ".");
  const base = path.resolve(WORKDIR);
  return target.startsWith(base);
}

function runChild({ cmd, args = [], cwd = WORKDIR, env = {}, background = false }) {
  if (!DEFAULT_ALLOWED.includes(cmd)) {
    const msg = `Command '${cmd}' is not in allow-list`;
    log({ kind: "reject", cmd, args, cwd, reason: msg });
    throw new Error(msg);
  }
  if (!inWorkspace(cwd)) {
    const msg = `CWD '${cwd}' escapes workspace fence`;
    log({ kind: "reject", cmd, args, cwd, reason: msg });
    throw new Error(msg);
  }

  // no shell by default; pass raw argv
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: background ? "ignore" : "pipe",
    shell: false,
    detached: false
  });

  const started = Date.now();
  let stdout = "";
  let stderr = "";

  if (!background) {
    child.stdout?.on("data", d => { stdout += d.toString(); });
    child.stderr?.on("data", d => { stderr += d.toString(); });
  }

  const timer = setTimeout(() => {
    try { child.kill("SIGKILL"); } catch {}
  }, MAX_MS);

  return new Promise((resolve) => {
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const dur = Date.now() - started;
      log({ kind: "exit", cmd, args, cwd, code, signal, dur, bytesOut: stdout.length, bytesErr: stderr.length });
      resolve({ code, signal, duration_ms: dur, stdout: background ? "" : stdout, stderr: background ? "" : stderr });
    });
    if (background) {
      // detach immediately; caller can’t stream background output in this minimal server
      log({ kind: "background", cmd, args, cwd });
      resolve({ code: 0, signal: null, duration_ms: 0, stdout: "", stderr: "" });
    }
  });
}

const tools = [
  {
    name: "safe_run",
    description: "Run an allowed binary with args. No shell. Fenced to workspace.",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { type: "string", description: "Binary to run (must be in allow-list)" },
        args: { type: "array", items: { type: "string" }, default: [] },
        cwd: { type: "string", description: "Working directory (within workspace)", default: WORKDIR },
        env: { type: "object", additionalProperties: { type: "string" }, default: {} }
      },
      required: ["cmd"]
    }
  },
  {
    name: "safe_start_process",
    description: "Start an allowed binary in background (fire-and-forget).",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { type: "string" },
        args: { type: "array", items: { type: "string" }, default: [] },
        cwd: { type: "string", default: WORKDIR },
        env: { type: "object", additionalProperties: { type: "string" }, default: {} }
      },
      required: ["cmd"]
    }
  }
];

const server = new Server(
  { name: "mcp-safe-exec", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler("tools/list", async () => ({ tools }));

server.setRequestHandler("tools/call", async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "safe_run") {
    const result = await runChild({ cmd: args.cmd, args: args.args || [], cwd: args.cwd, env: args.env, background: false });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  if (name === "safe_start_process") {
    const result = await runChild({ cmd: args.cmd, args: args.args || [], cwd: args.cwd, env: args.env, background: true });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  throw new Error(`Unknown tool ${name}`);
});

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  log({ kind: "ready", allowed: DEFAULT_ALLOWED, workdir: WORKDIR, max_ms: MAX_MS, log: LOG_PATH });
}).catch((e) => {
  log({ kind: "fatal", error: String(e) });
  process.exit(1);
});

3) (Optional) Docker variant — docker/safe-exec/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY mcp/safe-exec/package.json ./package.json
RUN npm i --omit=dev
COPY mcp/safe-exec/server.mjs ./server.mjs
ENV SAFEEXEC_WORKDIR=/workspace \
    SAFEEXEC_TIMEOUT_MS=600000
ENTRYPOINT ["node","/app/server.mjs"]

4) Extend your existing docker-compose.yml (if you want the containerized SafeExec)

Add this service next to Desktop Commander:

  safe-exec:
    build: ./docker/safe-exec
    stdin_open: true
    tty: true
    volumes:
      - ${WORKSPACE:?set WORKSPACE}:/workspace
      - safeexec_logs:/logs
    environment:
      SAFEEXEC_ALLOWED: ${SAFEEXEC_ALLOWED:-node,npm,pnpm,yarn,python,uv,pip,rg,git,go}
      SAFEEXEC_WORKDIR: /workspace
      SAFEEXEC_TIMEOUT_MS: ${SAFEEXEC_TIMEOUT_MS:-600000}
      SAFEEXEC_LOG: /logs/safeexec.log.jsonl

volumes:
  safeexec_logs:

Wire it into TRAE

Update .trae/mcp.json to include SafeExec alongside Desktop Commander.

If you’re using NPX for Desktop Commander:

{
  "mcpServers": [
    {
      "name": "desktop-commander",
      "command": ["npx", "-y", "@wonderwhy-er/desktop-commander@latest"],
      "env": { "DC_ALLOWED_DIRS": "${workspaceFolder}" }
    },
    {
      "name": "safe-exec",
      "command": ["node", "mcp/safe-exec/server.mjs"],
      "env": {
        "SAFEEXEC_ALLOWED": "node,npm,pnpm,yarn,python,uv,pip,rg,git,go",
        "SAFEEXEC_WORKDIR": "${workspaceFolder}",
        "SAFEEXEC_TIMEOUT_MS": "600000",
        "SAFEEXEC_LOG": "${workspaceFolder}/.logs/safeexec.log.jsonl"
      }
    }
  ]
}


If you’re using Docker for both:

{
  "mcpServers": [
    {
      "name": "desktop-commander-docker",
      "command": ["docker","compose","-f","docker/desktop-commander/docker-compose.yml","run","--rm","desktop-commander"],
      "env": { "WORKSPACE": "${workspaceFolder}" }
    },
    {
      "name": "safe-exec-docker",
      "command": ["docker","compose","run","--rm","safe-exec"],
      "env": { "WORKSPACE": "${workspaceFolder}" }
    }
  ]
}

Strengthen project rules

Append this to .trae/project_rules.md:

## SafeExec policy
- Use **safe_run**/**safe_start_process** (SafeExec MCP) for *all* command execution.
- Do **not** call Desktop Commander’s raw run/exec tools unless explicitly approved.
- If a command is rejected for being outside the allow-list, propose the minimal change to `SAFEEXEC_ALLOWED` and request approval.
- Keep working dir inside `${workspaceFolder}`; do not attempt to escape the fence.

Makefile helpers

Add targets to support install/build:

safeexec-install:
	cd mcp/safe-exec && npm i

safeexec-run:
	node mcp/safe-exec/server.mjs

safeexec-docker-build:
	docker compose build safe-exec

safeexec-docker-up:
	WORKSPACE=$$(pwd) docker compose run --rm safe-exec

First-run checklist (hand this to your agent)

Install deps
make safeexec-install

Smoke test (stdio)
Ask TRAE: “Use safe_run to execute node -v; then rg --version.”

Fence test
Try safe_run with cmd: "cat" (should be rejected unless you add cat to the allow-list).

Timeout test
Run a command that sleeps 15m; confirm it’s killed around the configured timeout (10m by default).

Background test
safe_start_process for python -m http.server 8080, then kill it via Desktop Commander’s process tool (allowed).

Open PR
Commit new files and open chore(safe-exec): add allow-list MCP + rules.

Tuning the allow-list

Update .trae/mcp.json → SAFEEXEC_ALLOWED (comma-separated).

Keep it tight: add new binaries only when necessary (e.g., cargo, make).

Prefer safe_run with explicit args rather than bash -lc "<string>". If you must use shell features, add bash but keep the command minimal and auditable.

Notes & limits

This minimal server doesn’t stream logs for background processes; it’s intentionally simple. Use Desktop Commander’s process tools to tail/manage long runners.

No secret redaction—avoid printing tokens; rely on your repo’s .env handling.

If you need richer policy (regex-based arg filters, per-role policies), we can add a policy.json file and validate against it before spawn.