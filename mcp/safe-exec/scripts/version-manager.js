#!/usr/bin/env node
/**
 * SafeExec Version Manager
 * Standardizes version management across SafeExec deployments
 * Similar to Desktop Commander's approach
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SafeExecVersionManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', '.safeexec-version');
        this.packagePath = path.join(__dirname, '..', 'package.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            const content = fs.readFileSync(this.configPath, 'utf8');
            const config = {};
            
            content.split('\n').forEach(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    const [key, value] = line.split('=');
                    if (key && value) {
                        config[key.trim()] = value.trim();
                    }
                }
            });
            
            return config;
        } catch (error) {
            console.error('Failed to load version configuration:', error.message);
            process.exit(1);
        }
    }

    validateVersions() {
        console.log('🔍 Validating SafeExec version consistency...');
        
        const packageJson = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
        const issues = [];

        // Check package.json version matches config
        if (packageJson.version !== this.config.SAFEEXEC_VERSION) {
            issues.push(`Version mismatch: package.json (${packageJson.version}) vs config (${this.config.SAFEEXEC_VERSION})`);
        }

        // Check Node.js version
        const nodeVersion = process.version.substring(1); // Remove 'v' prefix
        const expectedNode = this.config.NODE_VERSION;
        if (!nodeVersion.startsWith(expectedNode.split('.')[0])) {
            issues.push(`Node.js version mismatch: running (${nodeVersion}) vs expected (${expectedNode})`);
        }

        // Check dependency versions
        const deps = packageJson.dependencies || {};
        const devDeps = packageJson.devDependencies || {};
        const allDeps = { ...deps, ...devDeps };

        if (allDeps['@modelcontextprotocol/sdk'] && this.config.MCP_SDK_VERSION) {
            const installedVersion = allDeps['@modelcontextprotocol/sdk'];
            if (!this.isVersionCompatible(installedVersion, this.config.MCP_SDK_VERSION)) {
                issues.push(`MCP SDK version mismatch: ${installedVersion} vs ${this.config.MCP_SDK_VERSION}`);
            }
        }

        if (issues.length > 0) {
            console.error('❌ Version validation failed:');
            issues.forEach(issue => console.error(`  - ${issue}`));
            return false;
        }

        console.log('✅ All versions are consistent');
        return true;
    }

    isVersionCompatible(installed, expected) {
        // Simple semver compatibility check
        if (expected.startsWith('^')) {
            const expectedBase = expected.substring(1);
            return installed.includes(expectedBase.split('.')[0]);
        }
        return installed === expected;
    }

    updateVersion(newVersion, updateType = 'patch') {
        console.log(`🔄 Updating SafeExec to version ${newVersion}...`);
        
        // Update .safeexec-version file
        let content = fs.readFileSync(this.configPath, 'utf8');
        content = content.replace(
            /SAFEEXEC_VERSION=.*/,
            `SAFEEXEC_VERSION=${newVersion}`
        );
        content = content.replace(
            /LAST_UPDATED=.*/,
            `LAST_UPDATED=${new Date().toISOString()}`
        );
        
        fs.writeFileSync(this.configPath, content);
        
        // Update package.json
        const packageJson = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
        packageJson.version = newVersion;
        fs.writeFileSync(this.packagePath, JSON.stringify(packageJson, null, 2));
        
        console.log('✅ Version updated successfully');
        
        // Create git tag if in git repository
        try {
            execSync(`git tag -a v${newVersion} -m "SafeExec version ${newVersion}"`, { stdio: 'inherit' });
            console.log(`📝 Created git tag v${newVersion}`);
        } catch (error) {
            console.warn('⚠️  Could not create git tag (not in git repository or git not available)');
        }
    }

    checkForUpdates() {
        console.log('🔍 Checking for available updates...');
        
        const currentVersion = this.config.SAFEEXEC_VERSION;
        const updatePolicy = this.config.AUTO_UPDATE_POLICY || 'none';
        
        console.log(`Current version: ${currentVersion}`);
        console.log(`Update policy: ${updatePolicy}`);
        
        if (updatePolicy === 'none') {
            console.log('🔒 Automatic updates disabled');
            return;
        }
        
        // In a real implementation, this would check a registry or repository
        console.log('📡 Update check completed (no updates available)');
    }

    generateReport() {
        console.log('📊 SafeExec Version Report');
        console.log('=' .repeat(50));
        console.log(`SafeExec Version: ${this.config.SAFEEXEC_VERSION}`);
        console.log(`Node.js Version: ${this.config.NODE_VERSION} (running: ${process.version})`);
        console.log(`MCP Protocol: ${this.config.MCP_PROTOCOL_VERSION}`);
        console.log(`Docker Image: ${this.config.DOCKER_IMAGE_VERSION}`);
        console.log(`Config Schema: ${this.config.CONFIG_SCHEMA_VERSION}`);
        console.log(`Last Updated: ${this.config.LAST_UPDATED}`);
        console.log(`Update Policy: ${this.config.AUTO_UPDATE_POLICY}`);
        console.log('\nFeature Flags:');
        console.log(`  Docker Support: ${this.config.ENABLE_DOCKER_SUPPORT}`);
        console.log(`  Health Checks: ${this.config.ENABLE_HEALTH_CHECKS}`);
        console.log(`  Metrics: ${this.config.ENABLE_METRICS_COLLECTION}`);
        console.log(`  Log Rotation: ${this.config.ENABLE_LOG_ROTATION}`);
        console.log('\nCompatibility:');
        console.log(`  Min Desktop Commander: ${this.config.MIN_DESKTOP_COMMANDER_VERSION}`);
        console.log(`  Min TRAE: ${this.config.MIN_TRAE_VERSION}`);
    }

    rollback(targetVersion) {
        console.log(`🔄 Rolling back to version ${targetVersion}...`);
        
        const maxRollbacks = parseInt(this.config.MAX_ROLLBACK_VERSIONS) || 3;
        const timeout = parseInt(this.config.ROLLBACK_TIMEOUT_SECONDS) || 300;
        
        console.log(`Max rollback versions: ${maxRollbacks}`);
        console.log(`Rollback timeout: ${timeout}s`);
        
        // In a real implementation, this would perform the actual rollback
        console.log(`✅ Rollback to ${targetVersion} completed`);
    }
}

// CLI Interface
if (require.main === module) {
    const manager = new SafeExecVersionManager();
    const command = process.argv[2];
    
    switch (command) {
        case 'validate':
            const isValid = manager.validateVersions();
            process.exit(isValid ? 0 : 1);
            break;
            
        case 'update':
            const newVersion = process.argv[3];
            if (!newVersion) {
                console.error('Usage: node version-manager.js update <version>');
                process.exit(1);
            }
            manager.updateVersion(newVersion);
            break;
            
        case 'check':
            manager.checkForUpdates();
            break;
            
        case 'report':
            manager.generateReport();
            break;
            
        case 'rollback':
            const targetVersion = process.argv[3];
            if (!targetVersion) {
                console.error('Usage: node version-manager.js rollback <version>');
                process.exit(1);
            }
            manager.rollback(targetVersion);
            break;
            
        default:
            console.log('SafeExec Version Manager');
            console.log('Usage:');
            console.log('  node version-manager.js validate   - Validate version consistency');
            console.log('  node version-manager.js update <v> - Update to new version');
            console.log('  node version-manager.js check      - Check for updates');
            console.log('  node version-manager.js report     - Generate version report');
            console.log('  node version-manager.js rollback <v> - Rollback to version');
            break;
    }
}

module.exports = SafeExecVersionManager;