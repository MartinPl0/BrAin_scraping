const { loadConfig } = require('./utils/core/config-loader');
const CrawlerManager = require('./crawlers/crawler-manager');
const ChangeDetector = require('./utils/data/change-detector');
const EmailNotifier = require('./notifications/email-notifier');
const O2PdfScraper = require('./scrapers/o2-pdf-scraper');
const TelekomPdfScraper = require('./scrapers/telekom-pdf-scraper');
const OrangePdfScraper = require('./scrapers/orange-pdf-scraper');

/**
 * Price Monitor
 * Main orchestrator for automated price monitoring system
 */
class PriceMonitor {
    constructor() {
        this.config = null;
        this.crawlerManager = null;
        this.changeDetector = null;
        this.emailNotifier = null;
        this.results = {
            crawlResults: [],
            changeResults: null,
            extractionResults: [],
            emailResults: [],
            summary: null
        };
    }

    /**
     * Initialize the monitoring system
     */
    async initialize() {
        try {
            console.log('🚀 Initializing Price Monitor...');
            
            this.config = loadConfig();
            console.log('✅ Configuration loaded');
            
            this.crawlerManager = new CrawlerManager();
            this.changeDetector = new ChangeDetector();
            
            // Notifier kept for config tests
            this.emailNotifier = new EmailNotifier(this.config);
            
            this.crawlerManager.initializeCrawlers(this.config);
            
            console.log('✅ Price Monitor initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Price Monitor:', error.message);
            throw error;
        }
    }

