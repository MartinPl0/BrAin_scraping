/**
 * Email Notification System
 * Sends email notifications for monitoring failures, errors, and summaries
 * 
 * Configuration:
 * Add to src/config/scraper-config.json:
 * {
 *   "email": {
 *     "smtp": {
 *       "host": "smtp.gmail.com",
 *       "port": 587,
 *       "secure": false,
 *       "auth": {
 *         "user": "your-email@gmail.com",
 *         "pass": "your-app-password"
 *       }
 *     },
 *     "from": "your-email@gmail.com",
 *     "to": ["recipient@example.com"]
 *   }
 * }
 */

const nodemailer = require('nodemailer');

class EmailNotifier {
    constructor(config) {
        this.config = config;
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        try {
            if (!this.config || !this.config.email || !this.config.email.smtp) {
                console.warn('⚠️  Email configuration not found, email notifications disabled');
                console.warn('   Add email configuration to src/config/scraper-config.json');
                return;
            }

            this.transporter = nodemailer.createTransport(this.config.email.smtp);
            console.log('✅ Email transporter initialized');
        } catch (error) {
            console.error('❌ Failed to initialize email transporter:', error.message);
            this.transporter = null;
        }
    }

    async sendEmail(options) {
        try {
            if (!this.transporter) {
                console.warn('⚠️  Email transporter not available, skipping email notification');
                return false;
            }

            const mailOptions = {
                from: this.config.email.from || 'price-monitor@example.com',
                to: this.config.email.to || ['admin@example.com'],
                subject: this.formatSubject(options.subject, options.provider),
                html: this.formatEmailBody(options),
                text: this.formatEmailBody(options, 'text')
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Email sent successfully: ${result.messageId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send email:', error.message);
            return false;
        }
    }

    async sendFailureNotification(failureInfo) {
        const severityText = failureInfo.severity === 'critical' ? 'CRITICAL' : 'ALERT';
        const emailOptions = {
            subject: `[${severityText}] Price Monitor Alert - ${failureInfo.provider}`,
            provider: failureInfo.provider,
            type: 'failure',
            title: `Price Monitoring ${severityText}`,
            content: this.formatFailureContent(failureInfo),
            timestamp: new Date().toISOString()
        };

        return await this.sendEmail(emailOptions);
    }

    /**
     * Send comprehensive error summary email
     * @param {Object} summaryInfo - Error summary information
     */
    async sendErrorSummary(summaryInfo) {
        // Determine if this is a success or error summary
        const hasErrors = summaryInfo.totalErrors > 0;
        const hasWarnings = summaryInfo.totalWarnings > 0;
        const hasSuccesses = summaryInfo.totalSuccesses > 0;
        
        let subject, title;
        if (hasErrors || hasWarnings) {
            subject = `Price Monitor Summary - ${summaryInfo.totalErrors} Error(s)${hasWarnings ? `, ${summaryInfo.totalWarnings} Warning(s)` : ''}`;
            title = 'Price Monitoring Error Summary';
        } else if (hasSuccesses) {
            subject = `Price Monitor Summary - ${summaryInfo.totalSuccesses} Success(es)`;
            title = 'Price Monitoring Success Summary';
        } else {
            subject = 'Price Monitor Summary';
            title = 'Price Monitoring Summary';
        }
        
        const emailOptions = {
            subject: subject,
            provider: 'All Providers',
            type: 'summary',
            title: title,
            content: this.formatErrorSummaryContent(summaryInfo),
            timestamp: new Date().toISOString()
        };

        return await this.sendEmail(emailOptions);
    }

    /**
     * Format error summary content for email
     * @param {Object} summaryInfo - Error summary
     * @returns {string} Formatted HTML content
     */
    formatErrorSummaryContent(summaryInfo) {
        const { 
            totalErrors, 
            totalWarnings, 
            totalSuccesses,
            errorsByProvider,
            errorsByType,
            criticalErrors,
            durationFormatted,
            startTime,
            endTime
        } = summaryInfo;

        let content = `
            <div class="content-section">
                <h3>📊 Monitoring Session Summary</h3>
                <p><strong>Duration:</strong> ${durationFormatted}</p>
                <p><strong>Started:</strong> ${new Date(startTime).toLocaleString()}</p>
                <p><strong>Completed:</strong> ${new Date(endTime).toLocaleString()}</p>
            </div>
            
            <div class="content-section">
                <h3>📈 Statistics</h3>
                <p><strong>Total Errors:</strong> <span style="color: ${totalErrors > 0 ? '#dc3545' : '#28a745'}">${totalErrors}</span></p>
                <p><strong>Total Warnings:</strong> ${totalWarnings}</p>
                <p><strong>Total Successes:</strong> ${totalSuccesses}</p>
                ${criticalErrors && criticalErrors.length > 0 ? `<p><strong style="color: #dc3545;">Critical Errors:</strong> ${criticalErrors.length}</p>` : ''}
            </div>
        `;

        if (errorsByProvider && Object.keys(errorsByProvider).length > 0) {
            content += `
                <div class="content-section">
                    <h3>🚨 Provider Issues & System Errors</h3>
            `;
            
            // Separate provider failures from system errors
            const providerFailures = [];
            const systemErrors = [];
            
            for (const [provider, errors] of Object.entries(errorsByProvider)) {
                errors.forEach(error => {
                    if (error.isProviderFailure) {
                        providerFailures.push({...error, provider});
                    } else {
                        systemErrors.push({...error, provider});
                    }
                });
            }
            
            // Show provider failures prominently
            if (providerFailures.length > 0) {
                content += `
                    <div style="margin: 15px 0; padding: 15px; background: #fff3e0; border-left: 4px solid #ff9800;">
                        <h4>⚠️ Provider Failures (${providerFailures.length})</h4>
                        <p>These providers had issues that prevented data extraction:</p>
                `;
                
                // Group by provider
                const failuresByProvider = {};
                providerFailures.forEach(error => {
                    if (!failuresByProvider[error.provider]) {
                        failuresByProvider[error.provider] = [];
                    }
                    failuresByProvider[error.provider].push(error);
                });
                
                for (const [provider, failures] of Object.entries(failuresByProvider)) {
                    const http403 = failures.filter(e => e.errorCode === 403);
                    const otherFailures = failures.filter(e => e.errorCode !== 403);
                    
                    content += `
                        <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px;">
                            <strong>${provider}</strong> - ${failures.length} failure(s)
                            ${http403.length > 0 ? `<br><span style="color: #dc3545; font-weight: bold;">🚫 HTTP 403 (BLOCKED): ${http403.length}</span>` : ''}
                            ${otherFailures.length > 0 ? `<br><span>Other issues: ${otherFailures.length}</span>` : ''}
                            <ul style="margin-top: 8px; font-size: 14px;">
                                ${failures.slice(0, 3).map(e => {
                                    const emoji = e.errorCode === 403 ? '🚫' : e.errorCode === 404 ? '🔍' : e.errorCode >= 500 ? '🔥' : '⚠️';
                                    const errorCode = e.errorCode ? ` (HTTP ${e.errorCode})` : '';
                                    return `<li>${emoji} <strong>${e.operation}</strong>: ${e.message.substring(0, 80)}${errorCode}</li>`;
                                }).join('')}
                                ${failures.length > 3 ? `<li>... and ${failures.length - 3} more</li>` : ''}
                            </ul>
                        </div>
                    `;
                }
                
                content += `</div>`;
            }
            
            // Show system errors separately
            if (systemErrors.length > 0) {
                content += `
                    <div style="margin: 15px 0; padding: 15px; background: #ffebee; border-left: 4px solid #f44336;">
                        <h4>🔥 System Errors (${systemErrors.length})</h4>
                        <p>Internal system issues that need attention:</p>
                        <ul style="margin-top: 8px;">
                            ${systemErrors.slice(0, 5).map(e => `<li><strong>${e.provider}</strong> - ${e.operation}: ${e.message.substring(0, 100)}</li>`).join('')}
                            ${systemErrors.length > 5 ? `<li>... and ${systemErrors.length - 5} more</li>` : ''}
                        </ul>
                    </div>
                `;
            }
            
            content += `</div>`;
        }

        if (errorsByType && Object.keys(errorsByType).length > 0) {
            content += `
                <div class="content-section">
                    <h3>📋 Errors by Type</h3>
                    <ul>
                        ${Object.entries(errorsByType).map(([type, errors]) => 
                            `<li><strong>${type}:</strong> ${errors.length}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }

        // Add successes section if there are any
        if (totalSuccesses > 0 && summaryInfo.successesByProvider) {
            content += `
                <div class="content-section">
                    <h3>✅ Successful Operations</h3>
                    <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <p><strong>Total Successful Operations:</strong> ${totalSuccesses}</p>
            `;
            
            if (summaryInfo.successesByProvider && Object.keys(summaryInfo.successesByProvider).length > 0) {
                content += '<ul style="margin-top: 10px;">';
                for (const [provider, successes] of Object.entries(summaryInfo.successesByProvider)) {
                    content += `<li><strong>${provider}:</strong> ${successes.length} success(es)</li>`;
                }
                content += '</ul>';
            }
            
            content += `</div></div>`;
        }

        return content;
    }

    async sendSuccessNotification(successInfo) {
        const emailOptions = {
            subject: 'Price Monitor Success - {provider}',
            provider: successInfo.provider,
            type: 'success',
            title: 'Price Monitoring Success',
            content: this.formatSuccessContent(successInfo),
            timestamp: new Date().toISOString()
        };

        return await this.sendEmail(emailOptions);
    }

    async sendSummaryNotification(summaryInfo) {
        const emailOptions = {
            subject: 'Price Monitor Summary - {provider}',
            provider: 'All Providers',
            type: 'summary',
            title: 'Price Monitoring Summary',
            content: this.formatSummaryContent(summaryInfo),
            timestamp: new Date().toISOString()
        };

        return await this.sendEmail(emailOptions);
    }

    formatSubject(template, provider) {
        return template.replace('{provider}', provider || 'Unknown');
    }

    formatEmailBody(options, format = 'html') {
        if (format === 'text') {
            return this.formatTextEmail(options);
        } else {
            return this.formatHtmlEmail(options);
        }
    }

    formatHtmlEmail(options) {
        const { type, title, content, provider, timestamp } = options;
        
        const statusColor = type === 'failure' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8';
        const statusIcon = type === 'failure' ? '❌' : type === 'success' ? '✅' : '📊';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px; }
        .status { font-size: 24px; margin: 0; }
        .provider { font-size: 18px; margin: 10px 0; }
        .timestamp { color: #666; font-size: 14px; }
        .content-section { margin: 20px 0; }
        .error-details { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; }
        .success-details { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; }
        .code { background: #f8f9fa; border: 1px solid #e9ecef; padding: 10px; border-radius: 3px; font-family: monospace; font-size: 12px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="status">${statusIcon} ${title}</h1>
            <div class="provider">Provider: ${provider}</div>
            <div class="timestamp">${new Date(timestamp).toLocaleString()}</div>
        </div>
        <div class="content">
            <div class="content-section">
                ${content}
            </div>
            <div class="footer">
                <p>This is an automated message from the Price Monitoring System.</p>
                <p>Timestamp: ${timestamp}</p>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    formatTextEmail(options) {
        const { type, title, content, provider, timestamp } = options;
        
        return `
${title}
Provider: ${provider}
Timestamp: ${new Date(timestamp).toLocaleString()}

${content}

---
This is an automated message from the Price Monitoring System.
Timestamp: ${timestamp}
`;
    }

    formatFailureContent(failureInfo) {
        const { provider, error, errorType, errorCode, affectedSections, stack, severity } = failureInfo;
        
        const severityText = severity === 'critical' ? '🔴 CRITICAL' : severity === 'error' ? '⚠️ ERROR' : '⚠️ WARNING';
        
        let content = `
            <div class="error-details">
                <h3>${severityText} Error Details</h3>
                <p><strong>Provider:</strong> ${provider}</p>
                <p><strong>Error Type:</strong> ${errorType || 'Unknown'}</p>
                ${errorCode ? `<p><strong>Error Code:</strong> ${errorCode}</p>` : ''}
                <p><strong>Error Message:</strong> ${error}</p>
        `;

        if (affectedSections && affectedSections.length > 0) {
            content += `
                <p><strong>Affected Sections:</strong></p>
                <ul>
                    ${affectedSections.map(section => `<li>${section}</li>`).join('')}
                </ul>
            `;
        }

        if (stack && process.env.NODE_ENV === 'development') {
            content += `
                <p><strong>Stack Trace:</strong></p>
                <div class="code">${stack.replace(/\n/g, '<br>').substring(0, 500)}</div>
            `;
        }

        content += `</div>`;
        return content;
    }

    formatSuccessContent(successInfo) {
        const { provider, pdfUrl, publishDate, sectionsExtracted } = successInfo;
        
        return `
            <div class="success-details">
                <h3>✅ Success Details</h3>
                <p><strong>Provider:</strong> ${provider}</p>
                <p><strong>PDF URL:</strong> <a href="${pdfUrl}">${pdfUrl}</a></p>
                <p><strong>Publish Date:</strong> ${publishDate || 'Unknown'}</p>
                <p><strong>Sections Extracted:</strong> ${sectionsExtracted || 'Unknown'}</p>
            </div>
        `;
    }

    formatSummaryContent(summaryInfo) {
        const { totalProviders, successfulCrawls, failedCrawls, providersWithChanges, unchangedProviders } = summaryInfo;
        
        return `
            <div class="content-section">
                <h3>📊 Monitoring Summary</h3>
                <p><strong>Total Providers:</strong> ${totalProviders}</p>
                <p><strong>Successful Crawls:</strong> ${successfulCrawls}</p>
                <p><strong>Failed Crawls:</strong> ${failedCrawls}</p>
                <p><strong>Providers with Changes:</strong> ${providersWithChanges}</p>
                <p><strong>Unchanged Providers:</strong> ${unchangedProviders}</p>
            </div>
        `;
    }

    async testEmailConfiguration() {
        try {
            if (!this.transporter) {
                console.error('❌ Email transporter not available');
                return false;
            }

            const testOptions = {
                subject: 'Price Monitor Test - {provider}',
                provider: 'Test',
                type: 'test',
                title: 'Email Configuration Test',
                content: '<p>This is a test email to verify email configuration.</p>',
                timestamp: new Date().toISOString()
            };

            const result = await this.sendEmail(testOptions);
            if (result) {
                console.log('✅ Test email sent successfully');
            }
            return result;
        } catch (error) {
            console.error('❌ Failed to send test email:', error.message);
            return false;
        }
    }

    getConfigurationStatus() {
        return {
            isConfigured: !!this.transporter,
            hasSmtpConfig: !!(this.config.email && this.config.email.smtp),
            hasRecipients: !!(this.config.email && this.config.email.to && this.config.email.to.length > 0),
            smtpHost: this.config.email?.smtp?.host || 'Not configured',
            recipients: this.config.email?.to || []
        };
    }
}

module.exports = EmailNotifier;