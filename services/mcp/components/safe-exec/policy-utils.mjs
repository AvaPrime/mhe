/**
 * MCP Safe-Exec Policy Utilities
 * Helper functions for policy validation, transformation, and management
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * Policy validation utilities
 */
export class PolicyValidator {
  /**
   * Validate binary name format
   */
  static isValidBinaryName(name) {
    // Allow alphanumeric, hyphens, underscores, dots, and forward slashes for paths
    return /^[a-zA-Z0-9._/-]+$/.test(name);
  }

  /**
   * Validate role name format
   */
  static isValidRoleName(name) {
    // Role names should be alphanumeric with underscores and hyphens
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * Validate workspace fence format
   */
  static isValidWorkspaceFence(fence) {
    // Should be in format {VARIABLE_NAME}
    return /^\{[A-Z_][A-Z0-9_]*\}$/.test(fence);
  }

  /**
   * Check if a binary is potentially dangerous
   */
  static isDangerousBinary(binary) {
    const dangerousPatterns = [
      /^rm$/,
      /^sudo$/,
      /^su$/,
      /^chmod$/,
      /^chown$/,
      /^dd$/,
      /^mkfs/,
      /^fdisk$/,
      /^mount$/,
      /^umount$/,
      /^kill$/,
      /^pkill$/,
      /^killall$/,
      /^reboot$/,
      /^shutdown$/,
      /^init$/,
      /^systemctl$/,
      /^service$/
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(binary));
  }

  /**
   * Check if a flag is potentially dangerous
   */
  static isDangerousFlag(flag) {
    const dangerousFlags = [
      '--unsafe-perm',
      '--allow-root',
      '--privileged',
      '--no-sandbox',
      '--disable-sandbox',
      '--cap-add',
      '--device',
      '--volume',
      '-v',
      '--mount',
      '--network=host',
      '--pid=host',
      '--ipc=host',
      '--uts=host',
      '--user-ns=host'
    ];
    
    return dangerousFlags.some(dangerous => 
      flag.includes(dangerous) || flag.startsWith(dangerous)
    );
  }

  /**
   * Validate policy structure without schema
   */
  static validatePolicyStructure(policy) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!policy.workspaceFence) {
      errors.push('Missing required field: workspaceFence');
    } else if (!this.isValidWorkspaceFence(policy.workspaceFence)) {
      errors.push('Invalid workspaceFence format. Should be {UPPERCASE_NAME}');
    }

    if (!Array.isArray(policy.denyFlags)) {
      errors.push('denyFlags must be an array');
    }

    if (!policy.roles || typeof policy.roles !== 'object') {
      errors.push('roles must be an object');
    } else {
      // Validate each role
      Object.entries(policy.roles).forEach(([roleName, roleConfig]) => {
        if (!this.isValidRoleName(roleName)) {
          errors.push(`Invalid role name: ${roleName}`);
        }

        if (!Array.isArray(roleConfig.allowedBinaries)) {
          errors.push(`Role ${roleName}: allowedBinaries must be an array`);
        } else {
          roleConfig.allowedBinaries.forEach(binary => {
            if (!this.isValidBinaryName(binary)) {
              errors.push(`Role ${roleName}: Invalid binary name: ${binary}`);
            }
            if (this.isDangerousBinary(binary)) {
              warnings.push(`Role ${roleName}: Dangerous binary allowed: ${binary}`);
            }
          });
        }
      });
    }

    // Validate perBinary configurations
    if (policy.perBinary && typeof policy.perBinary === 'object') {
      Object.entries(policy.perBinary).forEach(([binaryName, binaryConfig]) => {
        if (!this.isValidBinaryName(binaryName)) {
          errors.push(`Invalid binary name in perBinary: ${binaryName}`);
        }

        if (binaryConfig.denyFlags && !Array.isArray(binaryConfig.denyFlags)) {
          errors.push(`Binary ${binaryName}: denyFlags must be an array`);
        }
      });
    }

