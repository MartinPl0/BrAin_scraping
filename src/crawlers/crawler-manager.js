const O2Crawler = require('./o2-crawler');
const TelekomCrawler = require('./telekom-crawler');
const OrangeCrawler = require('./orange-crawler');
const TescoCrawler = require('./tesco-crawler');
const FourKaCrawler = require('./4ka-crawler');
const RadCrawler = require('./rad-crawler');
const OkayfonCrawler = require('./okayfon-crawler');
const JuroCrawler = require('./juro-crawler');
const FunfonCrawler = require('./funfon-crawler');
const ChangeDetector = require('../utils/change-detector');
const DataStorage = require('../storage/data-storage');
const fs = require('fs');
const path = require('path');

/**
 * Crawler Manager
 * Orchestrates all provider crawlers and manages parallel execution
 */
class CrawlerManager {
    constructor() {
        this.crawlers = new Map();
        this.results = [];
        this.errors = [];
        this.changeDetector = new ChangeDetector();
        this.changeDetectionEnabled = true;
    }

    /**
     * Initialize crawlers based on configuration
     * @param {Object} config - Configuration object with provider settings
     */
    initializeCrawlers(config) {
        try {
            console.log('🚀 Initializing crawlers...');
            
            if (config.providers.o2 && config.providers.o2.crawlUrl) {
                const o2Crawler = new O2Crawler(config.providers.o2);
                o2Crawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('o2', o2Crawler);
                console.log('✅ O2 crawler initialized');
            }
            
            if (config.providers.telekom && config.providers.telekom.crawlUrl) {
                const telekomCrawler = new TelekomCrawler(config.providers.telekom);
                telekomCrawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('telekom', telekomCrawler);
                console.log('✅ Telekom crawler initialized');
            }
            
            if (config.providers.orange && config.providers.orange.crawlUrl) {
                const orangeCrawler = new OrangeCrawler(config.providers.orange);
                orangeCrawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('orange', orangeCrawler);
                console.log('✅ Orange crawler initialized');
            }
            
            if (config.providers.tesco && config.providers.tesco.crawlUrl) {
                const tescoCrawler = new TescoCrawler(config.providers.tesco);
                tescoCrawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('tesco', tescoCrawler);
                console.log('✅ Tesco Mobile crawler initialized');
            }
            
            if (config.providers.fourka && config.providers.fourka.crawlUrl) {
                const fourkaCrawler = new FourKaCrawler(config.providers.fourka);
                fourkaCrawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('fourka', fourkaCrawler);
                console.log('✅ 4ka crawler initialized');
            }
            
            if (config.providers.rad && config.providers.rad.crawlUrl) {
                const radCrawler = new RadCrawler(config.providers.rad);
                radCrawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('rad', radCrawler);
                console.log('✅ RAD crawler initialized');
            }
            
            if (config.providers.okayfon && config.providers.okayfon.crawlUrl) {
                const okayfonCrawler = new OkayfonCrawler(config.providers.okayfon);
                okayfonCrawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('okayfon', okayfonCrawler);
                console.log('✅ Okay fón crawler initialized');
            }
            
            if (config.providers.juro && config.providers.juro.crawlUrl) {
                const juroCrawler = new JuroCrawler(config.providers.juro);
                juroCrawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('juro', juroCrawler);
                console.log('✅ Juro crawler initialized');
            }
            
            if (config.providers.funfon && config.providers.funfon.crawlUrl) {
                const funfonCrawler = new FunfonCrawler(config.providers.funfon);
                funfonCrawler.errorMonitor = this.errorMonitor;
                this.crawlers.set('funfon', funfonCrawler);
                console.log('✅ Funfon crawler initialized');
            }
            
            console.log(`🎯 Total crawlers initialized: ${this.crawlers.size}`);
        } catch (error) {
            console.error('❌ Failed to initialize crawlers:', error.message);
            throw error;
        }
    }

