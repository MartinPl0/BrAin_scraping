const BaseCrawler = require('./base-crawler');
const cheerio = require('cheerio');

/**
 * Funfon Slovakia specific crawler
 * Monitors Funfon pricing page for PDF updates
 */
class FunfonCrawler extends BaseCrawler {
    constructor(config) {
        super('Funfon Slovakia', config);
    }

    /**
     * Navigate to pricing page and expand collapsible section if needed
     */
    async navigateToPricingPage() {
        try {
            console.log(`🌐 Navigating to ${this.config.crawlUrl}...`);
            await this.page.goto(this.config.crawlUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Wait for page to be ready
            const pageReady = await this.dynamicWaiter.smartWait(this.page, this.providerName, {
                timeout: 10000
            });
            
            if (pageReady) {
                console.log(`✅ Successfully loaded ${this.providerName} pricing page`);
            } else {
                console.warn(`⚠️  Page may not be fully loaded, continuing anyway...`);
            }

            // Try to expand the collapsible "Cenník" section if it's collapsed
            try {
                console.log(`🔍 Checking if collapsible section needs to be expanded...`);
                
                // Check if section is collapsed
                const isCollapsed = await this.page.evaluate(() => {
                    const collapseElement = document.querySelector('#collapse02');
                    if (!collapseElement) return false;
                    
                    // Check if it has 'collapse' class and not 'show' class
                    return collapseElement.classList.contains('collapse') && 
                           !collapseElement.classList.contains('show');
                });

                if (isCollapsed) {
                    console.log(`📂 Collapsible section is collapsed, attempting to expand...`);
                    
                    // Click on the heading to expand
                    await this.page.click('h4.item-title.collapsed[data-target="#collapse02"]');
                    
                    // Wait for collapse animation
                    await this.page.waitForSelector('#collapse02.show', { timeout: 5000 }).catch(() => {
                        console.log(`⚠️  Collapse may have already been expanded or selector changed`);
                    });
                    
                    console.log(`✅ Collapsible section expanded`);
                } else {
                    console.log(`✅ Collapsible section is already expanded or not present`);
                }
            } catch (error) {
                console.warn(`⚠️  Could not expand collapsible section (may already be expanded): ${error.message}`);
                // Continue anyway - PDF might be available in static HTML
            }

        } catch (error) {
            console.error(`❌ Failed to navigate to ${this.providerName} pricing page:`, error.message);
            throw error;
        }
    }

    /**
     * Funfon-specific PDF link extraction
     * Looks for PDF links in the pricing page, specifically the one with date in filename
     */
    async extractPdfLinks() {
        try {
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            const pdfLinks = [];
            
            // Look for PDF links - specifically the main pricing PDF
            // The link we want has "cennik-funfon-ferofka" and a date in the filename
            const selectors = [
                'a[href*="cennik-funfon-ferofka"]',
                'a[href$=".pdf"]',
                'p.link a[href*=".pdf"]',
                'a[href*="cennik"]'
            ];
            
            for (const selector of selectors) {
                $(selector).each((index, element) => {
                    const href = $(element).attr('href');
                    const text = $(element).text().trim();
                    
                    if (href && href.toLowerCase().includes('.pdf')) {
                        // Convert relative URLs to absolute
                        const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                        
                        // Prioritize the main pricing PDF (cennik-funfon-ferofka)
                        const isMainPricingPdf = href.toLowerCase().includes('cennik-funfon-ferofka') ||
                                                 text.toLowerCase().includes('férofka') ||
                                                 text.toLowerCase().includes('ferofka');
                        
                        pdfLinks.push({
                            url: absoluteUrl,
                            text: text,
                            selector: selector,
                            element: $(element).html(),
                            isMainPricingPdf: isMainPricingPdf
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
            
            // Sort: main pricing PDF first, then others
            uniqueLinks.sort((a, b) => {
                if (a.isMainPricingPdf && !b.isMainPricingPdf) return -1;
                if (!a.isMainPricingPdf && b.isMainPricingPdf) return 1;
                return 0;
            });
            
            // Filter to only main pricing PDF if found
            const mainPricingPdf = uniqueLinks.find(link => link.isMainPricingPdf);
            const filteredLinks = mainPricingPdf ? [mainPricingPdf] : uniqueLinks;
            
            console.log(`📄 Found ${filteredLinks.length} PDF link(s) for Funfon (from ${uniqueLinks.length} total)`);
            if (filteredLinks.length > 0) {
                console.log(`   Primary PDF: ${filteredLinks[0].url}`);
            }
            
            return filteredLinks;
        } catch (error) {
            console.error(`❌ Failed to extract PDF links for Funfon:`, error.message);
            throw error;
        }
    }

    /**
     * Extract date from PDF filename or link text
     */
    async extractMetadata() {
        try {
            const pdfLinks = await this.extractPdfLinks();
            let publishDate = null;
            
            if (pdfLinks.length > 0) {
                const pdfLink = pdfLinks[0];
                
                // Extract date from filename (e.g., "cennik-funfon-ferofka-2025-09-10.pdf")
                const filename = pdfLink.url.split('/').pop();
                publishDate = this.extractDateFromFilename(filename);
                
                // If no date from filename, try link text (e.g., "platný od 10.9.2025")
                if (!publishDate) {
                    publishDate = this.extractDateFromLinkText(pdfLink.text);
                }
            }
            
            return {
                publishDate,
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to extract metadata for Funfon:`, error.message);
            return {
                publishDate: null,
                lastChecked: new Date().toISOString()
            };
        }
    }

    /**
     * Process Funfon PDFs and return consolidated results
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
                    publishDate: options.reuseCrawlResult.publishDate,
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
            
            const primaryPdf = pdfLinks[0];
            console.log(`📄 Processing PDF 1/1: ${primaryPdf.text || 'Funfon Cenník služieb'}`);
            console.log(`🔗 URL: ${primaryPdf.url}`);
            
            const allPdfData = [];
            
            try {
                const FunfonPdfScraper = require('../scrapers/funfon-pdf-scraper');
                const funfonScraper = new FunfonPdfScraper(this.errorMonitor);
                const extractedData = await funfonScraper.scrapePdf(
                    primaryPdf.url, 
                    `Funfon Cenník služieb`, 
                    null, 
                    true // skipStorage - we'll save in consolidated format
                );
                
                // Create consolidated rawText from all sections (like Telekom)
                let consolidatedRawText = '';
                if (extractedData.data?.sections) {
                    Object.values(extractedData.data.sections).forEach(section => {
                        if (section.rawText) {
                            consolidatedRawText += section.rawText + '\n\n';
                        }
                    });
                }
                
                // Use rawText from scraper if available, otherwise use consolidated
                const finalRawText = extractedData.rawText || consolidatedRawText.trim();
                
                const pdfData = {
                    cennikName: extractedData.cennikName || `Funfon Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník služieb',
                    rawText: finalRawText,
                    data: {
                        sections: extractedData.data?.sections || {},
                        summary: extractedData.summary,
                        extractionInfo: extractedData.extractionInfo
                    },
                    scrapedAt: new Date().toISOString(),
                    summary: extractedData.summary,
                    extractionInfo: extractedData.extractionInfo,
                    validation: extractedData.metadata?.validation
                };
                
                console.log(`📊 PDF Data Structure for Funfon Cenník služieb:`);
                console.log(`   - Has rawText: ${!!pdfData.rawText}`);
                console.log(`   - Raw text length: ${pdfData.rawText.length} characters`);
                console.log(`   - Has data.sections: ${!!pdfData.data.sections}`);
                
                if (!pdfData.rawText || pdfData.rawText.trim().length === 0) {
                    console.error(`❌ No content extracted from Funfon PDF. This may indicate a download failure or extraction error.`);
                    pdfData.error = 'No content extracted - possible download failure or extraction error';
                }
                
                allPdfData.push(pdfData);
                console.log(`✅ Successfully processed Funfon Cenník služieb`);
                
            } catch (error) {
                console.error(`❌ Error processing Funfon PDF:`, error.message);
                allPdfData.push({
                    cennikName: `Funfon Cenník služieb`,
                    pdfUrl: primaryPdf.url,
                    pdfType: 'Cenník služieb',
                    rawText: '',
                    error: error.message
                });
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
                metadata: { publishDate: metadata.publishDate }
            };
            
            console.log(`📊 Consolidated Results:`);
            console.log(`   Total PDFs: ${consolidatedResult.totalPdfs}`);
            console.log(`   Successful: ${consolidatedResult.successfulPdfs}`);
            console.log(`   Failed: ${consolidatedResult.failedPdfs}`);
            if (metadata.publishDate) {
                console.log(`   Publish Date: ${metadata.publishDate}`);
            }
            
            return consolidatedResult;
            
        } catch (error) {
            if (this.errorMonitor) {
                const errorResult = this.errorMonitor.handleError(error, 'funfon-crawl', 'Funfon Slovakia');
                throw errorResult.error;
            } else {
                console.error(`❌ [Funfon Slovakia] funfon-crawl: ${error.message}`);
                throw error;
            }
        } finally {
            if (this.browser) {
                await this.cleanup();
            }
        }
    }
}

module.exports = FunfonCrawler;

