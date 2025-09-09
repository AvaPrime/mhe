#!/usr/bin/env node

/**
 * MCP Safe-Exec Policy Linter
 * Automated policy analysis and validation tool for MCP safe-exec policies
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

class PolicyLinter {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    this.schema = null;
    this.issues = [];
    this.warnings = [];
    this.suggestions = [];
  }

  /**
   * Load and compile the policy schema
   */
  async loadSchema(schemaPath) {
    try {
      const schemaContent = await readFile(schemaPath, 'utf-8');
      this.schema = JSON.parse(schemaContent);
      this.validate = this.ajv.compile(this.schema);
      return true;
    } catch (error) {
      this.issues.push({
        type: 'error',
        category: 'schema',
        message: `Failed to load schema: ${error.message}`,
        severity: 'critical'
      });
      return false;
    }
  }

  /**
   * Validate policy against JSON schema
   */
  validateSchema(policy) {
    if (!this.validate) {
      this.issues.push({
        type: 'error',
        category: 'validation',
        message: 'Schema not loaded',
        severity: 'critical'
      });
      return false;
    }

    const valid = this.validate(policy);
    if (!valid) {
      this.validate.errors.forEach(error => {
        this.issues.push({
          type: 'error',
          category: 'schema-validation',
          message: `${error.instancePath || 'root'}: ${error.message}`,
          data: error.data,
          severity: 'high',
          path: error.instancePath
        });
      });
    }
    return valid;
  }

  /**
   * Perform security analysis on the policy
   */
  analyzeSecurityRisks(policy) {
    // Check for overly permissive roles
    if (policy.roles) {
      Object.entries(policy.roles).forEach(([roleName, roleConfig]) => {
        if (roleConfig.allowedBinaries && roleConfig.allowedBinaries.length > 10) {
          this.warnings.push({
            type: 'warning',
            category: 'security',
            message: `Role '${roleName}' has ${roleConfig.allowedBinaries.length} allowed binaries - consider reducing scope`,
            severity: 'medium',
            path: `/roles/${roleName}/allowedBinaries`
          });
        }

        // Check for dangerous binaries
        const dangerousBinaries = ['rm', 'sudo', 'su', 'chmod', 'chown', 'dd', 'mkfs'];
        const allowedDangerous = roleConfig.allowedBinaries?.filter(binary => 
          dangerousBinaries.includes(binary)
        );
        
        if (allowedDangerous && allowedDangerous.length > 0) {
          this.issues.push({
            type: 'error',
            category: 'security',
            message: `Role '${roleName}' allows dangerous binaries: ${allowedDangerous.join(', ')}`,
            severity: 'critical',
            path: `/roles/${roleName}/allowedBinaries`
          });
        }
      });
    }

    // Check for insufficient deny flags
    const criticalDenyFlags = [
      '--unsafe-perm', '--allow-root', '--privileged', 
      '-rf', '--no-sandbox', '--disable-sandbox'
    ];
    
    const missingDenyFlags = criticalDenyFlags.filter(flag => 
      !policy.denyFlags?.includes(flag)
    );
    
    if (missingDenyFlags.length > 0) {
      this.warnings.push({
        type: 'warning',
        category: 'security',
        message: `Consider adding critical deny flags: ${missingDenyFlags.join(', ')}`,
        severity: 'medium',
        path: '/denyFlags'
      });
    }
  }

  /**
   * Check for best practices compliance
   */
  checkBestPractices(policy) {
    // Check if roles have descriptions
    if (policy.roles) {
      Object.entries(policy.roles).forEach(([roleName, roleConfig]) => {
        if (!roleConfig.description) {
          this.suggestions.push({
            type: 'suggestion',
            category: 'documentation',
            message: `Role '${roleName}' should have a description for clarity`,
            severity: 'low',
            path: `/roles/${roleName}/description`
          });
        }
      });
    }

    // Check for binary-specific configurations
    if (policy.perBinary) {
      Object.entries(policy.perBinary).forEach(([binaryName, binaryConfig]) => {
        if (!binaryConfig.notes && binaryConfig.denyFlags?.length > 0) {
          this.suggestions.push({
            type: 'suggestion',
            category: 'documentation',
            message: `Binary '${binaryName}' with restrictions should have explanatory notes`,
            severity: 'low',
            path: `/perBinary/${binaryName}/notes`
          });
        }
      });
    }

    // Check for workspace fence format
    if (policy.workspaceFence && !policy.workspaceFence.match(/^\{[A-Z_]+\}$/)) {
      this.warnings.push({
        type: 'warning',
        category: 'format',
        message: 'Workspace fence should follow format {UPPERCASE_NAME}',
        severity: 'low',
        path: '/workspaceFence'
      });
    }
  }

  /**
   * Generate policy diff analysis
   */
  generateDiff(oldPolicy, newPolicy) {
    const diff = {
      added: [],
      removed: [],
      modified: [],
      securityImpact: 'low'
    };

    // Compare roles
    const oldRoles = Object.keys(oldPolicy.roles || {});
    const newRoles = Object.keys(newPolicy.roles || {});
    
    diff.added.push(...newRoles.filter(role => !oldRoles.includes(role)).map(role => ({
      type: 'role_added',
      path: `/roles/${role}`,
      description: `New role '${role}' added`
    })));
    
    diff.removed.push(...oldRoles.filter(role => !newRoles.includes(role)).map(role => ({
      type: 'role_removed',
      path: `/roles/${role}`,
      description: `Role '${role}' removed`
    })));

    // Compare binary permissions
    newRoles.forEach(roleName => {
      if (oldPolicy.roles?.[roleName] && newPolicy.roles?.[roleName]) {
        const oldBinaries = oldPolicy.roles[roleName].allowedBinaries || [];
        const newBinaries = newPolicy.roles[roleName].allowedBinaries || [];
        
        const addedBinaries = newBinaries.filter(bin => !oldBinaries.includes(bin));
        const removedBinaries = oldBinaries.filter(bin => !newBinaries.includes(bin));
        
        if (addedBinaries.length > 0) {
          diff.modified.push({
            type: 'permissions_expanded',
            path: `/roles/${roleName}/allowedBinaries`,
            description: `Role '${roleName}' gained access to: ${addedBinaries.join(', ')}`,
            securityImpact: 'medium'
          });
          diff.securityImpact = 'medium';
        }
        
        if (removedBinaries.length > 0) {
          diff.modified.push({
            type: 'permissions_restricted',
            path: `/roles/${roleName}/allowedBinaries`,
            description: `Role '${roleName}' lost access to: ${removedBinaries.join(', ')}`,
            securityImpact: 'low'
          });
        }
      }
    });

    // Compare deny flags
    const oldDenyFlags = oldPolicy.denyFlags || [];
    const newDenyFlags = newPolicy.denyFlags || [];
    
    const addedDenyFlags = newDenyFlags.filter(flag => !oldDenyFlags.includes(flag));
    const removedDenyFlags = oldDenyFlags.filter(flag => !newDenyFlags.includes(flag));
    
    if (addedDenyFlags.length > 0) {
      diff.added.push({
        type: 'deny_flags_added',
        path: '/denyFlags',
        description: `Added deny flags: ${addedDenyFlags.join(', ')}`,
        securityImpact: 'positive'
      });
    }
    
    if (removedDenyFlags.length > 0) {
      diff.removed.push({
        type: 'deny_flags_removed',
        path: '/denyFlags',
        description: `Removed deny flags: ${removedDenyFlags.join(', ')}`,
        securityImpact: 'high'
      });
      diff.securityImpact = 'high';
    }

    return diff;
  }

  /**
   * Generate comprehensive lint report
   */
  generateReport() {
    const totalIssues = this.issues.length + this.warnings.length + this.suggestions.length;
    const criticalIssues = this.issues.filter(i => i.severity === 'critical').length;
    const highIssues = this.issues.filter(i => i.severity === 'high').length;
    
    let overallScore = 100;
    overallScore -= criticalIssues * 25;
    overallScore -= highIssues * 10;
    overallScore -= this.warnings.length * 5;
    overallScore -= this.suggestions.length * 1;
    overallScore = Math.max(0, overallScore);

    return {
      summary: {
        totalIssues,
        criticalIssues,
        highIssues,
        warnings: this.warnings.length,
        suggestions: this.suggestions.length,
        overallScore,
        status: criticalIssues > 0 ? 'FAIL' : highIssues > 0 ? 'WARNING' : 'PASS'
      },
      issues: this.issues,
      warnings: this.warnings,
      suggestions: this.suggestions,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format report for PR comments
   */
  formatForPR(report, diff = null) {
    let comment = '## 🔒 MCP Safe-Exec Policy Lint Report\n\n';
    
    // Summary
    const statusEmoji = {
      'PASS': '✅',
      'WARNING': '⚠️',
      'FAIL': '❌'
    };
    
    comment += `**Status:** ${statusEmoji[report.summary.status]} ${report.summary.status}\n`;
    comment += `**Overall Score:** ${report.summary.overallScore}/100\n\n`;
    
    if (diff) {
      comment += '### 📊 Policy Changes\n\n';
      
      if (diff.securityImpact === 'high') {
        comment += '🚨 **HIGH SECURITY IMPACT** - This change requires careful review\n\n';
      }
      
      [...diff.added, ...diff.removed, ...diff.modified].forEach(change => {
        const emoji = change.type.includes('added') ? '➕' : 
                     change.type.includes('removed') ? '➖' : '🔄';
        comment += `${emoji} ${change.description}\n`;
      });
      comment += '\n';
    }
    
    // Critical issues
    if (report.summary.criticalIssues > 0) {
      comment += '### ❌ Critical Issues\n\n';
      report.issues.filter(i => i.severity === 'critical').forEach(issue => {
        comment += `- **${issue.path || 'Policy'}**: ${issue.message}\n`;
      });
      comment += '\n';
    }
    
    // High priority issues
    if (report.summary.highIssues > 0) {
      comment += '### ⚠️ High Priority Issues\n\n';
      report.issues.filter(i => i.severity === 'high').forEach(issue => {
        comment += `- **${issue.path || 'Policy'}**: ${issue.message}\n`;
      });
      comment += '\n';
    }
    
    // Warnings
    if (report.warnings.length > 0) {
      comment += '<details>\n<summary>⚠️ Warnings (' + report.warnings.length + ')</summary>\n\n';
      report.warnings.forEach(warning => {
        comment += `- **${warning.path || 'Policy'}**: ${warning.message}\n`;
      });
      comment += '\n</details>\n\n';
    }
    
    // Suggestions
    if (report.suggestions.length > 0) {
      comment += '<details>\n<summary>💡 Suggestions (' + report.suggestions.length + ')</summary>\n\n';
      report.suggestions.forEach(suggestion => {
        comment += `- **${suggestion.path || 'Policy'}**: ${suggestion.message}\n`;
      });
      comment += '\n</details>\n\n';
    }
    
    comment += `---\n*Report generated at ${report.timestamp}*`;
    
    return comment;
  }

  /**
   * Main linting function
   */
  async lintPolicy(policyPath, schemaPath) {
    this.issues = [];
    this.warnings = [];
    this.suggestions = [];

    // Load schema
    const schemaLoaded = await this.loadSchema(schemaPath);
    if (!schemaLoaded) {
      return this.generateReport();
    }

    // Load and parse policy
    let policy;
    try {
      const policyContent = await readFile(policyPath, 'utf-8');
      policy = JSON.parse(policyContent);
    } catch (error) {
      this.issues.push({
        type: 'error',
        category: 'parsing',
        message: `Failed to parse policy: ${error.message}`,
        severity: 'critical'
      });
      return this.generateReport();
    }

    // Run all checks
    this.validateSchema(policy);
    this.analyzeSecurityRisks(policy);
    this.checkBestPractices(policy);

    return this.generateReport();
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: policy-linter.mjs <policy.json> <schema.json> [--output=file] [--format=json|markdown]');
    process.exit(1);
  }
  
  const [policyPath, schemaPath] = args;
  const outputFile = args.find(arg => arg.startsWith('--output='))?.split('=')[1];
  const format = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'json';
  
  const linter = new PolicyLinter();
  
  linter.lintPolicy(policyPath, schemaPath)
    .then(report => {
      let output;
      
      if (format === 'markdown') {
        output = linter.formatForPR(report);
      } else {
        output = JSON.stringify(report, null, 2);
      }
      
      if (outputFile) {
        return writeFile(outputFile, output);
      } else {
        console.log(output);
      }
    })
    .then(() => {
      if (outputFile) {
        console.log(`Report written to ${outputFile}`);
      }
    })
    .catch(error => {
      console.error('Linting failed:', error);
      process.exit(1);
    });
}

export default PolicyLinter;