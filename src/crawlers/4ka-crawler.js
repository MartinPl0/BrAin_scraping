const BaseCrawler = require('./base-crawler');
const cheerio = require('cheerio');

class FourKaCrawler extends BaseCrawler {
    constructor(config) {
        super('fourka', config);
    }


    /**
     * Optimized PDF link extraction 
     */
    async extractPdfLinksForChangeDetection() {
        console.log('🔍 Quick PDF link extraction for 4ka change detection...');
        
        const pdfLinks = [];
        
        try {
            console.log('🔍 Clicking on "Cenníky" tab...');
            await this.page.click('#cenniky-tab');
            await this.page.waitForTimeout(1000); // Short wait for tab to load
        } catch (error) {
            console.log('⚠️  Could not click Cenníky tab, continuing anyway...');
        }
        
        // Get the static HTML content (no accordion clicking needed!)
        const content = await this.page.content();
        const $ = cheerio.load(content);
        
        const allPdfElements = $('a[href$=".pdf"]').map((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const text = $el.text().trim();
            
            // Get the parent container to find the PDF name
            const parentContainer = $el.closest('.flex.max-md\\:flex-wrap');
            const pdfNameElement = parentContainer.find('span.text-black-subdued').first();
            const pdfName = pdfNameElement.text().trim();
            
            return {
                href: href,
                text: text,
                pdfName: pdfName,
                parentText: parentContainer.text().trim(),
                fullContext: (pdfName + ' ' + parentContainer.text().trim()).toLowerCase()
            };
        }).get();
        
        console.log(`📄 Found ${allPdfElements.length} total PDF elements in static HTML`);
        
        // Process all target PDFs directly from the static HTML (no category filtering needed)
        const categories = this.config.categories;
        const allTargetPdfs = [];
        
        // Collect all target PDFs from all categories
        for (const category of categories) {
            for (const targetPdf of category.targetPdfs) {
                allTargetPdfs.push({
                    ...targetPdf,
                    category: category.name
                });
            }
        }
        
        console.log(`🔍 Quick processing ${allTargetPdfs.length} target PDFs from static HTML...`);
        
        // Process each target PDF directly
        for (const targetPdf of allTargetPdfs) {
                console.log(`🔍 Quick looking for: ${targetPdf.name}`);
                
                let bestMatch = null;
                let latestDate = null;
                
                for (const pdfElement of allPdfElements) {
                    const contextText = pdfElement.fullContext;
                    
                    // Check if this PDF matches our target
                    let isMatchingPdf = false;
                    
                    if (targetPdf.name === 'Cenník mobilných služieb') {
                        isMatchingPdf = contextText.includes('cenník mobilných služieb') && 
                                       contextText.includes('platný od') &&
                                       !contextText.includes('prémiových') &&
                                       !contextText.includes('4g internet') &&
                                       !contextText.includes('zoznam');
                    } else if (targetPdf.name === 'Cenník prémiových čísel pre firemných zákazníkov') {
                        isMatchingPdf = contextText.includes('prémiových čísel') && 
                                       contextText.includes('firemných');
                    } else if (targetPdf.name === 'Cenník 4G INTERNET') {
                        isMatchingPdf = contextText.includes('4g internet') && 
                                       !contextText.includes('všeobecné podmienky') &&
                                       !contextText.includes('informácia') &&
                                       !contextText.includes('dohoda') &&
                                       !contextText.includes('zmluva');
                    } else if (targetPdf.name === 'Nekonečný paušál pre dvoch za cenu jedného') {
                        isMatchingPdf = contextText.includes('nekonečný paušál') && 
                                       contextText.includes('dvoch za cenu jedného');
                    } else if (targetPdf.name === 'Rýchla SIMka s digitálnou aktiváciou') {
                        isMatchingPdf = contextText.includes('rýchla simka') && 
                                       contextText.includes('digitálnou aktiváciou');
                    } else if (targetPdf.name === 'Digitálny Žiak') {
                        isMatchingPdf = contextText.includes('digitálny žiak');
                    } else if (targetPdf.name === 'SLOBODA za 4') {
                        isMatchingPdf = contextText.includes('sloboda za 4') && 
                                       !contextText.includes('s mobilom');
                    } else if (targetPdf.name === 'SLOBODA S MOBILOM') {
                        isMatchingPdf = contextText.includes('sloboda s mobilom');
                    } else if (targetPdf.name === 'Cenník služieb pevnej siete') {
                        isMatchingPdf = contextText.includes('cenník služieb pevnej siete');
                    }
                    
                    if (isMatchingPdf) {
                        console.log(`✅ Quick found matching PDF: "${pdfElement.pdfName}"`);
                        
                        // Extract date and find the latest one
                        const dateMatch = contextText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
                        if (dateMatch) {
                            const [, day, month, year] = dateMatch;
                            const pdfDate = new Date(year, month - 1, day);
                            
                            if (!latestDate || pdfDate > latestDate) {
                                latestDate = pdfDate;
                                bestMatch = pdfElement;
                                console.log(`📅 PDF date: ${day}.${month}.${year}`);
                            }
                        } else if (!bestMatch) {
                            // Use PDF without date if no dated PDF found yet
                            bestMatch = pdfElement;
                            console.log(`📄 Using PDF without date: ${pdfElement.pdfName}`);
                        }
                    }
                }
                
                if (bestMatch) {
                    const absoluteUrl = bestMatch.href.startsWith('http') ? 
                        bestMatch.href : 
                        new URL(bestMatch.href, this.config.crawlUrl).href;
                    
                    pdfLinks.push({
                        url: absoluteUrl,
                        pdfType: targetPdf.name,
                        text: bestMatch.pdfName,
                        category: targetPdf.category
                    });
                    
                    console.log(`✅ Quick selected PDF for ${targetPdf.name}: ${bestMatch.pdfName}`);
                } else {
                    console.log(`❌ Quick no matching PDF found for: ${targetPdf.name}`);
                }
        }

        console.log(`📄 Quick extraction found ${pdfLinks.length} total PDF links for 4ka`);
        return pdfLinks;
    }

