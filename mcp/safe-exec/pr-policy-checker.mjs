#!/usr/bin/env node

/**
 * PR Policy Checker
 * Integrates with GitHub/GitLab to automatically comment on PRs with policy diff analysis
 */

import { readFile, writeFile } from 'fs/promises';
import { execSync } from 'child_process';
import PolicyLinter from './policy-linter.mjs';
import { Octokit } from '@octokit/rest';

class PRPolicyChecker {
  constructor(options = {}) {
    this.github = options.githubToken ? new Octokit({
      auth: options.githubToken
    }) : null;
    
    this.config = {
      policyPath: options.policyPath || 'mcp/safe-exec/policy.json',
      schemaPath: options.schemaPath || 'mcp/safe-exec/policy.schema.json',
      commentPrefix: '<!-- MCP-POLICY-LINT -->',
      ...options
    };
  }

  /**
   * Get the current policy from the main branch
   */
  async getCurrentPolicy() {
    try {
      const currentContent = execSync(`git show HEAD~1:${this.config.policyPath}`, { encoding: 'utf-8' });
      return JSON.parse(currentContent);
    } catch (error) {
      console.warn('Could not fetch current policy from git:', error.message);
      return null;
    }
  }

  /**
   * Get the proposed policy from the PR branch
   */
  async getProposedPolicy() {
    try {
      const proposedContent = await readFile(this.config.policyPath, 'utf-8');
      return JSON.parse(proposedContent);
    } catch (error) {
      throw new Error(`Could not read proposed policy: ${error.message}`);
    }
  }

  /**
   * Check if policy file was modified in the current changes
   */
  isPolicyModified() {
    try {
      const changedFiles = execSync('git diff --name-only HEAD~1', { encoding: 'utf-8' });
      return changedFiles.split('\n').includes(this.config.policyPath);
    } catch (error) {
      console.warn('Could not check git diff:', error.message);
      return false;
    }
  }

  /**
   * Analyze policy changes and generate comprehensive report
   */
  async analyzePolicyChanges() {
    const linter = new PolicyLinter();
    
    // Get both versions of the policy
    const currentPolicy = await this.getCurrentPolicy();
    const proposedPolicy = await getProposedPolicy();
    
    // Lint the proposed policy
    const lintReport = await linter.lintPolicy(this.config.policyPath, this.config.schemaPath);
    
    // Generate diff if we have both versions
    let diff = null;
    if (currentPolicy && proposedPolicy) {
      diff = linter.generateDiff(currentPolicy, proposedPolicy);
    }
    
    return {
      lintReport,
      diff,
      hasChanges: diff && (diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0)
    };
  }

  /**
   * Post comment to GitHub PR
   */
  async postGitHubComment(owner, repo, pullNumber, comment) {
    if (!this.github) {
      throw new Error('GitHub token not provided');
    }

    try {
      // Check if we already have a comment
      const { data: comments } = await this.github.rest.issues.listComments({
        owner,
        repo,
        issue_number: pullNumber
      });

      const existingComment = comments.find(c => 
        c.body.includes(this.config.commentPrefix)
      );

      const commentBody = `${this.config.commentPrefix}\n${comment}`;

      if (existingComment) {
        // Update existing comment
        await this.github.rest.issues.updateComment({
          owner,
          repo,
          comment_id: existingComment.id,
          body: commentBody
        });
        console.log('Updated existing PR comment');
      } else {
        // Create new comment
        await this.github.rest.issues.createComment({
          owner,
          repo,
          issue_number: pullNumber,
          body: commentBody
        });
        console.log('Created new PR comment');
      }
    } catch (error) {
      throw new Error(`Failed to post GitHub comment: ${error.message}`);
    }
  }

