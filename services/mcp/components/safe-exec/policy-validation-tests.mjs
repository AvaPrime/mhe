#!/usr/bin/env node

/**
 * MCP Safe-Exec Policy Validation Test Suite
 * Comprehensive tests for policy linting, validation, and utilities
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PolicyLinter from './policy-linter.mjs';
import { PolicyValidator, PolicyTransformer, PolicyAnalyzer, PolicyManager } from './policy-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PolicyValidationTestSuite {
  constructor() {
    this.testResults = [];
    this.testDir = path.join(__dirname, 'test-temp');
  }

  /**
   * Setup test environment
   */
  async setup() {
    if (existsSync(this.testDir)) {
      await rm(this.testDir, { recursive: true, force: true });
    }
    await mkdir(this.testDir, { recursive: true });
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    if (existsSync(this.testDir)) {
      await rm(this.testDir, { recursive: true, force: true });
    }
  }

  /**
   * Run a single test
   */
  async runTest(testName, testFunction) {
    console.log(`Running test: ${testName}`);
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      this.testResults.push({
        name: testName,
        status: 'PASS',
        duration,
        error: null
      });
      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        name: testName,
        status: 'FAIL',
        duration,
        error: error.message
      });
      console.log(`❌ ${testName} - FAILED: ${error.message}`);
    }
  }

  /**
   * Create test policy files
   */
  async createTestPolicies() {
    // Valid policy
    const validPolicy = {
      "$schema": "./policy.schema.json",
      "workspaceFence": "{WORKSPACE_ROOT}",
      "denyFlags": ["--unsafe-perm", "--allow-root"],
      "roles": {
        "developer": {
          "description": "Developer role",
          "allowedBinaries": ["node", "npm", "git"]
        }
      },
      "perBinary": {
        "docker": {
          "denyFlags": ["--privileged"],
          "notes": "Docker restricted"
        }
      }
    };

    // Invalid policy (missing required fields)
    const invalidPolicy = {
      "roles": {
        "invalid-role!": {
          "allowedBinaries": ["invalid binary name!"]
        }
      }
    };

    // Dangerous policy (allows risky binaries)
    const dangerousPolicy = {
      "$schema": "./policy.schema.json",
      "workspaceFence": "{WORKSPACE_ROOT}",
      "denyFlags": [],
      "roles": {
        "admin": {
          "allowedBinaries": ["rm", "sudo", "chmod", "dd"]
        }
      }
    };

    await writeFile(
      path.join(this.testDir, 'valid-policy.json'),
      JSON.stringify(validPolicy, null, 2)
    );

    await writeFile(
      path.join(this.testDir, 'invalid-policy.json'),
      JSON.stringify(invalidPolicy, null, 2)
    );

    await writeFile(
      path.join(this.testDir, 'dangerous-policy.json'),
      JSON.stringify(dangerousPolicy, null, 2)
    );

    return { validPolicy, invalidPolicy, dangerousPolicy };
  }

  /**
   * Test PolicyValidator class
   */
  async testPolicyValidator() {
    await this.runTest('PolicyValidator.isValidBinaryName', () => {
      if (!PolicyValidator.isValidBinaryName('node')) throw new Error('Should accept valid binary name');
      if (!PolicyValidator.isValidBinaryName('my-app')) throw new Error('Should accept hyphenated names');
      if (!PolicyValidator.isValidBinaryName('path/to/binary')) throw new Error('Should accept paths');
      if (PolicyValidator.isValidBinaryName('invalid name!')) throw new Error('Should reject invalid characters');
    });

    await this.runTest('PolicyValidator.isValidRoleName', () => {
      if (!PolicyValidator.isValidRoleName('developer')) throw new Error('Should accept valid role name');
      if (!PolicyValidator.isValidRoleName('admin_user')) throw new Error('Should accept underscores');
      if (PolicyValidator.isValidRoleName('invalid role!')) throw new Error('Should reject invalid characters');
    });

    await this.runTest('PolicyValidator.isValidWorkspaceFence', () => {
      if (!PolicyValidator.isValidWorkspaceFence('{WORKSPACE_ROOT}')) throw new Error('Should accept valid fence');
      if (!PolicyValidator.isValidWorkspaceFence('{MY_VAR}')) throw new Error('Should accept custom variables');
      if (PolicyValidator.isValidWorkspaceFence('invalid')) throw new Error('Should reject invalid format');
    });

    await this.runTest('PolicyValidator.isDangerousBinary', () => {
      if (!PolicyValidator.isDangerousBinary('rm')) throw new Error('Should detect rm as dangerous');
      if (!PolicyValidator.isDangerousBinary('sudo')) throw new Error('Should detect sudo as dangerous');
      if (PolicyValidator.isDangerousBinary('node')) throw new Error('Should not flag node as dangerous');
    });

    await this.runTest('PolicyValidator.validatePolicyStructure', () => {
      const validPolicy = {
        workspaceFence: '{WORKSPACE_ROOT}',
        denyFlags: ['--unsafe-perm'],
        roles: {
          developer: {
            allowedBinaries: ['node', 'npm']
          }
        }
      };

      const result = PolicyValidator.validatePolicyStructure(validPolicy);
      if (result.errors.length > 0) {
        throw new Error(`Valid policy should not have errors: ${result.errors.join(', ')}`);
      }

      const invalidPolicy = {
        denyFlags: 'not-an-array',
        roles: {
          'invalid-name!': {
            allowedBinaries: ['rm']
          }
        }
      };

      const invalidResult = PolicyValidator.validatePolicyStructure(invalidPolicy);
      if (invalidResult.errors.length === 0) {
        throw new Error('Invalid policy should have errors');
      }
    });
  }

  /**
   * Test PolicyTransformer class
   */
  async testPolicyTransformer() {
    await this.runTest('PolicyTransformer.mergePolicies', () => {
      const basePolicy = {
        workspaceFence: '{BASE}',
        denyFlags: ['--flag1'],
        roles: {
          developer: {
            allowedBinaries: ['node']
          }
        }
      };

      const overridePolicy = {
        workspaceFence: '{OVERRIDE}',
        denyFlags: ['--flag2'],
        roles: {
          developer: {
            allowedBinaries: ['npm']
          },
          admin: {
            allowedBinaries: ['docker']
          }
        }
      };

      const result = PolicyTransformer.mergePolicies(basePolicy, overridePolicy);
      
      if (result.merged.workspaceFence !== '{OVERRIDE}') {
        throw new Error('Workspace fence should be overridden');
      }
      
      if (!result.merged.denyFlags.includes('--flag1') || !result.merged.denyFlags.includes('--flag2')) {
        throw new Error('Deny flags should be merged');
      }
      
      if (!result.merged.roles.developer.allowedBinaries.includes('node') || 
          !result.merged.roles.developer.allowedBinaries.includes('npm')) {
        throw new Error('Role binaries should be merged');
      }
      
      if (!result.merged.roles.admin) {
        throw new Error('New roles should be added');
      }
    });

    await this.runTest('PolicyTransformer.generateTemplate', () => {
      const template = PolicyTransformer.generateTemplate();
      
      if (!template.workspaceFence) throw new Error('Template should have workspaceFence');
      if (!Array.isArray(template.denyFlags)) throw new Error('Template should have denyFlags array');
      if (!template.roles || typeof template.roles !== 'object') throw new Error('Template should have roles object');
    });
  }

  /**
   * Test PolicyAnalyzer class
   */
  async testPolicyAnalyzer() {
    await this.runTest('PolicyAnalyzer.calculateComplexity', () => {
      const simplePolicy = {
        workspaceFence: '{WORKSPACE}',
        denyFlags: ['--flag1'],
        roles: {
          developer: {
            allowedBinaries: ['node']
          }
        }
      };

      const complexity = PolicyAnalyzer.calculateComplexity(simplePolicy);
      if (typeof complexity !== 'number' || complexity <= 0) {
        throw new Error('Complexity should be a positive number');
      }
    });

    await this.runTest('PolicyAnalyzer.analyzeSecurityPosture', () => {
      const dangerousPolicy = {
        workspaceFence: '{WORKSPACE}',
        denyFlags: [],
        roles: {
          admin: {
            allowedBinaries: ['rm', 'sudo']
          }
        }
      };

      const analysis = PolicyAnalyzer.analyzeSecurityPosture(dangerousPolicy);
      
      if (analysis.score >= 100) {
        throw new Error('Dangerous policy should have reduced security score');
      }
      
      if (analysis.risks.length === 0) {
        throw new Error('Dangerous policy should have identified risks');
      }
    });

    await this.runTest('PolicyAnalyzer.generateStatistics', () => {
      const policy = {
        workspaceFence: '{WORKSPACE}',
        denyFlags: ['--flag1', '--flag2'],
        roles: {
          developer: {
            allowedBinaries: ['node', 'npm']
          },
          admin: {
            allowedBinaries: ['docker']
          }
        }
      };

      const stats = PolicyAnalyzer.generateStatistics(policy);
      
      if (stats.totalRoles !== 2) throw new Error('Should count roles correctly');
      if (stats.totalDenyFlags !== 2) throw new Error('Should count deny flags correctly');
      if (stats.averageBinariesPerRole !== 1.5) throw new Error('Should calculate average correctly');
    });
  }

  /**
   * Test PolicyManager class
   */
  async testPolicyManager() {
    const { validPolicy } = await this.createTestPolicies();
    
    await this.runTest('PolicyManager.loadPolicy', async () => {
      const result = await PolicyManager.loadPolicy(path.join(this.testDir, 'valid-policy.json'));
      
      if (!result.valid) {
        throw new Error('Valid policy should load successfully');
      }
      
      if (!result.policy.workspaceFence) {
        throw new Error('Loaded policy should have all fields');
      }
    });

    await this.runTest('PolicyManager.savePolicy', async () => {
      const testPolicy = { workspaceFence: '{TEST}', denyFlags: [], roles: {} };
      const savePath = path.join(this.testDir, 'saved-policy.json');
      
      await PolicyManager.savePolicy(savePath, testPolicy);
      
      if (!existsSync(savePath)) {
        throw new Error('Policy file should be saved');
      }
      
      const content = await readFile(savePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      if (parsed.workspaceFence !== '{TEST}') {
        throw new Error('Saved policy should match original');
      }
    });

    await this.runTest('PolicyManager.backupPolicy', async () => {
      const originalPath = path.join(this.testDir, 'valid-policy.json');
      const backupPath = await PolicyManager.backupPolicy(originalPath);
      
      if (!backupPath || !existsSync(backupPath)) {
        throw new Error('Backup should be created');
      }
      
      const originalContent = await readFile(originalPath, 'utf-8');
      const backupContent = await readFile(backupPath, 'utf-8');
      
      if (originalContent !== backupContent) {
        throw new Error('Backup should match original');
      }
    });
  }

  /**
   * Test PolicyLinter integration
   */
  async testPolicyLinter() {
    const { validPolicy, dangerousPolicy } = await this.createTestPolicies();
    
    // Create a simple schema for testing
    const testSchema = {
      type: 'object',
      required: ['workspaceFence'],
      properties: {
        workspaceFence: { type: 'string' },
        denyFlags: { type: 'array', items: { type: 'string' } },
        roles: { type: 'object' }
      }
    };
    
    const schemaPath = path.join(this.testDir, 'test-schema.json');
    await writeFile(schemaPath, JSON.stringify(testSchema, null, 2));

    await this.runTest('PolicyLinter.lintPolicy - valid policy', async () => {
      const linter = new PolicyLinter();
      const report = await linter.lintPolicy(
        path.join(this.testDir, 'valid-policy.json'),
        schemaPath
      );
      
      if (report.summary.status === 'FAIL') {
        throw new Error('Valid policy should not fail linting');
      }
    });

    await this.runTest('PolicyLinter.lintPolicy - dangerous policy', async () => {
      const linter = new PolicyLinter();
      const report = await linter.lintPolicy(
        path.join(this.testDir, 'dangerous-policy.json'),
        schemaPath
      );
      
      if (report.summary.criticalIssues === 0) {
        throw new Error('Dangerous policy should have critical issues');
      }
    });

    await this.runTest('PolicyLinter.generateDiff', async () => {
      const linter = new PolicyLinter();
      
      const oldPolicy = {
        workspaceFence: '{OLD}',
        roles: {
          developer: {
            allowedBinaries: ['node']
          }
        }
      };
      
      const newPolicy = {
        workspaceFence: '{NEW}',
        roles: {
          developer: {
            allowedBinaries: ['node', 'npm']
          },
          admin: {
            allowedBinaries: ['docker']
          }
        }
      };
      
      const diff = linter.generateDiff(oldPolicy, newPolicy);
      
      if (diff.added.length === 0 && diff.modified.length === 0) {
        throw new Error('Diff should detect changes');
      }
    });

    await this.runTest('PolicyLinter.formatForPR', async () => {
      const linter = new PolicyLinter();
      const report = {
        summary: {
          status: 'WARNING',
          overallScore: 75,
          totalIssues: 2,
          criticalIssues: 0,
          highIssues: 1,
          warnings: 1,
          suggestions: 0
        },
        issues: [{
          severity: 'high',
          path: '/roles/admin',
          message: 'Test issue'
        }],
        warnings: [{
          severity: 'medium',
          path: '/denyFlags',
          message: 'Test warning'
        }],
        suggestions: [],
        timestamp: new Date().toISOString()
      };
      
      const comment = linter.formatForPR(report);
      
      if (!comment.includes('Policy Lint Report')) {
        throw new Error('Comment should include report title');
      }
      
      if (!comment.includes('WARNING')) {
        throw new Error('Comment should include status');
      }
      
      if (!comment.includes('75/100')) {
        throw new Error('Comment should include score');
      }
    });
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting MCP Safe-Exec Policy Validation Test Suite\n');
    
    await this.setup();
    
    try {
      // Test individual components
      await this.testPolicyValidator();
      await this.testPolicyTransformer();
      await this.testPolicyAnalyzer();
      await this.testPolicyManager();
      await this.testPolicyLinter();
      
    } finally {
      await this.cleanup();
    }
    
    // Generate test report
    this.generateTestReport();
  }

  /**
   * Generate and display test report
   */
  generateTestReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'PASS').length;
    const failedTests = this.testResults.filter(t => t.status === 'FAIL').length;
    const totalDuration = this.testResults.reduce((sum, t) => sum + t.duration, 0);
    
    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`Total Duration: ${totalDuration}ms`);
    
    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(t => t.status === 'FAIL')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }
    
    // Save detailed report
    const report = {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: (passedTests / totalTests) * 100,
        totalDuration
      },
      results: this.testResults,
      timestamp: new Date().toISOString()
    };
    
    writeFile('policy-validation-test-report.json', JSON.stringify(report, null, 2))
      .then(() => console.log('\n📄 Detailed report saved to policy-validation-test-report.json'))
      .catch(err => console.error('Failed to save report:', err.message));
    
    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new PolicyValidationTestSuite();
  
  testSuite.runAllTests()
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export default PolicyValidationTestSuite;