    /**
     * Quick PDF extraction from a specific category section (for change detection)
     * @param {Object} $ - Cheerio instance with page content
     * @param {Object} category - Category configuration
     * @returns {Array} Array of PDF links for this category
     */
    async extractPdfsFromCategoryQuick($, category) {
        const categoryPdfs = [];
        
        const pdfElements = $('a[href$=".pdf"]').map((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const text = $el.text().trim();
            
            // Get the parent container to find the PDF name
            const parentContainer = $el.closest('.flex.max-md\\:flex-wrap');
            const pdfNameElement = parentContainer.find('span.text-black-subdued').first();
            const pdfName = pdfNameElement.text().trim();
            
            return {
                href: href,
                text: text,
                pdfName: pdfName,
                parentText: parentContainer.text().trim()
            };
        }).get();
        
        console.log(`🔍 Quick found ${pdfElements.length} PDF elements in category: ${category.name}`);
        
        // Process each target PDF for this category (quick version)
        for (const targetPdf of category.targetPdfs) {
            console.log(`🔍 Quick looking for: ${targetPdf.name}`);
            
            let bestMatch = null;
            let latestDate = null;
            
            for (const pdfElement of pdfElements) {
                const contextText = (pdfElement.pdfName + ' ' + pdfElement.parentText).toLowerCase();
                
                // Check if this PDF matches our target (same logic as full version)
                let isMatchingPdf = false;
                
                if (targetPdf.name === 'Cenník mobilných služieb') {
                    isMatchingPdf = contextText.includes('cenník mobilných služieb') && 
                                   contextText.includes('platný od') &&
                                   !contextText.includes('prémiových') &&
                                   !contextText.includes('4g internet') &&
                                   !contextText.includes('zoznam');
                } else if (targetPdf.name === 'Cenník prémiových čísel pre firemných zákazníkov') {
                    isMatchingPdf = contextText.includes('prémiových čísel') && 
                                   contextText.includes('firemných');
                } else if (targetPdf.name === 'Cenník 4G INTERNET') {
                    isMatchingPdf = contextText.includes('4g internet');
                } else if (targetPdf.name === 'Nekonečný paušál pre dvoch za cenu jedného') {
                    isMatchingPdf = contextText.includes('nekonečný') && 
                                   contextText.includes('paušál') &&
                                   contextText.includes('dvoch');
                } else if (targetPdf.name === 'Rýchla SIMka s digitálnou aktiváciou') {
                    isMatchingPdf = contextText.includes('rýchla') && 
                                   contextText.includes('simka') &&
                                   contextText.includes('digitálnou');
                } else if (targetPdf.name === 'Digitálny Žiak') {
                    isMatchingPdf = contextText.includes('digitálny') && 
                                   contextText.includes('žiak');
                } else if (targetPdf.name === 'SLOBODA za 4') {
                    isMatchingPdf = contextText.includes('sloboda') && 
                                   contextText.includes('za 4') &&
                                   !contextText.includes('mobilom');
                } else if (targetPdf.name === 'SLOBODA S MOBILOM') {
                    isMatchingPdf = contextText.includes('sloboda') && 
                                   contextText.includes('mobilom');
                } else if (targetPdf.name === 'Cenník služieb pevnej siete') {
                    isMatchingPdf = contextText.includes('služieb pevnej siete') && 
                                   contextText.includes('platný od');
                } else if (targetPdf.name === 'Cenník káblovej televízie Bratislava') {
                    isMatchingPdf = contextText.includes('káblovej televízie') && 
                                   contextText.includes('bratislava');
                }
                
                if (isMatchingPdf) {
                    console.log(`✅ Quick found matching PDF: "${pdfElement.pdfName}"`);
                    
                    // Extract date to find the latest version
                    const dateMatch = pdfElement.pdfName.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
                    if (dateMatch) {
                        const day = parseInt(dateMatch[1]);
                        const month = parseInt(dateMatch[2]);
                        const year = parseInt(dateMatch[3]);
                        const pdfDate = new Date(year, month - 1, day);
                        
                        if (!latestDate || pdfDate > latestDate) {
                            latestDate = pdfDate;
                            bestMatch = {
                                url: pdfElement.href.startsWith('http') ? pdfElement.href : new URL(pdfElement.href, this.config.crawlUrl).href,
                                text: pdfElement.pdfName,
                                pdfType: targetPdf.name,
                                category: category.name,
                                date: pdfDate
                            };
                        }
                    } else {
                        // If no date found, use this as the match (for PDFs without dates)
                        if (!bestMatch) {
                            bestMatch = {
                                url: pdfElement.href.startsWith('http') ? pdfElement.href : new URL(pdfElement.href, this.config.crawlUrl).href,
                                text: pdfElement.pdfName,
                                pdfType: targetPdf.name,
                                category: category.name,
                                date: null
                            };
                        }
                    }
                }
            }
            
            if (bestMatch) {
                console.log(`✅ Quick selected PDF for ${targetPdf.name}: ${bestMatch.text}`);
                categoryPdfs.push(bestMatch);
            } else {
                console.log(`⚠️  Quick: No matching PDF found for: ${targetPdf.name}`);
            }
        }
        
        return categoryPdfs;
    }

