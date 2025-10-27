/**
 * Dynamic Waiter for BrAIn Scraping System
 * Replaces hardcoded waits with intelligent element-based waiting
 */
class DynamicWaiter {
    constructor() {
        this.defaultTimeout = 10000; // 10 seconds default timeout
        this.pollInterval = 100; // 100ms polling interval
    }

    /**
     * Wait for page to be ready with dynamic detection
     * @param {Object} page - Puppeteer page object
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if page is ready
     */
    async waitForPageReady(page, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const startTime = Date.now();

        console.log(`🔄 Waiting for page to be ready...`);

        try {
            await page.waitForFunction(() => {
                return performance.getEntriesByType('navigation')[0].loadEventEnd > 0;
            }, { timeout: timeout / 2 });
            console.log(`✅ Network idle detected`);

            await this.waitForDynamicContent(page, timeout / 2);
            console.log(`✅ Dynamic content loaded`);

            return true;
        } catch (error) {
            console.warn(`⚠️  Page ready timeout after ${Date.now() - startTime}ms: ${error.message}`);
            return false;
        }
    }

    /**
     * Wait for dynamic content to load
     * @param {Object} page - Puppeteer page object
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    async waitForDynamicContent(page, timeout) {
        const startTime = Date.now();
        let lastContentLength = 0;
        let stableCount = 0;
        const requiredStableCount = 3; // Content must be stable for 3 checks

        while (Date.now() - startTime < timeout) {
            try {
                const content = await page.content();
                const currentLength = content.length;

                if (currentLength === lastContentLength) {
                    stableCount++;
                    if (stableCount >= requiredStableCount) {
                        console.log(`✅ Content stable for ${stableCount} checks`);
                        return;
                    }
                } else {
                    stableCount = 0;
                    lastContentLength = currentLength;
                }

                await this.sleep(this.pollInterval);
            } catch (error) {
                console.warn(`⚠️  Error checking dynamic content: ${error.message}`);
                break;
            }
        }

        console.log(`⚠️  Dynamic content timeout after ${Date.now() - startTime}ms`);
    }

    /**
     * Wait for specific element to appear
     * @param {Object} page - Puppeteer page object
     * @param {string} selector - CSS selector
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if element found
     */
    async waitForElement(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const visible = options.visible !== false; // Default to true

        console.log(`🔄 Waiting for element: ${selector}`);

        try {
            if (visible) {
                await page.waitForSelector(selector, { 
                    visible: true, 
                    timeout: timeout 
                });
            } else {
                await page.waitForSelector(selector, { 
                    timeout: timeout 
                });
            }
            console.log(`✅ Element found: ${selector}`);
            return true;
        } catch (error) {
            console.warn(`⚠️  Element not found: ${selector} (${error.message})`);
            return false;
        }
    }

    /**
     * Wait for any of multiple elements to appear
     * @param {Object} page - Puppeteer page object
     * @param {Array} selectors - Array of CSS selectors
     * @param {Object} options - Waiting options
     * @returns {Promise<string|null>} First found selector or null
     */
    async waitForAnyElement(page, selectors, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const visible = options.visible !== false;

        console.log(`🔄 Waiting for any of ${selectors.length} elements...`);

        const startTime = Date.now();
        const promises = selectors.map(selector => 
            this.waitForElement(page, selector, { timeout: timeout / selectors.length, visible })
                .then(() => selector)
                .catch(() => null)
        );

        try {
            const results = await Promise.allSettled(promises);
            const found = results.find(result => 
                result.status === 'fulfilled' && result.value !== null
            );

            if (found) {
                console.log(`✅ Found element: ${found.value}`);
                return found.value;
            } else {
                console.warn(`⚠️  None of ${selectors.length} elements found`);
                return null;
            }
        } catch (error) {
            console.warn(`⚠️  Error waiting for elements: ${error.message}`);
            return null;
        }
    }

    /**
     * Wait for PDF links to be available
     * @param {Object} page - Puppeteer page object
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if PDF links found
     */
    async waitForPdfLinks(page, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const startTime = Date.now();

        console.log(`🔄 Waiting for PDF links to be available...`);

        while (Date.now() - startTime < timeout) {
            try {
                const pdfLinks = await page.$$eval('a[href$=".pdf"], a[href*="cennik"], a[href*="uuid="]', 
                    links => links.length
                );

                if (pdfLinks > 0) {
                    console.log(`✅ Found ${pdfLinks} PDF links`);
                    return true;
                }

                await this.sleep(this.pollInterval);
            } catch (error) {
                console.warn(`⚠️  Error checking for PDF links: ${error.message}`);
                break;
            }
        }

        console.warn(`⚠️  No PDF links found after ${Date.now() - startTime}ms`);
        return false;
    }

