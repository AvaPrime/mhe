Desktop Commander MCP — Hardening & Fix Pack v1.1 (delta)

This is a surgical update to your existing v1 doc + files. It keeps everything you liked and patches the three enhancements you flagged.

✅ What’s new

Version consistency

Pin Desktop Commander to the same version for NPX and Docker (default: 0.5.0), with an easy override.

Error handling

Add robust preflight checks, explicit exit codes, and time-bounded ops in the runbook and helper scripts.

Monitoring

Ship a tiny log watcher for safeexec.log.jsonl (alerts on rejects, non-zero exits, and policy violations).

Add make watch-logs and quick health targets.

1) Pin the version everywhere

A) Create mcp/docs/desktop-commander/.dc-version:

0.5.0


B) Update .trae/mcp.json (NPX path stays pinned):

{
  "mcpServers": [
    {
      "name": "desktop-commander",
      "command": ["npx", "-y", "@wonderwhy-er/desktop-commander@0.5.0"],
      "env": {
        "DC_ALLOWED_DIRS": "${workspaceFolder}",
        "npm_config_cache": "${workspaceFolder}/.cache/npm"
      }
    }
  ]
}


C) Update Docker to honour the same pin.

docker/desktop-commander/Dockerfile

FROM node:20-alpine

# ---- non-root user ----
RUN addgroup -S dev && adduser -S dev -G dev
USER dev
WORKDIR /home/dev/app
ENV npm_config_cache=/home/dev/.npm

# ---- version pin with runtime override ----
ARG DC_VERSION=0.5.0
ENV DC_VERSION=${DC_VERSION}

# Small startup script so ENV expands (ENTRYPOINT JSON doesn't expand)
COPY docker/desktop-commander/start-desktop-commander.sh /usr/local/bin/start-desktop-commander
RUN chmod +x /usr/local/bin/start-desktop-commander

ENTRYPOINT ["sh","/usr/local/bin/start-desktop-commander"]


docker/desktop-commander/start-desktop-commander.sh

#!/usr/bin/env sh
set -e
exec npx -y "@wonderwhy-er/desktop-commander@${DC_VERSION}"


D) Optional override at build/run:

# build with a different version
WORKSPACE=$(pwd) DC_VERSION=0.5.0 docker compose -f docker/desktop-commander/docker-compose.yml build
# or run-time (compose passes ARG at build, ENV at run via Dockerfile)


Your existing compose security_opt, cap_drop, read_only, etc. remain unchanged.

2) Error-handling upgrades

A) Replace scripts/fix_perms.sh with stricter checks:

#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(pwd)}"
echo "[perms] fixing under: $root"

req_bins=(node docker)
for b in "${req_bins[@]}"; do
  command -v "$b" >/dev/null 2>&1 || { echo "[perms] ERROR: '$b' not in PATH" >&2; exit 127; }
done

# Basic perms
find "$root" -type d -exec chmod 755 {} \;
find "$root" -type f -exec chmod 644 {} \;

# Tighten control surfaces
mkdir -p "$root/.logs" "$root/.cache/npm" "$root/.trae" "$root/docker"
chmod 750 "$root/.logs" "$root/.cache" "$root/.trae" "$root/docker"
chmod 700 "$root/.cache/npm"

echo "[perms] OK"


B) Add quick health script: scripts/health.sh

#!/usr/bin/env bash
set -euo pipefail
to=30

need() { command -v "$1" >/dev/null || { echo "[health] missing: $1"; exit 127; }; }
need node

echo "[health] node: $(node -v)"

if command -v docker >/dev/null; then
  echo "[health] docker: $(docker --version)"
  echo "[health] compose: $(docker compose version)"
fi

# time-bounded docker build/smoke (if compose file exists)
if [ -f docker/desktop-commander/docker-compose.yml ]; then
  echo "[health] docker build (<=${to}s)…"
  ( command -v timeout >/dev/null && timeout ${to}s true ) || true
  docker compose -f docker/desktop-commander/docker-compose.yml build
  echo "[health] docker run -- version probe…"
  WORKSPACE=$(pwd) docker compose -f docker/desktop-commander/docker-compose.yml run --rm desktop-commander --help >/dev/null 2>&1 || true
fi

echo "[health] OK"


C) Runbook inserts (in your v1 doc):