    /**
     * Run all crawlers with simple change detection (URL comparison only)
     * Only processes providers that have changes
     * @returns {Promise<Object>} Results with change detection info
     */
    async runAllCrawlersWithChangeDetection() {
        try {
            console.log(`\n🔍 Running crawlers with simple change detection for ${this.crawlers.size} providers...`);
            
            const crawlResults = await this.runQuickMetadataCrawl();
            
            const changeResults = await this.changeDetector.detectChanges(crawlResults);
            
            console.log(`\n📊 Simple Change Detection Results:`);
            console.log(`   📝 Providers with changes: ${changeResults.summary.providersWithChanges}`);
            console.log(`   ✅ Unchanged providers: ${changeResults.summary.unchangedProviders}`);
            console.log(`   ❌ Error providers: ${changeResults.summary.errorProviders}`);
            console.log(`   📈 Change rate: ${changeResults.summary.changeRate.toFixed(1)}%`);
            
            if (changeResults.providersWithChanges.length === 0) {
                console.log('🎉 No changes detected! Skipping PDF processing for all providers.');
                // Touch lastChecked for all unchanged providers
                try {
                    const dataStorage = new DataStorage();
                    const ts = new Date().toISOString();
                    for (const p of changeResults.unchangedProviders) {
                        if (p && p.provider) {
                            await dataStorage.updateLastChecked(p.provider, ts);
                        }
                    }
                } catch (touchErr) {
                    console.warn(`⚠️  Failed to update lastChecked for unchanged providers: ${touchErr.message}`);
                }
                return {
                    results: [],
                    errors: [],
                    changeDetection: changeResults,
                    totalCrawlers: this.crawlers.size,
                    successfulCrawls: 0,
                    failedCrawls: 0,
                    skippedCrawls: changeResults.summary.unchangedProviders,
                    efficiencyGained: true
                };
            }
            
            console.log(`\n🚀 Processing ${changeResults.providersWithChanges.length} providers with changes...`);
            const fullCrawlResults = await this.runFullCrawlForChangedProviders(changeResults.providersWithChanges, crawlResults);
            
            // Update stored URLs for changed providers
            await this.changeDetector.updateStoredUrls(changeResults.providersWithChanges);

            // Touch lastChecked for unchanged providers as well
            try {
                const dataStorage = new DataStorage();
                const ts = new Date().toISOString();
                for (const p of changeResults.unchangedProviders) {
                    if (p && p.provider) {
                        await dataStorage.updateLastChecked(p.provider, ts);
                    }
                }
            } catch (touchErr) {
                console.warn(`⚠️  Failed to update lastChecked for unchanged providers: ${touchErr.message}`);
            }
            
            return {
                results: fullCrawlResults.results,
                errors: fullCrawlResults.errors,
                changeDetection: changeResults,
                totalCrawlers: this.crawlers.size,
                successfulCrawls: fullCrawlResults.results.length,
                failedCrawls: fullCrawlResults.errors.length,
                skippedCrawls: changeResults.summary.unchangedProviders,
                efficiencyGained: true
            };
            
        } catch (error) {
            console.error('❌ Failed to run crawlers with change detection:', error.message);
            throw error;
        }
    }

    /**
     * Run all crawlers in parallel (legacy method without change detection)
     * @returns {Promise<Array>} Array of crawl results
     */
    async runAllCrawlers() {
        try {
            console.log(`\n🚀 Starting parallel crawl for ${this.crawlers.size} providers...`);
            
            const crawlPromises = [];
            
            for (const [providerName, crawler] of this.crawlers) {
                const promise = this.runSingleCrawler(providerName, crawler);
                crawlPromises.push(promise);
            }
            
            const results = await Promise.allSettled(crawlPromises);
            
            this.processCrawlResults(results);
            
            console.log(`\n📊 Crawl Summary:`);
            console.log(`   ✅ Successful: ${this.results.length}`);
            console.log(`   ❌ Failed: ${this.errors.length}`);
            
            return {
                results: this.results,
                errors: this.errors,
                totalCrawlers: this.crawlers.size,
                successfulCrawls: this.results.length,
                failedCrawls: this.errors.length
            };
            
        } catch (error) {
            console.error('❌ Failed to run crawlers:', error.message);
            throw error;
        }
    }

