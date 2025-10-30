const BaseCrawler = require('./base-crawler');
const cheerio = require('cheerio');
const RadPdfScraper = require('../scrapers/rad-pdf-scraper');
const DataStorage = require('../storage/data-storage');

/**
 * RAD Slovakia specific crawler
 * Monitors RAD pricing page for PDF updates
 */
class RadCrawler extends BaseCrawler {
    constructor(config) {
        super('RAD Slovakia', config);
        this.dataStorage = new DataStorage();
    }

    /**
     * RAD-specific PDF link extraction
     * Looks for PDF links in the pricing page and extracts date information
     */
    async extractPdfLinks() {
        try {
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            const pdfLinks = [];
            
            console.log('🔍 Looking for RAD PDF links...');
            
            // Look for PDF links with various selectors
            const selectors = [
                'a[href$=".pdf"]',
                'a[href*="CENNIK"]',
                'a[href*="cennik"]',
                'a[href*="pdf"]',
                'a.button[href*=".pdf"]' // Specific for RAD download button
            ];
            
            for (const selector of selectors) {
                $(selector).each((index, element) => {
                    const href = $(element).attr('href');
                    const text = $(element).text().trim();
                    
                    if (href && href.toLowerCase().includes('.pdf')) {
                        // Convert relative URLs to absolute
                        const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                        
                        // Extract date information from surrounding text
                        const dateInfo = this.extractDateFromContext($, element);
                        
                        pdfLinks.push({
                            url: absoluteUrl,
                            text: text,
                            selector: selector,
                            element: $(element).html(),
                            dateInfo: dateInfo
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
            
            // Filter for service pricing PDFs (look for "cennik" in URL or text)
            const filteredLinks = uniqueLinks.filter(link => {
                const url = link.url.toLowerCase();
                const text = link.text.toLowerCase();
                
                // Must contain "cennik" (pricing) in URL or text
                const hasCennik = url.includes('cennik') || text.includes('cennik') || 
                                 url.includes('cenník') || text.includes('cenník');
                
                if (!hasCennik) {
                    console.log(`🚫 Filtering out non-pricing PDF: ${link.url}`);
                    return false;
                }
                
                // Skip device pricing PDFs if they exist
                if (url.includes('zariadeni') || url.includes('zariadení') || 
                    text.includes('zariadeni') || text.includes('zariadení')) {
                    console.log(`🚫 Filtering out device pricing PDF: ${link.url}`);
                    return false;
                }
                
                return true;
            });
            
            console.log(`📄 Found ${filteredLinks.length} service pricing PDF links for RAD (filtered from ${uniqueLinks.length} total)`);
            
            // Log each found PDF with date info
            filteredLinks.forEach((link, index) => {
                console.log(`📄 PDF ${index + 1}: ${link.text || 'Untitled'}`);
                console.log(`   URL: ${link.url}`);
                if (link.dateInfo) {
                    console.log(`   Date: ${link.dateInfo}`);
                }
            });
            
            return filteredLinks;
        } catch (error) {
            console.error(`❌ Failed to extract PDF links for RAD:`, error.message);
            throw error;
        }
    }

    /**
     * Extract date information from context around PDF link
     * @param {Object} $ - Cheerio instance
     * @param {Object} element - PDF link element
     * @returns {string|null} Extracted date string or null
     */
    extractDateFromContext($, element) {
        try {
            // Look for date patterns in the element's text and surrounding context
            const elementText = $(element).text();
            const parentText = $(element).parent().text();
            const siblingText = $(element).siblings().text();
            
            const allText = `${elementText} ${parentText} ${siblingText}`;
            
            // Common Slovak date patterns
            const datePatterns = [
                /platný od (\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/i,
                /platný od (\d{1,2}\/\d{1,2}\/\d{4})/i,
                /od (\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/i,
                /od (\d{1,2}\/\d{1,2}\/\d{4})/i,
                /(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/,
                /(\d{1,2}\/\d{1,2}\/\d{4})/
            ];
            
            for (const pattern of datePatterns) {
                const match = allText.match(pattern);
                if (match) {
                    return match[1].trim();
                }
            }
            
            return null;
        } catch (error) {
            console.warn(`⚠️ Failed to extract date from context: ${error.message}`);
            return null;
        }
    }

    /**
     * RAD-specific metadata extraction
     * Returns basic metadata without unnecessary publishDate
     */
    async extractMetadata() {
        try {
            return {
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to extract metadata for RAD:`, error.message);
            return {
                lastChecked: new Date().toISOString()
            };
        }
    }

    /**
     * Process RAD PDFs and return consolidated results
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
            
            console.log(`📄 Found ${pdfLinks.length} unique PDF links for RAD`);
            
            const primaryPdf = pdfLinks[0]; // Assuming only one primary PDF for RAD
            console.log(`📄 Processing PDF 1/1: ${primaryPdf.text || 'RAD Cenník služieb'}`);
            console.log(`🔗 URL: ${primaryPdf.url}`);
            
            const allPdfData = [];
            
            try {
                const radScraper = new RadPdfScraper(this.errorMonitor);
                const extractedData = await radScraper.scrapePdf(primaryPdf.url, `RAD Cenník služieb`, null, true);
                
                // Create consolidated rawText from all sections (like Telekom)
                let consolidatedRawText = '';
                if (extractedData.data?.sections) {
                    Object.values(extractedData.data.sections).forEach(section => {
                        if (section.rawText) {
                            consolidatedRawText += section.rawText + '\n\n';
                        }
                    });
                }
                
                const pdfData = {
                    cennikName: extractedData.cennikName || `RAD Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník služieb',
                    rawText: consolidatedRawText.trim(),
                    summary: extractedData.summary,
                    extractionInfo: extractedData.extractionInfo,
                    validation: extractedData.metadata?.validation
                };
                
                console.log(`📊 PDF Data Structure for RAD Cenník služieb:`);
                console.log(`   - Has rawText: ${!!pdfData.rawText}`);
                console.log(`   - Has summary: ${!!pdfData.summary}`);
                console.log(`   - Has extractionInfo: ${!!pdfData.extractionInfo}`);
                console.log(`   - Raw text length: ${pdfData.rawText.length} characters`);
                
                if (!pdfData.rawText || pdfData.rawText.trim().length === 0) {
                    console.error(`❌ No content extracted from RAD PDF. This may indicate a download failure or extraction error.`);
                    pdfData.error = 'No content extracted - possible download failure or extraction error';
                }
                
                allPdfData.push(pdfData);
                console.log(`✅ Successfully processed RAD Cenník služieb`);
                
            } catch (error) {
                console.error(`❌ Error processing RAD PDF:`, error.message);
                allPdfData.push({
                    cennikName: `RAD Cenník služieb`,
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
                const errorResult = this.errorMonitor.handleError(error, 'rad-crawl', 'RAD Slovakia');
                throw errorResult.error;
            } else {
                console.error(`❌ [RAD Slovakia] rad-crawl: ${error.message}`);
                throw error;
            }
        } finally {
            if (this.browser) {
                await this.cleanup();
            }
        }
    }
}

module.exports = RadCrawler;