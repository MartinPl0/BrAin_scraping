const BaseCrawler = require('./base-crawler');
const cheerio = require('cheerio');
const TescoJsonMerger = require('../utils/mergers/tesco-json-merger');

/**
 * Tesco Mobile Slovakia specific crawler
 * Monitors Tesco Mobile pricing page for PDF updates
 */
class TescoCrawler extends BaseCrawler {
    constructor(config) {
        super('Tesco Mobile Slovakia', config);
        this.jsonMerger = new TescoJsonMerger();
    }

    /**
     * Tesco Mobile-specific PDF link extraction for multiple PDFs
     * Looks for specific PDF types based on configuration
     */
    async extractPdfLinks() {
        try {
            const content = await this.page.content();
            const $ = cheerio.load(content);
            
            const pdfLinks = [];
            
            if (this.config.targetPdfs && Array.isArray(this.config.targetPdfs)) {
                console.log(`🔍 Looking for ${this.config.targetPdfs.length} specific Tesco Mobile PDF types...`);
                
                for (const targetPdf of this.config.targetPdfs) {
                    console.log(`🔍 Searching for: ${targetPdf.name}`);
                    
                    let foundLink = null;
                    
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
                                    const absoluteUrl = href.startsWith('http') ? href : new URL(href, this.config.crawlUrl).href;
                                    foundLink = {
                                        url: absoluteUrl,
                                        text: text,
                                        selector: targetPdf.selector,
                                        element: $(element).html(),
                                        pdfType: targetPdf.name
                                    };
                                    console.log(`✅ Found matching PDF for ${targetPdf.name}: ${absoluteUrl}`);
                                    return false; // Break the loop
                                } else {
                                    console.log(`❌ Link doesn't match ${targetPdf.name}, continuing search...`);
                                }
                            }
                        });
                        
