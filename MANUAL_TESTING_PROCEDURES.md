# Manual Testing Procedures for Desktop Commander MCP Server

## Overview

This document provides comprehensive manual testing procedures to complement automated testing for the Desktop Commander MCP server implementation. These procedures ensure thorough validation of functionality, security, and user experience across both NPX and Docker deployment options.

## Pre-Testing Setup

### Environment Preparation

1. **Clean Environment Setup**
   - [ ] Fresh terminal session
   - [ ] Clear any existing MCP server processes
   - [ ] Verify system requirements (Node.js, Docker, etc.)
   - [ ] Document current system state

2. **Test Data Preparation**
   - [ ] Create test workspace directory
   - [ ] Prepare sample files for testing
   - [ ] Set up monitoring tools (Task Manager, htop, etc.)
   - [ ] Configure logging for manual observation

## Functional Testing Procedures

### MT-FUNC-001: NPX Deployment Manual Testing

**Objective**: Manually validate NPX deployment functionality and user experience

**Prerequisites**:
- [ ] Node.js v24.6.0+ installed
- [ ] npm v11.4.2+ available
- [ ] Clean terminal environment

**Test Steps**:

1. **Initial Deployment**
   - [ ] Execute: `npx desktop-commander-test --help`
   - [ ] Observe installation process
   - [ ] Record installation time: _____ seconds
   - [ ] Verify help output is displayed
   - [ ] Check for any error messages

2. **Server Initialization**
   - [ ] Start MCP server with: `npx desktop-commander-test`
   - [ ] Monitor console output for initialization messages
   - [ ] Verify these initialization indicators:
     - [ ] "Loading schemas.ts"
     - [ ] "Loading server.ts"
     - [ ] "Setting up request handlers"
     - [ ] "Initialized FilteredStdioServerTransport"
   - [ ] Record startup time: _____ seconds

3. **Resource Usage Monitoring**
   - [ ] Monitor CPU usage during startup
   - [ ] Monitor memory consumption
   - [ ] Record peak resource usage:
     - CPU: _____%
     - Memory: _____ MB

4. **Server Responsiveness**
   - [ ] Send test MCP request (if applicable)
   - [ ] Measure response time: _____ ms
   - [ ] Verify server remains responsive
   - [ ] Test graceful shutdown with Ctrl+C

**Expected Results**:
- [ ] Server starts without errors
- [ ] All initialization indicators present
- [ ] Resource usage within acceptable limits
- [ ] Server responds to requests promptly
- [ ] Clean shutdown process

**Actual Results**:
```
[Record observations here]
```

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

---

### MT-FUNC-002: Docker Deployment Manual Testing

**Objective**: Manually validate Docker deployment functionality and container behavior

**Prerequisites**:
- [ ] Docker v28.3.2+ installed
- [ ] Docker Compose v2.39.1+ available
- [ ] Docker daemon running
- [ ] WORKSPACE environment variable set

**Test Steps**:

1. **Container Build Process**
   - [ ] Execute: `WORKSPACE="$(pwd)" docker compose -f docker/desktop-commander/docker-compose.yml build`
   - [ ] Monitor build process output
   - [ ] Record build time: _____ seconds
   - [ ] Verify successful build completion
   - [ ] Check for any warnings or errors

2. **Container Startup**
   - [ ] Execute: `WORKSPACE="$(pwd)" docker compose -f docker/desktop-commander/docker-compose.yml up -d`
   - [ ] Verify container starts successfully
   - [ ] Check container status: `docker compose ps`
   - [ ] Record startup time: _____ seconds

3. **Container Health Check**
   - [ ] Verify container is running: `docker ps`
   - [ ] Check container logs: `docker compose logs`
   - [ ] Monitor resource usage: `docker stats`
   - [ ] Record resource metrics:
     - CPU: _____%
     - Memory: _____ MB
     - Network I/O: _____ KB

4. **Container Functionality**
   - [ ] Test MCP server accessibility (if applicable)
   - [ ] Verify file system access restrictions
   - [ ] Test container restart: `docker compose restart`
   - [ ] Verify data persistence (if applicable)

5. **Container Cleanup**
   - [ ] Stop container: `docker compose down`
   - [ ] Verify clean shutdown
   - [ ] Remove images if needed: `docker compose down --rmi all`

**Expected Results**:
- [ ] Container builds without errors
- [ ] Container starts and runs stably
- [ ] Resource usage within limits
- [ ] MCP server accessible within container
- [ ] Clean shutdown and cleanup

**Actual Results**:
```
[Record observations here]
```

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

---

### MT-FUNC-003: Configuration Validation Manual Testing