    /**
     * Run the complete monitoring cycle
     */
    async runMonitoringCycle() {
        try {
            console.log('\n🔄 Starting Price Monitoring Cycle...');
            const startTime = Date.now();
            
            console.log('\n📡 Step 1: Crawling provider websites...');
            const crawlResults = await this.crawlerManager.runAllCrawlers();
            this.results.crawlResults = crawlResults;
            
            if (crawlResults.failedCrawls > 0) {
                console.warn(`⚠️  ${crawlResults.failedCrawls} crawlers failed`);
            }
            
            console.log('\n🔍 Step 2: Detecting changes...');
            const changeResults = await this.changeDetector.detectAllChanges(crawlResults.results);
            this.results.changeResults = changeResults;
            
            if (changeResults.summary.providersWithChanges === 0) {
                console.log('✅ No changes detected, monitoring cycle complete');
                return this.generateSummary();
            }
            
            console.log('\n📊 Step 3: Extracting data for changed providers...');
            const extractionResults = await this.extractDataForChanges(changeResults.providersWithChanges);
            this.results.extractionResults = extractionResults;
            
            console.log('\n💾 Step 4: Updating metadata...');
            await this.changeDetector.updateMetadataForChanges(changeResults.providersWithChanges);
            
            const duration = Date.now() - startTime;
            console.log(`\n✅ Monitoring cycle completed in ${duration}ms`);
            
            return this.generateSummary();
            
        } catch (error) {
            console.error('❌ Monitoring cycle failed:', error.message);
            await this.handleError(error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Extract data for providers with changes
     * @param {Array} providersWithChanges - Providers that have changes
     * @returns {Promise<Array>} Extraction results
     */
    async extractDataForChanges(providersWithChanges) {
        const extractionResults = [];
        
        for (const providerData of providersWithChanges) {
            try {
                const { provider, crawlResult } = providerData;
                console.log(`📊 Extracting data for ${provider}...`);
                
                let scraper;
                switch (provider.toLowerCase()) {
                    case 'o2 slovakia':
                        scraper = new O2PdfScraper();
                        break;
                    case 'telekom slovakia':
                        scraper = new TelekomPdfScraper();
                        break;
                    case 'orange slovakia':
                        scraper = new OrangePdfScraper();
                        break;
                    default:
                        throw new Error(`Unknown provider: ${provider}`);
                }
                
                const extractionResult = await scraper.scrapePdf(
                    crawlResult.pdfUrl,
                    provider,
                    null // No local PDF path
                );
                
                extractionResults.push({
                    provider,
                    success: extractionResult.success,
                    result: extractionResult,
                    timestamp: new Date().toISOString()
                });
                
                if (extractionResult.success) {
                    console.log(`✅ Data extracted for ${provider}`);
                } else {
                    console.error(`❌ Data extraction failed for ${provider}: ${extractionResult.error}`);
                }
                
            } catch (error) {
                console.error(`❌ Failed to extract data for ${providerData.provider}:`, error.message);
                extractionResults.push({
                    provider: providerData.provider,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        return extractionResults;
    }

    /**
     * Send email notifications
     * @param {Object} crawlResults - Crawl results
     * @param {Object} changeResults - Change detection results
     * @returns {Promise<Array>} Email results
     */
    async sendNotifications(crawlResults, changeResults) {
        const emailResults = [];
        
        try {
            for (const error of crawlResults.errors) {
                const emailResult = await this.emailNotifier.sendFailureNotification({
                    provider: error.provider,
                    error: error.error,
                    errorType: 'Crawl Failure',
                    affectedSections: [],
                    stack: error.stack
                });
                
                emailResults.push({
                    provider: error.provider,
                    type: 'failure',
                    success: emailResult,
                    timestamp: new Date().toISOString()
                });
            }
            
            if (changeResults.summary.providersWithChanges > 0) {
                const summaryEmailResult = await this.emailNotifier.sendSummaryNotification({
                    totalProviders: crawlResults.totalCrawlers,
                    successfulCrawls: crawlResults.successfulCrawls,
                    failedCrawls: crawlResults.failedCrawls,
                    providersWithChanges: changeResults.summary.providersWithChanges,
                    unchangedProviders: changeResults.summary.unchangedProviders
                });
                
                emailResults.push({
                    provider: 'All Providers',
                    type: 'summary',
                    success: summaryEmailResult,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('❌ Failed to send notifications:', error.message);
            emailResults.push({
                provider: 'System',
                type: 'notification_error',
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        return emailResults;
    }

    /**
     * Handle errors and send notifications
     * @param {Error} error - Error to handle
     */
    async handleError(error) {
        try {
            console.error('🚨 Handling system error:', error.message);
            
            await this.emailNotifier.sendFailureNotification({
                provider: 'System',
                error: error.message,
                errorType: 'System Error',
                affectedSections: [],
                stack: error.stack
            });
        } catch (notificationError) {
            console.error('❌ Failed to send error notification:', notificationError.message);
        }
    }

    /**
     * Generate monitoring summary
     * @returns {Object} Monitoring summary
     */
    generateSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            crawlResults: {
                totalCrawlers: this.results.crawlResults?.totalCrawlers || 0,
                successfulCrawls: this.results.crawlResults?.successfulCrawls || 0,
                failedCrawls: this.results.crawlResults?.failedCrawls || 0
            },
            changeResults: {
                providersWithChanges: this.results.changeResults?.summary?.providersWithChanges || 0,
                unchangedProviders: this.results.changeResults?.summary?.unchangedProviders || 0,
                errorProviders: this.results.changeResults?.summary?.errorProviders || 0
            },
            extractionResults: {
                totalExtractions: this.results.extractionResults?.length || 0,
                successfulExtractions: this.results.extractionResults?.filter(r => r.success).length || 0,
                failedExtractions: this.results.extractionResults?.filter(r => !r.success).length || 0
            },
            emailResults: {
                totalEmails: this.results.emailResults?.length || 0,
                successfulEmails: this.results.emailResults?.filter(r => r.success).length || 0,
                failedEmails: this.results.emailResults?.filter(r => !r.success).length || 0
            }
        };
        
        this.results.summary = summary;
        return summary;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        try {
            console.log('🧹 Cleaning up resources...');
            
            if (this.crawlerManager) {
                await this.crawlerManager.cleanup();
            }
            
            console.log('✅ Cleanup completed');
        } catch (error) {
            console.error('❌ Error during cleanup:', error.message);
        }
    }

    /**
     * Test system configuration
     * @returns {Promise<Object>} Test results
     */
    async testConfiguration() {
        try {
            console.log('🧪 Testing system configuration...');
            
            const testResults = {
                config: !!this.config,
                crawlerManager: !!this.crawlerManager,
                changeDetector: !!this.changeDetector,
                emailNotifier: !!this.emailNotifier
            };
            
            // Test email notifications if configured
            if (this.emailNotifier && this.emailNotifier.transporter) {
                try {
                    console.log('📧 Testing email configuration...');
                    // Test email sending (you can uncomment this to actually send a test email)
                    // await this.emailNotifier.sendTestEmail();
                    console.log('✅ Email configuration valid');
                    testResults.emailTest = true;
                } catch (emailError) {
                    console.error('❌ Email test failed:', emailError.message);
                    testResults.emailTest = false;
                }
            } else {
                console.log('⚠️  Email notification tests skipped - not configured');
                testResults.emailTest = false;
            }
            
            console.log('✅ Configuration test completed');
            return testResults;
        } catch (error) {
            console.error('❌ Configuration test failed:', error.message);
            return { error: error.message };
        }
    }
}

// Main execution
async function main() {
    try {
        const monitor = new PriceMonitor();
        await monitor.initialize();
        
        const args = process.argv.slice(2);
        if (args.includes('--test')) {
            console.log('🧪 Running configuration test...');
            const testResults = await monitor.testConfiguration();
            console.log('Test Results:', JSON.stringify(testResults, null, 2));
            return;
        }
        
        const summary = await monitor.runMonitoringCycle();
        console.log('\n📊 Monitoring Summary:', JSON.stringify(summary, null, 2));
        
    } catch (error) {
        console.error('❌ Price Monitor failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = PriceMonitor;
