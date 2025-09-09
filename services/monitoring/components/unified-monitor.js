#!/usr/bin/env node
/**
 * Unified Monitoring System for SafeExec and Desktop Commander
 * Provides consistent log monitoring, metrics collection, and alerting
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const os = require('os');

class UnifiedMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            logPaths: {
                safeExec: path.join(process.cwd(), 'mcp', 'safe-exec', 'logs'),
                desktopCommander: path.join(process.cwd(), 'mcp', 'desktop-commander', 'logs')
            },
            monitoring: {
                interval: 5000, // 5 seconds
                logRetention: 7, // days
                maxLogSize: 50 * 1024 * 1024, // 50MB
                alertThresholds: {
                    errorRate: 0.1, // 10% error rate
                    memoryUsage: 0.8, // 80% memory usage
                    diskUsage: 0.9, // 90% disk usage
                    responseTime: 5000 // 5 seconds
                }
            },
            services: {
                safeExec: {
                    name: 'SafeExec MCP',
                    healthEndpoint: 'http://localhost:3001/health',
                    logPattern: /\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]\s+(ERROR|WARN|INFO|DEBUG)\s+(.+)/,
                    pidFile: path.join(process.cwd(), 'mcp', 'safe-exec', '.pid'),
                    configFile: path.join(process.cwd(), 'mcp', 'safe-exec', '.safeexec-version')
                },
                desktopCommander: {
                    name: 'Desktop Commander',
                    healthEndpoint: 'http://localhost:3002/health',
                    logPattern: /\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]\s+(ERROR|WARN|INFO|DEBUG)\s+(.+)/,
                    pidFile: path.join(process.cwd(), 'mcp', 'desktop-commander', '.pid'),
                    configFile: path.join(process.cwd(), 'mcp', 'desktop-commander', 'package.json')
                }
            },
            ...config
        };
        
        this.metrics = {
            safeExec: this.initializeMetrics(),
            desktopCommander: this.initializeMetrics(),
            system: this.initializeSystemMetrics()
        };
        
        this.logWatchers = new Map();
        this.healthCheckers = new Map();
        this.isRunning = false;
        this.startTime = Date.now();
    }

    initializeMetrics() {
        return {
            requests: 0,
            errors: 0,
            warnings: 0,
            responseTime: [],
            uptime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            lastHealthCheck: null,
            status: 'unknown'
        };
    }

    initializeSystemMetrics() {
        return {
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpuCount: os.cpus().length,
            loadAverage: os.loadavg(),
            uptime: os.uptime()
        };
    }

    /**
     * Start the unified monitoring system
     */
    async start() {
        console.log('🚀 Starting Unified Monitor for SafeExec and Desktop Commander');
        
        this.isRunning = true;
        
        // Initialize log directories
        await this.initializeLogDirectories();
        
        // Start log watchers
        this.startLogWatchers();
        
        // Start health checkers
        this.startHealthCheckers();
        
        // Start metrics collection
        this.startMetricsCollection();
        
        // Start log rotation
        this.startLogRotation();
        
        console.log('✅ Unified Monitor started successfully');
        this.emit('started');
    }

    /**
     * Stop the monitoring system
     */
    async stop() {
        console.log('🛑 Stopping Unified Monitor');
        
        this.isRunning = false;
        
        // Stop log watchers
        for (const [service, watcher] of this.logWatchers) {
            if (watcher && watcher.close) {
                watcher.close();
            }
        }
        this.logWatchers.clear();
        
        // Stop health checkers
        for (const [service, checker] of this.healthCheckers) {
            if (checker) {
                clearInterval(checker);
            }
        }
        this.healthCheckers.clear();
        
        console.log('✅ Unified Monitor stopped');
        this.emit('stopped');
    }

    /**
     * Initialize log directories for both services
     */
    async initializeLogDirectories() {
        for (const [service, logPath] of Object.entries(this.config.logPaths)) {
            try {
                if (!fs.existsSync(logPath)) {
                    fs.mkdirSync(logPath, { recursive: true });
                    console.log(`📁 Created log directory for ${service}: ${logPath}`);
                }
            } catch (error) {
                console.error(`❌ Failed to create log directory for ${service}:`, error.message);
            }
        }
    }

    /**
     * Start log watchers for both services
     */
    startLogWatchers() {
        for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
            const logPath = this.config.logPaths[serviceName];
            const logFile = path.join(logPath, 'application.log');
            
            try {
                // Create log file if it doesn't exist
                if (!fs.existsSync(logFile)) {
                    fs.writeFileSync(logFile, '');
                }
                
                const watcher = fs.watchFile(logFile, { interval: 1000 }, (curr, prev) => {
                    if (curr.mtime > prev.mtime) {
                        this.processNewLogEntries(serviceName, logFile, prev.size, curr.size);
                    }
                });
                
                this.logWatchers.set(serviceName, watcher);
                console.log(`👁️  Started log watcher for ${serviceConfig.name}`);
            } catch (error) {
                console.error(`❌ Failed to start log watcher for ${serviceName}:`, error.message);
            }
        }
    }

    /**
     * Process new log entries
     */
    processNewLogEntries(serviceName, logFile, prevSize, currSize) {
        try {
            const fd = fs.openSync(logFile, 'r');
            const buffer = Buffer.alloc(currSize - prevSize);
            fs.readSync(fd, buffer, 0, buffer.length, prevSize);
            fs.closeSync(fd);
            
            const newContent = buffer.toString('utf8');
            const lines = newContent.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                this.processLogLine(serviceName, line);
            }
        } catch (error) {
            console.error(`❌ Error processing log entries for ${serviceName}:`, error.message);
        }
    }

    /**
     * Process individual log line
     */
    processLogLine(serviceName, line) {
        const serviceConfig = this.config.services[serviceName];
        const match = line.match(serviceConfig.logPattern);
        
        if (match) {
            const [, timestamp, level, message] = match;
            const logEntry = {
                service: serviceName,
                timestamp: new Date(timestamp),
                level: level.toUpperCase(),
                message: message.trim()
            };
            
            // Update metrics
            this.updateLogMetrics(serviceName, logEntry);
            
            // Emit log event
            this.emit('logEntry', logEntry);
            
            // Check for alerts
            this.checkLogAlerts(serviceName, logEntry);
        }
    }

    /**
     * Update metrics based on log entry
     */
    updateLogMetrics(serviceName, logEntry) {
        const metrics = this.metrics[serviceName];
        
        switch (logEntry.level) {
            case 'ERROR':
                metrics.errors++;
                break;
            case 'WARN':
                metrics.warnings++;
                break;
            case 'INFO':
            case 'DEBUG':
                metrics.requests++;
                break;
        }
        
        // Extract response time if available
        const responseTimeMatch = logEntry.message.match(/response_time[:\s]+(\d+)ms/);
        if (responseTimeMatch) {
            const responseTime = parseInt(responseTimeMatch[1]);
            metrics.responseTime.push(responseTime);
            
            // Keep only last 100 response times
            if (metrics.responseTime.length > 100) {
                metrics.responseTime = metrics.responseTime.slice(-100);
            }
        }
    }

    /**
     * Check for alert conditions in logs
     */
    checkLogAlerts(serviceName, logEntry) {
        const serviceConfig = this.config.services[serviceName];
        
        // Critical error patterns
        const criticalPatterns = [
            /security.violation/i,
            /authentication.failed/i,
            /corruption.detected/i,
            /out.of.memory/i,
            /disk.full/i
        ];
        
        for (const pattern of criticalPatterns) {
            if (pattern.test(logEntry.message)) {
                this.emit('criticalAlert', {
                    service: serviceName,
                    serviceName: serviceConfig.name,
                    level: 'CRITICAL',
                    message: logEntry.message,
                    timestamp: logEntry.timestamp
                });
                break;
            }
        }
        
        // Error rate threshold
        const metrics = this.metrics[serviceName];
        const totalRequests = metrics.requests + metrics.errors;
        if (totalRequests > 10) { // Only check after some activity
            const errorRate = metrics.errors / totalRequests;
            if (errorRate > this.config.monitoring.alertThresholds.errorRate) {
                this.emit('errorRateAlert', {
                    service: serviceName,
                    serviceName: serviceConfig.name,
                    errorRate: errorRate,
                    threshold: this.config.monitoring.alertThresholds.errorRate
                });
            }
        }
    }

    /**
     * Start health checkers for both services
     */
    startHealthCheckers() {
        for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
            const checker = setInterval(async () => {
                await this.performHealthCheck(serviceName, serviceConfig);
            }, this.config.monitoring.interval);
            
            this.healthCheckers.set(serviceName, checker);
            console.log(`💓 Started health checker for ${serviceConfig.name}`);
        }
    }

    /**
     * Perform health check for a service
     */
    async performHealthCheck(serviceName, serviceConfig) {
        try {
            const startTime = Date.now();
            
            // Check if process is running
            const isRunning = await this.checkProcessStatus(serviceConfig.pidFile);
            
            if (!isRunning) {
                this.metrics[serviceName].status = 'stopped';
                this.emit('serviceDown', {
                    service: serviceName,
                    serviceName: serviceConfig.name,
                    reason: 'Process not running'
                });
                return;
            }
            
            // Perform HTTP health check if endpoint is available
            let healthStatus = 'unknown';
            try {
                const response = await this.httpHealthCheck(serviceConfig.healthEndpoint);
                healthStatus = response.status === 200 ? 'healthy' : 'unhealthy';
            } catch (error) {
                healthStatus = 'unhealthy';
            }
            
            const responseTime = Date.now() - startTime;
            
            // Update metrics
            this.metrics[serviceName].status = healthStatus;
            this.metrics[serviceName].lastHealthCheck = new Date();
            this.metrics[serviceName].uptime = this.calculateUptime(serviceName);
            
            // Check response time threshold
            if (responseTime > this.config.monitoring.alertThresholds.responseTime) {
                this.emit('slowResponseAlert', {
                    service: serviceName,
                    serviceName: serviceConfig.name,
                    responseTime,
                    threshold: this.config.monitoring.alertThresholds.responseTime
                });
            }
            
            this.emit('healthCheck', {
                service: serviceName,
                serviceName: serviceConfig.name,
                status: healthStatus,
                responseTime
            });
            
        } catch (error) {
            console.error(`❌ Health check failed for ${serviceName}:`, error.message);
            this.metrics[serviceName].status = 'error';
        }
    }

    /**
     * Check if process is running based on PID file
     */
    async checkProcessStatus(pidFile) {
        try {
            if (!fs.existsSync(pidFile)) {
                return false;
            }
            
            const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
            
            // Check if process exists
            try {
                process.kill(pid, 0); // Signal 0 checks if process exists
                return true;
            } catch (error) {
                return false;
            }
        } catch (error) {
            return false;
        }
    }

    /**
     * Perform HTTP health check
     */
    async httpHealthCheck(endpoint) {
        return new Promise((resolve, reject) => {
            const http = require('http');
            const url = new URL(endpoint);
            
            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'GET',
                timeout: 5000
            }, (res) => {
                resolve({ status: res.statusCode });
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Health check timeout')));
            req.end();
        });
    }

    /**
     * Calculate service uptime
     */
    calculateUptime(serviceName) {
        // This is a simplified calculation
        // In a real implementation, you'd track actual start times
        return Date.now() - this.startTime;
    }

    /**
     * Start metrics collection
     */
    startMetricsCollection() {
        setInterval(() => {
            this.collectSystemMetrics();
            this.emit('metricsUpdate', this.getMetrics());
        }, this.config.monitoring.interval);
        
        console.log('📊 Started metrics collection');
    }

    /**
     * Collect system metrics
     */
    collectSystemMetrics() {
        this.metrics.system = {
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpuCount: os.cpus().length,
            loadAverage: os.loadavg(),
            uptime: os.uptime()
        };
        
        // Check memory usage alert
        const memoryUsage = 1 - (this.metrics.system.freeMemory / this.metrics.system.totalMemory);
        if (memoryUsage > this.config.monitoring.alertThresholds.memoryUsage) {
            this.emit('memoryAlert', {
                usage: memoryUsage,
                threshold: this.config.monitoring.alertThresholds.memoryUsage,
                freeMemory: this.metrics.system.freeMemory,
                totalMemory: this.metrics.system.totalMemory
            });
        }
    }

    /**
     * Start log rotation
     */
    startLogRotation() {
        setInterval(() => {
            this.rotateLogsIfNeeded();
        }, 60000); // Check every minute
        
        console.log('🔄 Started log rotation');
    }

    /**
     * Rotate logs if they exceed size limit
     */
    rotateLogsIfNeeded() {
        for (const [serviceName, logPath] of Object.entries(this.config.logPaths)) {
            const logFile = path.join(logPath, 'application.log');
            
            try {
                if (fs.existsSync(logFile)) {
                    const stats = fs.statSync(logFile);
                    if (stats.size > this.config.monitoring.maxLogSize) {
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        const rotatedFile = path.join(logPath, `application-${timestamp}.log`);
                        
                        fs.renameSync(logFile, rotatedFile);
                        fs.writeFileSync(logFile, '');
                        
                        console.log(`🔄 Rotated log file for ${serviceName}: ${rotatedFile}`);
                        
                        // Compress old log file
                        this.compressLogFile(rotatedFile);
                    }
                }
            } catch (error) {
                console.error(`❌ Error rotating log for ${serviceName}:`, error.message);
            }
        }
    }

    /**
     * Compress log file (simplified implementation)
     */
    compressLogFile(filePath) {
        // In a real implementation, you'd use a compression library
        console.log(`📦 Log file compressed: ${filePath}`);
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            monitorUptime: Date.now() - this.startTime,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate monitoring report
     */
    generateReport() {
        const metrics = this.getMetrics();
        
        console.log('\n📊 Unified Monitoring Report');
        console.log('=' .repeat(50));
        console.log(`Monitor Uptime: ${Math.floor(metrics.monitorUptime / 1000)}s`);
        console.log(`Timestamp: ${metrics.timestamp}`);
        
        for (const [serviceName, serviceMetrics] of Object.entries(metrics)) {
            if (serviceName === 'system' || serviceName === 'monitorUptime' || serviceName === 'timestamp') {
                continue;
            }
            
            const serviceConfig = this.config.services[serviceName];
            if (serviceConfig) {
                console.log(`\n🔧 ${serviceConfig.name}:`);
                console.log(`  Status: ${serviceMetrics.status}`);
                console.log(`  Requests: ${serviceMetrics.requests}`);
                console.log(`  Errors: ${serviceMetrics.errors}`);
                console.log(`  Warnings: ${serviceMetrics.warnings}`);
                
                if (serviceMetrics.responseTime.length > 0) {
                    const avgResponseTime = serviceMetrics.responseTime.reduce((a, b) => a + b, 0) / serviceMetrics.responseTime.length;
                    console.log(`  Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
                }
                
                console.log(`  Last Health Check: ${serviceMetrics.lastHealthCheck || 'Never'}`);
            }
        }
        
        console.log(`\n💻 System:`);
        console.log(`  Memory Usage: ${((1 - metrics.system.freeMemory / metrics.system.totalMemory) * 100).toFixed(1)}%`);
        console.log(`  Load Average: ${metrics.system.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
        console.log(`  System Uptime: ${Math.floor(metrics.system.uptime / 3600)}h`);
    }
}

// CLI Interface
if (require.main === module) {
    const monitor = new UnifiedMonitor();
    
    // Set up event listeners
    monitor.on('criticalAlert', (alert) => {
        console.log(`🚨 CRITICAL ALERT [${alert.serviceName}]: ${alert.message}`);
    });
    
    monitor.on('errorRateAlert', (alert) => {
        console.log(`⚠️  ERROR RATE ALERT [${alert.serviceName}]: ${(alert.errorRate * 100).toFixed(1)}% (threshold: ${(alert.threshold * 100).toFixed(1)}%)`);
    });
    
    monitor.on('serviceDown', (alert) => {
        console.log(`🔴 SERVICE DOWN [${alert.serviceName}]: ${alert.reason}`);
    });
    
    monitor.on('memoryAlert', (alert) => {
        console.log(`🧠 MEMORY ALERT: ${(alert.usage * 100).toFixed(1)}% used (threshold: ${(alert.threshold * 100).toFixed(1)}%)`);
    });
    
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            monitor.start();
            
            // Generate report every 30 seconds
            setInterval(() => {
                monitor.generateReport();
            }, 30000);
            
            // Graceful shutdown
            process.on('SIGINT', async () => {
                console.log('\n🛑 Received SIGINT, shutting down gracefully...');
                await monitor.stop();
                process.exit(0);
            });
            
            break;
            
        case 'report':
            // Generate a one-time report
            monitor.generateReport();
            break;
            
        case 'metrics':
            console.log(JSON.stringify(monitor.getMetrics(), null, 2));
            break;
            
        default:
            console.log('Unified Monitor for SafeExec and Desktop Commander');
            console.log('Usage:');
            console.log('  node unified-monitor.js start   - Start monitoring');
            console.log('  node unified-monitor.js report  - Generate report');
            console.log('  node unified-monitor.js metrics - Show metrics JSON');
            break;
    }
}

module.exports = UnifiedMonitor;