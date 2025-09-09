/**
 * SafeExec Enhanced Error Handler
 * Implements configurable timeouts, retry mechanisms, and robust error handling
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class SafeExecErrorHandler extends EventEmitter {
    constructor(configPath = null) {
        super();
        this.configPath = configPath || path.join(__dirname, '..', 'config', 'error-handling.json');
        this.config = this.loadConfig();
        this.circuitBreakers = new Map();
        this.metrics = {
            errors: 0,
            retries: 0,
            successes: 0,
            circuitBreakerTrips: 0
        };
        this.startTime = Date.now();
    }

    loadConfig() {
        try {
            const configContent = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            // Apply environment-specific overrides
            const env = process.env.NODE_ENV || 'development';
            if (config.environment && config.environment[env]) {
                this.mergeConfig(config.errorHandling, config.environment[env]);
            }
            
            return config.errorHandling;
        } catch (error) {
            console.warn('Failed to load error handling config, using defaults:', error.message);
            return this.getDefaultConfig();
        }
    }

    mergeConfig(base, override) {
        for (const [key, value] of Object.entries(override)) {
            if (typeof value === 'object' && !Array.isArray(value) && base[key]) {
                this.mergeConfig(base[key], value);
            } else {
                base[key] = value;
            }
        }
    }

    getDefaultConfig() {
        return {
            timeouts: {
                commandExecution: { default: 30000 },
                processStartup: { default: 10000 },
                healthCheck: { default: 5000 }
            },
            retryMechanisms: {
                commandExecution: {
                    enabled: true,
                    maxAttempts: 3,
                    backoffStrategy: 'exponential',
                    initialDelay: 1000
                }
            },
            circuitBreaker: {
                enabled: false
            }
        };
    }

    /**
     * Execute a function with timeout and retry logic
     */
    async executeWithRetry(operation, operationType = 'commandExecution', context = {}) {
        const retryConfig = this.config.retryMechanisms[operationType];
        const timeoutConfig = this.config.timeouts[operationType];
        
        if (!retryConfig || !retryConfig.enabled) {
            return this.executeWithTimeout(operation, timeoutConfig?.default || 30000, context);
        }

        let lastError;
        const maxAttempts = retryConfig.maxAttempts || 3;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Check circuit breaker
                if (this.isCircuitBreakerOpen(operationType)) {
                    throw new Error(`Circuit breaker is open for ${operationType}`);
                }

                const result = await this.executeWithTimeout(
                    operation, 
                    timeoutConfig?.default || 30000, 
                    { ...context, attempt }
                );
                
                this.recordSuccess(operationType);
                this.metrics.successes++;
                
                if (attempt > 1) {
                    this.emit('retrySuccess', { operationType, attempt, context });
                }
                
                return result;
            } catch (error) {
                lastError = error;
                this.recordError(operationType, error);
                this.metrics.errors++;
                
                if (attempt < maxAttempts && this.shouldRetry(error, retryConfig)) {
                    const delay = this.calculateBackoff(attempt, retryConfig);
                    this.metrics.retries++;
                    
                    this.emit('retryAttempt', { 
                        operationType, 
                        attempt, 
                        error: error.message, 
                        delay, 
                        context 
                    });
                    
                    await this.sleep(delay);
                } else {
                    break;
                }
            }
        }
        
        this.emit('retryFailed', { 
            operationType, 
            attempts: maxAttempts, 
            error: lastError.message, 
            context 
        });
        
        throw lastError;
    }

    /**
     * Execute a function with timeout
     */
    async executeWithTimeout(operation, timeout, context = {}) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                const error = new Error(`Operation timed out after ${timeout}ms`);
                error.code = 'ETIMEDOUT';
                error.context = context;
                reject(error);
            }, timeout);

            try {
                const result = await operation();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                error.context = context;
                reject(error);
            }
        });
    }

    /**
     * Determine if an error should trigger a retry
     */
    shouldRetry(error, retryConfig) {
        if (!retryConfig.retryableErrors) {
            return true; // Retry all errors if no specific list provided
        }
        
        return retryConfig.retryableErrors.some(retryableError => {
            return error.code === retryableError || 
                   error.message.includes(retryableError) ||
                   error.status === retryableError;
        });
    }

    /**
     * Calculate backoff delay for retry attempts
     */
    calculateBackoff(attempt, retryConfig) {
        const { backoffStrategy, initialDelay, maxDelay, jitter } = retryConfig;
        let delay = initialDelay || 1000;
        
        switch (backoffStrategy) {
            case 'exponential':
                delay = initialDelay * Math.pow(2, attempt - 1);
                break;
            case 'linear':
                delay = initialDelay * attempt;
                break;
            case 'constant':
            default:
                delay = initialDelay;
                break;
        }
        
        if (maxDelay) {
            delay = Math.min(delay, maxDelay);
        }
        
        if (jitter) {
            delay += Math.random() * delay * 0.1; // Add up to 10% jitter
        }
        
        return Math.floor(delay);
    }

    /**
     * Circuit breaker implementation
     */
    isCircuitBreakerOpen(operationType) {
        if (!this.config.circuitBreaker?.enabled) {
            return false;
        }
        
        const breaker = this.circuitBreakers.get(operationType);
        if (!breaker) {
            return false;
        }
        
        const now = Date.now();
        
        // Check if recovery timeout has passed
        if (breaker.state === 'open' && 
            now - breaker.lastFailure > this.config.circuitBreaker.recoveryTimeout) {
            breaker.state = 'half-open';
            breaker.halfOpenCalls = 0;
        }
        
        return breaker.state === 'open';
    }

    recordSuccess(operationType) {
        if (!this.config.circuitBreaker?.enabled) {
            return;
        }
        
        const breaker = this.circuitBreakers.get(operationType);
        if (breaker) {
            if (breaker.state === 'half-open') {
                breaker.halfOpenCalls++;
                if (breaker.halfOpenCalls >= this.config.circuitBreaker.halfOpenMaxCalls) {
                    breaker.state = 'closed';
                    breaker.failures = 0;
                }
            } else if (breaker.state === 'closed') {
                breaker.failures = Math.max(0, breaker.failures - 1);
            }
        }
    }

    recordError(operationType, error) {
        if (!this.config.circuitBreaker?.enabled) {
            return;
        }
        
        let breaker = this.circuitBreakers.get(operationType);
        if (!breaker) {
            breaker = {
                state: 'closed',
                failures: 0,
                lastFailure: 0,
                halfOpenCalls: 0
            };
            this.circuitBreakers.set(operationType, breaker);
        }
        
        breaker.failures++;
        breaker.lastFailure = Date.now();
        
        if (breaker.failures >= this.config.circuitBreaker.failureThreshold) {
            breaker.state = 'open';
            this.metrics.circuitBreakerTrips++;
            this.emit('circuitBreakerOpen', { operationType, error: error.message });
        }
    }

    /**
     * Run preflight checks
     */
    async runPreflightChecks() {
        if (!this.config.preflightChecks?.enabled) {
            return { success: true, results: [] };
        }
        
        const results = [];
        const checks = this.config.preflightChecks.checks || [];
        
        for (const check of checks) {
            try {
                const result = await this.executeWithTimeout(
                    () => this.runSingleCheck(check),
                    check.timeout || 5000,
                    { checkName: check.name }
                );
                
                results.push({
                    name: check.name,
                    success: true,
                    result
                });
            } catch (error) {
                results.push({
                    name: check.name,
                    success: false,
                    error: error.message,
                    required: check.required
                });
                
                if (check.required) {
                    return {
                        success: false,
                        results,
                        failedCheck: check.name
                    };
                }
            }
        }
        
        return {
            success: true,
            results
        };
    }

    async runSingleCheck(check) {
        switch (check.name) {
            case 'nodeVersion':
                return this.checkNodeVersion();
            case 'memoryAvailable':
                return this.checkMemoryAvailable(check.minMemoryMB);
            case 'diskSpace':
                return this.checkDiskSpace(check.minSpaceMB);
            case 'permissions':
                return this.checkPermissions();
            case 'dependencies':
                return this.checkDependencies();
            default:
                throw new Error(`Unknown preflight check: ${check.name}`);
        }
    }

    checkNodeVersion() {
        const version = process.version;
        const major = parseInt(version.substring(1).split('.')[0]);
        return {
            version,
            major,
            supported: major >= 16
        };
    }

    checkMemoryAvailable(minMemoryMB = 512) {
        const totalMemory = require('os').totalmem();
        const freeMemory = require('os').freemem();
        const totalMB = Math.floor(totalMemory / 1024 / 1024);
        const freeMB = Math.floor(freeMemory / 1024 / 1024);
        
        return {
            totalMB,
            freeMB,
            sufficient: freeMB >= minMemoryMB
        };
    }

    checkDiskSpace(minSpaceMB = 100) {
        // Simplified disk space check
        return {
            available: true,
            sufficient: true
        };
    }

    checkPermissions() {
        try {
            const testFile = path.join(__dirname, '..', '.permission-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            return { writable: true };
        } catch (error) {
            return { writable: false, error: error.message };
        }
    }

    checkDependencies() {
        try {
            const packagePath = path.join(__dirname, '..', 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            return {
                packageExists: true,
                dependencies: Object.keys(packageJson.dependencies || {})
            };
        } catch (error) {
            return {
                packageExists: false,
                error: error.message
            };
        }
    }

    /**
     * Get current metrics and status
     */
    getMetrics() {
        const uptime = Date.now() - this.startTime;
        return {
            ...this.metrics,
            uptime,
            circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([type, breaker]) => ({
                type,
                state: breaker.state,
                failures: breaker.failures
            }))
        };
    }

    /**
     * Utility function for sleep/delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        const timeout = this.config.timeouts?.gracefulShutdown?.default || 15000;
        
        return this.executeWithTimeout(async () => {
            this.emit('shutdown');
            // Perform cleanup operations
            this.circuitBreakers.clear();
        }, timeout);
    }
}

module.exports = SafeExecErrorHandler;