    /**
     * Run crawler for a specific provider with change detection
     * @param {string} providerName - Name of the provider to run
     * @returns {Promise<Object>} Results with change detection info for the specific provider
     */
    async runProviderWithChangeDetection(providerName) {
        try {
            console.log(`\n🔍 Running crawler with change detection for ${providerName}...`);
            
            if (!this.crawlers.has(providerName)) {
                throw new Error(`Provider '${providerName}' not found in initialized crawlers`);
            }
            
            // Run only the specific provider, not all providers
            const crawlResults = await this.runSingleProviderQuickCrawl(providerName);
            
            const changeResults = await this.changeDetector.detectChanges(crawlResults);
            
            console.log(`\n📊 Change Detection Results for ${providerName}:`);
            console.log(`   📝 Providers with changes: ${changeResults.summary.providersWithChanges}`);
            console.log(`   ✅ Unchanged providers: ${changeResults.summary.unchangedProviders}`);
            console.log(`   ❌ Error providers: ${changeResults.summary.errorProviders}`);
            console.log(`   📈 Change rate: ${changeResults.summary.changeRate.toFixed(1)}%`);
            
            // Check if our specific provider has changes
            const providerHasChanges = changeResults.providersWithChanges.some(change => change.provider === providerName);
            
            if (!providerHasChanges) {
                console.log(`🎉 No changes detected for ${providerName}! No PDF processing needed.`);
                // Touch lastChecked for this provider
                try {
                    const dataStorage = new DataStorage();
                    await dataStorage.updateLastChecked(providerName, new Date().toISOString());
                } catch (touchErr) {
                    console.warn(`⚠️  Failed to update lastChecked for ${providerName}: ${touchErr.message}`);
                }
                return {
                    efficiencyGained: true,
                    skippedCrawls: 1,
                    results: [],
                    summary: changeResults.summary
                };
            }
            
            console.log(`\n🚀 Running full crawl for ${providerName}...`);
            // Run the full crawler to get consistent structure
            const crawler = this.crawlers.get(providerName);
            const fullResult = await this.runSingleCrawler(providerName, crawler);
            
            return {
                efficiencyGained: false,
                skippedCrawls: 0,
                results: [fullResult],
                summary: changeResults.summary
            };
            
        } catch (error) {
            console.error(`Error in runProviderWithChangeDetection for ${providerName}:`, error);
            throw error;
        }
    }

    /**
     * Run quick metadata crawl for a single provider
     * Only extracts metadata without downloading PDFs for the specific provider
     * @param {string} providerName - Name of the provider to crawl
     * @returns {Promise<Array>} Array of crawl results with metadata for the specific provider
     */
    async runSingleProviderQuickCrawl(providerName) {
        try {
            console.log(`\n🔍 Running quick metadata crawl for ${providerName}...`);
            
            if (!this.crawlers.has(providerName)) {
                throw new Error(`Provider '${providerName}' not found in initialized crawlers`);
            }
            
            const crawler = this.crawlers.get(providerName);
            const result = await this.runSingleCrawler(providerName, crawler);
            
            console.log(`✅ ${providerName} quick metadata crawl completed`);
            
            return [result];
            
        } catch (error) {
            console.error(`❌ Failed to run quick metadata crawl for ${providerName}:`, error.message);
            throw error;
        }
    }

