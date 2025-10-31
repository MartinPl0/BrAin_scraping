/**
 * Comprehensive Error Monitoring System
 * Tracks all errors across the application, including silent failures
 * Also provides error standardization and handling utilities
 */
class ErrorMonitor {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.successes = [];
        this.startTime = null;
        this.endTime = null;
        this.providerStatus = new Map(); // Track status per provider
        
        // Error types for standardization (from ErrorHandler)
        this.errorTypes = {
            CRAWL_ERROR: 'CRAWL_ERROR',
            EXTRACTION_ERROR: 'EXTRACTION_ERROR',
            VALIDATION_ERROR: 'VALIDATION_ERROR',
            STORAGE_ERROR: 'STORAGE_ERROR',
            NETWORK_ERROR: 'NETWORK_ERROR',
            CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
            FORBIDDEN_ERROR: 'FORBIDDEN_ERROR',
            NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
            SERVER_ERROR: 'SERVER_ERROR',
            CLIENT_ERROR: 'CLIENT_ERROR',
            SYSTEM_ERROR: 'SYSTEM_ERROR',
            UNKNOWN_ERROR: 'UNKNOWN_ERROR'
        };
    }

    /**
     * Start monitoring session
     */
    start() {
        this.errors = [];
        this.warnings = [];
        this.successes = [];
        this.providerStatus.clear();
        this.startTime = new Date();
        console.log('📊 Error monitoring started');
    }

    /**
     * Create a standardized error object (from ErrorHandler)
     * @param {string} type - Error type from errorTypes
     * @param {string} message - Error message
     * @param {Object} context - Additional context (provider, operation, etc.)
     * @param {Error} originalError - Original error if wrapping
     * @returns {Object} Standardized error object
     */
    createError(type, message, context = {}, originalError = null) {
        const error = {
            type: type,
            message: message,
            context: context,
            timestamp: new Date().toISOString(),
            stack: originalError ? originalError.stack : new Error().stack
        };

        if (originalError) {
            error.originalError = {
                message: originalError.message,
                name: originalError.name,
                stack: originalError.stack
            };
        }

        return error;
    }

    /**
     * Handle and log errors consistently (from ErrorHandler)
     * @param {Object} error - Error object (standardized or original)
     * @param {string} operation - Operation being performed
     * @param {string} provider - Provider name (optional)
     * @returns {Object} Processed error result
     */
    handleError(error, operation, provider = null) {
        const errorResult = {
            success: false,
            error: error,
            operation: operation,
            provider: provider,
            timestamp: new Date().toISOString()
        };

        // Log error based on type
        if (error.type) {
            // Already standardized error
            this.logStandardizedError(error, operation, provider);
        } else {
            // Convert to standardized error
            const standardizedError = this.standardizeError(error, operation, provider);
            this.logStandardizedError(standardizedError, operation, provider);
            errorResult.error = standardizedError;
        }

        return errorResult;
    }

    /**
     * Convert any error to standardized format (from ErrorHandler)
     * @param {Error|Object} error - Original error
     * @param {string} operation - Operation being performed
     * @param {string} provider - Provider name
     * @returns {Object} Standardized error
     */
    standardizeError(error, operation, provider) {
        let type = this.errorTypes.UNKNOWN_ERROR;
        let message = error.message || 'Unknown error occurred';

        // Determine error type based on error characteristics
        if (error.message) {
            if (error.message.includes('crawl') || error.message.includes('browser') || error.message.includes('navigation')) {
                type = this.errorTypes.CRAWL_ERROR;
            } else if (error.message.includes('extract') || error.message.includes('parse') || error.message.includes('section')) {
                type = this.errorTypes.EXTRACTION_ERROR;
            } else if (error.message.includes('validation') || error.message.includes('validate')) {
                type = this.errorTypes.VALIDATION_ERROR;
            } else if (error.message.includes('save') || error.message.includes('storage') || error.message.includes('dataset')) {
                type = this.errorTypes.STORAGE_ERROR;
            } else if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('connection')) {
                type = this.errorTypes.NETWORK_ERROR;
            } else if (error.message.includes('config') || error.message.includes('configuration')) {
                type = this.errorTypes.CONFIGURATION_ERROR;
            }
        }

        return this.createError(type, message, { operation, provider }, error);
    }

    /**
     * Log standardized error with appropriate level (from ErrorHandler)
     * @param {Object} error - Standardized error object
     * @param {string} operation - Operation being performed
     * @param {string} provider - Provider name
     */
    logStandardizedError(error, operation, provider) {
        const logPrefix = provider ? `[${provider}]` : '';
        const operationPrefix = operation ? `[${operation}]` : '';

        switch (error.type) {
            case this.errorTypes.CRAWL_ERROR:
                console.error(`❌ ${logPrefix}${operationPrefix} Crawl Error: ${error.message}`);
                break;
            case this.errorTypes.EXTRACTION_ERROR:
                console.error(`❌ ${logPrefix}${operationPrefix} Extraction Error: ${error.message}`);
                break;
            case this.errorTypes.VALIDATION_ERROR:
                console.error(`❌ ${logPrefix}${operationPrefix} Validation Error: ${error.message}`);
                break;
            case this.errorTypes.STORAGE_ERROR:
                console.error(`❌ ${logPrefix}${operationPrefix} Storage Error: ${error.message}`);
                break;
            case this.errorTypes.NETWORK_ERROR:
                console.error(`❌ ${logPrefix}${operationPrefix} Network Error: ${error.message}`);
                break;
            case this.errorTypes.CONFIGURATION_ERROR:
                console.error(`❌ ${logPrefix}${operationPrefix} Configuration Error: ${error.message}`);
                break;
            default:
                console.error(`❌ ${logPrefix}${operationPrefix} Unknown Error: ${error.message}`);
        }

        // Log context if available
        if (error.context && Object.keys(error.context).length > 0) {
            console.error(`   Context:`, error.context);
        }

        // Log original error if available
        if (error.originalError) {
            console.error(`   Original Error: ${error.originalError.message}`);
        }
    }

    /**
     * Record an error
     * @param {Object} errorInfo - Error information
     */
    recordError(errorInfo) {
        const error = {
            id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            provider: errorInfo.provider || 'Unknown',
            operation: errorInfo.operation || 'Unknown',
            type: errorInfo.type || 'UNKNOWN_ERROR',
            message: errorInfo.message || 'Unknown error',
            errorCode: errorInfo.errorCode || null, // HTTP status code, etc.
            stack: errorInfo.stack || null,
            context: errorInfo.context || {},
            severity: errorInfo.severity || 'error', // 'error', 'warning', 'critical'
            isProviderFailure: this.isProviderFailure(errorInfo) // Track if this is a provider-specific issue
        };

        this.errors.push(error);

        // Update provider status
        this.updateProviderStatus(error.provider, 'error', error);

        // Log with appropriate emoji based on error type
        const emoji = this.getErrorEmoji(error);
        console.error(`${emoji} [${error.provider}] ${error.operation}: ${error.message}`);
        
        return error;
    }

    /**
     * Determine if an error is a provider failure vs system error
     * @param {Object} errorInfo - Error information
     * @returns {boolean} True if this is a provider-specific failure
     */
    isProviderFailure(errorInfo) {
        // System errors are explicitly marked as such
        if (errorInfo.type === 'SYSTEM_ERROR' || errorInfo.provider === 'System') {
            return false;
        }
        
        const providerFailureTypes = [
            'FORBIDDEN_ERROR', 'NOT_FOUND_ERROR', 'NETWORK_ERROR',
            'CRAWL_ERROR', 'EXTRACTION_ERROR'
        ];
        
        const providerFailureOperations = [
            'pdf-download', 'crawl', 'extraction'
        ];
        
        return providerFailureTypes.includes(errorInfo.type) || 
               providerFailureOperations.includes(errorInfo.operation) ||
               (errorInfo.errorCode !== null && errorInfo.provider !== 'System'); // HTTP errors are usually provider issues, unless it's a system error
    }

    /**
     * Get appropriate emoji for error type
     * @param {Object} error - Error object
     * @returns {string} Emoji string
     */
    getErrorEmoji(error) {
        if (error.errorCode === 403) return '🚫'; // Blocked
        if (error.errorCode === 404) return '🔍'; // Not found
        if (error.errorCode >= 500) return '🔥'; // Server error
        if (error.type === 'FORBIDDEN_ERROR') return '🚫';
        if (error.type === 'NETWORK_ERROR') return '🌐';
        if (error.type === 'CRAWL_ERROR') return '🕷️';
        if (error.type === 'EXTRACTION_ERROR') return '📄';
        return '❌'; // Default error
    }

    /**
     * Record a warning
     * @param {Object} warningInfo - Warning information
     */
    recordWarning(warningInfo) {
        const warning = {
            id: `warning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            provider: warningInfo.provider || 'Unknown',
            operation: warningInfo.operation || 'Unknown',
            message: warningInfo.message || 'Unknown warning',
            context: warningInfo.context || {}
        };

        this.warnings.push(warning);
        
        console.warn(`⚠️  [${warning.provider}] ${warning.operation}: ${warning.message}`);
        
        return warning;
    }

    /**
     * Record a success
     * @param {Object} successInfo - Success information
     */
    recordSuccess(successInfo) {
        const success = {
            id: `success_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            provider: successInfo.provider || 'Unknown',
            operation: successInfo.operation || 'Unknown',
            message: successInfo.message || 'Operation successful',
            context: successInfo.context || {}
        };

        this.successes.push(success);

        // Update provider status
        this.updateProviderStatus(success.provider, 'success', success);

        return success;
    }

    /**
     * Update provider status tracking
     * @param {string} provider - Provider name
     * @param {string} status - Status ('success', 'error', 'warning')
     * @param {Object} data - Additional data
     */
    updateProviderStatus(provider, status, data) {
        if (!this.providerStatus.has(provider)) {
            this.providerStatus.set(provider, {
                provider,
                status: 'unknown',
                errors: [],
                warnings: [],
                successes: [],
                lastUpdate: null
            });
        }

        const providerData = this.providerStatus.get(provider);
        providerData.lastUpdate = new Date().toISOString();

        if (status === 'error') {
            providerData.errors.push(data);
            if (providerData.status !== 'error') {
                providerData.status = 'error';
            }
        } else if (status === 'warning') {
            providerData.warnings.push(data);
            if (providerData.status !== 'error' && providerData.status !== 'warning') {
                providerData.status = 'warning';
            }
        } else if (status === 'success') {
            providerData.successes.push(data);
            if (providerData.status === 'unknown') {
                providerData.status = 'success';
            }
        }
    }

    /**
     * Check for HTTP errors (403, 404, 500, etc.)
     * @param {Error} error - Error object
     * @param {string} provider - Provider name
     * @param {string} operation - Operation name
     * @returns {Object|null} Recorded error or null
     */
    checkHttpError(error, provider, operation) {
        const message = error.message || '';
        const stack = error.stack || '';

        // Check for HTTP status codes
        const httpStatusPattern = /HTTP (\d{3})/;
        const statusMatch = message.match(httpStatusPattern);

        if (statusMatch) {
            const statusCode = parseInt(statusMatch[1]);
            let errorType = 'NETWORK_ERROR';
            let severity = 'error';

            if (statusCode === 403) {
                errorType = 'FORBIDDEN_ERROR';
                severity = 'critical';
            } else if (statusCode === 404) {
                errorType = 'NOT_FOUND_ERROR';
            } else if (statusCode >= 500) {
                errorType = 'SERVER_ERROR';
                severity = 'error';
            } else if (statusCode >= 400) {
                errorType = 'CLIENT_ERROR';
            }

            return this.recordError({
                provider,
                operation,
                type: errorType,
                message: `HTTP ${statusCode}: ${error.message}`,
                errorCode: statusCode,
                stack,
                context: { httpStatus: statusCode },
                severity
            });
        }

        // Check for network-related errors
        if (message.includes('net::ERR_') || message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
            return this.recordError({
                provider,
                operation,
                type: 'NETWORK_ERROR',
                message,
                stack,
                context: { networkError: true },
                severity: 'error'
            });
        }

        // Check for puppeteer/browser errors
        if (message.includes('Target closed') || message.includes('Navigation failed') || message.includes('Timeout')) {
            return this.recordError({
                provider,
                operation,
                type: 'CRAWL_ERROR',
                message,
                stack,
                context: { browserError: true },
                severity: 'error'
            });
        }

        return null;
    }

    /**
     * End monitoring session and generate summary
     * @returns {Object} Monitoring summary
     */
    end() {
        this.endTime = new Date();
        const duration = this.endTime - this.startTime;

        const summary = {
            startTime: this.startTime.toISOString(),
            endTime: this.endTime.toISOString(),
            duration: duration,
            durationFormatted: this.formatDuration(duration),
            totalErrors: this.errors.length,
            totalWarnings: this.warnings.length,
            totalSuccesses: this.successes.length,
            errorsByType: this.groupErrorsByType(),
            errorsByProvider: this.groupErrorsByProvider(),
            warningsByProvider: this.groupWarningsByProvider(),
            successesByProvider: this.groupSuccessesByProvider(),
            providerStatus: Array.from(this.providerStatus.values()),
            criticalErrors: this.errors.filter(e => e.severity === 'critical'),
            hasErrors: this.errors.length > 0,
            hasWarnings: this.warnings.length > 0
        };

        console.log(`📊 Monitoring session ended: ${summary.totalErrors} errors, ${summary.totalWarnings} warnings, ${summary.totalSuccesses} successes`);
        
        return summary;
    }

    /**
     * Group errors by type
     * @returns {Object} Errors grouped by type
     */
    groupErrorsByType() {
        const grouped = {};
        this.errors.forEach(error => {
            if (!grouped[error.type]) {
                grouped[error.type] = [];
            }
            grouped[error.type].push(error);
        });
        return grouped;
    }

    /**
     * Group errors by provider
     * @returns {Object} Errors grouped by provider
     */
    groupErrorsByProvider() {
        const grouped = {};
        this.errors.forEach(error => {
            if (!grouped[error.provider]) {
                grouped[error.provider] = [];
            }
            grouped[error.provider].push(error);
        });
        return grouped;
    }

    /**
     * Group warnings by provider
     * @returns {Object} Warnings grouped by provider
     */
    groupWarningsByProvider() {
        const grouped = {};
        this.warnings.forEach(warning => {
            if (!grouped[warning.provider]) {
                grouped[warning.provider] = [];
            }
            grouped[warning.provider].push(warning);
        });
        return grouped;
    }

    /**
     * Group successes by provider
     * @returns {Object} Successes grouped by provider
     */
    groupSuccessesByProvider() {
        const grouped = {};
        this.successes.forEach(success => {
            if (!grouped[success.provider]) {
                grouped[success.provider] = [];
            }
            grouped[success.provider].push(success);
        });
        return grouped;
    }

    /**
     * Format duration in human-readable format
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    /**
     * Get all errors for email reporting
     * @returns {Array} Array of error objects formatted for email
     */
    getErrorsForEmail() {
        return this.errors.map(error => ({
            provider: error.provider,
            operation: error.operation,
            type: error.type,
            message: error.message,
            errorCode: error.errorCode,
            timestamp: error.timestamp,
            severity: error.severity
        }));
    }

    /**
     * Check if any provider has critical failures
     * @returns {boolean} True if any provider has critical errors
     */
    hasCriticalFailures() {
        return this.errors.some(e => e.severity === 'critical');
    }

    /**
     * Get failed providers
     * @returns {Array} Array of provider names that have errors
     */
    getFailedProviders() {
        const failedProviders = new Set();
        this.errors.forEach(error => {
            if (error.provider && error.provider !== 'Unknown') {
                failedProviders.add(error.provider);
            }
        });
        return Array.from(failedProviders);
    }

    /**
     * Get successful providers
     * @returns {Array} Array of provider names that succeeded
     */
    getSuccessfulProviders() {
        const successfulProviders = new Set();
        this.successes.forEach(success => {
            if (success.provider && success.provider !== 'Unknown') {
                successfulProviders.add(success.provider);
            }
        });
        return Array.from(successfulProviders);
    }

    /**
     * Create a success result object (from ErrorHandler)
     * @param {Object} data - Success data
     * @param {string} operation - Operation performed
     * @param {string} provider - Provider name
     * @returns {Object} Success result
     */
    createSuccessResult(data, operation, provider = null) {
        return {
            success: true,
            data: data,
            operation: operation,
            provider: provider,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Wrap async operations with standardized error handling (from ErrorHandler)
     * @param {Function} asyncFunction - Async function to wrap
     * @param {string} operation - Operation name
     * @param {string} provider - Provider name
     * @returns {Function} Wrapped function
     */
    wrapAsyncOperation(asyncFunction, operation, provider = null) {
        return async (...args) => {
            try {
                const result = await asyncFunction(...args);
                return this.createSuccessResult(result, operation, provider);
            } catch (error) {
                return this.handleError(error, operation, provider);
            }
        };
    }

    /**
     * Check if an error is recoverable (from ErrorHandler)
     * @param {Object} error - Error object
     * @returns {boolean} True if error is recoverable
     */
    isRecoverableError(error) {
        if (!error.type) return false;

        const recoverableTypes = [
            this.errorTypes.NETWORK_ERROR,
            this.errorTypes.CRAWL_ERROR
        ];

        return recoverableTypes.includes(error.type);
    }

    /**
     * Get error recovery suggestions (from ErrorHandler)
     * @param {Object} error - Error object
     * @returns {Array} Array of recovery suggestions
     */
    getRecoverySuggestions(error) {
        const suggestions = [];

        switch (error.type) {
            case this.errorTypes.NETWORK_ERROR:
                suggestions.push('Check internet connection');
                suggestions.push('Retry operation after delay');
                suggestions.push('Check if target website is accessible');
                break;
            case this.errorTypes.CRAWL_ERROR:
                suggestions.push('Check if website structure has changed');
                suggestions.push('Verify crawler configuration');
                suggestions.push('Try running with different browser settings');
                break;
            case this.errorTypes.EXTRACTION_ERROR:
                suggestions.push('Check if PDF format has changed');
                suggestions.push('Verify extraction configuration');
                suggestions.push('Try different extraction method');
                break;
            case this.errorTypes.VALIDATION_ERROR:
                suggestions.push('Review extracted data quality');
                suggestions.push('Check validation rules');
                suggestions.push('Verify data source integrity');
                break;
            case this.errorTypes.STORAGE_ERROR:
                suggestions.push('Check disk space and permissions');
                suggestions.push('Verify storage configuration');
                suggestions.push('Try alternative storage location');
                break;
            case this.errorTypes.CONFIGURATION_ERROR:
                suggestions.push('Check configuration files');
                suggestions.push('Verify all required settings');
                suggestions.push('Validate configuration format');
                break;
        }

        return suggestions;
    }

    /**
     * Create error summary for reporting (from ErrorHandler)
     * @param {Array} errors - Array of error objects
     * @returns {Object} Error summary
     */
    createErrorSummary(errors) {
        const summary = {
            totalErrors: errors.length,
            errorTypes: {},
            providers: {},
            operations: {},
            recoverableErrors: 0,
            criticalErrors: 0
        };

        errors.forEach(error => {
            // Count by type
            summary.errorTypes[error.type] = (summary.errorTypes[error.type] || 0) + 1;

            // Count by provider
            if (error.context && error.context.provider) {
                summary.providers[error.context.provider] = (summary.providers[error.context.provider] || 0) + 1;
            }

            // Count by operation
            if (error.context && error.context.operation) {
                summary.operations[error.context.operation] = (summary.operations[error.context.operation] || 0) + 1;
            }

            // Count recoverable vs critical
            if (this.isRecoverableError(error)) {
                summary.recoverableErrors++;
            } else {
                summary.criticalErrors++;
            }
        });

        return summary;
    }
}

module.exports = ErrorMonitor;