    async extractPdfLinks() {
        // Use the optimized method for all PDF extraction
        return await this.extractPdfLinksForChangeDetection();
    }
    
    /**
     * Extract PDFs from a specific category section
     * @param {Object} $ - Cheerio instance with page content
     * @param {Object} category - Category configuration
     * @returns {Array} Array of PDF links for this category
     */
    async extractPdfsFromCategory($, category) {
        const categoryPdfs = [];
        
        const pdfElements = $('a[href$=".pdf"]').map((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const text = $el.text().trim();
            
            // Get the parent container to find the PDF name
            const parentContainer = $el.closest('.flex.max-md\\:flex-wrap');
            const pdfNameElement = parentContainer.find('span.text-black-subdued').first();
            const pdfName = pdfNameElement.text().trim();
            
            return {
                href: href,
                text: text,
                pdfName: pdfName,
                parentText: parentContainer.text().trim()
            };
        }).get();
        
        console.log(`🔍 Found ${pdfElements.length} PDF elements in category: ${category.name}`);
        
        // Process each target PDF for this category
        for (const targetPdf of category.targetPdfs) {
            console.log(`🔍 Looking for: ${targetPdf.name}`);
            
            let bestMatch = null;
            let latestDate = null;
            
            for (const pdfElement of pdfElements) {
                const contextText = (pdfElement.pdfName + ' ' + pdfElement.parentText).toLowerCase();
                
                // Check if this PDF matches our target
                let isMatchingPdf = false;
                
                if (targetPdf.name === 'Cenník mobilných služieb') {
                    isMatchingPdf = contextText.includes('cenník mobilných služieb') && 
                                   contextText.includes('platný od') &&
                                   !contextText.includes('prémiových') &&
                                   !contextText.includes('4g internet') &&
                                   !contextText.includes('zoznam');
                } else if (targetPdf.name === 'Cenník prémiových čísel pre firemných zákazníkov') {
                    isMatchingPdf = contextText.includes('prémiových čísel') && 
                                   contextText.includes('firemných');
                } else if (targetPdf.name === 'Cenník 4G INTERNET') {
                    isMatchingPdf = contextText.includes('4g internet');
                } else if (targetPdf.name === 'Zoznam zmluvných operátorov a krajín pre volania/SMS do zahraničia') {
                    isMatchingPdf = contextText.includes('zmluvných operátorov') && 
                                   contextText.includes('zahraničia') &&
                                   !contextText.includes('roaming');
                } else if (targetPdf.name === 'Zoznam zmluvných operátorov s dostupnou službou medzinárodný roaming') {
                    isMatchingPdf = contextText.includes('zmluvných operátorov') && 
                                   contextText.includes('roaming');
                } else if (targetPdf.name === 'Nekonečný paušál pre dvoch za cenu jedného') {
                    isMatchingPdf = contextText.includes('nekonečný') && 
                                   contextText.includes('paušál') &&
                                   contextText.includes('dvoch');
                } else if (targetPdf.name === 'Rýchla SIMka s digitálnou aktiváciou') {
                    isMatchingPdf = contextText.includes('rýchla') && 
                                   contextText.includes('simka') &&
                                   contextText.includes('digitálnou');
                } else if (targetPdf.name === 'Digitálny Žiak') {
                    isMatchingPdf = contextText.includes('digitálny') && 
                                   contextText.includes('žiak');
                } else if (targetPdf.name === 'SLOBODA za 4') {
                    isMatchingPdf = contextText.includes('sloboda') && 
                                   contextText.includes('za 4') &&
                                   !contextText.includes('mobilom');
                } else if (targetPdf.name === 'SLOBODA S MOBILOM') {
                    isMatchingPdf = contextText.includes('sloboda') && 
                                   contextText.includes('mobilom');
                } else if (targetPdf.name === 'Cenník služieb pevnej siete') {
                    isMatchingPdf = contextText.includes('služieb pevnej siete') && 
                                   contextText.includes('platný od');
                } else if (targetPdf.name === 'Cenník káblovej televízie Bratislava') {
                    isMatchingPdf = contextText.includes('káblovej televízie') && 
                                   contextText.includes('bratislava');
                }
                
                if (isMatchingPdf) {
                    console.log(`✅ Found matching PDF: "${pdfElement.pdfName}"`);
                    console.log(`   URL: ${pdfElement.href}`);
                    
                    // Extract date to find the latest version
                    const dateMatch = pdfElement.pdfName.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
                    if (dateMatch) {
                        const day = parseInt(dateMatch[1]);
                        const month = parseInt(dateMatch[2]);
                        const year = parseInt(dateMatch[3]);
                        const pdfDate = new Date(year, month - 1, day);
                        
                        console.log(`📅 PDF date: ${day}.${month}.${year}`);
                        
                        if (!latestDate || pdfDate > latestDate) {
                            latestDate = pdfDate;
                            bestMatch = {
                                url: pdfElement.href.startsWith('http') ? pdfElement.href : new URL(pdfElement.href, this.config.crawlUrl).href,
                                text: pdfElement.pdfName,
                                pdfType: targetPdf.name,
                                category: category.name,
                                date: pdfDate
                            };
                            console.log(`🆕 New latest PDF found: ${pdfElement.pdfName}`);
                        }
                    } else {
                        // If no date found, use this as the match (for PDFs without dates)
                        if (!bestMatch) {
                            bestMatch = {
                                url: pdfElement.href.startsWith('http') ? pdfElement.href : new URL(pdfElement.href, this.config.crawlUrl).href,
                                text: pdfElement.pdfName,
                                pdfType: targetPdf.name,
                                category: category.name,
                                date: null
                            };
                            console.log(`📄 Using PDF without date: ${pdfElement.pdfName}`);
                        }
                    }
                }
            }
            
            if (bestMatch) {
                console.log(`✅ Selected PDF for ${targetPdf.name}: ${bestMatch.text}`);
                categoryPdfs.push(bestMatch);
            } else {
                console.log(`⚠️  No matching PDF found for: ${targetPdf.name}`);
            }
        }
        
        return categoryPdfs;
    }