**Objective**: Manually validate MCP configuration files and settings

**Test Steps**:

1. **MCP Configuration File**
   - [ ] Open `.trae/mcp.json` in text editor
   - [ ] Verify JSON syntax is valid
   - [ ] Check required sections:
     - [ ] `mcpServers` object exists
     - [ ] `desktop-commander-npx` configuration
     - [ ] `desktop-commander-docker` configuration
   - [ ] Validate command paths and arguments
   - [ ] Test configuration with JSON validator

2. **Docker Configuration**
   - [ ] Open `docker/desktop-commander/docker-compose.yml`
   - [ ] Verify YAML syntax
   - [ ] Check service definitions
   - [ ] Validate volume mounts
   - [ ] Review environment variables
   - [ ] Check network configurations

3. **Project Rules Validation**
   - [ ] Open `.trae/project_rules.md`
   - [ ] Review security guidelines
   - [ ] Verify file access restrictions
   - [ ] Check operational procedures
   - [ ] Validate compliance requirements

**Expected Results**:
- [ ] All configuration files are syntactically valid
- [ ] Required sections and fields present
- [ ] Paths and references are correct
- [ ] Security guidelines are comprehensive

**Actual Results**:
```
[Record observations here]
```

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

---

## Security Testing Procedures

### MT-SEC-001: Authentication and Authorization Manual Testing

**Objective**: Manually validate security controls and access restrictions

**Test Steps**:

1. **Access Control Testing**
   - [ ] Attempt to access MCP server without authentication
   - [ ] Test with invalid credentials (if applicable)
   - [ ] Verify proper error messages
   - [ ] Test session timeout (if applicable)

2. **File System Access Testing**
   - [ ] Test access to allowed directories
   - [ ] Attempt access to restricted directories
   - [ ] Test path traversal attempts:
     - [ ] `../../../etc/passwd`
     - [ ] `..\..\..\windows\system32`
   - [ ] Verify proper access denials

3. **Container Security Testing** (Docker only)
   - [ ] Verify container runs as non-root user
   - [ ] Test container escape attempts
   - [ ] Check for privileged access
   - [ ] Verify resource limitations

**Expected Results**:
- [ ] Unauthorized access properly denied
- [ ] File system restrictions enforced
- [ ] Container security boundaries maintained
- [ ] Appropriate error messages displayed

**Actual Results**:
```
[Record observations here]
```

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

---

### MT-SEC-002: Input Validation Manual Testing

**Objective**: Manually test input validation and injection prevention

**Test Steps**:

1. **Command Injection Testing**
   - [ ] Test with malicious payloads:
     - [ ] `; ls -la`
     - [ ] `&& whoami`
     - [ ] `| cat /etc/passwd`
     - [ ] `` `id` ``
     - [ ] `$(whoami)`
   - [ ] Verify proper sanitization
   - [ ] Check error handling

2. **Path Injection Testing**
   - [ ] Test with path traversal sequences
   - [ ] Test with absolute paths
   - [ ] Test with symbolic links
   - [ ] Verify path validation

3. **Parameter Validation**
   - [ ] Test with oversized inputs
   - [ ] Test with special characters
   - [ ] Test with null bytes
   - [ ] Test with Unicode characters

**Expected Results**:
- [ ] Malicious inputs properly sanitized
- [ ] Path traversal attempts blocked
- [ ] Parameter validation enforced
- [ ] Appropriate error responses

**Actual Results**:
```
[Record observations here]
```

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

---

## Performance Testing Procedures

### MT-PERF-001: Resource Usage Manual Testing

**Objective**: Manually assess resource consumption and performance characteristics

**Test Steps**:

1. **Baseline Measurements**
   - [ ] Record system resources before testing:
     - CPU: _____%
     - Memory: _____ MB
     - Disk I/O: _____ MB/s
     - Network: _____ KB/s

2. **Startup Performance**
   - [ ] Measure cold start time: _____ seconds
   - [ ] Measure warm start time: _____ seconds
   - [ ] Record peak resource usage during startup
   - [ ] Monitor memory leaks during startup

3. **Runtime Performance**
   - [ ] Monitor steady-state resource usage
   - [ ] Test with concurrent operations
   - [ ] Measure response times under load
   - [ ] Check for memory leaks over time

4. **Stress Testing**
   - [ ] Run server for extended period (30+ minutes)
   - [ ] Monitor resource usage trends
   - [ ] Test with maximum concurrent connections
   - [ ] Verify graceful degradation under load

**Expected Results**:
- [ ] Resource usage within acceptable limits
- [ ] No memory leaks detected
- [ ] Consistent performance over time
- [ ] Graceful handling of resource constraints