    /**
     * Run quick metadata crawl for change detection
     * Only extracts metadata without downloading PDFs
     * @returns {Promise<Array>} Array of crawl results with metadata
     */
    async runQuickMetadataCrawl() {
        try {
            console.log(`\n🔍 Running quick metadata crawl for change detection...`);
            
            const crawlPromises = [];
            
            // Create promises for each crawler (metadata only)
            for (const [providerName, crawler] of this.crawlers) {
                const promise = this.runQuickMetadataCrawlForProvider(providerName, crawler);
                crawlPromises.push(promise);
            }
            
            const results = await Promise.allSettled(crawlPromises);
            
            const crawlResults = [];
            const errors = [];
            
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        crawlResults.push(result.value);
                    } else {
                        errors.push(result.value);
                    }
                } else {
                    errors.push({
                        success: false,
                        provider: 'unknown',
                        error: result.reason.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            console.log(`📊 Quick metadata crawl completed: ${crawlResults.length} successful, ${errors.length} failed`);
            return crawlResults;
            
        } catch (error) {
            console.error('❌ Failed to run quick metadata crawl:', error.message);
            throw error;
        }
    }

    /**
     * Run quick metadata crawl for a single provider
     * @param {string} providerName - Name of the provider
     * @param {Object} crawler - Crawler instance
     * @returns {Promise<Object>} Crawl result with metadata only
     */
    async runQuickMetadataCrawlForProvider(providerName, crawler) {
        try {
            console.log(`\n🔍 Running quick metadata crawl for ${providerName}...`);
            const startTime = Date.now();
            
            await crawler.initialize();
            await crawler.navigateToPricingPage();
            
            let pdfLinks = await crawler.extractPdfLinks();
            
            if (pdfLinks.length === 0) {
                throw new Error(`No PDF links found for ${providerName}`);
            }
            
            const primaryPdf = pdfLinks[0];
            
            const result = {
                provider: providerName,
                pdfs: pdfLinks.map(link => ({
                    pdfUrl: link.url,
                    pdfType: link.pdfType || 'PDF',
                    text: link.text,
                    category: link.category || null
                })),
                lastChecked: new Date().toISOString(),
                allPdfLinks: pdfLinks,
                crawlUrl: crawler.config.crawlUrl
            };
            
            console.log(`🔍 ${providerName}: Added ${result.pdfs.length} PDFs from pdfLinks`);
            
            const duration = Date.now() - startTime;
            console.log(`✅ ${providerName} quick metadata crawl completed in ${duration}ms`);
            
            // Record successful quick metadata crawl
            if (this.errorMonitor && result && result.pdfs) {
                this.errorMonitor.recordSuccess({
                    provider: providerName,
                    operation: 'quick-metadata-crawl',
                    message: `Successfully completed quick metadata crawl for ${providerName}`,
                    duration: duration,
                    pdfsFound: result.pdfs.length
                });
            }
            
            return {
                success: true,
                provider: providerName,
                result: result,
                duration: duration,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ ${providerName} quick metadata crawl failed:`, error.message);
            
            return {
                success: false,
                provider: providerName,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            };
        } finally {
            await crawler.cleanup();
        }
    }

    /**
     * Run full crawl for providers with changes
     * @param {Array} providersWithChanges - Array of providers with changes
     * @param {Array} crawlResults - Results from quick metadata crawl to reuse
     * @returns {Promise<Object>} Full crawl results
     */
    async runFullCrawlForChangedProviders(providersWithChanges, crawlResults = []) {
        try {
            console.log(`\n🚀 Running full crawl for ${providersWithChanges.length} providers with changes...`);
            
            const crawlPromises = [];
            
            for (const providerData of providersWithChanges) {
                const providerName = providerData.provider;
                const crawler = this.crawlers.get(providerName);
                
                if (crawler) {
                    const providerCrawlResult = crawlResults.find(result => result.provider === providerName);
                    
                    const options = {
                        reuseCrawlResult: providerCrawlResult ? {
                            pdfs: providerCrawlResult.result.pdfs || null, 
                            pdfLinks: providerCrawlResult.result.allPdfLinks || null,
                            metadata: providerCrawlResult.result.lastChecked || null
                        } : null
                    };
                    
                    if (providerData.changedPdfs && providerData.changedPdfs.changed && providerData.changedPdfs.changed.length > 0) {
                        options.changedPdfUrls = providerData.changedPdfs.changed;
                        console.log(`🎯 Selective processing for ${providerName}: ${options.changedPdfUrls.length} changed PDFs`);
                    } else {
                        console.log(`📄 Full processing for ${providerName}: All PDFs`);
                    }
                    
                    const promise = this.runSingleCrawler(providerName, crawler, options);
                    crawlPromises.push(promise);
                } else {
                    console.warn(`⚠️  Crawler not found for ${providerName}`);
                }
            }
            
            const results = await Promise.allSettled(crawlPromises);
            
            const fullResults = [];
            const fullErrors = [];
            
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    // Check if the result has a provider field (successful crawl)
                    if (result.value && result.value.provider) {
                        const hasFailedPdfs = result.value.failedPdfs && result.value.failedPdfs > 0;
                        if (hasFailedPdfs) {
                            fullErrors.push({
                                success: false,
                                provider: result.value.provider,
                                error: `${result.value.failedPdfs} PDF(s) failed to extract`,
                                failedPdfs: result.value.failedPdfs,
                                successfulPdfs: result.value.successfulPdfs,
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            fullResults.push(result.value);
                        }
                    } else {
                        fullErrors.push(result.value);
                    }
                } else {
                    fullErrors.push({
                        success: false,
                        provider: 'unknown',
                        error: result.reason.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            console.log(`📊 Full crawl completed: ${fullResults.length} successful, ${fullErrors.length} failed`);
            
            return {
                results: fullResults,
                errors: fullErrors
            };
            
        } catch (error) {
            console.error('❌ Failed to run full crawl for changed providers:', error.message);
            throw error;
        }
    }

    /**
     * Run a single crawler with error handling
     * @param {string} providerName - Name of the provider
     * @param {Object} crawler - Crawler instance
     * @param {Object} options - Options for selective processing
     * @returns {Promise<Object>} Crawl result
     */
    async runSingleCrawler(providerName, crawler, options = {}) {
        try {
            console.log(`\n🌐 Starting crawl for ${providerName}...`);
            const startTime = Date.now();
            
            let result;
            try {
                result = await crawler.crawl(options);
            } catch (crawlError) {
                // Check for HTTP errors using error monitor if available
                if (this.errorMonitor) {
                    const httpError = this.errorMonitor.checkHttpError(crawlError, providerName, 'crawl');
                    if (!httpError) {
                        // Record as regular error if not HTTP error
                        this.errorMonitor.recordError({
                            provider: providerName,
                            operation: 'crawl',
                            type: 'CRAWL_ERROR',
                            message: crawlError.message,
                            stack: crawlError.stack,
                            severity: 'error'
                        });
                    }
                }
                throw crawlError;
            }
            
            if (result && result.pdfs) {
                console.log(`💾 Saving ${providerName} results to dataset storage...`);
                const dataStorage = new DataStorage();
                
                // If this was a merged result, the JSON merger already saved the data
                if (result.merged && result.mergeResult) {
                    console.log(`✅ ${providerName} results already saved by JSON merger: ${result.mergeResult.filePath}`);
                } else {
                    // For full runs, save directly to consolidated JSON
                    await dataStorage.saveToDataset([result], null, providerName);
                    console.log(`✅ ${providerName} results saved to dataset storage`);
                }
            }
            
            // Update stored URLs for this provider
            if (result && result.pdfs) {
                console.log(`📝 Updating stored URLs for ${providerName}...`);
                try {
                    let pdfUrls = [];
                    if (Array.isArray(result.pdfs)) {
                        pdfUrls = result.pdfs.map(pdf => pdf.pdfUrl).filter(url => url);
                    } else if (result.pdfUrl) {
                        pdfUrls = [result.pdfUrl];
                    }
                    
                    if (pdfUrls.length > 0) {
                        const mockChangeResult = {
                            providersWithChanges: [{
                                provider: providerName,
                                changeType: 'update',
                                newUrls: pdfUrls,
                                oldUrls: []
                            }]
                        };
                        
                        await this.changeDetector.updateStoredUrls(mockChangeResult.providersWithChanges);
                        console.log(`✅ Updated stored URLs for ${providerName}: ${pdfUrls.length} PDF(s)`);
                    }
                } catch (urlUpdateError) {
                    console.warn(`⚠️  Failed to update stored URLs for ${providerName}: ${urlUpdateError.message}`);
                }
            }
            
            const duration = Date.now() - startTime;
            console.log(`✅ ${providerName} crawl completed in ${duration}ms`);
            
            // Record successful crawl in error monitor
            if (this.errorMonitor && result) {
                const successCount = result.pdfs ? 
                    (Array.isArray(result.pdfs) ? result.pdfs.filter(pdf => !pdf.error).length : 1) :
                    (result.pdfUrl ? 1 : 0);
                
                this.errorMonitor.recordSuccess({
                    provider: providerName,
                    operation: 'crawl',
                    message: `Successfully crawled ${providerName}`,
                    duration: duration,
                    pdfsProcessed: result.pdfs ? 
                        (Array.isArray(result.pdfs) ? result.pdfs.length : 1) :
                        (result.pdfUrl ? 1 : 0),
                    successfulPdfs: successCount
                });
            }
            
            return {
                success: true,
                provider: providerName,
                result: result,
                duration: duration,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ ${providerName} crawl failed:`, error.message);
            
            // Record error in error monitor if available
            if (this.errorMonitor) {
                const httpError = this.errorMonitor.checkHttpError(error, providerName, 'crawl');
                if (!httpError) {
                    this.errorMonitor.recordError({
                        provider: providerName,
                        operation: 'crawl',
                        type: 'CRAWL_ERROR',
                        message: error.message,
                        stack: error.stack,
                        severity: error.statusCode === 403 ? 'critical' : 'error',
                        errorCode: error.statusCode || null
                    });
                }
            }
            
            return {
                success: false,
                provider: providerName,
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                statusCode: error.statusCode || null
            };
        }
    }

    /**
     * Process crawl results and separate successes from errors
     * @param {Array} results - Array of Promise.allSettled results
     */
    processCrawlResults(results) {
        this.results = [];
        this.errors = [];
        
        for (const result of results) {
            if (result.status === 'fulfilled') {
                if (result.value.success) {
                    this.results.push(result.value);
                } else {
                    this.errors.push(result.value);
                }
            } else {
                // Promise was rejected
                this.errors.push({
                    success: false,
                    provider: 'unknown',
                    error: result.reason.message,
                    stack: result.reason.stack,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    /**
     * Get results for a specific provider
     * @param {string} providerName - Name of the provider
     * @returns {Object|null} Result for the provider or null if not found
     */
    getProviderResult(providerName) {
        const result = this.results.find(r => r.provider === providerName);
        return result ? result.result : null;
    }

    /**
     * Get errors for a specific provider
     * @param {string} providerName - Name of the provider
     * @returns {Object|null} Error for the provider or null if not found
     */
    getProviderError(providerName) {
        const error = this.errors.find(e => e.provider === providerName);
        return error || null;
    }

    /**
     * Check if a provider has successful results
     * @param {string} providerName - Name of the provider
     * @returns {boolean} True if provider has successful results
     */
    hasProviderResult(providerName) {
        return this.results.some(r => r.provider === providerName);
    }

    /**
     * Enable or disable change detection
     * @param {boolean} enabled - Whether to enable change detection
     */
    setChangeDetectionEnabled(enabled) {
        this.changeDetectionEnabled = enabled;
        console.log(`🔍 Change detection ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get change detection status
     * @returns {boolean} Whether change detection is enabled
     */
    isChangeDetectionEnabled() {
        return this.changeDetectionEnabled;
    }

    /**
     * Get URL summary for all providers
     * @returns {Promise<Object>} URL summary
     */
    async getUrlSummary() {
        try {
            return await this.changeDetector.getUrlSummary();
        } catch (error) {
            console.error('❌ Failed to get URL summary:', error.message);
            return {
                totalProviders: 0,
                providers: [],
                urls: {},
                lastUpdated: new Date().toISOString()
            };
        }
    }

    /**
     * Get summary of all crawl results
     * @returns {Object} Summary object
     */
    getSummary() {
        return {
            totalProviders: this.crawlers.size,
            successfulCrawls: this.results.length,
            failedCrawls: this.errors.length,
            successRate: this.crawlers.size > 0 ? (this.results.length / this.crawlers.size) * 100 : 0,
            results: this.results.map(r => ({
                provider: r.provider,
                pdfUrl: r.result?.pdfUrl,
                publishDate: r.result?.publishDate,
                duration: r.duration
            })),
            errors: this.errors.map(e => ({
                provider: e.provider,
                error: e.error
            }))
        };
    }

    /**
     * Clean up temp files in the temp directory
     */
    async cleanupTempFiles() {
        try {
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            
            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                const pdfFiles = files.filter(file => file.endsWith('.pdf'));
                
                if (pdfFiles.length > 0) {
                    console.log(`🧹 Cleaning up ${pdfFiles.length} temp PDF files...`);
                    
                    for (const file of pdfFiles) {
                        try {
                            const filePath = path.join(tempDir, file);
                            fs.unlinkSync(filePath);
                        } catch (error) {
                            console.warn(`⚠️  Could not delete temp file ${file}:`, error.message);
                        }
                    }
                    
                    console.log(`✅ Cleaned up ${pdfFiles.length} temp PDF files`);
                }
            }
        } catch (error) {
            console.warn('⚠️  Error during temp file cleanup:', error.message);
        }
    }

    /**
     * Clean up all crawlers
     */
    async cleanup() {
        try {
            console.log('🧹 Cleaning up crawlers...');
            
            for (const [providerName, crawler] of this.crawlers) {
                try {
                    await crawler.cleanup();
                    console.log(`✅ ${providerName} crawler cleaned up`);
                } catch (error) {
                    console.warn(`⚠️  Error cleaning up ${providerName} crawler:`, error.message);
                }
            }
            
            // Clean up any remaining temp files
            await this.cleanupTempFiles();
            
            this.crawlers.clear();
            this.results = [];
            this.errors = [];
            
            console.log('✅ All crawlers cleaned up');
        } catch (error) {
            console.error('❌ Error during crawler cleanup:', error.message);
        }
    }
}

module.exports = CrawlerManager;
