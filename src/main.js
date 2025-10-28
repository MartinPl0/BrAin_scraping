const { loadConfig } = require('./utils/config-loader');
const DataStorage = require('./storage/data-storage');
const O2PdfScraper = require('./scrapers/o2-pdf-scraper');
const TelekomPdfScraper = require('./scrapers/telekom-pdf-scraper');
const OrangePdfScraper = require('./scrapers/orange-pdf-scraper');
const RadPdfScraper = require('./scrapers/rad-pdf-scraper');

/**
 * Main class for BrAIn PDF Scraper System
 * Multi-source PDF extraction for telco and banking sectors
 */
class BrainScraper {
    constructor() {
        this.dataStorage = new DataStorage();
    }

    /**
     * Run O2 PDF scraping for all O2 price lists
     * @param {string} localPdfPath - Optional local PDF path for testing (Phase 2)
     * @returns {Promise<Array>} Results from all O2 price lists
     */
    async runO2Scraper(localPdfPath = null) {
        try {
            console.log(`=== 🚀 Starting O2 PDF scraping ===`);
            
            const config = loadConfig();
            const o2Config = config.providers.o2;
            
            if (!o2Config) {
                throw new Error('O2 configuration not found');
            }
            
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
                const o2Scraper = new O2PdfScraper();
                const results = await o2Scraper.scrapePdf(o2Config.pdfUrl, o2Config.displayName, localPdfPath);
                return [results];
            }
            
            console.log('🔄 Using dynamic PDF discovery with change detection...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const crawlResults = await crawlerManager.runProviderWithChangeDetection('rad');
            
            if (crawlResults.efficiencyGained && crawlResults.skippedCrawls > 0) {
                console.log(`🎉 Efficiency gained! Skipped ${crawlResults.skippedCrawls} unchanged providers`);
            }
            
            if (crawlResults.results.length === 0) {
                console.log('🎉 No changes detected for O2! No PDF processing needed.');
                return [];
            }
            
            const o2Result = crawlResults.results.find(r => r.provider === 'o2');
            if (!o2Result || !o2Result.result.pdfUrl) {
                throw new Error(`O2 crawl failed: No PDF URL found`);
            }
            
            // Now scrape the discovered PDF
            const o2Scraper = new O2PdfScraper();
            const results = await o2Scraper.scrapePdf(o2Result.result.pdfUrl, o2Config.displayName);
            
            console.log('=== 🚀 O2 PDF scraping complete ===');
            return [results];
            
        } catch (error) {
            console.error(`Error in O2 PDF scraping:`, error.message);
            throw error;
        }
    }

    /**
     * Run Telekom PDF scraping for all Telekom price lists
     * @param {string} localPdfPath - Optional local PDF path for testing
     * @returns {Promise<Array>} Results from all Telekom price lists
     */
    async runTelekomScraper(localPdfPath = null) {
        try {
            console.log(`=== 🚀 Starting Telekom PDF scraping ===`);
            
            const config = loadConfig();
            const telekomConfig = config.providers.telekom;
            
            if (!telekomConfig) {
                throw new Error('Telekom configuration not found');
            }
            
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
                const telekomScraper = new TelekomPdfScraper();
                const results = await telekomScraper.scrapePdf(telekomConfig.pdfUrl, telekomConfig.displayName, localPdfPath);
                return [results];
            }
            
            console.log('🔄 Using dynamic PDF discovery with change detection...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const crawlResults = await crawlerManager.runProviderWithChangeDetection('telekom');
            
            if (crawlResults.efficiencyGained && crawlResults.skippedCrawls > 0) {
                console.log(`🎉 Efficiency gained! Skipped ${crawlResults.skippedCrawls} unchanged providers`);
            }
            
            if (crawlResults.results.length === 0) {
                console.log('🎉 No changes detected for Telekom! No PDF processing needed.');
                return [];
            }
            
            const telekomResult = crawlResults.results.find(r => r.provider === 'telekom');
            if (!telekomResult || !telekomResult.result) {
                throw new Error(`Telekom crawl failed: No crawl result found`);
            }
            
            // Telekom crawler returns structure with pdfs array, not single pdfUrl
            const telekomPdf = telekomResult.result.pdfs && telekomResult.result.pdfs[0];
            if (!telekomPdf || !telekomPdf.pdfUrl) {
                throw new Error(`Telekom crawl failed: No PDF URL found`);
            }
            
            // Now scrape the discovered PDF
            const telekomScraper = new TelekomPdfScraper();
            const results = await telekomScraper.scrapePdf(telekomPdf.pdfUrl, telekomConfig.displayName);
            
            console.log('=== 🚀 Telekom PDF scraping complete ===');
            return [results];
            
        } catch (error) {
            console.error(`Error in Telekom PDF scraping:`, error.message);
            throw error;
        }
    }

