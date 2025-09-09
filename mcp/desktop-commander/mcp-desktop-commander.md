Desktop Commander MCP — TRAE IDE Setup

production-grade setup for TRAE IDE with Desktop Commander MCP. includes guardrails, rules, and scripts so an agent can execute safely.

Table of Contents

Recommended path

Quick start (choose A or B)

A) NPX local

B) Docker local (isolated)

TRAE configuration

Project rules (guardrails)

Makefile & scripts

Operational playbook

Troubleshooting

Security notes

Recommended path

Use NPX for everyday work: fastest startup, lowest memory, always current.

Use Docker when you want hard isolation (e.g., unknown code, risky ops). This guide caps CPU/RAM and restricts file access to your workspace.

Docker Desktop can be heavy. This setup keeps containers ephemeral and resource-limited, so it’s as gentle as Docker gets. If it still feels chunky, prefer NPX except for experiments.

Quick start (choose A or B)

Create the following files in your repo exactly as shown.

A) NPX local (lightweight)

.trae/mcp.json

{
  "mcpServers": [
    {
      "name": "desktop-commander",
      "command": ["npx", "-y", "@wonderwhy-er/desktop-commander@latest"],
      "env": {
        "DC_ALLOWED_DIRS": "${workspaceFolder}"
      }
    }
  ]
}


DC_ALLOWED_DIRS fences file tools to your project folder.

Update ${workspaceFolder} if your TRAE uses a different variable.

Initial smoke test (ask TRAE):

run pwd && node -v, then create hello.txt with “hi from TRAE” and read it back.

B) Docker local (isolated)

docker/desktop-commander/Dockerfile

FROM node:20-alpine
# Create non-root user
RUN addgroup -S dev && adduser -S dev -G dev
USER dev
WORKDIR /home/dev/app
# Cache npx downloads between runs when using a volume-mounted cache (optional)
ENV npm_config_cache=/home/dev/.npm
# Default command: run server via npx
ENTRYPOINT ["npx","-y","@wonderwhy-er/desktop-commander@latest"]


docker/desktop-commander/docker-compose.yml

version: "3.9"
services:
  desktop-commander:
    build: .
    # Attach STDIN/STDOUT for MCP stdio mode
    stdin_open: true
    tty: true
    # Sandbox: only mount the workspace, read-write
    volumes:
      - ${WORKSPACE:?set WORKSPACE env var}:/workspace
      - dc_npm_cache:/home/dev/.npm
    working_dir: /workspace
    environment:
      # Restrict file tools to /workspace (server honors this)
      DC_ALLOWED_DIRS: /workspace
    # Resource caps (tune as needed)
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1g
        reservations:
          cpus: '0.25'
          memory: 256m

volumes:
  dc_npm_cache:


.trae/mcp.json (docker)

{
  "mcpServers": [
    {
      "name": "desktop-commander-docker",
      "command": [
        "docker","compose",
        "-f","docker/desktop-commander/docker-compose.yml",
        "run","--rm","desktop-commander"
      ],
      "env": {
        "WORKSPACE": "${workspaceFolder}"
      }
    }
  ]
}


TRAE will execute MCP via stdio into the container.

Only your workspace is mounted at /workspace.

CPU/RAM caps keep Docker polite.

Update WORKSPACE if your agent runtime requires a different folder.

Smoke test (ask TRAE):

run pwd && whoami; then start a background python -m http.server 8080, list processes, and kill it.

TRAE configuration

Location: project-local config at .trae/mcp.json (as above).

You can define both servers (NPX and Docker) in the same file; select which one to use in the TRAE UI.

Optional: global config
If your TRAE supports a global MCP file (e.g., ~/.cursor/mcp.json), you can copy the same stanza there.

Project rules (guardrails)

.trae/project_rules.md

# Project Rules for Agents (Desktop Commander)

