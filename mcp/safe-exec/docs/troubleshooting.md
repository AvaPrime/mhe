# SafeExec Troubleshooting Guide

This document provides specific troubleshooting information for SafeExec++ MCP server and policy enforcement system.

## Quick Diagnostics

### Health Check
```bash
# Run comprehensive health check
node scripts/health-check.js --comprehensive

# Check specific components
node scripts/health-check.js --component=policy
node scripts/health-check.js --component=mcp
node scripts/health-check.js --component=logging
```

### System Status
```bash
# Check SafeExec status
node ../monitoring/unified-monitor.js --status safeexec

# View recent activity
node ../monitoring/unified-monitor.js --logs safeexec --tail 50

# Check version and configuration
node scripts/version-manager.js --status
```

---

## Common Issues

### 1. Policy Validation Failures

**Symptoms:**
- "Policy validation failed" errors
- Commands rejected unexpectedly
- Schema validation errors

**Diagnosis:**
```bash
# Validate policy against schema
node policy-linter.mjs --validate --policy policy.json --schema policy.schema.json

# Analyze policy for issues
node policy-linter.mjs --analyze --policy policy.json --fail-on=medium

# Check policy syntax
node -e "console.log(JSON.parse(require('fs').readFileSync('policy.json')))"
```

**Common Fixes:**
- Fix JSON syntax errors in policy.json
- Ensure all required schema fields are present
- Validate role definitions and permissions
- Check for typos in binary names or flags

### 2. Command Execution Denied

**Symptoms:**
- "Command denied by policy" errors
- Unexpected permission rejections
- Role-based access failures

**Diagnosis:**
```bash
# Test command with specific role
node scripts/policy-tester.js --cmd="git status" --role=reviewer

# Check deny flags
node scripts/policy-tester.js --check-flags="--force"

# Validate workspace fence
node scripts/policy-tester.js --check-fence="/path/to/workspace"
```

**Resolution Steps:**
1. Verify the command is allowed for your role:
   ```json
   {
     "roles": {
       "builder": {
         "allowedBinaries": ["git", "node", "npm"]
       }
     }
   }
   ```

2. Check for denied flags:
   ```json
   {
     "denyFlags": ["--force", "--unsafe-perm"]
   }
   ```

3. Ensure workspace fence compliance:
   - Commands must run within the configured workspace
   - Check SAFEEXEC_WORKDIR environment variable

### 3. MCP Server Connection Issues

**Symptoms:**
- "MCP server not responding" errors
- Timeout during server startup
- Connection refused errors

**Diagnosis:**
```bash
# Check MCP server process
ps aux | grep server.mjs

# Test MCP protocol
node scripts/mcp-test.js --ping

# Check server logs
tail -f .logs/safeexec.log.jsonl
```

**Resolution:**
1. Restart MCP server:
   ```bash
   # Kill existing process
   pkill -f "server.mjs"
   
   # Start server
   node server.mjs
   ```

2. Check TRAE IDE configuration:
   ```json
   {
     "mcpServers": [
       {
         "name": "safe-exec",
         "command": ["node", "mcp/safe-exec/server.mjs"],
         "env": {
           "SAFEEXEC_ROLE": "builder",
           "SAFEEXEC_WORKDIR": "${workspaceFolder}"
         }
       }
     ]
   }
   ```

### 4. Timeout and Performance Issues

**Symptoms:**
- Commands timeout before completion
- Slow response times
- "Operation timed out" errors

**Diagnosis:**
```bash
# Check timeout configuration
node scripts/config-analyzer.js --timeouts

# Monitor performance
node ../monitoring/unified-monitor.js --metrics safeexec

# Check system resources
node scripts/resource-monitor.js
```

**Resolution:**
1. Adjust timeout settings in error-handling.json:
   ```json
   {
     "timeouts": {
       "command": 300000,
       "network": 30000,
       "startup": 60000
     }
   }
   ```

2. Enable circuit breaker for failing commands:
   ```json
   {
     "circuitBreaker": {
       "enabled": true,
       "failureThreshold": 5,
       "resetTimeout": 60000
     }
   }
   ```

### 5. Logging and Audit Issues

**Symptoms:**
- Missing audit logs
- Log files not being created
- Incomplete logging information

**Diagnosis:**
```bash
# Check log file permissions
ls -la .logs/

# Test log writing
node scripts/log-test.js

# Verify log configuration
echo $SAFEEXEC_LOG
```

