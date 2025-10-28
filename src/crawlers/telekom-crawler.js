const BaseCrawler = require('./base-crawler');
const cheerio = require('cheerio');

/**
 * Telekom Slovakia specific crawler
 * Monitors Telekom pricing page for PDF updates
 */
class TelekomCrawler extends BaseCrawler {
    constructor(config) {
        super('Telekom Slovakia', config);
    }

    /**
     * Telekom-specific PDF link extraction
     * Looks for PDF links in the pricing page using search text approach
     */
    async extractPdfLinks() {
        try {
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            const pdfLinks = [];
            
            if (this.config.searchText) {
                const searchResult = this.findPdfNearSearchText($, this.config.searchText);
                if (searchResult) {
                    pdfLinks.push(searchResult);
                }
            }
            
            if (pdfLinks.length === 0) {
                const selectors = [
                    'a[href*="uuid="]',
                    'a[href$=".pdf"]',
                    'a[href*="cennik"]',
                    'a[href*="Cennik"]',
                    'a[href*="tarif"]',
                    'a[href*="pdf"]',
                    'a[href*="dokument"]'
                ];
                
                for (const selector of selectors) {
                    $(selector).each((index, element) => {
                        const href = $(element).attr('href');
                        const text = $(element).text().trim();
                        
                        if (href && (href.toLowerCase().includes('.pdf') || href.includes('uuid='))) {
                            // Convert relative URLs to absolute
                            const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                            
                            pdfLinks.push({
                                url: absoluteUrl,
                                text: text,
                                selector: selector,
                                element: $(element).html()
                            });
                        }
                    });
                }
            }
            
            const uniqueLinks = [];
            const seenUrls = new Set();
            
            for (const link of pdfLinks) {
                if (!seenUrls.has(link.url)) {
                    seenUrls.add(link.url);
                    uniqueLinks.push(link);
                }
            }
            
            console.log(`📄 Found ${uniqueLinks.length} unique PDF links for Telekom`);
            return uniqueLinks;
        } catch (error) {
            console.error(`❌ Failed to extract PDF links for Telekom:`, error.message);
            throw error;
        }
    }

    /**
     * Telekom-specific metadata extraction
     * Returns basic metadata without unnecessary publishDate
     */
    async extractMetadata() {
        try {
            return {
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to extract metadata for Telekom:`, error.message);
            return {
                lastChecked: new Date().toISOString()
            };
        }
    }


    /**
     * Process Telekom PDFs and return consolidated results
     * This method overrides the base crawl method to handle PDF processing
     * @param {Object} options - Options for selective processing
     * @param {Object} options.reuseCrawlResult - Crawl result to reuse (avoids double crawling)
     * @returns {Promise<Object>} Consolidated crawl result
     */
    async crawl(options = {}) {
        try {
            console.log(`🚀 Starting consolidated crawl for ${this.providerName}...`);
            
            let pdfLinks, metadata;
            
            // Check if we can reuse crawl results to avoid double crawling
            if (options.reuseCrawlResult && options.reuseCrawlResult.allPdfLinks) {
                console.log(`🔄 Reusing crawl results to avoid double crawling...`);
                pdfLinks = options.reuseCrawlResult.allPdfLinks || [];
                metadata = {
                    lastChecked: options.reuseCrawlResult.lastChecked
                };
                console.log(`📄 Reusing ${pdfLinks.length} PDF links from previous crawl`);
            } else {
                // Fallback to normal crawling if no results to reuse
                console.log(`🌐 Performing fresh crawl (no results to reuse)...`);
                await this.initialize();
                await this.navigateToPricingPage();
                
                pdfLinks = await this.extractPdfLinks();
                metadata = await this.extractMetadata();
            }
            
            if (pdfLinks.length === 0) {
                throw new Error(`No PDF links found for ${this.providerName}`);
            }
            
            console.log(`📄 Found ${pdfLinks.length} unique PDF links for Telekom`);
            
            // Process the primary PDF (Telekom typically has one main PDF)
            const primaryPdf = pdfLinks[0];
            console.log(`📄 Processing PDF 1/1: ${primaryPdf.text || 'Telekom Cenník služieb'}`);
            console.log(`🔗 URL: ${primaryPdf.url}`);
            
            const allPdfData = [];
            
            try {
                // Use Telekom PDF scraper to process the PDF (skip individual storage)
                const TelekomPdfScraper = require('../scrapers/telekom-pdf-scraper');
                const telekomScraper = new TelekomPdfScraper();
                    const extractedData = await telekomScraper.scrapePdf(primaryPdf.url, `Telekom Cenník služieb`, null, true);
                
                // Create consolidated data structure using the scraper result
                // Create consolidated rawText from all sections (clean format)
                let consolidatedRawText = '';
                if (extractedData.data?.sections) {
                    Object.values(extractedData.data.sections).forEach(section => {
                        if (section.rawText) {
                            consolidatedRawText += section.rawText + '\n\n';
                        }
                    });
                }
                
                const pdfData = {
                    cennikName: extractedData.cennikName || `Telekom Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník služieb',
                    rawText: consolidatedRawText.trim(),
                    data: {
                        sections: extractedData.data?.sections || {},
                        summary: extractedData.summary,
                        extractionInfo: extractedData.extractionInfo
                    },
                    summary: extractedData.summary,
                    extractionInfo: extractedData.extractionInfo
                };
                
                console.log(`📊 PDF Data Structure for Telekom Cenník služieb:`);
                console.log(`   - Has rawText: ${!!pdfData.rawText}`);
                console.log(`   - Has summary: ${!!pdfData.summary}`);
                console.log(`   - Has extractionInfo: ${!!pdfData.extractionInfo}`);
                console.log(`   - Raw text length: ${pdfData.rawText.length} characters`);
                
                allPdfData.push(pdfData);
                console.log(`✅ Successfully processed Telekom Cenník služieb`);
                
            } catch (error) {
                console.error(`❌ Error processing Telekom PDF:`, error.message);
                allPdfData.push({
                    cennikName: `Telekom Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník služieb',
                    rawText: '',
                    error: error.message
                });
            }
            
            // Create consolidated result
            const consolidatedResult = {
                provider: this.providerName,
                crawlDate: new Date().toISOString(),
                lastChecked: new Date().toISOString(),
                totalPdfs: allPdfData.length,
                successfulPdfs: allPdfData.filter(pdf => !pdf.error).length,
                failedPdfs: allPdfData.filter(pdf => pdf.error).length,
                pdfs: allPdfData,
                lastUpdate: {
                    updatedPdfs: allPdfData.length,
                    updatedPdfUrls: pdfLinks.map(link => link.url),
                    updateType: 'full'
                },
                metadata: metadata
            };
            
            console.log(`📊 Consolidated Results:`);
            console.log(`   Total PDFs: ${consolidatedResult.totalPdfs}`);
            console.log(`   Successful: ${consolidatedResult.successfulPdfs}`);
            console.log(`   Failed: ${consolidatedResult.failedPdfs}`);
            
            return consolidatedResult;
            
        } catch (error) {
            const errorResult = this.errorHandler.handleError(error, 'telekom-crawl', 'Telekom Slovakia');
            throw errorResult.error;
        } finally {
            if (this.browser) {
                await this.cleanup();
            }
        }
    }
}

module.exports = TelekomCrawler;