    /**
     * Run RAD PDF scraping for RAD Slovakia price list
     * @param {string} localPdfPath - Optional local PDF path for testing
     * @returns {Promise<Array>} Results from RAD price list
     */
    async runRadScraper(localPdfPath = null) {
        try {
            console.log(`=== 🚀 Starting RAD PDF scraping ===`);
            
            const config = loadConfig();
            const radConfig = config.providers.rad;
            
            if (!radConfig) {
                throw new Error('RAD configuration not found');
            }
            
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
                const radScraper = new RadPdfScraper();
                const results = await radScraper.scrapePdf(radConfig.pdfUrl, radConfig.displayName, localPdfPath);
                return [results];
            }
            
            console.log('🔄 Using dynamic PDF discovery with change detection...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const crawlResults = await crawlerManager.runProviderWithChangeDetection('rad');
            
            if (crawlResults.efficiencyGained && crawlResults.skippedCrawls > 0) {
                console.log(`🎉 Efficiency gained! Skipped ${crawlResults.skippedCrawls} unchanged providers`);
            }
            
            if (crawlResults.results.length === 0) {
                console.log('🎉 No changes detected for RAD! No PDF processing needed.');
                return [];
            }
            
            const radResult = crawlResults.results.find(r => r.provider === 'rad');
            if (!radResult || !radResult.result) {
                throw new Error(`RAD crawl failed: No crawl result found`);
            }
            
            // RAD crawler returns structure with pdfs array, not single pdfUrl
            const radPdf = radResult.result.pdfs && radResult.result.pdfs[0];
            if (!radPdf || !radPdf.pdfUrl) {
                throw new Error(`RAD crawl failed: No PDF URL found`);
            }
            
            // Now scrape the discovered PDF
            const radScraper = new RadPdfScraper();
            const results = await radScraper.scrapePdf(radPdf.pdfUrl, radConfig.displayName);
            
            console.log('=== 🚀 RAD PDF scraping complete ===');
            return [results];
            
        } catch (error) {
            console.error(`Error in RAD PDF scraping:`, error.message);
            throw error;
        }
    }

    /**
     * Run Orange PDF scraping for all Orange price lists
     * @param {string} localPdfPath - Optional local PDF path for testing
     * @returns {Promise<Array>} Results from all Orange price lists
     */
    async runOrangeScraper(localPdfPath = null) {
        try {
            console.log(`=== 🚀 Starting Orange PDF scraping ===`);
            
            const config = loadConfig();
            const orangeConfig = config.providers.orange;
            
            if (!orangeConfig) {
                throw new Error('Orange configuration not found');
            }
            
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
                const orangeScraper = new OrangePdfScraper();
                const results = await orangeScraper.scrapePdf(orangeConfig.pdfUrl, orangeConfig.displayName, localPdfPath);
                return [results];
            }
            
            // For dynamic discovery, use single provider crawling
            console.log('🔄 Using dynamic PDF discovery for Orange only...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const orangeCrawler = crawlerManager.crawlers.get('orange');
            if (!orangeCrawler) {
                throw new Error('Orange crawler not initialized');
            }
            
            console.log('🚀 Running Orange crawler directly...');
            const orangeResult = await crawlerManager.runSingleCrawler('orange', orangeCrawler);
            
            if (!orangeResult || !orangeResult.result || !orangeResult.result.pdfs) {
                throw new Error(`Orange consolidated crawl failed: No PDF data found`);
            }
            
            const consolidatedResult = orangeResult.result;
            
            console.log(`📊 Orange Consolidated Results:`);
            console.log(`   Total PDFs: ${consolidatedResult.totalPdfs}`);
            console.log(`   Successful: ${consolidatedResult.successfulPdfs}`);
            console.log(`   Failed: ${consolidatedResult.failedPdfs}`);
            
            const storageResult = await this.dataStorage.saveToDataset([consolidatedResult], null, 'orange');
            console.log(`💾 Consolidated data saved to: ${storageResult.backupFile}`);
            
            return [consolidatedResult];
            
        } catch (error) {
            console.error(`Error in Orange PDF scraping:`, error.message);
            throw error;
        }
    }