    async extractMetadata() {
        console.log('🔍 Extracting 4ka metadata...');
        
        const content = await this.page.content();
        const $ = cheerio.load(content);
        
        // Try to find last update date in various locations
        const dateSelectors = [
            '.date', '.publish-date', '.last-updated', '.document-date', '.file-date',
            '[class*="date"]', '[class*="update"]', '.meta-info', '.document-info', '.file-info',
            '.text-gray-400', '.text-gray-500', '.text-muted', '.date-text'
        ];
        
        let lastUpdate = null;
        
        for (const selector of dateSelectors) {
            const dateElement = $(selector);
            if (dateElement.length > 0) {
                const dateText = dateElement.text().trim();
                if (dateText && dateText.match(/\d{1,2}\.\d{1,2}\.\d{4}/)) {
                    lastUpdate = dateText;
                    break;
                }
            }
        }
        
        // If no specific date found, use current date
        if (!lastUpdate) {
            lastUpdate = new Date().toLocaleDateString('sk-SK');
        }
        
        console.log(`📅 Last update: ${lastUpdate}`);
        
        return {
            lastUpdate: lastUpdate,
            source: this.config.crawlUrl,
            extractedAt: new Date().toISOString()
        };
    }

    async crawl(options = {}) {
        try {
            console.log(`🚀 Starting consolidated crawl for ${this.providerName}...`);
            
            let pdfLinks = [];
            let metadata = {};
            
            if (options.reuseCrawlResult && (options.reuseCrawlResult.pdfLinks || options.reuseCrawlResult.pdfs)) {
                console.log('🔄 Reusing existing PDF links...');
                // Handle both old format (pdfLinks) and new format (pdfs from quick crawl)
                if (options.reuseCrawlResult.pdfLinks) {
                pdfLinks = options.reuseCrawlResult.pdfLinks;
                } else if (options.reuseCrawlResult.pdfs) {
                    // Convert quick crawl format to expected format
                    pdfLinks = options.reuseCrawlResult.pdfs.map(pdf => ({
                        url: pdf.pdfUrl,
                        pdfType: pdf.pdfType,
                        text: pdf.text,
                        category: pdf.category
                    }));
                }
                metadata = options.reuseCrawlResult.metadata || {};
            } else {
                console.log('🌐 Performing fresh crawl (no results to reuse)...');
                await this.initialize();
                await this.navigateToPricingPage();
                
                pdfLinks = await this.extractPdfLinks();
                metadata = await this.extractMetadata();
            }
            
            if (pdfLinks.length === 0) {
                throw new Error(`No PDF links found for ${this.providerName}`);
            }
            
            console.log(`📄 Found ${pdfLinks.length} unique PDF links for 4ka`);
            
            // Check if consolidated file exists to determine processing strategy
            const FourKaJsonMerger = require('../utils/data/mergers/fourka-json-merger');
            const jsonMerger = new FourKaJsonMerger();
            const existingData = await jsonMerger.loadExistingData();
            
            // Filter PDFs if selective processing is requested AND consolidated file exists
            let pdfsToProcess = pdfLinks;
            if (options.changedPdfUrls && Array.isArray(options.changedPdfUrls) && options.changedPdfUrls.length > 0 && existingData) {
                pdfsToProcess = pdfLinks.filter(pdfLink => options.changedPdfUrls.includes(pdfLink.url));
                console.log(`🎯 Selective processing: Processing ${pdfsToProcess.length}/${pdfLinks.length} changed PDFs`);
                console.log(`📄 Changed PDFs: ${options.changedPdfUrls.join(', ')}`);
            } else {
                console.log(`📄 Processing all ${pdfLinks.length} PDFs${existingData ? '' : ' (no existing consolidated file)'}`);
            }
            
            const allPdfData = [];
            
            for (let i = 0; i < pdfsToProcess.length; i++) {
                const pdfLink = pdfsToProcess[i];
                console.log(`📄 Processing PDF ${i + 1}/${pdfsToProcess.length}: ${pdfLink.pdfType}`);
                console.log(`🔗 URL: ${pdfLink.url}`);
                
                try {
                    const FourKaPdfScraper = require('../scrapers/4ka-pdf-scraper');
                    const fourKaScraper = new FourKaPdfScraper(this.errorMonitor);
                    const extractedData = await fourKaScraper.scrapePdf(pdfLink.url, `4ka ${pdfLink.pdfType}`, null, true, pdfLink.category);
                    
                    // Decide structure per-PDF strictly by extraction method
                    // Check all possible locations (scraper provides data.extractionInfo now)
                    const detectedMethod = extractedData.summary?.extractionMethod
                        || extractedData.data?.extractionInfo?.extractionMethod
                        || extractedData.data?.extractionInfo?.method
                        || extractedData.extractionInfo?.extractionMethod
                        || extractedData.extractionInfo?.method
                        || 'unknown';
                    const isToc = detectedMethod === 'toc-guided-header';

                    const baseFields = {
                        cennikName: extractedData.cennikName || `4ka ${pdfLink.pdfType}`,
                        pdfUrl: pdfLink.url,
                        pdfType: pdfLink.pdfType,
                        category: pdfLink.category,
                        rawText: extractedData.rawText || extractedData.data?.sections?.fullContent || ''
                    };

                    // Avoid duplicating extractionMethod inside summary; keep it in extractionInfo only
                    // Also filter ALL stale validation warnings from summary (they're incorrect - we provide extractionInfo correctly)
                    const sanitizedSummary = extractedData.summary ? { ...extractedData.summary } : undefined;
                    if (sanitizedSummary) {
                        if ('extractionMethod' in sanitizedSummary) delete sanitizedSummary.extractionMethod;
                        // Filter stale validator warnings from summary.validation.warnings (embedded in summary object)
                        if (sanitizedSummary.validation && Array.isArray(sanitizedSummary.validation.warnings)) {
                            sanitizedSummary.validation.warnings = sanitizedSummary.validation.warnings.filter(w => {
                                const s = String(w).toLowerCase();
                                // Remove warnings about missing data.extractionInfo - we provide it correctly based on mode
                                return !(s.includes('data.extractioninfo') || s.includes('missing data.extractioninfo'));
                            });
                            // Clean up empty validation objects
                            if (
                                sanitizedSummary.validation.warnings.length === 0 &&
                                (!sanitizedSummary.validation.errors || sanitizedSummary.validation.errors.length === 0)
                            ) {
                                delete sanitizedSummary.validation;
                            }
                        }
                    }

                    let pdfData;
                    if (isToc) {
                        // Filter stale warnings for ToC mode (we provide data.extractionInfo now)
                        const filteredValidation = (() => {
                            const v = extractedData.metadata?.validation ? { ...extractedData.metadata.validation } : undefined;
                            if (v && Array.isArray(v.warnings)) {
                                v.warnings = v.warnings.filter(w => !String(w).toLowerCase().includes('data.extractioninfo'));
                            }
                            return v;
                        })();
                        // ToC-based: keep data wrapper and avoid root duplicates
                        // Use extractionInfo from scraper if available, otherwise build from summary
                        const tocExtractionInfo = extractedData.data?.extractionInfo || {
                            extractionMethod: detectedMethod,
                            pagesWithEuro: extractedData.summary?.pagesWithEuro,
                            totalPages: extractedData.summary?.totalPages
                        };
                        
                        pdfData = {
                            ...baseFields,
                            data: {
                                sections: extractedData.data?.sections || {},
                                summary: sanitizedSummary,
                                extractionInfo: tocExtractionInfo
                            },
                            validation: filteredValidation
                        };
                    } else {
                        // Filter stale warnings for Simple mode (no data.* expected)
                        const filteredValidation = (() => {
                            const v = extractedData.metadata?.validation ? { ...extractedData.metadata.validation } : undefined;
                            if (v && Array.isArray(v.warnings)) {
                                v.warnings = v.warnings.filter(w => {
                                    const s = String(w).toLowerCase();
                                    return !(s.includes('data.summary') || s.includes('data.extractioninfo'));
                                });
                            }
                            return v;
                        })();
                        // Simple: root-level summary/extractionInfo
                        pdfData = {
                            ...baseFields,
                            summary: sanitizedSummary,
                            extractionInfo: {
                                extractionMethod: detectedMethod,
                                pagesWithEuro: extractedData.summary?.pagesWithEuro,
                                totalPages: extractedData.summary?.totalPages
                            },
                            validation: filteredValidation
                        };
                    }
                    
                    console.log(`📊 PDF Data Structure for ${pdfLink.pdfType}:`);
                    console.log(`   - Has rawText: ${!!pdfData.rawText}`);
                    console.log(`   - Has summary: ${!!pdfData.summary}`);
                    console.log(`   - Has extractionInfo: ${!!pdfData.extractionInfo}`);
                    console.log(`   - Raw text length: ${pdfData.rawText.length} characters`);
                    
                    allPdfData.push(pdfData);
                    console.log(`✅ Successfully processed ${pdfLink.pdfType}`);
                    
                } catch (error) {
                    console.error(`❌ Error processing PDF ${pdfLink.pdfType}:`, error.message);
                    allPdfData.push({
                        cennikName: `4ka ${pdfLink.pdfType}`,
                        pdfUrl: pdfLink.url,
                        pdfType: pdfLink.pdfType,
                        category: pdfLink.category,
                        rawText: '',
                        error: error.message
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
                lastUpdate: (options.changedPdfUrls && existingData) ? {
                    updatedPdfs: options.changedPdfUrls.length,
                    updatedPdfUrls: options.changedPdfUrls,
                    updateType: 'selective'
                } : {
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
            if (consolidatedResult.lastUpdate && consolidatedResult.lastUpdate.updateType === 'selective') {
                console.log(`   🎯 Selective Processing: ${consolidatedResult.lastUpdate.updatedPdfs}/${consolidatedResult.lastUpdate.updatedPdfUrls.length} PDFs`);
            }
            
            // Always use JSON merger for consolidated processing
            console.log(`\n🔄 Using JSON merger for consolidated processing...`);
            
            // Prepare data for merger
            const mergerData = {
                ...consolidatedResult,
                selectiveProcessing: consolidatedResult.lastUpdate && consolidatedResult.lastUpdate.updateType === 'selective' ? {
                    enabled: true,
                    processedCount: consolidatedResult.lastUpdate.updatedPdfs,
                    totalAvailable: pdfLinks.length,
                    processedPdfUrls: consolidatedResult.lastUpdate.updatedPdfUrls
                } : {
                    enabled: false,
                    processedCount: consolidatedResult.lastUpdate.updatedPdfs,
                    totalAvailable: pdfLinks.length,
                    processedPdfUrls: consolidatedResult.lastUpdate.updatedPdfUrls
                }
            };
            
            // Use JSON merger to merge with existing data
            const mergeResult = await jsonMerger.processSelectiveUpdate(mergerData);
            
            console.log(`✅ Consolidated processing complete: ${mergeResult.filePath}`);
                return {
                    ...consolidatedResult,
                    merged: true,
                    mergeResult: mergeResult
                };
            
        } catch (error) {
            if (this.errorMonitor) {
                const errorResult = this.errorMonitor.handleError(error, '4ka-crawl', '4ka Slovakia');
                throw errorResult.error;
            } else {
                console.error(`❌ [4ka Slovakia] 4ka-crawl: ${error.message}`);
                throw error;
            }
        } finally {
            if (this.browser) {
                await this.cleanup();
            }
        }
    }
}

module.exports = FourKaCrawler;
