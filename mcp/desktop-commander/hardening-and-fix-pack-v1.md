Desktop Commander MCP — Hardening & NPX Fix Pack v1

Goals

✅ Add no-new-privileges, drop caps, non-root user, read-only rootfs, PID caps, log rotation

✅ Fix world-writable perms (.trae, docker/)

✅ Secure env files & .gitignore

✅ Make NPX path reliable and fast (pinned version + warm cache)

✅ Enforce SafeExec++ for command execution

1) Docker hardening (runtime)

docker/desktop-commander/docker-compose.yml (replace your previous one)

version: "3.9"
services:
  desktop-commander:
    build: .
    stdin_open: true
    tty: true
    user: "1000:1000"                # run as non-root
    read_only: true                  # immutable root fs
    # workspace is the only writable surface
    volumes:
      - ${WORKSPACE:?set WORKSPACE}:/workspace:rw
      - dc_npm_cache:/home/dev/.npm:rw
      - type: tmpfs                  # scratch for node/npm
        target: /tmp
        tmpfs:
          size: 64m
          mode: 1777
    working_dir: /workspace
    environment:
      DC_ALLOWED_DIRS: /workspace
      npm_config_cache: /home/dev/.npm
    security_opt:
      - no-new-privileges:true
    cap_drop: ["ALL"]                # drop every capability
    pids_limit: 128
    stop_grace_period: 10s
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1g
        reservations:
          cpus: "0.25"
          memory: 256m
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  dc_npm_cache:


docker/desktop-commander/Dockerfile (non-root base stays)

FROM node:20-alpine
RUN addgroup -S dev && adduser -S dev -G dev
USER dev
WORKDIR /home/dev/app
ENV npm_config_cache=/home/dev/.npm
ENTRYPOINT ["npx","-y","@wonderwhy-er/desktop-commander@latest"]


Hardening notes: non-root, read-only rootfs, no-new-privileges, drop all caps, PID limit, tmpfs /tmp, log rotation.

2) NPX path: make it reliable & fast

.trae/mcp.json (add/repair NPX entry and pin a version)

{
  "mcpServers": [
    {
      "name": "desktop-commander",
      "command": ["npx", "-y", "@wonderwhy-er/desktop-commander@0.5.0"],
      "env": {
        "DC_ALLOWED_DIRS": "${workspaceFolder}",
        "npm_config_cache": "${workspaceFolder}/.cache/npm"
      }
    },
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


Why this fixes timeouts: pinning avoids repeated metadata resolution; local npm cache under .cache/npm warms once and makes subsequent spawns fast.

3) Permissions & secrets hygiene

scripts/fix_perms.sh

#!/usr/bin/env bash
set -euo pipefail
root="${1:-$(pwd)}"
echo "Fixing permissions under: $root"
# Directories 755, files 644; tighten special dirs
find "$root" -type d -exec chmod 755 {} \;
find "$root" -type f -exec chmod 644 {} \;

# Tighten agent control surfaces
chmod 750 "$root/.trae" 2>/dev/null || true
chmod 750 "$root/docker" 2>/dev/null || true
mkdir -p "$root/.logs" "$root/.cache/npm"
chmod 750 "$root/.logs" "$root/.cache" 2>/dev/null || true
chmod 700 "$root/.cache/npm" 2>/dev/null || true

echo "Done."


Windows PowerShell fallback (optional):

# scripts\fix_perms.ps1
$root = (Get-Location).Path
icacls $root /T /Q /C /grant:r "$($env:USERNAME):(RX)"
icacls "$root\.trae","$root\docker","$root\.logs","$root\.cache" /T /Q /C /grant:r "$($env:USERNAME):(F)"


.gitignore (append)

.logs/
.cache/
.env
.env.*
safeexec.log.jsonl
npm-debug.log*

4) Project rules (enforce SafeExec++)

.trae/project_rules.md (append)

## Execution policy (enforced)
- Prefer **SafeExec++** for *all* commands.
- Destructive or networked operations: `safe_plan` ➜ human review ➜ `safe_apply_plan`.
- Desktop Commander process tools allowed for tail/kill only.
- Never store secrets in repo; use `.env` and keep it gitignored.

5) Runbook (hand this to your agent)
# Runbook — Hardening & NPX Fix Pack v1

1) Ensure Node + Docker available:
   - `node -v`, `docker --version`, `docker compose version`

2) Create/overwrite files from the Fix Pack:
   - docker/desktop-commander/Dockerfile
   - docker/desktop-commander/docker-compose.yml
   - .trae/mcp.json
   - .trae/project_rules.md (append)
   - scripts/fix_perms.sh (+ scripts/fix_perms.ps1 if Windows)
   - .gitignore (append)

3) Apply permissions:
   - Linux/WSL/macOS: `bash scripts/fix_perms.sh`
   - Windows (if needed): `powershell -ExecutionPolicy Bypass -File scripts\fix_perms.ps1`

4) Docker sanity:
   - `WORKSPACE=$(pwd) docker compose -f docker/desktop-commander/docker-compose.yml build`
   - `WORKSPACE=$(pwd) docker compose -f docker/desktop-commander/docker-compose.yml run --rm desktop-commander --version` (just to spawn/exit)

5) TRAE test (NPX path):
   - Ask: “Use Desktop Commander (npx) to run `pwd && node -v`.”
   - Confirm it’s fast after cache warm.

6) SafeExec++ enforcement:
   - Plan a benign command: `safe_plan { cmd: "rg", args: ["--version"] }`
   - Apply plan: `safe_apply_plan` with returned `plan_id` and `approval_token`.
   - Try a denied op: plan `git push` → expect rejection.

7) Commit + PR:
   - Branch: `chore/mcp-hardening-npx-fixpack-v1`
   - Commit message: `chore(mcp): harden Docker (nnp, caps, ro fs) + NPX pin/cache + perms + rules`

6) Optional: Cloud-run pattern (zero Desktop overhead)

When Docker Desktop feels heavy:

Build once on CI to a small runtime image (Node 20-alpine + preinstalled Desktop Commander).

Expose via stdio over SSH tunnel to the agent workstation, or run the MCP server in SSE mode behind an authenticated port.

Keep the runtime container with read_only: true, cap_drop: ["ALL"], no-new-privileges:true, and no outbound network at runtime.

If you want, I can add a GitHub Actions workflow that builds the hardened image and provides a one-line ssh -L launcher.

7) Mapping to your findings

no-new-privileges: now set in compose ✅

World-writable perms: fix_perms.sh resets to 755/644, tightens .trae/docker/.logs ✅

Over-permissive 777: same script + rules ✅

NPX timeouts/missing config: pinned version + warm cache + validated .trae/mcp.json ✅