  /**
   * Generate status check for GitHub
   */
  async updateGitHubStatus(owner, repo, sha, report) {
    if (!this.github) {
      return;
    }

    const state = report.lintReport.summary.status === 'PASS' ? 'success' :
                  report.lintReport.summary.status === 'WARNING' ? 'success' : 'failure';
    
    const description = `Score: ${report.lintReport.summary.overallScore}/100, ` +
                       `Issues: ${report.lintReport.summary.totalIssues}`;

    try {
      await this.github.rest.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state,
        description,
        context: 'mcp/policy-lint'
      });
      console.log('Updated GitHub status check');
    } catch (error) {
      console.warn('Failed to update GitHub status:', error.message);
    }
  }

  /**
   * Main function to check PR and post comments
   */
  async checkPR(prInfo) {
    console.log('Checking MCP policy changes...');
    
    // Check if policy was modified
    if (!this.isPolicyModified()) {
      console.log('Policy file not modified, skipping check');
      return;
    }

    console.log('Policy file modified, analyzing changes...');
    
    try {
      const analysis = await this.analyzePolicyChanges();
      
      // Generate comment
      const linter = new PolicyLinter();
      const comment = linter.formatForPR(analysis.lintReport, analysis.diff);
      
      // Post to GitHub if configured
      if (prInfo.github && this.github) {
        await this.postGitHubComment(
          prInfo.github.owner,
          prInfo.github.repo,
          prInfo.github.pullNumber,
          comment
        );
        
        await this.updateGitHubStatus(
          prInfo.github.owner,
          prInfo.github.repo,
          prInfo.github.sha,
          analysis
        );
      }
      
      // Save report locally
      const reportPath = 'policy-lint-report.md';
      await writeFile(reportPath, comment);
      console.log(`Policy lint report saved to ${reportPath}`);
      
      // Exit with appropriate code
      if (analysis.lintReport.summary.criticalIssues > 0) {
        console.error('Critical policy issues found!');
        process.exit(1);
      } else if (analysis.lintReport.summary.status === 'WARNING') {
        console.warn('Policy warnings found');
        process.exit(0);
      } else {
        console.log('Policy check passed');
        process.exit(0);
      }
      
    } catch (error) {
      console.error('Policy check failed:', error.message);
      
      if (prInfo.github && this.github) {
        const errorComment = `## ❌ MCP Policy Check Failed\n\n` +
                           `**Error:** ${error.message}\n\n` +
                           `Please check the policy file format and try again.`;
        
        try {
          await this.postGitHubComment(
            prInfo.github.owner,
            prInfo.github.repo,
            prInfo.github.pullNumber,
            errorComment
          );
        } catch (commentError) {
          console.error('Failed to post error comment:', commentError.message);
        }
      }
      
      process.exit(1);
    }
  }
}

/**
 * Parse environment variables for CI/CD integration
 */
function parseEnvironment() {
  const env = process.env;
  
  // GitHub Actions
  if (env.GITHUB_ACTIONS) {
    const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
    return {
      ci: 'github-actions',
      github: {
        owner,
        repo,
        pullNumber: env.GITHUB_EVENT_PATH ? 
          JSON.parse(require('fs').readFileSync(env.GITHUB_EVENT_PATH)).number : null,
        sha: env.GITHUB_SHA
      }
    };
  }
  
  // GitLab CI
  if (env.GITLAB_CI) {
    return {
      ci: 'gitlab-ci',
      gitlab: {
        projectId: env.CI_PROJECT_ID,
        mergeRequestIid: env.CI_MERGE_REQUEST_IID,
        sha: env.CI_COMMIT_SHA
      }
    };
  }
  
  // Manual/local execution
  return {
    ci: 'manual',
    github: null,
    gitlab: null
  };
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  const options = {
    githubToken: process.env.GITHUB_TOKEN,
    gitlabToken: process.env.GITLAB_TOKEN,
    policyPath: args.find(arg => arg.startsWith('--policy='))?.split('=')[1] || 'mcp/safe-exec/policy.json',
    schemaPath: args.find(arg => arg.startsWith('--schema='))?.split('=')[1] || 'mcp/safe-exec/policy.schema.json'
  };
  
  const checker = new PRPolicyChecker(options);
  const prInfo = parseEnvironment();
  
  console.log('MCP Safe-Exec Policy Checker');
  console.log('Environment:', prInfo.ci);
  
  checker.checkPR(prInfo)
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export default PRPolicyChecker;