    /**
     * Run Tesco Mobile PDF scraping for all Tesco Mobile price lists
     * @param {string} localPdfPath - Optional local PDF path for testing
     * @returns {Promise<Array>} Results from all Tesco Mobile price lists
     */
    async runTescoScraper(localPdfPath = null) {
        try {
            console.log(`=== 🚀 Starting Tesco Mobile PDF scraping ===`);
            
            const config = loadConfig();
            const tescoConfig = config.providers.tesco;
            
            if (!tescoConfig) {
                throw new Error('Tesco Mobile configuration not found');
            }
            
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
                const TescoPdfScraper = require('./scrapers/tesco-pdf-scraper');
                const tescoScraper = new TescoPdfScraper();
                const results = await tescoScraper.scrapePdf(tescoConfig.pdfUrl, tescoConfig.displayName, localPdfPath);
                return [results];
            }
            
            // For dynamic discovery, use single provider crawling
            console.log('🔄 Using dynamic PDF discovery for Tesco Mobile only...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const tescoCrawler = crawlerManager.crawlers.get('tesco');
            if (!tescoCrawler) {
                throw new Error('Tesco Mobile crawler not initialized');
            }
            
            console.log('🚀 Running Tesco Mobile crawler directly...');
            const tescoResult = await crawlerManager.runSingleCrawler('tesco', tescoCrawler);
            
            if (!tescoResult || !tescoResult.result || !tescoResult.result.pdfs) {
                throw new Error(`Tesco Mobile consolidated crawl failed: No PDF data found`);
            }
            
            const consolidatedResult = tescoResult.result;
            
            console.log(`📊 Tesco Mobile Consolidated Results:`);
            console.log(`   Total PDFs: ${consolidatedResult.totalPdfs}`);
            console.log(`   Successful: ${consolidatedResult.successfulPdfs}`);
            console.log(`   Failed: ${consolidatedResult.failedPdfs}`);
            
            // Display individual PDF results
            consolidatedResult.pdfs.forEach((pdf, index) => {
                if (pdf.error) {
                    console.log(`❌ PDF ${index + 1} (${pdf.pdfType}): ${pdf.error}`);
                } else {
                    console.log(`✅ PDF ${index + 1} (${pdf.pdfType}): ${pdf.summary?.totalCharacters || 0} characters extracted`);
                }
            });
            
            return [consolidatedResult];
            
        } catch (error) {
            console.error(`Error in Tesco Mobile PDF scraping:`, error.message);
            throw error;
        }
    }