    return { errors, warnings };
  }
}

/**
 * Policy transformation utilities
 */
export class PolicyTransformer {
  /**
   * Merge two policies with conflict resolution
   */
  static mergePolicies(basePolicy, overridePolicy, options = {}) {
    const merged = JSON.parse(JSON.stringify(basePolicy));
    const conflicts = [];

    // Merge workspace fence (override wins)
    if (overridePolicy.workspaceFence) {
      if (merged.workspaceFence !== overridePolicy.workspaceFence) {
        conflicts.push({
          field: 'workspaceFence',
          base: merged.workspaceFence,
          override: overridePolicy.workspaceFence,
          resolution: 'override'
        });
      }
      merged.workspaceFence = overridePolicy.workspaceFence;
    }

    // Merge deny flags (union by default)
    if (overridePolicy.denyFlags) {
      const baseDenyFlags = new Set(merged.denyFlags || []);
      const overrideDenyFlags = new Set(overridePolicy.denyFlags);
      
      if (options.denyFlagsStrategy === 'replace') {
        merged.denyFlags = [...overrideDenyFlags];
      } else {
        // Union strategy (default)
        merged.denyFlags = [...new Set([...baseDenyFlags, ...overrideDenyFlags])];
      }
    }

    // Merge roles
    if (overridePolicy.roles) {
      merged.roles = merged.roles || {};
      
      Object.entries(overridePolicy.roles).forEach(([roleName, roleConfig]) => {
        if (merged.roles[roleName]) {
          // Merge existing role
          const baseRole = merged.roles[roleName];
          const mergedRole = { ...baseRole, ...roleConfig };
          
          // Handle allowedBinaries array merge
          if (baseRole.allowedBinaries && roleConfig.allowedBinaries) {
            if (options.rolesStrategy === 'replace') {
              mergedRole.allowedBinaries = roleConfig.allowedBinaries;
            } else {
              // Union strategy (default)
              mergedRole.allowedBinaries = [
                ...new Set([...baseRole.allowedBinaries, ...roleConfig.allowedBinaries])
              ];
            }
          }
          
          merged.roles[roleName] = mergedRole;
          
          conflicts.push({
            field: `roles.${roleName}`,
            base: baseRole,
            override: roleConfig,
            resolution: options.rolesStrategy || 'merge'
          });
        } else {
          // New role
          merged.roles[roleName] = roleConfig;
        }
      });
    }

    // Merge perBinary configurations
    if (overridePolicy.perBinary) {
      merged.perBinary = merged.perBinary || {};
      
      Object.entries(overridePolicy.perBinary).forEach(([binaryName, binaryConfig]) => {
        if (merged.perBinary[binaryName]) {
          conflicts.push({
            field: `perBinary.${binaryName}`,
            base: merged.perBinary[binaryName],
            override: binaryConfig,
            resolution: 'override'
          });
        }
        merged.perBinary[binaryName] = { ...merged.perBinary[binaryName], ...binaryConfig };
      });
    }

    return { merged, conflicts };
  }

  /**
   * Convert policy to different formats
   */
  static convertToYAML(policy) {
    // Simple YAML conversion (would need yaml library for full implementation)
    const yamlLines = [];
    
    yamlLines.push(`workspaceFence: "${policy.workspaceFence}"`);
    
    if (policy.denyFlags && policy.denyFlags.length > 0) {
      yamlLines.push('denyFlags:');
      policy.denyFlags.forEach(flag => {
        yamlLines.push(`  - "${flag}"`);
      });
    }
    
    if (policy.roles) {
      yamlLines.push('roles:');
      Object.entries(policy.roles).forEach(([roleName, roleConfig]) => {
        yamlLines.push(`  ${roleName}:`);
        if (roleConfig.description) {
          yamlLines.push(`    description: "${roleConfig.description}"`);
        }
        if (roleConfig.allowedBinaries) {
          yamlLines.push('    allowedBinaries:');
          roleConfig.allowedBinaries.forEach(binary => {
            yamlLines.push(`      - "${binary}"`);
          });
        }
      });
    }
    
    return yamlLines.join('\n');
  }

