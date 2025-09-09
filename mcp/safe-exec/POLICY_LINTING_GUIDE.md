# MCP Safe-Exec Policy Linting Guide

Comprehensive guide for using the MCP Safe-Exec policy validation and linting system.

## Overview

The MCP Safe-Exec policy linting system provides automated validation, security analysis, and PR integration for policy files. It ensures policy consistency, security compliance, and provides actionable feedback for policy changes.

## Components

### 1. Policy Schema (`policy.schema.json`)

JSON Schema definition that validates policy structure and ensures compliance with expected format.

**Features:**
- Validates required fields and data types
- Enforces naming conventions
- Provides clear error messages for invalid configurations
- Supports IDE integration for real-time validation

### 2. Policy Linter (`policy-linter.mjs`)

Core linting engine that performs comprehensive policy analysis.

**Capabilities:**
- Schema validation
- Security risk analysis
- Best practices compliance checking
- Policy diff generation
- Customizable reporting formats

### 3. PR Integration (`pr-policy-checker.mjs`)

Automated PR comment system for policy change analysis.

**Features:**
- GitHub/GitLab integration
- Automatic policy diff detection
- Security impact assessment
- Status check updates
- Configurable comment formatting

### 4. Policy Utilities (`policy-utils.mjs`)

Helper functions for policy management and transformation.

**Utilities:**
- Policy validation functions
- Policy merging and transformation
- Security posture analysis
- Statistics generation
- File management operations

### 5. Test Suite (`policy-validation-tests.mjs`)

Comprehensive test coverage for all policy validation components.

## Installation

### Prerequisites

```bash
# Install Node.js dependencies
npm install ajv ajv-formats @octokit/rest
```

### Setup

1. **Place files in your MCP safe-exec directory:**
   ```
   mcp/safe-exec/
   ├── policy.json
   ├── policy.schema.json
   ├── policy-linter.mjs
   ├── pr-policy-checker.mjs
   ├── policy-utils.mjs
   ├── policy-validation-tests.mjs
   └── POLICY_LINTING_GUIDE.md
   ```

2. **Make scripts executable:**
   ```bash
   chmod +x policy-linter.mjs
   chmod +x pr-policy-checker.mjs
   chmod +x policy-validation-tests.mjs
   ```

## Usage

### Command Line Interface

#### Basic Policy Linting

```bash
# Lint a policy file
./policy-linter.mjs policy.json policy.schema.json

# Generate markdown report
./policy-linter.mjs policy.json policy.schema.json --format=markdown

# Save report to file
./policy-linter.mjs policy.json policy.schema.json --output=report.json
```

#### PR Integration

```bash
# Check policy changes in current PR
./pr-policy-checker.mjs

# Specify custom paths
./pr-policy-checker.mjs --policy=custom/policy.json --schema=custom/schema.json
```

#### Run Tests

```bash
# Run comprehensive test suite
./policy-validation-tests.mjs
```

### Programmatic Usage

#### Policy Linting

```javascript
import PolicyLinter from './policy-linter.mjs';

const linter = new PolicyLinter();
const report = await linter.lintPolicy('policy.json', 'policy.schema.json');

console.log(`Status: ${report.summary.status}`);
console.log(`Score: ${report.summary.overallScore}/100`);
```

#### Policy Validation

```javascript
import { PolicyValidator } from './policy-utils.mjs';

const policy = { /* your policy object */ };
const validation = PolicyValidator.validatePolicyStructure(policy);

if (validation.errors.length > 0) {
  console.error('Policy errors:', validation.errors);
}
```

#### Policy Analysis

```javascript
import { PolicyAnalyzer } from './policy-utils.mjs';

const policy = { /* your policy object */ };
const analysis = PolicyAnalyzer.analyzeSecurityPosture(policy);
const stats = PolicyAnalyzer.generateStatistics(policy);

console.log(`Security Score: ${analysis.score}/100`);
console.log(`Total Roles: ${stats.totalRoles}`);
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/policy-lint.yml`:

```yaml
name: Policy Lint

on:
  pull_request:
    paths:
      - 'mcp/safe-exec/policy.json'

jobs:
  policy-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 2
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd mcp/safe-exec
          npm install ajv ajv-formats @octokit/rest
      
      - name: Run policy linter
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cd mcp/safe-exec
          ./pr-policy-checker.mjs
```

### GitLab CI

Add to `.gitlab-ci.yml`:

```yaml
policy-lint:
  stage: test
  image: node:18
  script:
    - cd mcp/safe-exec
    - npm install ajv ajv-formats
    - ./policy-linter.mjs policy.json policy.schema.json
  rules:
    - changes:
        - mcp/safe-exec/policy.json
  artifacts:
    reports:
      junit: policy-lint-report.xml
```

### Pre-commit Hook

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check if policy.json is being committed
if git diff --cached --name-only | grep -q "mcp/safe-exec/policy.json"; then
  echo "Policy file changed, running linter..."
  
  cd mcp/safe-exec
  ./policy-linter.mjs policy.json policy.schema.json
  
  if [ $? -ne 0 ]; then
    echo "Policy linting failed. Commit aborted."
    exit 1
  fi
  
  echo "Policy linting passed."
fi
```

## Configuration

### Linter Configuration

Customize linting behavior by modifying the PolicyLinter class:

```javascript
const linter = new PolicyLinter();

// Custom dangerous binaries
linter.dangerousBinaries = ['rm', 'sudo', 'custom-dangerous-tool'];

