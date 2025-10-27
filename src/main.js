const { loadConfig } = require('./utils/config-loader');
const DataStorage = require('./storage/data-storage');
const O2PdfScraper = require('./scrapers/o2-pdf-scraper');
const TelekomPdfScraper = require('./scrapers/telekom-pdf-scraper');
const OrangePdfScraper = require('./scrapers/orange-pdf-scraper');

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
            
            const crawlResults = await crawlerManager.runAllCrawlersWithChangeDetection();
            
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
            
            const crawlResults = await crawlerManager.runAllCrawlersWithChangeDetection();
            
            if (crawlResults.efficiencyGained && crawlResults.skippedCrawls > 0) {
                console.log(`🎉 Efficiency gained! Skipped ${crawlResults.skippedCrawls} unchanged providers`);
            }
            
            if (crawlResults.results.length === 0) {
                console.log('🎉 No changes detected for Telekom! No PDF processing needed.');
                return [];
            }
            
            const telekomResult = crawlResults.results.find(r => r.provider === 'telekom');
            if (!telekomResult || !telekomResult.result.pdfUrl) {
                throw new Error(`Telekom crawl failed: No PDF URL found`);
            }
            
            // Now scrape the discovered PDF
            const telekomScraper = new TelekomPdfScraper();
            const results = await telekomScraper.scrapePdf(telekomResult.result.pdfUrl, telekomConfig.displayName);
            
            console.log('=== 🚀 Telekom PDF scraping complete ===');
            return [results];
            
        } catch (error) {
            console.error(`Error in Telekom PDF scraping:`, error.message);
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
     * @param {string} localPdfPath - Optional local PDF path
     * @returns {Promise<Array>} Array of scraping results
     */
    async runFourKaScraper(localPdfPath = null) {
        try {
            console.log('=== 🚀 Starting 4ka PDF scraping ===');
            
            const config = loadConfig();
            const fourkaConfig = config.providers?.fourka;

            if (!fourkaConfig) {
                throw new Error('4ka configuration not found');
            }

            // For single PDF mode, use the scraper directly
            if (localPdfPath) {
                console.log('📄 Using local PDF file...');
                const FourKaPdfScraper = require('./scrapers/4ka-pdf-scraper');
                const fourkaScraper = new FourKaPdfScraper();
                const results = await fourkaScraper.scrapePdf(fourkaConfig.pdfUrl, fourkaConfig.displayName, localPdfPath);
                return [results];
            }
            
            // For dynamic discovery, use single provider crawling
            console.log('🔄 Using dynamic PDF discovery for 4ka only...');
            const CrawlerManager = require('./crawlers/crawler-manager');
            const crawlerManager = new CrawlerManager();
            
            crawlerManager.initializeCrawlers(config);
            
            const fourkaCrawler = crawlerManager.crawlers.get('fourka');
            if (!fourkaCrawler) {
                throw new Error('4ka crawler not initialized');
            }
            
            console.log('🚀 Running 4ka crawler directly...');
            const fourkaResult = await crawlerManager.runSingleCrawler('fourka', fourkaCrawler);
            
            if (!fourkaResult || !fourkaResult.result || !fourkaResult.result.pdfs) {
                throw new Error(`4ka consolidated crawl failed: No PDF data found`);
            }
            
            const consolidatedResult = fourkaResult.result;
            
            console.log(`📊 4ka Consolidated Results:`);
            console.log(`   Total PDFs: ${consolidatedResult.totalPdfs}`);
            console.log(`   Successful: ${consolidatedResult.successfulPdfs}`);
            console.log(`   Failed: ${consolidatedResult.failedPdfs}`);
            
            // Display individual PDF results
            consolidatedResult.pdfs.forEach((pdf, index) => {
                const status = pdf.error ? '❌' : '✅';
                const charCount = pdf.rawText ? pdf.rawText.length : 0;
                console.log(`${status} PDF ${index + 1} (${pdf.pdfType}): ${charCount} characters extracted`);
            });
            
            return [consolidatedResult];
            
        } catch (error) {
            console.error(`Error in 4ka PDF scraping:`, error.message);
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

📖 Documentation:
- SYSTEM_OVERVIEW.md - Complete system documentation
- README.md - Project setup and usage

Examples:
node src/main.js o2               # Run O2 scraper
node src/main.js telekom          # Run Telekom scraper
node src/main.js orange           # Run Orange scraper
node src/main.js tesco            # Run Tesco Mobile scraper
node src/main.js fourka           # Run 4ka scraper
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
                        console.log(`   ✅ ${result.provider}: ${result.result.pdfUrl}`);
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
        
        if (scraperName) {
            console.log(`❌ Scraper '${scraperName}' not supported. Available: o2, telekom, orange, tesco, fourka`);
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