  /**
   * Generate policy template
   */
  static generateTemplate(options = {}) {
    const template = {
      "$schema": "./policy.schema.json",
      "workspaceFence": options.workspaceFence || "{WORKSPACE_ROOT}",
      "denyFlags": [
        "--unsafe-perm",
        "--allow-root",
        "--privileged",
        "-rf",
        "--no-sandbox",
        "--disable-sandbox"
      ],
      "roles": {
        "developer": {
          "description": "Standard developer role with common tools",
          "allowedBinaries": [
            "node",
            "npm",
            "yarn",
            "git",
            "ls",
            "cat",
            "grep",
            "find",
            "echo",
            "mkdir",
            "touch",
            "cp",
            "mv"
          ]
        },
        "admin": {
          "description": "Administrative role with elevated permissions",
          "allowedBinaries": [
            "docker",
            "kubectl",
            "terraform",
            "aws",
            "gcloud",
            "az"
          ]
        }
      },
      "perBinary": {
        "docker": {
          "denyFlags": [
            "--privileged",
            "--cap-add",
            "--device",
            "--volume=/:/host",
            "--network=host",
            "--pid=host"
          ],
          "notes": "Docker access restricted to prevent container escape"
        }
      },
      "globalSettings": {
        "maxExecutionTime": 300,
        "allowNetworkAccess": true,
        "logAllCommands": true
      },
      "auditSettings": {
        "enabled": true,
        "logPath": "/var/log/mcp-safe-exec.log",
        "includeEnvironment": false
      }
    };

    return template;
  }
}

/**
 * Policy analysis utilities
 */
export class PolicyAnalyzer {
  /**
   * Calculate policy complexity score
   */
  static calculateComplexity(policy) {
    let complexity = 0;
    
    // Base complexity
    complexity += 1;
    
    // Roles complexity
    if (policy.roles) {
      const roleCount = Object.keys(policy.roles).length;
      complexity += roleCount * 2;
      
      // Binary count complexity
      Object.values(policy.roles).forEach(role => {
        if (role.allowedBinaries) {
          complexity += role.allowedBinaries.length * 0.5;
        }
      });
    }
    
    // Deny flags complexity
    if (policy.denyFlags) {
      complexity += policy.denyFlags.length * 0.3;
    }
    
    // Per-binary configurations
    if (policy.perBinary) {
      complexity += Object.keys(policy.perBinary).length * 1.5;
    }
    
    return Math.round(complexity * 10) / 10;
  }

  /**
   * Analyze policy security posture
   */
  static analyzeSecurityPosture(policy) {
    const analysis = {
      score: 100,
      risks: [],
      recommendations: []
    };

    // Check for dangerous binaries
    if (policy.roles) {
      Object.entries(policy.roles).forEach(([roleName, roleConfig]) => {
        if (roleConfig.allowedBinaries) {
          roleConfig.allowedBinaries.forEach(binary => {
            if (PolicyValidator.isDangerousBinary(binary)) {
              analysis.score -= 15;
              analysis.risks.push({
                type: 'dangerous_binary',
                severity: 'high',
                message: `Role '${roleName}' allows dangerous binary: ${binary}`,
                path: `/roles/${roleName}/allowedBinaries`
              });
            }
          });
        }
      });
    }

    // Check deny flags coverage
    const criticalDenyFlags = [
      '--unsafe-perm', '--allow-root', '--privileged', 
      '--no-sandbox', '--disable-sandbox'
    ];
    
    const missingCriticalFlags = criticalDenyFlags.filter(flag => 
      !policy.denyFlags?.includes(flag)
    );
    
    if (missingCriticalFlags.length > 0) {
      analysis.score -= missingCriticalFlags.length * 5;
      analysis.recommendations.push({
        type: 'missing_deny_flags',
        severity: 'medium',
        message: `Consider adding critical deny flags: ${missingCriticalFlags.join(', ')}`,
        path: '/denyFlags'
      });
    }

    // Check for overly permissive roles
    if (policy.roles) {
      Object.entries(policy.roles).forEach(([roleName, roleConfig]) => {
        if (roleConfig.allowedBinaries && roleConfig.allowedBinaries.length > 15) {
          analysis.score -= 5;
          analysis.recommendations.push({
            type: 'overly_permissive',
            severity: 'low',
            message: `Role '${roleName}' has ${roleConfig.allowedBinaries.length} allowed binaries - consider splitting into multiple roles`,
            path: `/roles/${roleName}`
          });
        }
      });
    }

    analysis.score = Math.max(0, analysis.score);
    return analysis;
  }

