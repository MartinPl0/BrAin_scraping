const BaseCrawler = require('./base-crawler');
const cheerio = require('cheerio');

/**
 * O2 Slovakia specific crawler
 * Monitors O2 pricing page for PDF updates
 */
class O2Crawler extends BaseCrawler {
    constructor(config) {
        super('O2 Slovakia', config);
    }

    /**
     * O2-specific PDF link extraction
     * Looks for PDF links in the pricing page
     */
    async extractPdfLinks() {
        try {
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            const pdfLinks = [];
            
            // Look for PDF links with various selectors
            const selectors = [
                'a[href$=".pdf"]',
                'a[href*="Cennik"]',
                'a[href*="cennik"]',
                'a[href*="pdf"]'
            ];
            
            for (const selector of selectors) {
                $(selector).each((index, element) => {
                    const href = $(element).attr('href');
                    const text = $(element).text().trim();
                    
                    if (href && href.toLowerCase().includes('.pdf')) {
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
            
            // Remove duplicates based on URL
            const uniqueLinks = [];
            const seenUrls = new Set();
            
            for (const link of pdfLinks) {
                if (!seenUrls.has(link.url)) {
                    seenUrls.add(link.url);
                    uniqueLinks.push(link);
                }
            }
            
            // Filter out device pricing PDFs (we only want service pricing)
            const filteredLinks = uniqueLinks.filter(link => {
                const url = link.url.toLowerCase();
                const text = link.text.toLowerCase();
                
                // Skip device pricing PDFs
                if (url.includes('zariadeni') || url.includes('zariadení') || 
                    url.includes('cennik_zariadeni') || url.includes('cenník_zariadení') ||
                    text.includes('zariadeni') || text.includes('zariadení') ||
                    text.includes('smartfon') || text.includes('telefon')) {
                    console.log(`🚫 Filtering out device pricing PDF: ${link.url}`);
                    return false;
                }
                
                return true;
            });
            
            console.log(`📄 Found ${filteredLinks.length} service pricing PDF links for O2 (filtered from ${uniqueLinks.length} total)`);
            return filteredLinks;
        } catch (error) {
            console.error(`❌ Failed to extract PDF links for O2:`, error.message);
            throw error;
        }
    }

    /**
     * O2-specific metadata extraction
     * Returns basic metadata without unnecessary publishDate
     */
    async extractMetadata() {
        try {
            return {
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to extract metadata for O2:`, error.message);
            return {
                lastChecked: new Date().toISOString()
            };
        }
    }


    /**
     * Process O2 PDFs and return consolidated results
     * This method overrides the base crawl method to handle PDF processing
     * @param {Object} options - Options for selective processing
     * @param {Object} options.reuseCrawlResult - Crawl result to reuse (avoids double crawling)
     * @returns {Promise<Object>} Consolidated crawl result
     */
    async crawl(options = {}) {
        try {
            console.log(`🚀 Starting consolidated crawl for ${this.providerName}...`);
            
            let pdfLinks, metadata;
            
            if (options.reuseCrawlResult && options.reuseCrawlResult.allPdfLinks) {
                console.log(`🔄 Reusing crawl results to avoid double crawling...`);
                pdfLinks = options.reuseCrawlResult.allPdfLinks || [];
                metadata = {
                    lastChecked: options.reuseCrawlResult.lastChecked
                };
                console.log(`📄 Reusing ${pdfLinks.length} PDF links from previous crawl`);
            } else {
                console.log(`🌐 Performing fresh crawl (no results to reuse)...`);
                await this.initialize();
                await this.navigateToPricingPage();
                
                pdfLinks = await this.extractPdfLinks();
                metadata = await this.extractMetadata();
            }
            
            if (pdfLinks.length === 0) {
                throw new Error(`No PDF links found for ${this.providerName}`);
            }
            
            console.log(`📄 Found ${pdfLinks.length} unique PDF links for O2`);
            
            const primaryPdf = pdfLinks[0];
            console.log(`📄 Processing PDF 1/1: ${primaryPdf.text || 'O2 Cenník služieb'}`);
            console.log(`🔗 URL: ${primaryPdf.url}`);
            
            const allPdfData = [];
            
            try {
                const O2PdfScraper = require('../scrapers/o2-pdf-scraper');
                const o2Scraper = new O2PdfScraper(this.errorMonitor);
                const extractedData = await o2Scraper.scrapePdf(primaryPdf.url, `O2 Cenník služieb`, null, null, true);
                
                // Create consolidated rawText from all sections (like RAD and Telekom)
                let consolidatedRawText = '';
                if (extractedData.data?.sections) {
                    Object.values(extractedData.data.sections).forEach(section => {
                        if (section.rawText) {
                            consolidatedRawText += section.rawText + '\n\n';
                        }
                    });
                }
                
                const pdfData = {
                    cennikName: extractedData.cennikName || `O2 Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník služieb',
                    rawText: consolidatedRawText.trim(),
                    data: {
                        sections: extractedData.data?.sections || {},
                        summary: extractedData.summary,
                        extractionInfo: extractedData.extractionInfo
                    },
                    summary: extractedData.summary,
                    validation: extractedData.metadata?.validation,
                    extractionInfo: extractedData.extractionInfo
                };
                
                console.log(`📊 PDF Data Structure for O2 Cenník služieb:`);
                console.log(`   - Has rawText: ${!!pdfData.rawText}`);
                console.log(`   - Has summary: ${!!pdfData.summary}`);
                console.log(`   - Has extractionInfo: ${!!pdfData.extractionInfo}`);
                console.log(`   - Raw text length: ${pdfData.rawText.length} characters`);
                
                if (!pdfData.rawText || pdfData.rawText.trim().length === 0) {
                    console.error(`❌ No content extracted from O2 PDF. This may indicate a download failure or extraction error.`);
                    pdfData.error = 'No content extracted - possible download failure or extraction error';
                }
                
                allPdfData.push(pdfData);
                console.log(`✅ Successfully processed O2 Cenník služieb`);
                
            } catch (error) {
                console.error(`❌ Error processing O2 PDF:`, error.message);
                allPdfData.push({
                    cennikName: `O2 Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník služieb',
                    rawText: '',
                    error: error.message
                });
            }
            
            // Preserve metadata but remove lastChecked to avoid duplication at top-level
            const filteredMetadata = { ...(metadata || {}) };
            if (filteredMetadata && Object.prototype.hasOwnProperty.call(filteredMetadata, 'lastChecked')) {
                delete filteredMetadata.lastChecked;
            }

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
                metadata: filteredMetadata
            };
            
            console.log(`📊 Consolidated Results:`);
            console.log(`   Total PDFs: ${consolidatedResult.totalPdfs}`);
            console.log(`   Successful: ${consolidatedResult.successfulPdfs}`);
            console.log(`   Failed: ${consolidatedResult.failedPdfs}`);
            
            return consolidatedResult;
            
        } catch (error) {
            if (this.errorMonitor) {
                const errorResult = this.errorMonitor.handleError(error, 'o2-crawl', 'O2 Slovakia');
                throw errorResult.error;
            } else {
                console.error(`❌ [O2 Slovakia] o2-crawl: ${error.message}`);
                throw error;
            }
        } finally {
            if (this.browser) {
                await this.cleanup();
            }
        }
    }
}

module.exports = O2Crawler;
