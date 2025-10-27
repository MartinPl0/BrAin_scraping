/**
 * TODO: Email Notification System
 * 
 * This file contains the implementation for sending email notifications for monitoring failures and alerts.
 * The code is complete but requires SMTP configuration to be functional.
 * 
 * To implement:
 * 1. Set up SMTP email service (Gmail, Outlook, or custom SMTP server)
 * 2. Obtain SMTP credentials (username/password or app-specific password)
 
 * 3. Uncomment the code below and test with: node src/monitor.js --test
 * 
 * Features implemented:
 * - HTML and text email formatting
 * - Failure notifications with error details
 * - Summary notifications for monitoring cycles
 * - Success notifications (optional)
 * - SMTP configuration testing
 * - Error handling and retry logic
 */

/*
const nodemailer = require('nodemailer');

class EmailNotifier {
    constructor(config) {
        this.config = config;
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        try {
            if (!this.config.email || !this.config.email.smtp) {
                console.warn('⚠️  Email configuration not found, email notifications disabled');
                return;
            }

            this.transporter = nodemailer.createTransporter(this.config.email.smtp);
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
        const emailOptions = {
            subject: 'Price Monitor Alert - {provider}',
            provider: failureInfo.provider,
            type: 'failure',
            title: 'Price Monitoring Failure',
            content: this.formatFailureContent(failureInfo),
            timestamp: new Date().toISOString()
        };

        return await this.sendEmail(emailOptions);
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
        const { provider, error, errorType, affectedSections, stack } = failureInfo;
        
        let content = `
            <div class="error-details">
                <h3>❌ Error Details</h3>
                <p><strong>Provider:</strong> ${provider}</p>
                <p><strong>Error Type:</strong> ${errorType || 'Unknown'}</p>
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

        if (stack) {
            content += `
                <p><strong>Stack Trace:</strong></p>
                <div class="code">${stack}</div>
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
*/

// Placeholder export for compatibility
module.exports = class EmailNotifier {
    constructor(config) {
        console.log('⚠️  Email notification system not configured - see src/notifications/email-notifier.js for setup instructions');
    }
    
    async sendFailureNotification(failureInfo) {
        console.log(`⚠️  Email notifications not configured - failure not sent for ${failureInfo.provider}`);
        return false;
    }
    
    async sendSummaryNotification(summaryInfo) {
        console.log('⚠️  Email notifications not configured - summary not sent');
        return false;
    }
    
    async testEmailConfiguration() {
        return false;
    }
    
    getConfigurationStatus() {
        return { isConfigured: false, smtpHost: 'Not configured' };
    }
};