  /**
   * Generate policy statistics
   */
  static generateStatistics(policy) {
    const stats = {
      totalRoles: 0,
      totalBinaries: 0,
      totalDenyFlags: 0,
      totalPerBinaryConfigs: 0,
      averageBinariesPerRole: 0,
      mostPermissiveRole: null,
      leastPermissiveRole: null
    };

    if (policy.roles) {
      stats.totalRoles = Object.keys(policy.roles).length;
      
      let maxBinaries = 0;
      let minBinaries = Infinity;
      let totalBinariesAcrossRoles = 0;
      
      Object.entries(policy.roles).forEach(([roleName, roleConfig]) => {
        const binaryCount = roleConfig.allowedBinaries?.length || 0;
        totalBinariesAcrossRoles += binaryCount;
        
        if (binaryCount > maxBinaries) {
          maxBinaries = binaryCount;
          stats.mostPermissiveRole = { name: roleName, binaries: binaryCount };
        }
        
        if (binaryCount < minBinaries) {
          minBinaries = binaryCount;
          stats.leastPermissiveRole = { name: roleName, binaries: binaryCount };
        }
      });
      
      stats.totalBinaries = totalBinariesAcrossRoles;
      stats.averageBinariesPerRole = stats.totalRoles > 0 ? 
        Math.round((totalBinariesAcrossRoles / stats.totalRoles) * 10) / 10 : 0;
    }

    stats.totalDenyFlags = policy.denyFlags?.length || 0;
    stats.totalPerBinaryConfigs = policy.perBinary ? Object.keys(policy.perBinary).length : 0;

    return stats;
  }
}

/**
 * Policy file management utilities
 */
export class PolicyManager {
  /**
   * Load policy from file with validation
   */
  static async loadPolicy(filePath) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const policy = JSON.parse(content);
      
      const validation = PolicyValidator.validatePolicyStructure(policy);
      
      return {
        policy,
        valid: validation.errors.length === 0,
        errors: validation.errors,
        warnings: validation.warnings
      };
    } catch (error) {
      throw new Error(`Failed to load policy: ${error.message}`);
    }
  }

  /**
   * Save policy to file with formatting
   */
  static async savePolicy(filePath, policy, options = {}) {
    try {
      const formatted = JSON.stringify(policy, null, options.indent || 2);
      await writeFile(filePath, formatted, 'utf-8');
      return true;
    } catch (error) {
      throw new Error(`Failed to save policy: ${error.message}`);
    }
  }

  /**
   * Backup existing policy
   */
  static async backupPolicy(filePath) {
    if (!existsSync(filePath)) {
      return null;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    
    try {
      const content = await readFile(filePath, 'utf-8');
      await writeFile(backupPath, content, 'utf-8');
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to backup policy: ${error.message}`);
    }
  }
}

export default {
  PolicyValidator,
  PolicyTransformer,
  PolicyAnalyzer,
  PolicyManager
};