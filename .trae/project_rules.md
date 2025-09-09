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