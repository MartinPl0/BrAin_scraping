const BaseCrawler = require('./base-crawler');
const cheerio = require('cheerio');

/**
 * Juro Slovakia specific crawler
 * Monitors Telekom pricing page for Juro PDF updates
 * Juro is created by Telekom, so it uses the same crawl URL
 */
class JuroCrawler extends BaseCrawler {
    constructor(config) {
        super('Juro Slovakia', config);
    }

    /**
     * Juro-specific PDF link extraction
     * Finds the Juro PDF from the Telekom pricing page
     */
    async extractPdfLinks() {
        try {
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            const pdfLinks = [];
            const allCandidates = [];
            
            // Look for Juro PDF specifically
            // The PDF text is "Cenník pre poskytovanie služby Juro"
            const searchText = this.config.searchText || 'Juro';
            
            console.log(`🔍 Searching for Juro PDF with search text: "${searchText}"`);
            
            // Strategy 1: Scan all links that might be PDFs (similar to Telekom crawler)
            const selectors = [
                'a[href*="uuid="]',
                'a[href$=".pdf"]',
                'a[href*="cennik"]',
                'a[href*="Cennik"]',
                'a[href*="juro"]',
                'a[href*="Juro"]',
                'a[href*="pdf"]',
                'a[href*="dokument"]'
            ];
            
            // First, collect all potential PDF links
            for (const selector of selectors) {
                $(selector).each((index, element) => {
                    const href = $(element).attr('href');
                    const text = $(element).text().trim();
                    
                    if (href && (href.toLowerCase().includes('.pdf') || href.includes('uuid='))) {
                        const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                        
                        // Collect all candidates for debugging
                        allCandidates.push({
                            url: absoluteUrl,
                            text: text,
                            selector: selector,
                            href: href
                        });
                    }
                });
            }
            
            console.log(`🔍 Found ${allCandidates.length} potential PDF links on page`);
            
            // Now filter for Juro-specific PDFs
            for (const candidate of allCandidates) {
                const lowerHref = candidate.href.toLowerCase();
                const lowerText = candidate.text.toLowerCase();
                
                // Check if this is the Juro PDF
                const isJuroPdf = lowerHref.includes('juro') || 
                               lowerText.includes('juro') ||
                               lowerText.includes('cenník pre poskytovanie služby juro') ||
                               lowerText.includes('cennik pre poskytovanie sluzby juro');
                
                if (isJuroPdf) {
                    pdfLinks.push({
                        url: candidate.url,
                        text: candidate.text,
                        selector: candidate.selector,
                        element: candidate.text,
                        pdfType: 'Cenník pre poskytovanie služby Juro'
                    });
                    
                    console.log(`✅ Found Juro PDF: ${candidate.text}`);
                    console.log(`🔗 URL: ${candidate.url}`);
                }
            }
            
            // Strategy 2: Use search text approach if not found yet
            if (pdfLinks.length === 0 && this.config.searchText) {
                console.log(`🔄 Trying search text approach...`);
                const searchResult = this.findPdfNearSearchText($, this.config.searchText);
                if (searchResult) {
                    // Verify it's actually Juro PDF
                    const lowerHref = searchResult.url.toLowerCase();
                    const lowerText = searchResult.text.toLowerCase();
                    
                    if (lowerHref.includes('juro') || lowerText.includes('juro')) {
                        pdfLinks.push({
                            ...searchResult,
                            pdfType: 'Cenník pre poskytovanie služby Juro'
                        });
                        console.log(`✅ Found Juro PDF via search text: ${searchResult.text}`);
                    }
                }
            }
            
            // Strategy 3: If still not found, try looking for text containing "Juro" anywhere on page
            if (pdfLinks.length === 0) {
                console.log(`🔄 Trying text-based search for "Juro"...`);
                
                // Find all elements containing "Juro"
                $('*').each((index, element) => {
                    const text = $(element).text().trim();
                    if (text.toLowerCase().includes('juro') && text.toLowerCase().includes('cenník')) {
                        // Look for PDF link nearby
                        const nearbyLink = $(element).closest('tr, div, section').find('a[href*="uuid="], a[href$=".pdf"]').first();
                        if (nearbyLink.length > 0) {
                            const href = nearbyLink.attr('href');
                            const linkText = nearbyLink.text().trim();
                            if (href) {
                                const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                                pdfLinks.push({
                                    url: absoluteUrl,
                                    text: linkText || text,
                                    selector: 'text-based-search',
                                    pdfType: 'Cenník pre poskytovanie služby Juro'
                                });
                                console.log(`✅ Found Juro PDF via text search: ${linkText || text}`);
                                return false; // Break
                            }
                        }
                    }
                });
            }
            
            // Remove duplicates
            const uniqueLinks = [];
            const seenUrls = new Set();
            
            for (const link of pdfLinks) {
                if (!seenUrls.has(link.url)) {
                    seenUrls.add(link.url);
                    uniqueLinks.push(link);
                }
            }
            
            if (uniqueLinks.length === 0) {
                console.warn(`⚠️  No Juro PDF links found on page`);
                console.log(`💡 Debug: Found ${allCandidates.length} total PDF links. Showing first 5:`);
                allCandidates.slice(0, 5).forEach((c, i) => {
                    console.log(`   ${i + 1}. Text: "${c.text.substring(0, 100)}", URL: ${c.url.substring(0, 100)}`);
                });
            } else {
                console.log(`📄 Found ${uniqueLinks.length} unique Juro PDF link(s)`);
            }
            
            return uniqueLinks;
        } catch (error) {
            console.error(`❌ Failed to extract PDF links for Juro:`, error.message);
            throw error;
        }
    }