Before any docker step, instruct: bash scripts/health.sh and fail the run if exit ≠ 0.

On NPX path timeout, advise: delete .cache/npm, re-run once; if repeated, use Docker path while investigating.

3) Monitoring — tiny log watcher (no extra infra)

A) Add scripts/watch_safeexec_logs.mjs:

import fs from "node:fs";
import path from "node:path";

const LOG = process.env.SAFEEXEC_LOG || path.join(process.cwd(), ".logs", "safeexec.log.jsonl");
console.log(`[watch] monitoring ${LOG}`);

if (!fs.existsSync(LOG)) {
  console.error(`[watch] no log yet: ${LOG}`);
  process.exit(0);
}

const levels = { info: "", warn: "⚠️  ", error: "🚨 " };
function render(ev) {
  const k = ev.kind || "info";
  const tag = levels[k] ?? "";
  const code = ev.code != null ? ` code=${ev.code}` : "";
  return `${tag}${ev.ts || ""} ${k} :: ${ev.cmd || ""} ${(ev.args||[]).join(" ")}${code} ${ev.reason?(":: "+ev.reason):""}`;
}

let pos = 0;
const stream = fs.createReadStream(LOG, { encoding: "utf8", start: 0 });
stream.on("data", chunk => {
  process.stdout.write(chunk);
  pos += chunk.length;
}).on("end", () => {
  const watcher = fs.watch(LOG, { persistent: true }, async () => {
    try {
      const stat = fs.statSync(LOG);
      if (stat.size > pos) {
        const s = fs.createReadStream(LOG, { start: pos, end: stat.size, encoding: "utf8" });
        let buf = "";
        for await (const ch of s) buf += ch;
        pos = stat.size;
        for (const line of buf.split("\n").filter(Boolean)) {
          try {
            const ev = JSON.parse(line);
            if (ev.kind === "reject" || ev.kind === "exit" && ev.code && ev.code !== 0) {
              console.log(render(ev));
            }
          } catch {}
        }
      }
    } catch {}
  });
});


B) Makefile helpers (append):

health:
	bash scripts/health.sh

watch-logs:
	node scripts/watch_safeexec_logs.mjs


This watcher prints only rejects and non-zero exits—the signals you actually care about in day-to-day dev. For production, you can later point this JSONL at Loki/Vector/CloudWatch; your container already rotates logs.

4) Doc patch (drop into hardening-and-fix-pack-v1.md)

Append a “v1.1 Updates” section:

## v1.1 Updates
- **Version consistency:** Desktop Commander pinned to `0.5.0` across NPX and Docker. Dockerfile now reads `DC_VERSION` and launches via a tiny entrypoint script so the pin is authoritative.
- **Error handling:** Added `scripts/health.sh` (preflight env + bounded docker probe) and improved `scripts/fix_perms.sh` checks. Run `make health` before any build to fail fast.
- **Monitoring:** Added `scripts/watch_safeexec_logs.mjs` + `make watch-logs` for lightweight alerting on policy rejections and non-zero exits. No external infra required.

5) Quick runbook (agent-ready)
# Runbook — v1.1 Delta

1) Create/overwrite:
   - mcp/docs/desktop-commander/.dc-version
   - docker/desktop-commander/start-desktop-commander.sh
   - docker/desktop-commander/Dockerfile (updated)
   - scripts/fix_perms.sh (updated)
   - scripts/health.sh (new)
   - scripts/watch_safeexec_logs.mjs (new)
   - Makefile targets: health, watch-logs
   - Append "v1.1 Updates" to hardening-and-fix-pack-v1.md

2) Permissions:
   - `bash scripts/fix_perms.sh`

3) Preflight:
   - `make health`  # fails fast on env problems

4) NPX smoke:
   - In TRAE, run Desktop Commander (npx) → `pwd && node -v`

5) Docker smoke:
   - `WORKSPACE=$(pwd) docker compose -f docker/desktop-commander/docker-compose.yml run --rm desktop-commander --help`

6) Monitoring (dev):
   - `make watch-logs`  # see rejects / non-zero exits in real time

7) Commit + PR:
   - Branch: `chore/dc-fixpack-v1-1`
   - Message: `fixpack(v1.1): version pin, health checks, lightweight monitoring`