                        console.log(`🔍 Checked ${checkedLinks} links for ${targetPdf.name}`);
                    }
                    
                    if (foundLink) {
                        foundLink.pdfType = targetPdf.name;
                        pdfLinks.push(foundLink);
                        console.log(`✅ Found ${targetPdf.name}: ${foundLink.url}`);
                    } else {
                        console.log(`⚠️  Could not find ${targetPdf.name}`);
                    }
                }
            }
            
            // Fallback: if no targetPdfs configured or none found, use generic approach
            if (pdfLinks.length === 0) {
                console.log('🔄 Using fallback PDF discovery...');
                const selectors = [
                    'a[href$=".pdf"]',
                    'a[href*="cennik"]',
                    'a[href*="Cennik"]',
                    'a[href*="sluzieb"]',
                    'a[href*="tarif"]',
                    'a[href*="pdf"]',
                    'a[href*="dokument"]',
                    'a[href*="download"]'
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
                                pdfType: 'Generic Tesco Mobile PDF'
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
            
            console.log(`📄 Found ${uniqueLinks.length} unique PDF links for Tesco Mobile`);
            return uniqueLinks;
        } catch (error) {
            console.error(`❌ Failed to extract PDF links for Tesco Mobile:`, error.message);
            throw error;
        }
    }

    /**
     * Tesco Mobile-specific metadata extraction
     * Returns basic metadata without unnecessary publishDate
     */
    async extractMetadata() {
        try {
            return {
                lastChecked: new Date().toISOString()
            };
        } catch (error) {
            console.error(`❌ Failed to extract metadata for Tesco Mobile:`, error.message);
            return {
                lastChecked: new Date().toISOString()
            };
        }
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
        
        // Additional specific checks for Tesco Mobile PDFs
        const specificChecks = {
            'Cenník služieb (Tesco mobile Topka)': () => {
                const isTopka = lowerText.includes('topka') || lowerHref.includes('topka');
                console.log(`🔍 Topka check: ${isTopka} (text: "${lowerText}")`);
                return isTopka;
            },
            'Cenník služieb (Tesco mobile Trio)': () => {
                const isTrio = lowerText.includes('trio') || lowerHref.includes('trio');
                console.log(`🔍 Trio check: ${isTrio} (text: "${lowerText}")`);
                return isTrio;
            }
        };
        
        const specificCheck = specificChecks[targetPdf.name];
        if (specificCheck) {
            const result = specificCheck();
            console.log(`🔍 Specific check result for ${targetPdf.name}: ${result}`);
            return result;
        }
        
        // Final fallback: check if the link text contains the search text
        const textMatch = lowerText.includes(lowerSearchText);
        console.log(`🔍 Text match fallback: ${textMatch}`);
        
        return textMatch;
    }

    /**
     * Process all Tesco Mobile PDFs and save as consolidated JSON
     * This method overrides the base crawl method to handle multiple PDFs
     * @param {Object} options - Options for selective processing
     * @param {Array} options.changedPdfUrls - Array of specific PDF URLs to process (optional)
     * @param {Object} options.reuseCrawlResult - Crawl result to reuse (avoids double crawling)
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
            
            console.log(`📄 Found ${pdfLinks.length} unique PDF links for Tesco Mobile`);
            
            // If we're reusing crawl results, we might have pdfs array instead of pdfLinks
            // Convert pdfs array back to pdfLinks format if needed
            if (options.reuseCrawlResult && options.reuseCrawlResult.pdfs && pdfLinks.length === 0) {
                console.log(`🔄 Converting reused PDFs array to pdfLinks format...`);
                pdfLinks = options.reuseCrawlResult.pdfs.map(pdf => ({
                    url: pdf.pdfUrl,
                    text: pdf.text,
                    pdfType: pdf.pdfType || 'PDF'
                }));
                console.log(`📄 Converted ${pdfLinks.length} PDFs from reused data`);
            }
            
            // Filter PDFs if selective processing is requested
            let pdfsToProcess = pdfLinks;
            if (options.changedPdfUrls && Array.isArray(options.changedPdfUrls) && options.changedPdfUrls.length > 0) {
                pdfsToProcess = pdfLinks.filter(pdfLink => options.changedPdfUrls.includes(pdfLink.url));
                console.log(`🎯 Selective processing: Processing ${pdfsToProcess.length}/${pdfLinks.length} changed PDFs`);
                console.log(`📄 Changed PDFs: ${options.changedPdfUrls.join(', ')}`);
            } else {
                console.log(`📄 Processing all ${pdfLinks.length} PDFs`);
            }
            
            const allPdfData = [];
            
            for (let i = 0; i < pdfsToProcess.length; i++) {
                const pdfLink = pdfsToProcess[i];
                console.log(`\n📄 Processing PDF ${i + 1}/${pdfsToProcess.length}: ${pdfLink.pdfType}`);
                console.log(`🔗 URL: ${pdfLink.url}`);
                
                try {
                    const TescoPdfScraper = require('../scrapers/tesco-pdf-scraper');
                    const tescoScraper = new TescoPdfScraper();
                    const extractedData = await tescoScraper.scrapePdf(pdfLink.url, `Tesco Mobile Cenník služieb - ${pdfLink.pdfType}`, null, true);
                    
                    const pdfData = {
                        cennikName: extractedData.cennikName || `Tesco Mobile Cenník služieb - ${pdfLink.pdfType}`,
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
                        extractionInfo: extractedData.extractionInfo,
                        validation: extractedData.metadata?.validation
                    };
                    
                    console.log(`📊 PDF Data Structure for ${pdfLink.pdfType}:`);
                    console.log(`   - Has rawText: ${!!pdfData.rawText}`);
                    console.log(`   - Has summary: ${!!pdfData.summary}`);
                    console.log(`   - Has extractionInfo: ${!!pdfData.extractionInfo}`);
                    console.log(`   - Raw text length: ${pdfData.rawText.length} characters`);
                    
                    allPdfData.push(pdfData);
                    console.log(`✅ Successfully processed ${pdfLink.pdfType}`);
                    
                } catch (error) {
                    console.error(`❌ Failed to process ${pdfLink.pdfType}:`, error.message);
                    
                    allPdfData.push({
                        cennikName: `Tesco Mobile Cenník služieb - ${pdfLink.pdfType}`,
                        pdfUrl: pdfLink.url,
                        pdfType: pdfLink.pdfType,
                        error: error.message,
                        rawText: '',
                        summary: {
                            totalSections: 0,
                            successfulExtractions: 0,
                            failedExtractions: 1,
                            totalCharacters: 0,
                            originalCharacters: 0
                        },
                        extractionInfo: {
                            extractionMethod: this.config.extractionMethod || 'euro-symbol-based',
                            pagesWithEuro: 0,
                            totalPages: 0
                        }
                    });
                }
            }
            
            const consolidatedResult = {
                provider: this.providerName,
                crawlDate: new Date().toISOString(),
                lastChecked: new Date().toISOString(),
                totalPdfs: allPdfData.length,
                successfulPdfs: allPdfData.filter(pdf => !pdf.error).length,
                failedPdfs: allPdfData.filter(pdf => pdf.error).length,
                pdfs: allPdfData,
                lastUpdate: options.changedPdfUrls ? {
                    updatedPdfs: options.changedPdfUrls.length,
                    updatedPdfUrls: options.changedPdfUrls,
                    updateType: 'selective'
                } : {
                    updatedPdfs: allPdfData.length,
                    updatedPdfUrls: pdfLinks.map(link => link.url),
                    updateType: 'full'
                }
            };
            
            console.log(`\n📊 Consolidated Results:`);
            console.log(`   Total PDFs: ${consolidatedResult.totalPdfs}`);
            console.log(`   Successful: ${consolidatedResult.successfulPdfs}`);
            console.log(`   Failed: ${consolidatedResult.failedPdfs}`);
            if (consolidatedResult.lastUpdate && consolidatedResult.lastUpdate.updateType === 'selective') {
                console.log(`   🎯 Selective Processing: ${consolidatedResult.lastUpdate.updatedPdfs}/${consolidatedResult.lastUpdate.updatedPdfUrls.length} PDFs`);
            }
            
            // If selective processing, merge with existing data to preserve unchanged PDFs
            if (consolidatedResult.lastUpdate && consolidatedResult.lastUpdate.updateType === 'selective') {
                console.log(`🔄 Merging with existing data to preserve unchanged PDFs...`);
                try {
                    const mergeResult = await this.jsonMerger.processSelectiveUpdate(consolidatedResult);
                    
                    return {
                        ...consolidatedResult,
                        pdfs: mergeResult.merged ? await this.jsonMerger.loadExistingData().then(d => d.pdfs) : consolidatedResult.pdfs,
                        merged: mergeResult.merged,
                        mergeResult: mergeResult
                    };
                } catch (mergeError) {
                    console.warn(`⚠️  Failed to merge data: ${mergeError.message}`);
                    console.log(`📄 Returning unmerged data`);
                    return consolidatedResult;
                }
            }
            
            return consolidatedResult;
            
        } catch (error) {
            if (this.errorMonitor) {
                const errorResult = this.errorMonitor.handleError(error, 'tesco-crawl', 'Tesco Mobile Slovakia');
                throw errorResult.error;
            } else {
                console.error(`❌ [Tesco Mobile Slovakia] tesco-crawl: ${error.message}`);
                throw error;
            }
        } finally {
            if (this.browser) {
                await this.cleanup();
            }
        }
    }
}

module.exports = TescoCrawler;
