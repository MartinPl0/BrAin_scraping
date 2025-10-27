const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const ErrorHandler = require('../utils/error-handler');
const DynamicWaiter = require('../utils/dynamic-waiter');

/**
 * Base crawler class for monitoring telecom provider websites
 * Provides common functionality for PDF link detection and metadata extraction
 */
class BaseCrawler {
    constructor(providerName, config) {
        this.providerName = providerName;
        this.config = config;
        this.browser = null;
        this.page = null;
        this.errorHandler = new ErrorHandler();
        this.dynamicWaiter = new DynamicWaiter();
    }

    /**
     * Initialize browser and page
     */
    async initialize() {
        try {
            this.browser = await puppeteer.launch({
                headless: "new",
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
            
            this.page = await this.browser.newPage();
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await this.page.setViewport({ width: 1920, height: 1080 });
            
            console.log(`✅ Browser initialized for ${this.providerName}`);
        } catch (error) {
            console.error(`❌ Failed to initialize browser for ${this.providerName}:`, error.message);
            throw error;
        }
    }

    /**
     * Navigate to the provider's pricing page
     */
    async navigateToPricingPage() {
        try {
            console.log(`🌐 Navigating to ${this.config.crawlUrl}...`);
            await this.page.goto(this.config.crawlUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Use dynamic waiting instead of hardcoded timeout
            const pageReady = await this.dynamicWaiter.smartWait(this.page, this.providerName, {
                timeout: 10000
            });
            
            if (pageReady) {
                console.log(`✅ Successfully loaded ${this.providerName} pricing page`);
            } else {
                console.warn(`⚠️  Page may not be fully loaded, continuing anyway...`);
            }
        } catch (error) {
            console.error(`❌ Failed to navigate to ${this.providerName} pricing page:`, error.message);
            throw error;
        }
    }

    /**
     * Extract PDF links from the current page using search text
     * Override this method in provider-specific crawlers
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
            
            if (pdfLinks.length === 0 && this.config.pdfLinkSelector) {
                $(this.config.pdfLinkSelector).each((index, element) => {
                    const href = $(element).attr('href');
                    const text = $(element).text().trim();
                    
                    if (href && (href.toLowerCase().includes('.pdf') || href.includes('uuid='))) {
                        // Convert relative URLs to absolute
                        const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                        
                        pdfLinks.push({
                            url: absoluteUrl,
                            text: text,
                            element: $(element).html()
                        });
                    }
                });
            }
            
            console.log(`📄 Found ${pdfLinks.length} PDF links for ${this.providerName}`);
            return pdfLinks;
        } catch (error) {
            console.error(`❌ Failed to extract PDF links for ${this.providerName}:`, error.message);
            throw error;
        }
    }

    /**
     * Find PDF link near search text
     * @param {Object} $ - Cheerio instance
     * @param {string} searchText - Text to search for
     * @returns {Object|null} PDF link info or null
     */
    findPdfNearSearchText($, searchText) {
        try {
            // Find all text nodes and elements containing the search text
            let foundElement = null;
            
            // Method 1: Look for exact text match
            $('*').each((index, element) => {
                const text = $(element).text().trim();
                if (text.includes(searchText)) {
                    foundElement = $(element);
                    return false; // Break the loop
                }
            });
            
            // Method 2: If exact match fails, try partial match
            if (!foundElement) {
                const words = searchText.split(' ').filter(word => word.length > 3);
                if (words.length > 0) {
                    $('*').each((index, element) => {
                        const text = $(element).text().trim();
                        const matchCount = words.filter(word => text.includes(word)).length;
                        if (matchCount >= Math.ceil(words.length * 0.7)) { // 70% match
                            foundElement = $(element);
                            return false; // Break the loop
                        }
                    });
                }
            }
            
            if (foundElement) {
                // Look for PDF link in the same element or nearby elements
                let pdfLink = this.findPdfLinkInElement($, foundElement);
                
                if (!pdfLink) {
                    // Look in parent element
                    pdfLink = this.findPdfLinkInElement($, foundElement.parent());
                }
                
                if (!pdfLink) {
                    // Look in next sibling
                    pdfLink = this.findPdfLinkInElement($, foundElement.next());
                }
                
                if (!pdfLink) {
                    // Look in previous sibling
                    pdfLink = this.findPdfLinkInElement($, foundElement.prev());
                }
                
                if (pdfLink) {
                    return pdfLink;
                }
            }
            
            return null;
        } catch (error) {
            console.warn(`⚠️  Error finding PDF near search text: ${error.message}`);
            return null;
        }
    }

    /**
     * Find PDF link within an element
     * @param {Object} $ - Cheerio instance
     * @param {Object} element - Element to search in
     * @returns {Object|null} PDF link info or null
     */
    findPdfLinkInElement($, element) {
        if (!element || element.length === 0) return null;
        
        // Look for links with PDF or UUID patterns
        const selectors = [
            'a[href$=".pdf"]',
            'a[href*="uuid="]',
            'a[href*="cennik"]',
            'a[href*="pdf"]'
        ];
        
        for (const selector of selectors) {
            const link = element.find(selector).first();
            if (link.length > 0) {
                const href = link.attr('href');
                const text = link.text().trim();
                
                if (href) {
                    // Convert relative URLs to absolute
                    const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                    
                    return {
                        url: absoluteUrl,
                        text: text,
                        element: link.html(),
                        selector: selector
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Extract date metadata from the page
     * Override this method in provider-specific crawlers
     */
    async extractMetadata() {
        try {
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            let publishDate = null;
            
            const pdfLinks = await this.extractPdfLinks();
            if (pdfLinks.length > 0) {
                const pdfLink = pdfLinks[0];
                
                // Extract date from PDF link text (e.g., "PDF | 01.10.2025 | 745 kB")
                publishDate = this.extractDateFromLinkText(pdfLink.text);
                
                // If no date from link text, try filename
                if (!publishDate) {
                    const filename = pdfLink.url.split('/').pop();
                    publishDate = this.extractDateFromFilename(filename);
                }
            }
            
            // Fallback: try to extract date from configured selector
            if (!publishDate && this.config.dateSelector) {
                const dateText = $(this.config.dateSelector).text().trim();
                if (dateText) {
                    publishDate = this.parseDate(dateText);
                }
            }
            
            
            return {
                publishDate,
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to extract metadata for ${this.providerName}:`, error.message);
            return {
                publishDate: null,
                lastChecked: new Date().toISOString()
            };
        }
    }

    /**
     * Extract date from PDF link text
     * @param {string} linkText - Text from PDF link
     * @returns {string|null} Extracted date or null
     */
    extractDateFromLinkText(linkText) {
        if (!linkText) return null;
        
        try {
            // Look for date patterns in link text
            // Examples: "PDF | 01.10.2025 | 745 kB", "platný od 8.10.2025"
            const datePatterns = [
                /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY
                /(\d{1,2})\/(\d{1,2})\/(\d{4})/,  // DD/MM/YYYY
                /(\d{4})-(\d{1,2})-(\d{1,2})/,    // YYYY-MM-DD
                /(\d{1,2})\s+(\d{1,2})\.(\d{4})/, // DD MM.YYYY
                /platný od (\d{1,2})\.(\d{1,2})\.(\d{4})/i  // "platný od DD.MM.YYYY"
            ];
            
            for (const pattern of datePatterns) {
                const match = linkText.match(pattern);
                if (match) {
                    let day, month, year;
                    
                    if (match[0].includes('platný od')) {
                        // Special case for "platný od" format
                        [day, month, year] = match.slice(1, 4).map(x => parseInt(x));
                    } else if (match[1].length === 4) {
                        // YYYY-MM-DD format
                        [year, month, day] = match.slice(1, 4).map(x => parseInt(x));
                    } else {
                        // DD.MM.YYYY or DD/MM/YYYY format
                        [day, month, year] = match.slice(1, 4).map(x => parseInt(x));
                    }
                    
                    const date = new Date(year, month - 1, day);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString().split('T')[0];
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.warn(`⚠️  Failed to extract date from link text "${linkText}":`, error.message);
            return null;
        }
    }

    /**
     * Parse date string using configured format
     */
    parseDate(dateString) {
        if (!dateString || !this.config.dateFormat) {
            return null;
        }
        
        try {
            // Simple date parsing - can be enhanced with moment.js if needed
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
        } catch (error) {
            console.warn(`⚠️  Failed to parse date "${dateString}":`, error.message);
            return null;
        }
    }

    /**
     * Extract date from PDF filename
     */
    extractDateFromFilename(filename) {
        if (!filename) return null;
        
        // Look for common date patterns in filename
        const datePatterns = [
            /(\d{4})[-_](\d{1,2})[-_](\d{1,2})/,  // YYYY-MM-DD or YYYY_MM_DD
            /(\d{1,2})[-_](\d{1,2})[-_](\d{4})/,  // DD-MM-YYYY or DD_MM_YYYY
            /(\d{4})(\d{2})(\d{2})/              // YYYYMMDD
        ];
        
        for (const pattern of datePatterns) {
            const match = filename.match(pattern);
            if (match) {
                try {
                    let year, month, day;
                    if (match[1].length === 4) {
                        [year, month, day] = match.slice(1, 4);
                    } else {
                        [day, month, year] = match.slice(1, 4);
                    }
                    
                    const date = new Date(year, month - 1, day);
                    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
                } catch (error) {
                    continue;
                }
            }
        }
        
        return null;
    }

    /**
     * Main crawl method - combines all steps
     * @param {Object} options - Options for crawling
     * @param {Object} options.reuseCrawlResult - Crawl result to reuse (avoids double crawling)
     */
    async crawl(options = {}) {
        try {
            console.log(`🚀 Starting crawl for ${this.providerName}...`);
            
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
            
            // Use the first (most recent) PDF link
            const primaryPdf = pdfLinks[0];
            
            const result = {
                provider: this.providerName,
                pdfUrl: primaryPdf.url,
                pdfText: primaryPdf.text,
                publishDate: metadata.publishDate,
                lastChecked: metadata.lastChecked,
                allPdfLinks: pdfLinks,
                crawlUrl: this.config.crawlUrl
            };
            
            console.log(`✅ Crawl completed for ${this.providerName}: ${primaryPdf.url}`);
            return result;
            
        } catch (error) {
            const errorResult = this.errorHandler.handleError(error, 'base-crawl', this.providerName);
            throw errorResult.error;
        } finally {
            if (this.browser) {
                await this.cleanup();
            }
        }
    }

    /**
     * Clean up browser resources
     */
    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            console.log(`🧹 Cleaned up browser resources for ${this.providerName}`);
        } catch (error) {
            console.warn(`⚠️  Error during cleanup for ${this.providerName}:`, error.message);
        }
    }
}

module.exports = BaseCrawler;