    /**
     * Juro-specific metadata extraction
     * Returns basic metadata - date can be extracted from URL
     */
    async extractMetadata() {
        try {
            const pdfLinks = await this.extractPdfLinks();
            let publishDate = null;
            
            if (pdfLinks.length > 0) {
                const pdfLink = pdfLinks[0];
                // Extract date from URL (format: YYYY-MM-DD or DD.MM.YYYY)
                publishDate = this.extractDateFromFilename(pdfLink.url.split('/').pop()) ||
                             this.extractDateFromLinkText(pdfLink.text);
            }
            
            return {
                publishDate,
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to extract metadata for Juro:`, error.message);
            return {
                publishDate: null,
                lastChecked: new Date().toISOString()
            };
        }
    }

    /**
     * Process Juro PDFs and return consolidated results
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
                    publishDate: options.reuseCrawlResult.publishDate,
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
            
            console.log(`📄 Found ${pdfLinks.length} unique PDF links for Juro`);
            
            // Process the primary PDF (Juro typically has one PDF)
            const primaryPdf = pdfLinks[0];
            console.log(`📄 Processing PDF 1/1: ${primaryPdf.text || 'Juro Cenník služieb'}`);
            console.log(`🔗 URL: ${primaryPdf.url}`);
            
            const allPdfData = [];
            
            try {
                // Use Juro PDF scraper to process the PDF (skip individual storage)
                const JuroPdfScraper = require('../scrapers/juro-pdf-scraper');
                const juroScraper = new JuroPdfScraper(this.errorMonitor);
                const extractedData = await juroScraper.scrapePdf(
                    primaryPdf.url, 
                    `Juro Cenník služieb`, 
                    null, 
                    true // skipStorage
                );
                
                // For euro-symbol-based extraction, we only need rawText
                // No need for data.sections since it's the same as rawText for single PDF extraction
                let consolidatedRawText = '';
                if (extractedData.data?.sections?.fullContent) {
                    consolidatedRawText = extractedData.data.sections.fullContent;
                } else if (extractedData.data?.sections) {
                    Object.values(extractedData.data.sections).forEach(section => {
                        if (section.rawText) {
                            consolidatedRawText += section.rawText + '\n\n';
                        }
                    });
                }
                
                const pdfData = {
                    cennikName: extractedData.cennikName || `Juro Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník pre poskytovanie služby Juro',
                    rawText: consolidatedRawText.trim(),
                    validation: extractedData.metadata?.validation
                };
                
                console.log(`📊 PDF Data Structure for Juro Cenník služieb:`);
                console.log(`   - Has rawText: ${!!pdfData.rawText}`);
                console.log(`   - Raw text length: ${pdfData.rawText.length} characters`);
                
                allPdfData.push(pdfData);
                console.log(`✅ Successfully processed Juro Cenník služieb`);
                
            } catch (error) {
                console.error(`❌ Error processing Juro PDF:`, error.message);
                allPdfData.push({
                    cennikName: `Juro Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník pre poskytovanie služby Juro',
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
                metadata: { publishDate: metadata.publishDate }
            };
            
            console.log(`📊 Consolidated Results:`);
            console.log(`   Total PDFs: ${consolidatedResult.totalPdfs}`);
            console.log(`   Successful: ${consolidatedResult.successfulPdfs}`);
            console.log(`   Failed: ${consolidatedResult.failedPdfs}`);
            
            return consolidatedResult;
            
        } catch (error) {
            if (this.errorMonitor) {
                const errorResult = this.errorMonitor.handleError(error, 'juro-crawl', 'Juro Slovakia');
                throw errorResult.error;
            } else {
                console.error(`❌ [Juro Slovakia] juro-crawl: ${error.message}`);
                throw error;
            }
        } finally {
            if (this.browser) {
                await this.cleanup();
            }
        }
    }
}

module.exports = JuroCrawler;