    /**
     * Wait for text content to appear
     * @param {Object} page - Puppeteer page object
     * @param {string} text - Text to wait for
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if text found
     */
    async waitForText(page, text, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const startTime = Date.now();

        console.log(`🔄 Waiting for text: "${text}"`);

        while (Date.now() - startTime < timeout) {
            try {
                const content = await page.content();
                if (content.includes(text)) {
                    console.log(`✅ Text found: "${text}"`);
                    return true;
                }

                await this.sleep(this.pollInterval);
            } catch (error) {
                console.warn(`⚠️  Error checking for text: ${error.message}`);
                break;
            }
        }

        console.warn(`⚠️  Text not found: "${text}" after ${Date.now() - startTime}ms`);
        return false;
    }

    /**
     * Wait for page navigation to complete
     * @param {Object} page - Puppeteer page object
     * @param {string} url - Expected URL (optional)
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if navigation successful
     */
    async waitForNavigation(page, url = null, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;

        console.log(`🔄 Waiting for navigation to complete...`);

        try {
            await page.waitForLoadState('networkidle', { timeout });
            
            if (url && page.url() !== url) {
                console.warn(`⚠️  Navigation completed but URL mismatch: expected ${url}, got ${page.url()}`);
                return false;
            }

            console.log(`✅ Navigation completed`);
            return true;
        } catch (error) {
            console.warn(`⚠️  Navigation timeout: ${error.message}`);
            return false;
        }
    }

    /**
     * Wait for specific condition to be true
     * @param {Function} condition - Function that returns boolean
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if condition met
     */
    async waitForCondition(condition, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const startTime = Date.now();

        console.log(`🔄 Waiting for condition...`);

        while (Date.now() - startTime < timeout) {
            try {
                if (await condition()) {
                    console.log(`✅ Condition met`);
                    return true;
                }

                await this.sleep(this.pollInterval);
            } catch (error) {
                console.warn(`⚠️  Error checking condition: ${error.message}`);
                break;
            }
        }

        console.warn(`⚠️  Condition timeout after ${Date.now() - startTime}ms`);
        return false;
    }

    /**
     * Sleep for specified duration
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Wait for page to be interactive
     * @param {Object} page - Puppeteer page object
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if page is interactive
     */
    async waitForInteractivity(page, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;

        console.log(`🔄 Waiting for page to be interactive...`);

        try {
            // Wait for DOM to be ready
            await page.waitForFunction(() => document.readyState === 'complete', { timeout });
            
            // Wait for any pending JavaScript
            await this.sleep(500);
            
            console.log(`✅ Page is interactive`);
            return true;
        } catch (error) {
            console.warn(`⚠️  Interactivity timeout: ${error.message}`);
            return false;
        }
    }

    /**
     * Smart wait based on page content analysis
     * @param {Object} page - Puppeteer page object
     * @param {string} provider - Provider name for context
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if page is ready
     */
    async smartWait(page, provider, options = {}) {
        console.log(`🔄 Smart waiting for ${provider} page...`);

        // Provider-specific waiting strategies
        const strategies = {
            'o2': () => this.waitForO2Page(page, options),
            'telekom': () => this.waitForTelekomPage(page, options),
            'orange': () => this.waitForOrangePage(page, options)
        };

        const strategy = strategies[provider.toLowerCase()];
        if (strategy) {
            return await strategy();
        } else {
            // Default strategy
            return await this.waitForPageReady(page, options);
        }
    }

    /**
     * O2-specific page waiting
     * @param {Object} page - Puppeteer page object
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if ready
     */
    async waitForO2Page(page, options) {
        // Wait for O2-specific elements
        const o2Selectors = [
            'a[href$=".pdf"]',
            '.cennik',
            '[class*="cennik"]',
            'a[href*="Cennik"]'
        ];

        return await this.waitForAnyElement(page, o2Selectors, options);
    }

    /**
     * Telekom-specific page waiting
     * @param {Object} page - Puppeteer page object
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if ready
     */
    async waitForTelekomPage(page, options) {
        // Wait for Telekom-specific elements
        const telekomSelectors = [
            'a[href*="uuid="]',
            'a[href$=".pdf"]',
            '[class*="cennik"]',
            'a[href*="cennik"]'
        ];

        return await this.waitForAnyElement(page, telekomSelectors, options);
    }

    /**
     * Orange-specific page waiting
     * @param {Object} page - Puppeteer page object
     * @param {Object} options - Waiting options
     * @returns {Promise<boolean>} True if ready
     */
    async waitForOrangePage(page, options) {
        // Wait for Orange-specific elements
        const orangeSelectors = [
            'a[href*="cennik"]',
            'a[href$=".pdf"]',
            '[class*="cennik"]',
            'a[href*="sluzieb"]'
        ];

        return await this.waitForAnyElement(page, orangeSelectors, options);
    }
}

module.exports = DynamicWaiter;
