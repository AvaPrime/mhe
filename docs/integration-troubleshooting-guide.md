# Integration Troubleshooting Guide

This guide provides comprehensive troubleshooting information for SafeExec and Desktop Commander integration scenarios.

## Table of Contents

1. [Common Integration Issues](#common-integration-issues)
2. [Version Compatibility Problems](#version-compatibility-problems)
3. [Network and Connectivity Issues](#network-and-connectivity-issues)
4. [Permission and Security Issues](#permission-and-security-issues)
5. [Performance and Timeout Issues](#performance-and-timeout-issues)
6. [Monitoring and Logging Issues](#monitoring-and-logging-issues)
7. [Configuration Problems](#configuration-problems)
8. [Emergency Recovery Procedures](#emergency-recovery-procedures)

---

## Common Integration Issues

### Issue: SafeExec and Desktop Commander Version Mismatch

**Symptoms:**
- Commands fail with version compatibility errors
- MCP server startup failures
- Inconsistent behavior between systems

**Diagnosis:**
```bash
# Check SafeExec version
node mcp/safe-exec/scripts/version-manager.js --check

# Check Desktop Commander version
node mcp/desktop-commander/scripts/version-check.js

# Compare versions
node monitoring/unified-monitor.js --version-report
```

**Resolution:**
1. Update both systems to compatible versions:
   ```bash
   # Update SafeExec
   cd mcp/safe-exec
   node scripts/version-manager.js --update --target=0.5.0
   
   # Update Desktop Commander
   cd mcp/desktop-commander
   node scripts/version-manager.js --update --target=0.5.0
   ```

2. Verify compatibility:
   ```bash
   node monitoring/unified-monitor.js --health-check --all
   ```

### Issue: MCP Server Communication Failures

**Symptoms:**
- "Server not responding" errors
- Timeout during MCP calls
- Intermittent connection drops

**Diagnosis:**
```bash
# Check MCP server status
node monitoring/unified-monitor.js --status mcp

# Test connectivity
node mcp/safe-exec/scripts/health-check.js
node mcp/desktop-commander/scripts/health-check.js

# Review connection logs
node monitoring/unified-monitor.js --logs mcp --filter="connection"
```

**Resolution:**
1. Restart MCP servers:
   ```bash
   # Graceful restart
   node monitoring/unified-monitor.js --restart mcp --graceful
   ```

2. Check firewall and network settings
3. Verify MCP configuration in TRAE IDE

---

## Version Compatibility Problems

### Issue: Dependency Version Conflicts

**Symptoms:**
- Module loading errors
- Runtime exceptions during startup
- Feature incompatibility warnings

**Diagnosis:**
```bash
# Generate dependency report
node scripts/dependency-analyzer.js --report

# Check for conflicts
node scripts/dependency-analyzer.js --conflicts

# Validate package integrity
npm audit --audit-level=moderate
```

**Resolution:**
1. Update dependencies to compatible versions:
   ```bash
   npm update --save
   npm audit fix
   ```

2. Use version pinning:
   ```bash
   # Pin specific versions
   node scripts/version-manager.js --pin-dependencies
   ```

### Issue: Node.js Version Incompatibility

**Symptoms:**
- Syntax errors on startup
- Missing API warnings
- Performance degradation

**Diagnosis:**
```bash
# Check Node.js version
node --version

# Verify minimum requirements
node scripts/version-manager.js --check-runtime
```

**Resolution:**
1. Update Node.js to supported version (≥20.0.0)
2. Use Node Version Manager (nvm) for version management
3. Update package.json engines field

---

## Network and Connectivity Issues

### Issue: Proxy Configuration Problems

**Symptoms:**
- Network requests timeout
- SSL certificate errors
- Connection refused errors

**Diagnosis:**
```bash
# Test network connectivity
node scripts/network-test.js

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY

# Verify SSL certificates
node scripts/ssl-check.js
```

**Resolution:**
1. Configure proxy settings:
   ```bash
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=https://proxy.company.com:8080
   export NO_PROXY=localhost,127.0.0.1
   ```

2. Update npm proxy configuration:
   ```bash
   npm config set proxy http://proxy.company.com:8080
   npm config set https-proxy https://proxy.company.com:8080
   ```

### Issue: Firewall Blocking Connections

**Symptoms:**
- Connection timeouts
- Port access denied
- Intermittent connectivity

**Diagnosis:**
```bash
# Test port connectivity
telnet localhost 3000
telnet localhost 8080

# Check listening ports
netstat -an | grep LISTEN
```

**Resolution:**
1. Configure firewall rules
2. Use alternative ports if blocked
3. Enable port forwarding if needed

---

## Permission and Security Issues

### Issue: File System Permission Errors

**Symptoms:**
- "Permission denied" errors
- Cannot write to log files
- Configuration file access failures

**Diagnosis:**
```bash
# Check file permissions
ls -la mcp/safe-exec/
ls -la mcp/desktop-commander/

# Test write permissions
node scripts/permission-test.js
```

**Resolution:**
1. Fix file permissions:
   ```bash
   # Make scripts executable
   chmod +x mcp/safe-exec/scripts/*.js
   chmod +x mcp/desktop-commander/scripts/*.js
   
   # Fix directory permissions
   chmod 755 logs/
   chmod 644 config/*.json
   ```

2. Run with appropriate user privileges
3. Use sudo only when necessary

### Issue: Security Policy Violations

**Symptoms:**
- Commands blocked by policy
- Security warnings in logs
- Audit failures

**Diagnosis:**
```bash
# Check security policies
node mcp/safe-exec/policy-linter.mjs --analyze

# Review audit logs
node monitoring/unified-monitor.js --logs security

# Validate policy configuration
node mcp/safe-exec/policy-linter.mjs --validate
```

**Resolution:**
1. Update security policies as needed
2. Review and approve policy changes
3. Implement least-privilege access

---

## Performance and Timeout Issues

### Issue: Command Execution Timeouts

**Symptoms:**
- Commands timeout before completion
- Slow response times
- Resource exhaustion

**Diagnosis:**
```bash
# Check timeout configuration
node scripts/config-analyzer.js --timeouts

# Monitor resource usage
node monitoring/unified-monitor.js --metrics --live

# Analyze performance logs
node monitoring/unified-monitor.js --logs performance
```

**Resolution:**
1. Adjust timeout settings:
   ```json
   {
     "timeouts": {
       "command": 300000,
       "network": 30000,
       "startup": 60000
     }
   }
   ```

2. Optimize resource usage:
   ```bash
   # Enable performance monitoring
   node monitoring/unified-monitor.js --enable-profiling
   ```

### Issue: Memory Leaks and Resource Exhaustion

**Symptoms:**
- Increasing memory usage over time
- System slowdown
- Out of memory errors

**Diagnosis:**
```bash
# Monitor memory usage
node monitoring/unified-monitor.js --memory-profile

# Generate heap dump
node --inspect scripts/memory-analyzer.js

# Check for memory leaks
node scripts/leak-detector.js
```

**Resolution:**
1. Restart services periodically
2. Implement memory limits
3. Fix identified memory leaks

---

## Monitoring and Logging Issues

### Issue: Log Files Not Being Created

**Symptoms:**
- Missing log files
- Empty log directories
- No monitoring data

**Diagnosis:**
```bash
# Check log configuration
node monitoring/unified-monitor.js --config-check

# Verify log directory permissions
ls -la logs/

# Test log writing
node scripts/log-test.js
```

**Resolution:**
1. Create log directories:
   ```bash
   mkdir -p logs/safeexec
   mkdir -p logs/desktop-commander
   mkdir -p logs/monitoring
   ```

2. Fix permissions:
   ```bash
   chmod 755 logs/
   chmod 644 logs/*.log
   ```

### Issue: Monitoring Dashboard Not Updating

**Symptoms:**
- Stale monitoring data
- Dashboard shows "No Data"
- Metrics not being collected

**Diagnosis:**
```bash
# Check monitoring service status
node monitoring/unified-monitor.js --status

# Test metrics collection
node monitoring/unified-monitor.js --test-metrics

# Verify data pipeline
node monitoring/unified-monitor.js --pipeline-check
```

**Resolution:**
1. Restart monitoring services:
   ```bash
   node monitoring/unified-monitor.js --restart
   ```

2. Clear cache and rebuild:
   ```bash
   node monitoring/unified-monitor.js --clear-cache --rebuild
   ```

---

## Configuration Problems

### Issue: Invalid Configuration Files

**Symptoms:**
- Startup failures
- Configuration validation errors
- Default settings being used

**Diagnosis:**
```bash
# Validate all configurations
node scripts/config-validator.js --all

# Check JSON syntax
node -e "console.log(JSON.parse(require('fs').readFileSync('config/error-handling.json')))"

# Compare with defaults
node scripts/config-diff.js
```

**Resolution:**
1. Fix JSON syntax errors
2. Restore from backup if needed
3. Regenerate default configuration:
   ```bash
   node scripts/config-generator.js --reset
   ```

### Issue: Environment Variable Conflicts

**Symptoms:**
- Unexpected behavior
- Configuration overrides not working
- Environment-specific issues

**Diagnosis:**
```bash
# List all environment variables
env | grep SAFEEXEC
env | grep DESKTOP_COMMANDER

# Check for conflicts
node scripts/env-analyzer.js --conflicts
```

**Resolution:**
1. Clean up environment variables
2. Use .env files for configuration
3. Document required variables

---

## Emergency Recovery Procedures

### Complete System Reset

**When to use:** System is completely non-functional

**Steps:**
1. Stop all services:
   ```bash
   node monitoring/unified-monitor.js --stop-all
   ```

2. Backup current configuration:
   ```bash
   node scripts/backup-manager.js --create-emergency-backup
   ```

3. Reset to known good state:
   ```bash
   node scripts/system-reset.js --to-last-known-good
   ```

4. Restart services:
   ```bash
   node monitoring/unified-monitor.js --start-all
   ```

### Rollback to Previous Version

**When to use:** New version causing issues

**Steps:**
1. Identify previous stable version:
   ```bash
   node scripts/version-manager.js --list-stable
   ```

2. Rollback:
   ```bash
   node scripts/version-manager.js --rollback --version=0.4.9
   ```

3. Verify rollback:
   ```bash
   node monitoring/unified-monitor.js --health-check --all
   ```

### Data Recovery

**When to use:** Configuration or data corruption

**Steps:**
1. Stop affected services
2. Restore from backup:
   ```bash
   node scripts/backup-manager.js --restore --timestamp=latest
   ```
3. Verify data integrity
4. Restart services

---

## Getting Help

### Log Analysis

For detailed troubleshooting, analyze logs:

```bash
# Generate comprehensive log report
node monitoring/unified-monitor.js --log-report --last=24h

# Search for specific errors
node monitoring/unified-monitor.js --search "error|timeout|failed"

# Export logs for support
node monitoring/unified-monitor.js --export-logs --format=json
```

### Health Check Report

Generate a complete system health report:

```bash
node scripts/health-reporter.js --comprehensive --output=health-report.json
```

### Support Information

When contacting support, include:
- System health report
- Recent error logs
- Configuration files (sanitized)
- Steps to reproduce the issue
- Expected vs actual behavior

---

*This guide is maintained as part of the SafeExec and Desktop Commander integration documentation. For updates and additional troubleshooting scenarios, refer to the project documentation.*