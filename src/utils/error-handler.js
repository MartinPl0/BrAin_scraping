/**
 * Standardized Error Handler for BrAIn Scraping System
 * Provides consistent error handling across all components
 */
class ErrorHandler {
    constructor() {
        this.errorTypes = {
            CRAWL_ERROR: 'CRAWL_ERROR',
            EXTRACTION_ERROR: 'EXTRACTION_ERROR',
            VALIDATION_ERROR: 'VALIDATION_ERROR',
            STORAGE_ERROR: 'STORAGE_ERROR',
            NETWORK_ERROR: 'NETWORK_ERROR',
            CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
            UNKNOWN_ERROR: 'UNKNOWN_ERROR'
        };
    }

    /**
     * Create a standardized error object
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
     * Handle and log errors consistently
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
     * Convert any error to standardized format
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
     * Log standardized error with appropriate level
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
     * Create a success result object
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
     * Wrap async operations with standardized error handling
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
     * Check if an error is recoverable
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
     * Get error recovery suggestions
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
     * Create error summary for reporting
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

module.exports = ErrorHandler;