    /**
     * Run 4ka PDF scraping for all 4ka price lists
     * @param {string} localPdfPath - Optional local PDF path for testing
     * @returns {Promise<Array>} Results from all 4ka price lists
     */
    async runFourKaScraper(localPdfPath = null) {
        try {
            console.log(`=== 🚀 Starting 4ka PDF scraping ===`);
            
            const config = loadConfig();
            const fourkaConfig = config.providers.fourka;
            
            if (!fourkaConfig) {
                throw new Error('4ka configuration not found');
            }
            
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
                const FourKaPdfScraper = require('./scrapers/4ka-pdf-scraper');
                const fourkaScraper = new FourKaPdfScraper();
                const results = await fourkaScraper.scrapePdf(fourkaConfig.pdfUrl, fourkaConfig.displayName, localPdfPath);
                return [results];
            }
            
            console.log('🔄 Using dynamic PDF discovery with change detection...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const crawlResults = await crawlerManager.runProviderWithChangeDetection('fourka');
            
            if (crawlResults.efficiencyGained && crawlResults.skippedCrawls > 0) {
                console.log(`🎉 Efficiency gained! Skipped ${crawlResults.skippedCrawls} unchanged providers`);
            }
            
            // If no changes detected, return existing data
            if (crawlResults.efficiencyGained && crawlResults.results.length === 0) {
                console.log('📄 No changes detected, returning existing data...');
                const fs = require('fs');
                const path = require('path');
                const existingDataPath = path.join(__dirname, '..', 'storage', 'datasets', 'fourka', 'fourka.json');
                
                if (fs.existsSync(existingDataPath)) {
                    const existingData = JSON.parse(fs.readFileSync(existingDataPath, 'utf8'));
                    return [existingData];
                } else {
                    throw new Error('No changes detected and no existing data found');
                }
            }
            
            const fourkaResult = crawlResults.results.find(r => r.provider === 'fourka');
            if (!fourkaResult || !fourkaResult.result) {
                throw new Error(`4ka crawl failed: No crawl result found`);
            }
            
            // 4ka crawler returns structure with pdfs array, not single pdfUrl
            const fourkaPdfs = fourkaResult.result.pdfs && fourkaResult.result.pdfs;
            if (!fourkaPdfs || fourkaPdfs.length === 0) {
                throw new Error(`4ka crawl failed: No PDF URLs found`);
            }
            
            // Now scrape the discovered PDFs
            const FourKaPdfScraper = require('./scrapers/4ka-pdf-scraper');
            const fourkaScraper = new FourKaPdfScraper();
            const results = await fourkaScraper.scrapePdf(fourkaPdfs[0].pdfUrl, fourkaConfig.displayName);
            
            return [results];
            
        } catch (error) {
            console.error(`Error in 4ka PDF scraping:`, error.message);
            throw error;
        }
    }

    /**
     * Run Okay fón PDF scraping for all Okay fón price lists
     * @param {string} localPdfPath - Optional local PDF path for testing
     * @returns {Promise<Array>} Results from all Okay fón price lists
     */
    async runOkayfonScraper(localPdfPath = null) {
        try {
            console.log(`=== 🚀 Starting Okay fón PDF scraping ===`);
            
            const config = loadConfig();
            const okayfonConfig = config.providers.okayfon;
            
            if (!okayfonConfig) {
                throw new Error('Okay fón configuration not found');
            }
            
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
                const OkayfonPdfScraper = require('./scrapers/okayfon-pdf-scraper');
                const okayfonScraper = new OkayfonPdfScraper();
                const results = await okayfonScraper.scrapePdf(okayfonConfig.pdfUrl, okayfonConfig.displayName, localPdfPath);
                return [results];
            }
            
            console.log('🔄 Using dynamic PDF discovery with change detection...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const crawlResults = await crawlerManager.runProviderWithChangeDetection('okayfon');
            
            if (crawlResults.efficiencyGained && crawlResults.skippedCrawls > 0) {
                console.log(`🎉 Efficiency gained! Skipped ${crawlResults.skippedCrawls} unchanged providers`);
            }
            
            // If no changes detected, return existing data
            if (crawlResults.efficiencyGained && crawlResults.results.length === 0) {
                console.log('📄 No changes detected, returning existing data...');
                const fs = require('fs');
                const path = require('path');
                const existingDataPath = path.join(__dirname, '..', 'storage', 'datasets', 'okayfon', 'okayfon.json');
                
                if (fs.existsSync(existingDataPath)) {
                    const existingData = JSON.parse(fs.readFileSync(existingDataPath, 'utf8'));
                    return [existingData];
                } else {
                    throw new Error('No changes detected and no existing data found');
                }
            }
            
            const okayfonResult = crawlResults.results.find(r => r.provider === 'okayfon');
            if (!okayfonResult) {
                throw new Error(`Okay fón crawl failed: No crawl result found`);
            }
            
            // Okay fón crawler returns structure with pdfs array nested under result
            const okayfonPdfs = okayfonResult.result.pdfs && okayfonResult.result.pdfs;
            if (!okayfonPdfs || okayfonPdfs.length === 0) {
                throw new Error(`Okay fón crawl failed: No PDF URLs found`);
            }
            
            // Now scrape the discovered PDFs
            const OkayfonPdfScraper = require('./scrapers/okayfon-pdf-scraper');
            const okayfonScraper = new OkayfonPdfScraper();
            const results = await okayfonScraper.scrapePdf(okayfonPdfs[0].pdfUrl, okayfonConfig.displayName);
            
            return [results];
            
        } catch (error) {
            console.error(`Error in Okay fón PDF scraping:`, error.message);
            throw error;
        }
    }

