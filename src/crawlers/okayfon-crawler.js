const BaseCrawler = require('./base-crawler');
const cheerio = require('cheerio');
const OkayfonPdfScraper = require('../scrapers/okayfon-pdf-scraper');
const ErrorHandler = require('../utils/error-handler');

/**
 * Okay fón Slovakia specific crawler
 * Monitors Okay fón pricing page for PDF updates
 */
class OkayfonCrawler extends BaseCrawler {
    constructor(config) {
        super('Okay fón Slovakia', config);
        this.errorHandler = new ErrorHandler();
    }

    /**
     * Okay fón-specific PDF link extraction
     * Looks for the main pricing PDF based on configuration
     */
    async extractPdfLinks() {
        try {
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            const pdfLinks = [];
            
            if (this.config.targetPdfs && Array.isArray(this.config.targetPdfs)) {
                console.log(`🔍 Looking for ${this.config.targetPdfs.length} specific Okay fón PDF types...`);
                
                for (const targetPdf of this.config.targetPdfs) {
                    console.log(`🔍 Searching for: ${targetPdf.name}`);
                    
                    const matchingLinks = [];
                    
                    if (targetPdf.selector) {
                        console.log(`🔍 Trying selector approach for ${targetPdf.name}...`);
                        let checkedLinks = 0;
                        
                        $(targetPdf.selector).each((index, element) => {
                            const href = $(element).attr('href');
                            const text = $(element).text().trim();
                            checkedLinks++;
                            
                            console.log(`🔍 Checking link ${checkedLinks}: "${text}" -> ${href}`);
                            
                            if (href && (href.toLowerCase().includes('.pdf') || href.includes('cennik'))) {
                                const isMatchingPdf = this.isMatchingPdfType(href, text, targetPdf);
                                console.log(`🔍 Is matching ${targetPdf.name}? ${isMatchingPdf}`);
                                
                                if (isMatchingPdf) {
                                    // Convert relative URLs to absolute
                                    const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                                    
                                    matchingLinks.push({
                                        url: absoluteUrl,
                                        text: text,
                                        selector: targetPdf.selector,
                                        element: $(element).html(),
                                        pdfType: targetPdf.name,
                                        href: href,
                                        priority: this.getPdfPriority(href, text)
                                    });
                                    
                                    console.log(`✅ Found matching PDF for ${targetPdf.name}: ${absoluteUrl}`);
                                }
                            }
                        });
                        
                        console.log(`🔍 Checked ${checkedLinks} links for ${targetPdf.name}`);
                    }
                    
                    if (matchingLinks.length > 0) {
                        // Sort by priority (highest first) and select the best one
                        matchingLinks.sort((a, b) => b.priority - a.priority);
                        const bestLink = matchingLinks[0];
                        
                        pdfLinks.push(bestLink);
                        console.log(`✅ Selected best PDF for ${targetPdf.name}: ${bestLink.url} (priority: ${bestLink.priority})`);
                    } else {
                        console.log(`❌ No matching PDF found for ${targetPdf.name}`);
                    }
                }
            }
            
            // Fallback: look for any PDF links if no specific ones found
            if (pdfLinks.length === 0) {
                console.log(`🔍 No specific PDFs found, looking for any PDF links...`);
                
                const selectors = [
                    'a[href$=".pdf"]',
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
                                element: $(element).html(),
                                pdfType: 'Generic Okay fón PDF'
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
            
            console.log(`📄 Found ${uniqueLinks.length} unique PDF links for Okay fón`);
            return uniqueLinks;
        } catch (error) {
            console.error(`❌ Failed to extract PDF links for Okay fón:`, error.message);
            throw error;
        }
    }

    /**
     * Okay fón-specific metadata extraction
     * Returns basic metadata
     */
    async extractMetadata() {
        try {
            return {
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to extract metadata for Okay fón:`, error.message);
            return {
                lastChecked: new Date().toISOString()
            };
        }
    }

    /**
     * Get priority score for PDF selection (higher = better)
     * @param {string} href - PDF URL
     * @param {string} text - Link text
     * @returns {number} Priority score
     */
    getPdfPriority(href, text) {
        const lowerHref = href.toLowerCase();
        const lowerText = text.toLowerCase();
        let priority = 0;
        
        // Highest priority: Main pricing PDF
        if (lowerHref.includes('okayfon_cennik.pdf')) {
            priority += 100;
        }
        
        // High priority: Contains "cennik" in URL
        if (lowerHref.includes('cennik')) {
            priority += 50;
        }
        
        // Medium priority: Contains "cennik" in text
        if (lowerText.includes('cennik')) {
            priority += 30;
        }
        
        // Lower priority: Contains "datovych" or "balikov"
        if (lowerHref.includes('datovych') || lowerHref.includes('balikov')) {
            priority += 20;
        }
        
        if (lowerText.includes('datovych') || lowerText.includes('balikov')) {
            priority += 15;
        }
        
        // Base priority for any PDF
        priority += 10;
        
        console.log(`🔍 Priority for "${text}" (${href}): ${priority}`);
        return priority;
    }

    /**
     * Check if a PDF link matches the specific PDF type
     * @param {string} href - PDF URL
     * @param {string} text - Link text
     * @param {Object} targetPdf - Target PDF configuration
     * @returns {boolean} True if matches the PDF type
     */
    isMatchingPdfType(href, text, targetPdf) {
        if (!href || !text) return false;
        
        const lowerHref = href.toLowerCase();
        const lowerText = text.toLowerCase();
        const lowerSearchText = targetPdf.searchText.toLowerCase();
        
        console.log(`🔍 Checking if link matches ${targetPdf.name}:`);
        console.log(`   URL: ${href}`);
        console.log(`   Text: "${text}"`);
        console.log(`   Search text: "${targetPdf.searchText}"`);
        
        // Use keywords from configuration first (most specific)
        const keywords = targetPdf.keywords || [];
        const hasKeywordMatch = keywords.some(keyword => {
            const keywordLower = keyword.toLowerCase();
            const hrefMatch = lowerHref.includes(keywordLower);
            const textMatch = lowerText.includes(keywordLower);
            console.log(`   Keyword "${keyword}": href=${hrefMatch}, text=${textMatch}`);
            return hrefMatch || textMatch;
        });
        
        if (hasKeywordMatch) {
            console.log(`✅ Keyword match found for ${targetPdf.name}`);
            return true;
        }
        
        // Additional specific checks for Okay fón PDFs
        const specificChecks = {
            'Cenník dátových balíkov': () => {
                // Prioritize the main pricing PDF (okayfon_cennik.pdf)
                const isMainPricingPdf = lowerHref.includes('okayfon_cennik.pdf') || 
                                       (lowerHref.includes('cennik') && lowerHref.includes('okayfon'));
                
                // Fallback: look for data package related terms
                const isDataPackageList = lowerText.includes('datovych') || 
                                        lowerText.includes('balikov') ||
                                        lowerHref.includes('datovych') ||
                                        lowerHref.includes('balikov');
                
                const result = isMainPricingPdf || isDataPackageList;
                console.log(`🔍 Main pricing PDF check: ${isMainPricingPdf}`);
                console.log(`🔍 Data package list check: ${isDataPackageList}`);
                console.log(`🔍 Final result: ${result} (text: "${lowerText}", href: "${lowerHref}")`);
                return result;
            }
        };
        
        const specificCheck = specificChecks[targetPdf.name];
        if (specificCheck) {
            const specificMatch = specificCheck();
            if (specificMatch) {
                console.log(`✅ Specific check passed for ${targetPdf.name}`);
                return true;
            }
        }
        
        // General fallback: check if search text is contained
        const generalMatch = lowerText.includes(lowerSearchText) || lowerHref.includes(lowerSearchText);
        console.log(`🔍 General text match: ${generalMatch}`);
        
        return generalMatch;
    }

    /**
     * Process PDFs using Okay fón-specific scraper
     * @param {Array} pdfLinks - Array of PDF links to process
     * @returns {Promise<Object>} Processing results
     */
    async processPdfs(pdfLinks) {
        try {
            console.log(`📄 Processing ${pdfLinks.length} Okay fón PDFs`);
            
            const results = [];
            
            for (let i = 0; i < pdfLinks.length; i++) {
                const pdfLink = pdfLinks[i];
                console.log(`📄 Processing PDF ${i + 1}/${pdfLinks.length}: ${pdfLink.pdfType}`);
                console.log(`🔗 URL: ${pdfLink.url}`);
                
                try {
                    const okayfonScraper = new OkayfonPdfScraper();
                    const extractedData = await okayfonScraper.scrapePdf(pdfLink.url, `Okay fón ${pdfLink.pdfType}`, null, null, true);
                    
                    const pdfData = {
                        cennikName: extractedData.cennikName || `Okay fón ${pdfLink.pdfType}`,
                        pdfUrl: pdfLink.url,
                        pdfType: pdfLink.pdfType,
                        rawText: extractedData.data?.sections?.fullContent || '',
                        summary: {
                            totalSections: extractedData.summary?.totalSections || 0,
                            successfulExtractions: extractedData.summary?.successfulExtractions || 0,
                            failedExtractions: extractedData.summary?.failedExtractions || 0,
                            totalCharacters: extractedData.summary?.totalCharacters || 0,
                            originalCharacters: extractedData.summary?.originalCharacters || 0
                        },
                        extractionInfo: extractedData.extractionInfo
                    };
                    
                    results.push(pdfData);
                    console.log(`✅ Successfully processed ${pdfLink.pdfType}`);
                    
                } catch (error) {
                    console.error(`❌ Failed to process ${pdfLink.pdfType}:`, error.message);
                    results.push({
                        cennikName: `Okay fón ${pdfLink.pdfType}`,
                        pdfUrl: pdfLink.url,
                        pdfType: pdfLink.pdfType,
                        error: error.message
                    });
                }
            }
            
            return {
                provider: 'okayfon',
                pdfs: results,
                totalPdfs: results.length,
                successfulPdfs: results.filter(r => !r.error).length,
                failedPdfs: results.filter(r => r.error).length
            };
            
        } catch (error) {
            console.error(`❌ Error processing Okay fón PDFs:`, error.message);
            throw error;
        }
    }

    /**
     * Perform the full crawl for Okay fón.
     * Overrides base crawler to return consistent structure with RAD
     * @param {Object} options - Crawl options.
     * @param {boolean} options.onlyMetadata - If true, only extract metadata without downloading PDFs.
     * @returns {Promise<Object>} Crawl results.
     */
    async crawl(options = { onlyMetadata: false }) {
        console.log(`🌐 Starting crawl for ${this.providerName}...`);
        try {
            await this.initialize();
            await this.navigateToPricingPage();
            
            const pdfLinks = await this.extractPdfLinks();
            const metadata = await this.extractMetadata();
            
            if (options.onlyMetadata) {
                console.log(`🔍 Quick extraction found ${pdfLinks.length} total PDF links for ${this.providerName}`);
                console.log(`🔍 Extracting ${this.providerName} metadata...`);
                console.log(`📅 Last update: ${metadata.lastChecked}`);
                return {
                    provider: this.providerName,
                    pdfs: pdfLinks.map(link => ({ pdfUrl: link.url, pdfType: link.pdfType })),
                    metadata: metadata
                };
            }
            
            console.log(`📄 Found ${pdfLinks.length} unique PDF links for ${this.providerName}`);
            
            const results = [];
            
            // For Okay fón, we expect only one PDF based on the config
            if (pdfLinks.length > 0) {
                const primaryPdf = pdfLinks[0]; // Assuming the first found PDF is the primary one
                
                const okayfonScraper = new OkayfonPdfScraper();
                const extractedData = await okayfonScraper.scrapePdf(primaryPdf.url, primaryPdf.pdfType, null, true); // skipStorage = true
                
                const pdfData = {
                    cennikName: extractedData.cennikName || `Okay fón Cenník dátových balíkov`,
                    pdfUrl: primaryPdf.url,
                    pdfType: primaryPdf.pdfType,
                    rawText: extractedData.data?.sections?.fullContent || '',
                    data: {
                        sections: extractedData.data?.sections || {},
                        summary: extractedData.summary,
                        extractionInfo: extractedData.extractionInfo
                    },
                    summary: extractedData.summary,
                    extractionInfo: extractedData.extractionInfo
                };
                results.push(pdfData);
            } else {
                console.warn(`⚠️  No PDF links found for ${this.providerName}.`);
            }

            return {
                provider: this.providerName,
                pdfs: results,
                metadata: metadata
            };
        } catch (error) {
            console.error(`❌ Error during crawl for ${this.providerName}:`, error.message);
            return {
                provider: this.providerName,
                error: error.message
            };
        } finally {
            if (this.browser) {
                await this.browser.close();
                console.log(`🧹 Cleaned up browser resources for ${this.providerName}`);
            }
        }
    }
}

module.exports = OkayfonCrawler;
