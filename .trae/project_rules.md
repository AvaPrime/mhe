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

## Security Guidelines

### Input Validation
- **Always validate and sanitize all user inputs** before processing
- **Parameter validation**: Check data types, ranges, and formats for all parameters
- **Injection prevention**: Use parameterized queries and escape special characters
- **Path traversal protection**: Validate file paths and prevent directory traversal attacks
- **Command injection prevention**: Sanitize inputs used in system commands
- **SQL injection prevention**: Use prepared statements and input validation
- **XSS prevention**: Escape HTML/JavaScript content in web outputs
- **File upload validation**: Check file types, sizes, and content before processing

### Data Sanitization
- Remove or escape dangerous characters from user inputs
- Validate against allowlists rather than denylists when possible
- Implement proper encoding for different contexts (HTML, URL, SQL, etc.)
- Use established libraries for sanitization rather than custom implementations

### Error Handling
- Never expose sensitive information in error messages
- Log security events for monitoring and analysis
- Implement proper exception handling to prevent information disclosure
- Use generic error messages for user-facing responses

## Logs & provenance
- Summarize: inputs, commands, touched files, outputs, and follow-ups.