    /**
     * Run RAD PDF scraping for all RAD price lists
     * @param {string} localPdfPath - Optional local PDF path for testing
     * @returns {Promise<Array>} Results from all RAD price lists
     */
    async runRadScraper(localPdfPath = null) {
        try {
            console.log(`=== 🚀 Starting RAD PDF scraping ===`);
            
            const config = loadConfig();
            const radConfig = config.providers.rad;
            
            if (!radConfig) {
                throw new Error('RAD configuration not found');
            }
            
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
                const radScraper = new RadPdfScraper();
                const results = await radScraper.scrapePdf(radConfig.pdfUrl, radConfig.displayName, localPdfPath);
                return [results];
            }
            
            console.log('🔄 Using dynamic PDF discovery with change detection...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const crawlResults = await crawlerManager.runProviderWithChangeDetection('rad');
            
            if (crawlResults.efficiencyGained && crawlResults.skippedCrawls > 0) {
                console.log(`🎉 Efficiency gained! Skipped ${crawlResults.skippedCrawls} unchanged providers`);
            }
            
            if (crawlResults.results.length === 0) {
                console.log('🎉 No changes detected for RAD! No PDF processing needed.');
                return [];
            }
            
            const radResult = crawlResults.results.find(r => r.provider === 'rad');
            if (!radResult || !radResult.result) {
                throw new Error(`RAD crawl failed: No crawl result found`);
            }
            
            // RAD crawler returns structure with pdfs array, not single pdfUrl
            const radPdf = radResult.result.pdfs && radResult.result.pdfs[0];
            if (!radPdf || !radPdf.pdfUrl) {
                throw new Error(`RAD crawl failed: No PDF URL found`);
            }
            
            // Now scrape the discovered PDF
            const radScraper = new RadPdfScraper();
            const results = await radScraper.scrapePdf(radPdf.pdfUrl, radConfig.displayName);
            
            console.log('=== 🚀 RAD PDF scraping complete ===');
            return [results];
            
        } catch (error) {
            console.error(`Error in RAD PDF scraping:`, error.message);
            throw error;
        }
    }

}

/**
 * Show help information
 */
function showHelp() {
    console.log(`
🚀 BrAIn PDF Scraper System
Multi-source PDF extraction for telco and banking sectors

📋 Available Commands:
node src/main.js --help           - Show this help
node src/main.js --sections       - Show configurable sections
node src/main.js --changes        - Show change detection status
node src/main.js --all            - Run all providers with change detection
node src/main.js o2               - Run O2 Slovakia scraper
node src/main.js telekom          - Run Telekom Slovakia scraper
node src/main.js orange           - Run Orange Slovakia scraper
node src/main.js tesco            - Run Tesco Mobile Slovakia scraper
node src/main.js fourka           - Run 4ka Slovakia scraper
node src/main.js rad              - Run RAD Slovakia scraper
node src/main.js okayfon          - Run Okay fón Slovakia scraper

📖 Documentation:
- SYSTEM_OVERVIEW.md - Complete system documentation
- README.md - Project setup and usage

Examples:
node src/main.js o2               # Run O2 scraper
node src/main.js telekom          # Run Telekom scraper
node src/main.js orange           # Run Orange scraper
node src/main.js tesco            # Run Tesco Mobile scraper
node src/main.js fourka           # Run 4ka scraper
node src/main.js rad              # Run RAD scraper
node src/main.js okayfon          # Run Okay fón scraper
node src/main.js --all            # Run all providers with change detection
node src/main.js --changes        # Show change detection status
node src/main.js --sections      # Show configurable sections
    `);
}

