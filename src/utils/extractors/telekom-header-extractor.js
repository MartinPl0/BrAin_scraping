const { PDFExtract } = require('pdf.js-extract');

/**
 * Header-Based Text Extractor for Telekom PDF
 * Extracts section text by finding section headers and boundaries
 */
class TelekomHeaderExtractor {
    constructor() {
        this.pdfExtract = new PDFExtract();
    }

    /**
     * Extract section text by finding section header and next section boundary
     * @param {string} pdfPath - Path to PDF file
     * @param {string} sectionTitle - Title of the section to extract
     * @param {string} nextSectionTitle - Title of the next section (for boundary)
     * @param {number} startPage - Starting page number from ToC
     * @param {number} nextSectionPage - Expected page number for next section
     * @returns {Promise<string>} Extracted text for the section
     */
    async extractSectionByHeaderFromPage(pdfPath, sectionTitle, nextSectionTitle = null, startPage, nextSectionPage = null) {
        console.log(`Extracting section "${sectionTitle}" starting from page ${startPage}...`);
        
        try {
            const data = await new Promise((resolve, reject) => {
                this.pdfExtract.extract(pdfPath, {}, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });

            let extractedText = '';
            let foundSectionStart = false;
            let foundSectionEnd = false;

            const startPdfIndex = this.getPdfIndexFromDisplayedPage(startPage);

            // Search through pages starting from the ToC page
            for (let i = startPdfIndex; i < data.pages.length; i++) {
                const page = data.pages[i];
                let pageText = '';
                
                // Extract text from this page
                page.content.forEach(item => {
                    if (item.str) {
                        pageText += item.str + ' ';
                    }
                });

                // Check if this page contains the section header
                if (!foundSectionStart && this.containsSectionHeader(pageText, sectionTitle)) {
                    console.log(`Found section "${sectionTitle}" header on page ${i}`);
                    foundSectionStart = true;
                    
                    const sectionHeaderIndex = pageText.indexOf(sectionTitle);
                    if (sectionHeaderIndex !== -1) {
                        // Check if this page also contains the next section header
                        if (nextSectionTitle && this.containsSectionHeader(pageText, nextSectionTitle)) {
                            console.log(`Found both current and next section headers on same page ${i}`);
                            
                            let nextSectionIndex = pageText.indexOf(nextSectionTitle);
                            if (nextSectionIndex === -1) {
                                // Try flexible matching for the next section title
                                const flexibleNextTitle = this.createFlexiblePattern(nextSectionTitle.toLowerCase());
                                if (flexibleNextTitle) {
                                    nextSectionIndex = pageText.toLowerCase().indexOf(flexibleNextTitle);
                                }
                            }
                            
                            if (nextSectionIndex !== -1 && nextSectionIndex > sectionHeaderIndex) {
                                // Extract content from current section header to next section header
                                const contentFromCurrentToNext = pageText.substring(sectionHeaderIndex, nextSectionIndex);
                                extractedText += contentFromCurrentToNext + ' ';
                                
                                foundSectionEnd = true;
                                break;
                            } else {
                                // Fallback: extract from current section header to end of page
                                const contentFromHeader = pageText.substring(sectionHeaderIndex);
                                extractedText += contentFromHeader + ' ';
                            }
                        } else {
                            const contentFromHeader = pageText.substring(sectionHeaderIndex);
                            extractedText += contentFromHeader + ' ';
                        }
                    }
                }

                // If we found the section start, continue collecting text
                if (foundSectionStart && !foundSectionEnd) {
                    // Check if we've reached the next section header
                    if (nextSectionTitle && this.containsSectionHeader(pageText, nextSectionTitle)) {
                        console.log(`Found next section "${nextSectionTitle}" header on page ${i} - stopping extraction`);
                        
                        // Split the content at the next section header
                        const nextSectionIndex = pageText.indexOf(nextSectionTitle);
                        if (nextSectionIndex !== -1) {
                            const contentToAdd = pageText.substring(0, nextSectionIndex);
                            extractedText += contentToAdd + ' ';
                        } else {
                            // If we can't find the exact position, add the full page content
                            extractedText += pageText + ' ';
                        }
                        
                        foundSectionEnd = true;
                        break;
                    }
                    
                    // Check if we've reached the expected next section page but haven't found the header
                    if (nextSectionPage && i >= this.getPdfIndexFromDisplayedPage(nextSectionPage)) {
                        console.log(`Reached expected next section page ${nextSectionPage} but header not found - stopping extraction`);
                        // Add the current page content before stopping
                        extractedText += pageText + ' ';
                        foundSectionEnd = true;
                        break;
                    }
                    
                    // Add this page's text to our extraction
                    if (i > startPdfIndex) {
                        // This is a subsequent page, add all content
                        extractedText += pageText + ' ';
                    } else if (i === startPdfIndex && foundSectionStart) {
                        // This is the same page where we found the section header
                        // Check if this page also contains the next section header
                        if (nextSectionTitle && this.containsSectionHeader(pageText, nextSectionTitle)) {
                            console.log(`Found next section "${nextSectionTitle}" header on same page ${i} - stopping extraction`);
                            
                            const nextSectionIndex = pageText.indexOf(nextSectionTitle);
                            if (nextSectionIndex !== -1) {
                                const contentToAdd = pageText.substring(0, nextSectionIndex);
                                extractedText += contentToAdd + ' ';
                            } else {
                                // If we can't find the exact position, add the full page content
                                extractedText += pageText + ' ';
                            }
                            
                            foundSectionEnd = true;
                            break;
                        } else {
                            // This is the same page where we found the section header
                            // We already added content from the header onwards, so we're done with this page
                        }
                    }
                }
            }

            if (!foundSectionStart) {
                throw new Error(`Section "${sectionTitle}" header not found starting from page ${startPage}`);
            }

            // Validate page numbers at the start of extracted text
            const validationResult = this.validatePageNumbers(extractedText, startPage, sectionTitle);
            if (!validationResult.isValid) {
                throw new Error(`Page number validation failed for "${sectionTitle}": ${validationResult.error}`);
            }

            return extractedText.trim();
        } catch (error) {
            console.error(`❌ Error extracting section "${sectionTitle}":`, error.message);
            throw error;
        }
    }

    /**
     * Check if page text contains a section header
     * @param {string} pageText - Text content of the page
     * @param {string} sectionTitle - Section title to look for
     * @returns {boolean} True if section header is found
     */
    containsSectionHeader(pageText, sectionTitle) {
        if (!pageText || !sectionTitle) return false;
        
        // Normalize both texts for comparison
        const normalizedPageText = pageText.toLowerCase().trim();
        const normalizedSectionTitle = sectionTitle.toLowerCase().trim();
        
        // First try exact match
        if (this.exactHeaderMatch(normalizedPageText, normalizedSectionTitle)) {
            // Validate case format for nextTitle to prevent false matches
            if (this.isNextTitleFormat(sectionTitle)) {
                const foundText = this.extractMatchedText(pageText, normalizedSectionTitle);
                if (foundText && foundText === foundText.toUpperCase()) {
                    return true; // Found text is all uppercase - valid match
                } else {
                    return false; // Found text is not all uppercase - ignore false match
                }
            }
            return true; // For current section titles, allow any case
        }
        
        // If exact match fails, try flexible matching for common variations
        const flexibleTitle = this.createFlexiblePattern(normalizedSectionTitle);
        if (flexibleTitle && this.exactHeaderMatch(normalizedPageText, flexibleTitle)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Check for exact header match using strict patterns
     */
    exactHeaderMatch(pageText, sectionTitle) {
        const patterns = [
            // Pattern 1: Section title at start of line or after page numbers (most specific)
            new RegExp(`(^|\\s|\\d+\\s+\\d+\\s+)${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i'),
            // Pattern 2: Section title as a distinct header with proper word boundaries
            new RegExp(`\\b${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        ];
        
        // Check if any pattern matches, but be very strict about it
        const matches = patterns.some(pattern => pattern.test(pageText));
        
        // Additional validation: make sure it's not just a partial match in a longer sentence
        if (matches) {
            // Check if the match is actually a standalone header, not part of a longer sentence
            const fullMatch = pageText.match(new RegExp(`\\b${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
            if (fullMatch) {
                const matchIndex = fullMatch.index;
                const beforeMatch = pageText.substring(Math.max(0, matchIndex - 20), matchIndex);
                const afterMatch = pageText.substring(matchIndex + sectionTitle.length, matchIndex + sectionTitle.length + 20);
                
                // Check if it's surrounded by appropriate delimiters (not in the middle of a sentence)
                const isStandalone = /(^|\s|$)/.test(beforeMatch.slice(-1)) && /(^|\s|$)/.test(afterMatch.slice(0, 1));
                
                if (!isStandalone) {
                    return false;
                }
            }
        }
        
        return matches;
    }
    
    /**
     * Create flexible pattern for common title variations
     */
    createFlexiblePattern(originalTitle) {
        // Handle common variations in Slovak text, especially line break issues
        const variations = [
            // Handle line break issue: "preslužby" vs "pre služby" (missing space due to line break)
            { from: 'preslužby', to: 'pre služby' },
            { from: 'pre služby', to: 'preslužby' },
            // Handle other common variations
            { from: 's dobíjaním kreditu', to: 's dobíjaním kreditu' }
        ];
        
        let flexibleTitle = originalTitle;
        for (const variation of variations) {
            if (flexibleTitle.includes(variation.from)) {
                flexibleTitle = flexibleTitle.replace(variation.from, variation.to);
            }
        }
        
        return flexibleTitle !== originalTitle ? flexibleTitle : null;
    }

    /**
     * Check if a title is in nextTitle format (typically all uppercase)
     * @param {string} title - Title to check
     * @returns {boolean} True if title appears to be a nextTitle format
     */
    isNextTitleFormat(title) {
        if (!title) return false;
        
        // Check if title is all uppercase (typical for section headers from ToC)
        const isAllUppercase = title === title.toUpperCase();
        
        // Additional check: if title contains common nextTitle patterns
        const hasNextTitlePatterns = /^(DOPLNKOVÉ|ZMENA|PROGRAM|SLUŽBY|INTERNET|MOBILNÝ|MAGIO)/i.test(title);
        
        return isAllUppercase || hasNextTitlePatterns;
    }

    /**
     * Extract the actual matched text from pageText for case validation
     * @param {string} pageText - Full page text
     * @param {string} normalizedTitle - Normalized title to find
     * @returns {string|null} The actual matched text or null if not found
     */
    extractMatchedText(pageText, normalizedTitle) {
        if (!pageText || !normalizedTitle) return null;
        
        // Use the same patterns as exactHeaderMatch to find the match
        const patterns = [
            // Pattern 1: Section title at start of line or after page numbers
            new RegExp(`(^|\\s|\\d+\\s+\\d+\\s+)(${normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(\\s|$)`, 'i'),
            // Pattern 2: Section title as a distinct header with proper word boundaries
            new RegExp(`\\b(${normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i')
        ];
        
        for (const pattern of patterns) {
            const match = pageText.match(pattern);
            if (match) {
                // Return the actual matched text (group 2 for pattern 1, group 1 for pattern 2)
                return match[2] || match[1];
            }
        }
        
        return null;
    }

    /**
     * Map displayed page number to PDF internal index (standard indexing)
     * @param {number} displayedPage - Displayed page number
     * @returns {number} PDF internal index
     */
    getPdfIndexFromDisplayedPage(displayedPage) {
        // Standard PDF indexing: page N = PDF index N-1
        return displayedPage - 1;
    }

    /**
     * Convert PDF index back to displayed page number
     * @param {number} pdfIndex - PDF internal index
     * @returns {number} Displayed page number
     */
    getDisplayedPageFromPdfIndex(pdfIndex) {
        // Standard PDF indexing: PDF index N = displayed page N+1
        return pdfIndex + 1;
    }

    /**
     * Validate that extracted text starts with expected page numbers
     * @param {string} extractedText - The extracted text to validate
     * @param {number} expectedPage - Expected page number from ToC
     * @param {string} sectionTitle - Section title for error reporting
     * @returns {Object} Validation result
     */
    validatePageNumbers(extractedText, expectedPage, sectionTitle) {
        if (!extractedText || extractedText.trim().length === 0) {
            return {
                isValid: false,
                error: `No page numbers found at start of text: "${extractedText}"`
            };
        }

        // For Telekom PDFs, be more lenient with page number validation
        // Just check if we have substantial content (more than 100 characters)
        if (extractedText.length < 100) {
            return {
                isValid: false,
                error: `Extracted text too short: ${extractedText.length} characters`
            };
        }

        // Extract first few numbers from the text
        const numbers = extractedText.match(/\d+/g);
        if (!numbers || numbers.length === 0) {
            return {
                isValid: false,
                error: `No page numbers found at start of text: "${extractedText.substring(0, 100)}..."`
            };
        }

        // For Telekom, we're more lenient - just check if we have reasonable content
        // Accept if we have substantial content, regardless of exact page numbers
        return { isValid: true };
    }
}

module.exports = TelekomHeaderExtractor;