// Custom security thresholds
linter.securityThresholds = {
  maxBinariesPerRole: 15,
  criticalDenyFlags: ['--unsafe-perm', '--allow-root']
};
```

### PR Comment Customization

Modify comment format in `pr-policy-checker.mjs`:

```javascript
const checker = new PRPolicyChecker({
  commentPrefix: '<!-- CUSTOM-POLICY-LINT -->',
  includeStatistics: true,
  severityEmojis: {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: '💡'
  }
});
```

## Policy Best Practices

### Security Guidelines

1. **Minimize Binary Permissions**
   - Only allow necessary binaries for each role
   - Regularly audit and remove unused permissions
   - Use specific binary paths when possible

2. **Comprehensive Deny Flags**
   ```json
   {
     "denyFlags": [
       "--unsafe-perm",
       "--allow-root",
       "--privileged",
       "--no-sandbox",
       "--disable-sandbox",
       "--cap-add",
       "--device"
     ]
   }
   ```

3. **Role-Based Access Control**
   - Create specific roles for different use cases
   - Avoid overly permissive "admin" roles
   - Document role purposes and restrictions

4. **Binary-Specific Restrictions**
   ```json
   {
     "perBinary": {
       "docker": {
         "denyFlags": ["--privileged", "--cap-add", "--device"],
         "notes": "Prevent container escape vulnerabilities"
       }
     }
   }
   ```

### Documentation Standards

1. **Role Descriptions**
   ```json
   {
     "roles": {
       "developer": {
         "description": "Standard development tools for application building",
         "allowedBinaries": ["node", "npm", "git"]
       }
     }
   }
   ```

2. **Explanatory Notes**
   ```json
   {
     "perBinary": {
       "kubectl": {
         "notes": "Kubernetes access restricted to read-only operations",
         "denyFlags": ["delete", "create", "apply"]
       }
     }
   }
   ```

## Troubleshooting

### Common Issues

#### Schema Validation Errors

**Problem:** Policy fails schema validation
```
Error: /roles/developer: allowedBinaries must be array
```

**Solution:** Ensure all arrays are properly formatted:
```json
{
  "roles": {
    "developer": {
      "allowedBinaries": ["node", "npm"]  // Array, not string
    }
  }
}
```

#### Binary Name Validation

**Problem:** Invalid binary names
```
Error: Invalid binary name: my app
```

**Solution:** Use valid characters (alphanumeric, hyphens, underscores, paths):
```json
{
  "allowedBinaries": ["my-app", "path/to/binary", "tool_name"]
}
```

#### PR Integration Issues

**Problem:** GitHub comments not posting

**Solutions:**
1. Verify `GITHUB_TOKEN` environment variable
2. Ensure token has `pull_requests: write` permission
3. Check repository and PR number detection

#### Performance Issues

**Problem:** Linting takes too long

**Solutions:**
1. Reduce policy complexity
2. Optimize binary lists
3. Use caching for repeated validations

### Debug Mode

Enable verbose logging:

```bash
# Set debug environment variable
export DEBUG=policy-linter
./policy-linter.mjs policy.json policy.schema.json
```

## API Reference

### PolicyLinter Class

#### Methods

- `loadSchema(schemaPath)` - Load and compile JSON schema
- `validateSchema(policy)` - Validate policy against schema
- `analyzeSecurityRisks(policy)` - Perform security analysis
- `checkBestPractices(policy)` - Check compliance with best practices
- `generateDiff(oldPolicy, newPolicy)` - Generate policy diff
- `lintPolicy(policyPath, schemaPath)` - Complete policy linting
- `formatForPR(report, diff)` - Format report for PR comments

#### Properties

- `issues` - Array of critical and high-severity issues
- `warnings` - Array of medium-severity warnings
- `suggestions` - Array of low-severity suggestions

### PolicyValidator Class

#### Static Methods

- `isValidBinaryName(name)` - Validate binary name format
- `isValidRoleName(name)` - Validate role name format
- `isValidWorkspaceFence(fence)` - Validate workspace fence format
- `isDangerousBinary(binary)` - Check if binary is potentially dangerous
- `isDangerousFlag(flag)` - Check if flag is potentially dangerous
- `validatePolicyStructure(policy)` - Validate policy structure

### PolicyAnalyzer Class

#### Static Methods

- `calculateComplexity(policy)` - Calculate policy complexity score
- `analyzeSecurityPosture(policy)` - Analyze security posture
- `generateStatistics(policy)` - Generate policy statistics

### PolicyManager Class

#### Static Methods

- `loadPolicy(filePath)` - Load policy from file
- `savePolicy(filePath, policy, options)` - Save policy to file
- `backupPolicy(filePath)` - Create policy backup

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `./policy-validation-tests.mjs`
4. Make changes and test thoroughly
5. Update documentation as needed

### Adding New Validations

1. **Add validation logic to PolicyLinter:**
   ```javascript
   checkCustomRule(policy) {
     // Your validation logic
     if (condition) {
       this.issues.push({
         type: 'error',
         category: 'custom',
         message: 'Custom rule violation',
         severity: 'high'
       });
     }
   }
   ```

2. **Add tests:**
   ```javascript
   await this.runTest('Custom validation', () => {
     // Test your validation logic
   });
   ```

3. **Update documentation**

### Extending Schema

1. **Update `policy.schema.json`:**
   ```json
   {
     "properties": {
       "newField": {
         "type": "string",
         "description": "New field description"
       }
     }
   }
   ```

2. **Update validation logic**
3. **Add tests for new field**
4. **Update documentation**

## License

This policy linting system is part of the MCP Safe-Exec project and follows the same licensing terms.

## Support

For issues, questions, or contributions:

1. Check existing documentation
2. Run the test suite to verify setup
3. Review troubleshooting section
4. Create detailed issue reports with:
   - Policy file (sanitized)
   - Error messages
   - Environment details
   - Steps to reproduce