// Main function
async function main() {
    try {
        const scraper = new BrainScraper();
        
        const args = process.argv.slice(2);
        const scraperName = args[0];
            
            if (scraperName === '--help') {
                showHelp();
                process.exit(0);
            }
            
            if (scraperName === '--sections') {
                // Show configurable sections
                const O2SectionExtractor = require('./extractors/o2-section-extractor');
                const TelekomSectionExtractor = require('./extractors/telekom-section-extractor');
                const OrangeSectionExtractor = require('./extractors/orange-section-extractor');
                
                console.log('\n=== Configurable Sections ===');
                console.log('Sections are defined in src/config/scraper-config.json');
                console.log('You can modify the "providers" object to change which sections are extracted.\n');
                
                console.log('\n📱 O2 Sections:');
                const o2Extractor = new O2SectionExtractor();
                const o2Sections = o2Extractor.getSectionConfiguration();
                o2Sections.forEach((section, index) => {
                    console.log(`  ${index + 1}. ${section.title} (key: ${section.key})`);
                });
                
                console.log('\n📱 Telekom Sections:');
                const telekomExtractor = new TelekomSectionExtractor();
                const telekomSections = telekomExtractor.getSectionConfiguration();
                telekomSections.forEach((section, index) => {
                    console.log(`  ${index + 1}. ${section.title} (key: ${section.key})`);
                });
                
                console.log('\n📱 Orange Sections:');
                const orangeExtractor = new OrangeSectionExtractor();
                const orangeSections = orangeExtractor.getSectionConfiguration();
                orangeSections.forEach((section, index) => {
                    console.log(`  ${index + 1}. ${section.title} (key: ${section.key})`);
                });
                
                console.log('\nTo modify sections:');
                console.log('1. Edit src/config/scraper-config.json');
                console.log('2. Update the "providers.o2.sections", "providers.telekom.sections", or "providers.orange.sections" objects');
                console.log('3. Run the scraper again');
                process.exit(0);
            }
            
            if (scraperName === '--changes') {
                // Show change detection status
                console.log('\n=== Simple Change Detection Status ===');
                const CrawlerManager = require('./crawlers/crawler-manager');
                const crawlerManager = new CrawlerManager();
                
                console.log(`🔍 Change detection enabled: ${crawlerManager.isChangeDetectionEnabled()}`);
                
                const urlSummary = await crawlerManager.getUrlSummary();
                console.log(`\n📊 URL Summary:`);
                console.log(`   Total providers tracked: ${urlSummary.totalProviders}`);
                console.log(`   Total PDFs tracked: ${urlSummary.totalPdfs}`);
                console.log(`   Providers: ${urlSummary.providers.join(', ')}`);
                
                if (urlSummary.totalProviders > 0) {
                    console.log(`\n📋 Stored PDF URLs by Provider:`);
                    for (const [provider, details] of Object.entries(urlSummary.providerDetails)) {
                        console.log(`   ${provider}: ${details.pdfCount} PDF(s)`);
                        if (Array.isArray(details.urls)) {
                            details.urls.forEach((url, index) => {
                                console.log(`     ${index + 1}. ${url}`);
                            });
                        } else {
                            console.log(`     1. ${details.urls}`);
                        }
                    }
                } else {
                    console.log('   No stored URLs found - first run will create initial URL tracking');
                }
                process.exit(0);
            }
            
            if (scraperName === '--all') {
                console.log('\n=== 🚀 Running All Providers with Change Detection ===');
                const CrawlerManager = require('./crawlers/crawler-manager');
                const crawlerManager = new CrawlerManager();
                
                const config = loadConfig();
                crawlerManager.initializeCrawlers(config);
                
                const crawlResults = await crawlerManager.runAllCrawlersWithChangeDetection();
                
                console.log('\n=== 📊 Change Detection Results ===');
                console.log(`   Total providers: ${crawlResults.totalCrawlers}`);
                console.log(`   Providers with changes: ${crawlResults.successfulCrawls}`);
                console.log(`   Skipped (unchanged): ${crawlResults.skippedCrawls}`);
                console.log(`   Failed: ${crawlResults.failedCrawls}`);
                
                if (crawlResults.efficiencyGained && crawlResults.skippedCrawls > 0) {
                    console.log(`\n🎉 Efficiency gained! Skipped ${crawlResults.skippedCrawls} unchanged providers`);
                    const efficiencyPercent = (crawlResults.skippedCrawls / crawlResults.totalCrawlers) * 100;
                    console.log(`   Efficiency improvement: ${efficiencyPercent.toFixed(1)}%`);
                }
                
                if (crawlResults.results.length === 0) {
                    console.log('\n🎉 No changes detected for any provider! No PDF processing needed.');
                } else {
                    console.log('\n📋 Providers with changes:');
                    crawlResults.results.forEach(result => {
                        // Check if result has the consolidated structure (totalPdfs at top level)
                        // or if we need to calculate from the pdfs array (nested under result)
                        const totalPdfs = result.totalPdfs !== undefined ? result.totalPdfs : (result.result?.pdfs ? result.result.pdfs.length : 0);
                        const successfulPdfs = result.successfulPdfs !== undefined ? result.successfulPdfs : (result.result?.pdfs ? result.result.pdfs.filter(pdf => !pdf.error).length : 0);
                        const failedPdfs = result.failedPdfs !== undefined ? result.failedPdfs : (result.result?.pdfs ? result.result.pdfs.filter(pdf => pdf.error).length : 0);
                        
                        // If we still don't have PDF info, it means the data was saved but not returned in the results array
                        // In this case, just show "Processed" since we know from the logs that it was successful
                        const pdfInfo = totalPdfs > 0 
                            ? `${totalPdfs} PDF(s) (${successfulPdfs} successful, ${failedPdfs} failed)` 
                            : (result.provider ? 'Processed' : 'No PDFs');
                        console.log(`   ✅ ${result.provider}: ${pdfInfo}`);
                    });
                }
                
                // Display failed providers
                if (crawlResults.errors && crawlResults.errors.length > 0) {
                    console.log('\n❌ Providers with errors:');
                    crawlResults.errors.forEach(error => {
                        console.log(`   ❌ ${error.provider}: ${error.error}`);
                    });
                }
                
                await crawlerManager.cleanup();
                
                if (crawlResults.failedCrawls > 0) {
                    console.log(`\n❌ ${crawlResults.failedCrawls} provider(s) failed! Check the logs above for details.`);
                    process.exit(1);
                } else {
                    console.log(`\n🎉 All providers processed successfully!`);
                    process.exit(0);
                }
            }
        
        if (scraperName === 'o2' || !scraperName) {
            const localPdfPath = args[1]; // Optional: path to local PDF
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
            }
            const results = await scraper.runO2Scraper(localPdfPath);
            console.log('\n=== 🚀 O2 Scraping Results ===');
            results.forEach(result => {
                if (result.success) {
                    console.log(`✅ ${result.cennikName}: ${result.totalSections} sections, ${result.successfulExtractions} successful extractions, ${result.totalCharacters} characters`);
                } else {
                    console.log(`❌ ${result.cennikName}: ${result.error}`);
                }
            });
            process.exit(0);
        }
        
        if (scraperName === 'telekom') {
            const localPdfPath = args[1]; // Optional: path to local PDF
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
            }
            const results = await scraper.runTelekomScraper(localPdfPath);
            console.log('\n=== 🚀 Telekom Scraping Results ===');
            results.forEach(result => {
                if (result.success) {
                    console.log(`✅ ${result.cennikName}: ${result.totalSections} sections, ${result.successfulExtractions} successful extractions, ${result.totalCharacters} characters`);
                } else {
                    console.log(`❌ ${result.cennikName}: ${result.error}`);
                }
            });
            process.exit(0);
        }
        
        if (scraperName === 'rad') {
            const localPdfPath = args[1]; // Optional: path to local PDF
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
            }
            const results = await scraper.runRadScraper(localPdfPath);
            console.log('\n=== 🚀 RAD Scraping Results ===');
            results.forEach(result => {
                if (result.success) {
                    console.log(`✅ ${result.cennikName}: ${result.totalSections} sections, ${result.successfulExtractions} successful extractions, ${result.totalCharacters} characters`);
                } else {
                    console.log(`❌ ${result.cennikName}: ${result.error}`);
                }
            });
            process.exit(0);
        }
        
        if (scraperName === 'tesco') {
            const localPdfPath = args[1]; // Optional: path to local PDF
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
            }
            const results = await scraper.runTescoScraper(localPdfPath);
            console.log('\n=== 🚀 Tesco Mobile Consolidated Results ===');
            if (results[0] && results[0].pdfs) {
                const consolidated = results[0];
                console.log(`📊 Summary: ${consolidated.totalPdfs} total PDFs, ${consolidated.successfulPdfs} successful, ${consolidated.failedPdfs} failed`);
                
                consolidated.pdfs.forEach(pdf => {
                    if (pdf.error) {
                        console.log(`❌ ${pdf.cennikName}: ${pdf.error}`);
                    } else if (pdf.summary) {
                        console.log(`✅ ${pdf.cennikName}: ${pdf.summary.totalSections} sections, ${pdf.summary.successfulExtractions} successful extractions, ${pdf.summary.totalCharacters} characters`);
                    } else {
                        console.log(`✅ ${pdf.cennikName}: Successfully processed`);
                    }
                });
            } else {
                console.log('❌ No consolidated results found');
            }
            process.exit(0);
        }
        
        if (scraperName === 'fourka') {
            const localPdfPath = args[1]; // Optional: path to local PDF
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
            }
            const results = await scraper.runFourKaScraper(localPdfPath);
            console.log('\n=== 🚀 4ka Consolidated Results ===');
            if (results[0] && results[0].pdfs) {
                const consolidated = results[0];
                console.log(`📊 Summary: ${consolidated.totalPdfs} total PDFs, ${consolidated.successfulPdfs} successful, ${consolidated.failedPdfs} failed`);
                
                consolidated.pdfs.forEach(pdf => {
                    if (pdf.error) {
                        console.log(`❌ ${pdf.cennikName}: ${pdf.error}`);
                    } else if (pdf.summary) {
                        console.log(`✅ ${pdf.cennikName}: ${pdf.summary.totalSections} sections, ${pdf.summary.successfulExtractions} successful extractions, ${pdf.summary.totalCharacters} characters`);
                    } else {
                        console.log(`✅ ${pdf.cennikName}: Successfully processed`);
                    }
                });
            } else {
                console.log('❌ No consolidated results found');
            }
            process.exit(0);
        }
        
        if (scraperName === 'okayfon') {
            const localPdfPath = args[1]; // Optional: path to local PDF
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
            }
            const results = await scraper.runOkayfonScraper(localPdfPath);
            console.log('\n=== 🚀 Okay fón Scraping Results ===');
            results.forEach(result => {
                if (result.success || result.cennikName) {
                    const summary = result.summary || result.data?.summary;
                    if (summary) {
                        console.log(`✅ ${result.cennikName}: ${summary.totalSections} sections, ${summary.successfulExtractions} successful extractions, ${summary.totalCharacters} characters`);
                    } else {
                        console.log(`✅ ${result.cennikName}: Data loaded from storage`);
                    }
                } else {
                    console.log(`❌ ${result.cennikName || 'Unknown'}: ${result.error || 'Unknown error'}`);
                }
            });
            process.exit(0);
        }
        
        if (scraperName === 'rad') {
            const localPdfPath = args[1]; // Optional: path to local PDF
            if (localPdfPath) {
                console.log(`📄 Using local PDF: ${localPdfPath}`);
            }
            const results = await scraper.runRadScraper(localPdfPath);
            console.log('\n=== 🚀 RAD Scraping Results ===');
            results.forEach(result => {
                if (result.success) {
                    console.log(`✅ ${result.cennikName}: ${result.totalSections} sections, ${result.successfulExtractions} successful extractions, ${result.totalCharacters} characters`);
                } else {
                    console.log(`❌ ${result.cennikName}: ${result.error}`);
                }
            });
            process.exit(0);
        }
        
        if (scraperName) {
            console.log(`❌ Scraper '${scraperName}' not supported. Available: o2, telekom, orange, tesco, fourka, rad`);
            process.exit(1);
        } else {
            showHelp();
            process.exit(0);
        }
        
    } catch (error) {
        console.error('Error in main function:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = BrainScraper;