## Golden rules
1. **Stay in-bounds:** Only read/write inside `${workspaceFolder}`.
2. **No destructive ops** without an explicit plan and approval.  
   - Deletions, mass-rewrites, `git push -f`, package updates.
3. **Explain-before-execute** for commands that modify system state.
4. **Prefer dry runs** (`--check`, `--diff`, `--dry-run`) when available.
5. **Background long jobs**; then monitor and stop cleanly.

## Command policy
- Allowed commands (default): `node`, `npm|pnpm|yarn`, `python|uv`, `pip`, `rg`, `git`, `bash`, `sh`, `go`, `docker compose` (docker path only).
- Disallowed without approval: `rm -rf`, `kill -9`, network scanners, privilege escalation, system package managers.

## Git discipline
- Never commit secrets.
- For refactors: `git add -p` + clear commit message.
- Create a branch for any multi-file change.

## File editing
- Use diff-based edits where provided.
- For bulk regex replaces: run on a narrowed file set and show a preview.

## Logs & provenance
- Summarize: inputs, commands, touched files, outputs, and follow-ups.

Makefile & scripts

Makefile

# ----- NPX path -----
npx-up:
	@echo "Starting Desktop Commander via NPX..."
	@echo "TRAE will spawn it automatically from .trae/mcp.json when needed."

npx-remove:
	npx -y @wonderwhy-er/desktop-commander@latest remove || true

# ----- Docker path -----
docker-up:
	WORKSPACE=$$(pwd) docker compose -f docker/desktop-commander/docker-compose.yml run --rm desktop-commander

docker-build:
	docker compose -f docker/desktop-commander/docker-compose.yml build

docker-pull:
	docker pull node:20-alpine

# Convenience: ensure env var exists for compose
print-workspace:
	@echo "WORKSPACE=$$(pwd)"


Windows PowerShell equivalents (optional):

NPX: no action required; TRAE spawns it.

Docker (from repo root):

$env:WORKSPACE=(Get-Location).Path
docker compose -f docker/desktop-commander/docker-compose.yml build
docker compose -f docker/desktop-commander/docker-compose.yml run --rm desktop-commander

Operational playbook

Ask your TRAE agent to follow this sequence the first time:

Validate environment

node -v (for NPX path)

docker --version and docker compose version (for Docker path)

Self-check

pwd && whoami

Create mcp_check.txt with content “ok”, then read it.

Search & edit demo

Recursively search for “TODO”.

Make a diff-based edit on a single small file, show patch preview, apply patch.

Background job

Start python -m http.server 8080 in background, list processes, tail logs, then kill it.

Commit

git checkout -b chore/mcp-proof

Add .trae/*, docker/desktop-commander/*, Makefile

Commit with message: chore(mcp): Desktop Commander setup (npx+docker, rules, caps)

Open PR.

Troubleshooting

TRAE doesn’t list the server:

JSON syntax in .trae/mcp.json

Restart TRAE agent pane

Confirm npx or docker are in PATH

No output / long command stalls:

Use the background process tools and read output incrementally.

For Docker: ensure stdin_open: true and tty: true (provided).

Permission errors in Docker:

File ownership on mounted volume (Windows/WSL paths). Try running from a simple local folder (no network share) or from WSL.

Too heavy:

Prefer NPX for routine edits; use Docker only when you need isolation.

Lower resource caps in compose if necessary (cpus: 0.5, memory: 512m).

Security notes

The server is powerful by design. The sandbox comes from:

DC_ALLOWED_DIRS → file tool fencing

Docker mount to /workspace only

Resource limits (CPU/RAM caps)

Project rules the agent must obey

Secrets: keep them out of the repo; use .gitignore; never ask the agent to cat credentials.

Hand-off to your agent

Instruction to agent:

Create all files from this markdown in the repo, preserving paths.

For NPX: verify Node is installed and run the smoke tests.

For Docker: build the image, run docker-up once, and perform the smoke tests.

Enforce .trae/project_rules.md during all future actions.

Open a PR titled “Desktop Commander MCP setup”.