**Resolution:**
1. Create log directory:
   ```bash
   mkdir -p .logs
   chmod 755 .logs
   ```

2. Set proper environment variables:
   ```bash
   export SAFEEXEC_LOG="$(pwd)/.logs/safeexec.log.jsonl"
   ```

3. Check disk space and permissions

---

## Advanced Troubleshooting

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Set debug environment
export DEBUG=safeexec:*
export SAFEEXEC_DEBUG=true

# Start server with debug output
node server.mjs 2>&1 | tee debug.log
```

### Policy Testing

Test policy changes before deployment:

```bash
# Dry run policy validation
node policy-linter.mjs --dry-run --policy policy-new.json

# Compare policies
node scripts/policy-diff.js --old=policy.json --new=policy-new.json

# Test specific scenarios
node scripts/policy-simulator.js --scenario=git-operations
```

### Performance Profiling

Profile SafeExec performance:

```bash
# Enable profiling
node --prof server.mjs

# Generate profile report
node --prof-process isolate-*.log > profile.txt

# Memory usage analysis
node --inspect server.mjs
```

### Error Recovery

Recover from various error states:

```bash
# Reset to default configuration
node scripts/reset-config.js --confirm

# Clear all cached data
node scripts/clear-cache.js --all

# Rebuild policy index
node scripts/rebuild-policy-index.js
```

---

## Integration-Specific Issues

### Desktop Commander Integration

**Issue:** Version mismatch between SafeExec and Desktop Commander

**Solution:**
```bash
# Check version compatibility
node scripts/version-manager.js --check-compatibility desktop-commander

# Sync versions
node scripts/version-manager.js --sync-with desktop-commander
```

### TRAE IDE Integration

**Issue:** MCP server not appearing in TRAE

**Solution:**
1. Verify MCP configuration in `.trae/mcp.json`
2. Restart TRAE IDE
3. Check server logs for startup errors
4. Validate environment variables

### CI/CD Integration

**Issue:** Policy validation failing in CI

**Solution:**
```bash
# Run CI validation locally
node scripts/ci-validator.js --simulate

# Check CI environment variables
node scripts/ci-env-check.js

# Generate CI-compatible policy report
node policy-linter.mjs --format=junit --output=policy-results.xml
```

---

## Emergency Procedures

### Complete Reset

When SafeExec is completely non-functional:

```bash
# 1. Stop all processes
pkill -f "server.mjs"

# 2. Backup current state
cp -r . ../safeexec-backup-$(date +%Y%m%d-%H%M%S)

# 3. Reset to defaults
node scripts/emergency-reset.js --confirm

# 4. Restart with minimal configuration
node server.mjs --safe-mode
```

### Policy Rollback

Rollback to previous working policy:

```bash
# List available policy backups
node scripts/policy-backup.js --list

# Rollback to specific version
node scripts/policy-backup.js --restore --version=20240115-143022

# Validate restored policy
node policy-linter.mjs --validate --policy policy.json
```

---

## Getting Support

### Information to Collect

Before seeking support, collect:

```bash
# Generate support bundle
node scripts/support-bundle.js --output=safeexec-support.zip

# This includes:
# - System information
# - Configuration files (sanitized)
# - Recent logs
# - Policy validation results
# - Version information
```

### Log Analysis

Analyze logs for patterns:

```bash
# Search for errors
grep -i "error\|failed\|denied" .logs/safeexec.log.jsonl

# Count error types
node scripts/log-analyzer.js --count-errors

# Generate error report
node scripts/log-analyzer.js --error-report --last=24h
```

### Performance Metrics

Collect performance data:

```bash
# Generate performance report
node ../monitoring/unified-monitor.js --performance-report safeexec

# Export metrics
node ../monitoring/unified-monitor.js --export-metrics --format=csv
```

---

## Prevention

### Regular Maintenance

```bash
# Weekly health check
node scripts/weekly-maintenance.js

# Policy validation
node policy-linter.mjs --analyze --policy policy.json

# Log rotation
node scripts/log-rotate.js --keep=30

# Update dependencies
npm audit && npm update
```

### Monitoring Setup

```bash
# Enable continuous monitoring
node ../monitoring/unified-monitor.js --enable safeexec

# Set up alerts
node ../monitoring/unified-monitor.js --alert-config safeexec

# Configure health checks
node scripts/setup-health-monitoring.js
```

---

*For additional help, refer to the main integration troubleshooting guide or contact the development team with your support bundle.*