**Actual Results**:
```
[Record observations here]
```

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

---

## User Experience Testing Procedures

### MT-UX-001: Installation and Setup Experience

**Objective**: Evaluate user experience for initial setup and configuration

**Test Steps**:

1. **Documentation Clarity**
   - [ ] Follow setup instructions step-by-step
   - [ ] Note any unclear or missing steps
   - [ ] Verify all prerequisites are documented
   - [ ] Test troubleshooting procedures

2. **Error Handling**
   - [ ] Test with missing prerequisites
   - [ ] Test with incorrect configurations
   - [ ] Verify error messages are helpful
   - [ ] Test recovery procedures

3. **First-Time User Experience**
   - [ ] Time complete setup process: _____ minutes
   - [ ] Count number of manual steps required: _____
   - [ ] Note any confusing aspects
   - [ ] Verify successful completion indicators

**Expected Results**:
- [ ] Setup process is straightforward
- [ ] Error messages are clear and actionable
- [ ] Documentation is complete and accurate
- [ ] First-time setup succeeds without issues

**Actual Results**:
```
[Record observations here]
```

**Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

---

## Comparative Analysis Procedures

### MT-COMP-001: NPX vs Docker Deployment Comparison

**Objective**: Compare deployment options across multiple criteria

**Comparison Criteria**:

| Criteria | NPX Deployment | Docker Deployment | Winner |
|----------|----------------|-------------------|--------|
| **Setup Time** | _____ minutes | _____ minutes | _____ |
| **Resource Usage (CPU)** | ____% | ____% | _____ |
| **Resource Usage (Memory)** | _____ MB | _____ MB | _____ |
| **Startup Time** | _____ seconds | _____ seconds | _____ |
| **Security Isolation** | ___/10 | ___/10 | _____ |
| **Ease of Use** | ___/10 | ___/10 | _____ |
| **Maintenance Overhead** | ___/10 | ___/10 | _____ |
| **Troubleshooting Difficulty** | ___/10 | ___/10 | _____ |
| **Scalability** | ___/10 | ___/10 | _____ |
| **Portability** | ___/10 | ___/10 | _____ |

**Overall Recommendation**:
```
[Provide recommendation based on comparison results]
```

---

## Test Execution Checklist

### Pre-Execution
- [ ] Environment prepared and documented
- [ ] Test data and tools ready
- [ ] Baseline measurements recorded
- [ ] Test execution plan reviewed

### During Execution
- [ ] All test steps followed precisely
- [ ] Observations recorded in real-time
- [ ] Screenshots/logs captured for issues
- [ ] Timing measurements recorded

### Post-Execution
- [ ] All test results documented
- [ ] Issues categorized by severity
- [ ] Recommendations formulated
- [ ] Test artifacts preserved

---

## Issue Reporting Template

### Issue ID: MT-ISSUE-XXX

**Test Case**: [Test case identifier]
**Severity**: [ ] Critical [ ] High [ ] Medium [ ] Low
**Category**: [ ] Functional [ ] Security [ ] Performance [ ] Usability

**Description**:
```
[Detailed description of the issue]
```

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**:
```
[What should have happened]
```

**Actual Result**:
```
[What actually happened]
```

**Environment**:
- OS: [Operating System]
- Node.js: [Version]
- Docker: [Version]
- Browser: [If applicable]

**Additional Information**:
```
[Logs, screenshots, or other relevant information]
```

**Recommended Action**:
```
[Suggested fix or workaround]
```

---

## Test Completion Criteria

### Functional Testing
- [ ] All deployment options tested successfully
- [ ] Configuration validation completed
- [ ] Core functionality verified
- [ ] Error handling tested

### Security Testing
- [ ] Authentication mechanisms validated
- [ ] Input validation tested
- [ ] Access controls verified
- [ ] Container security assessed

### Performance Testing
- [ ] Resource usage measured
- [ ] Performance benchmarks completed
- [ ] Stress testing performed
- [ ] Memory leak testing done

### User Experience Testing
- [ ] Setup experience evaluated
- [ ] Documentation accuracy verified
- [ ] Error message clarity assessed
- [ ] Troubleshooting procedures tested

### Comparative Analysis
- [ ] Deployment options compared
- [ ] Recommendations formulated
- [ ] Trade-offs documented
- [ ] Use case guidance provided

---

## Sign-off

**Tester Name**: _____________________
**Date**: _____________________
**Overall Test Status**: [ ] PASS [ ] FAIL [ ] PARTIAL

**Summary**:
```
[Brief summary of test execution and results]
```

**Recommendations**:
```
[Key recommendations based on testing results]
```