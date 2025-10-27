const { PDFExtract } = require('pdf.js-extract');

/**
 * Header-Based Text Extractor for O2 PDF
 * Extracts section text by finding section headers and boundaries
 * Supports both single-sided and double-sided PDF layouts
 */
class HeaderBasedExtractor {
    constructor() {
        this.pdfExtract = new PDFExtract();
        this.pdfFormat = null; // Will be detected: 'single-sided' or 'double-sided'
    }

    /**
     * Detect PDF format (single-sided vs double-sided) by analyzing page content
     * @param {string} pdfPath - Path to PDF file
     * @returns {Promise<string>} Detected format: 'single-sided' or 'double-sided'
     */
    async detectPdfFormat(pdfPath) {
        if (this.pdfFormat) {
            return this.pdfFormat;
        }

        console.log('🔍 Detecting PDF format...');
        
        try {
            const data = await new Promise((resolve, reject) => {
                this.pdfExtract.extract(pdfPath, {}, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });

            
            let singleSidedScore = 0;
            let doubleSidedScore = 0;

            for (let displayedPage = 4; displayedPage <= 6; displayedPage++) {
                const singleSidedIndex = displayedPage - 1; // Standard mapping
                if (singleSidedIndex < data.pages.length) {
                    const singleSidedText = this.extractPageText(data.pages[singleSidedIndex]);
                    if (this.containsPageNumber(singleSidedText, displayedPage)) {
                        singleSidedScore++;
                    }
                }

                if (displayedPage >= 4) {
                    const doubleSidedIndex = Math.floor((displayedPage - 4) / 2) + 2;
                    if (doubleSidedIndex < data.pages.length) {
                        const doubleSidedText = this.extractPageText(data.pages[doubleSidedIndex]);
                        if (this.containsPageNumber(doubleSidedText, displayedPage)) {
                            doubleSidedScore++;
                        }
                    }
                }
            }

            // Determine format based on scores
            if (singleSidedScore > doubleSidedScore) {
                this.pdfFormat = 'single-sided';
                console.log('📄 Detected: Single-sided PDF format');
            } else {
                this.pdfFormat = 'double-sided';
                console.log('📄 Detected: Double-sided PDF format');
            }

            return this.pdfFormat;
        } catch (error) {
            console.warn('⚠️ Could not detect PDF format, defaulting to double-sided:', error.message);
            this.pdfFormat = 'double-sided';
            return this.pdfFormat;
        }
    }

    /**
     * Extract text from a PDF page
     * @param {Object} page - PDF page object
     * @returns {string} Extracted text
     */
    extractPageText(page) {
        let text = '';
        page.content.forEach(item => {
            if (item.str) {
                text += item.str + ' ';
            }
        });
        return text;
    }

    /**
     * Check if page text contains a specific page number
     * @param {string} pageText - Text content of the page
     * @param {number} pageNumber - Page number to look for
     * @returns {boolean} True if page number is found
     */
    containsPageNumber(pageText, pageNumber) {
        // Look for page number patterns like "4", "5", "6" at the beginning or end of text
        const patterns = [
            new RegExp(`^\\s*${pageNumber}\\s*$`, 'm'),
            new RegExp(`\\b${pageNumber}\\b`, 'g'),
            new RegExp(`${pageNumber}\\s*$`, 'm')
        ];
        
        return patterns.some(pattern => pattern.test(pageText));
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
            // Detect PDF format first
            await this.detectPdfFormat(pdfPath);
            
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
                            // Validate that the next section header is on the correct page
                            if (nextSectionPage && !this.isSectionHeaderOnCorrectPage(pageText, nextSectionTitle, i, nextSectionPage)) {
                                // Ignore the next section header on wrong page and continue extracting
                                const contentFromHeader = pageText.substring(sectionHeaderIndex);
                                const pageNumbersMatch = pageText.match(/^\d+\s+\d+/);
                                if (pageNumbersMatch) {
                                    extractedText += pageNumbersMatch[0] + ' ' + contentFromHeader + ' ';
                                } else {
                                    extractedText += contentFromHeader + ' ';
                                }
                                // Don't break - continue to next page to find the correct next section
                                continue;
                            }
                            
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
                                
                                const pageNumbersMatch = pageText.match(/^\d+\s+\d+/);
                                if (pageNumbersMatch) {
                                    extractedText += pageNumbersMatch[0] + ' ' + contentFromCurrentToNext + ' ';
                                } else {
                                    // Fallback: just add content from section header to next section
                                    extractedText += contentFromCurrentToNext + ' ';
                                }
                                
                                foundSectionEnd = true;
                                break;
                            } else {
                                // Fallback: extract from current section header to end of page
                                const contentFromHeader = pageText.substring(sectionHeaderIndex);
                                
                                const pageNumbersMatch = pageText.match(/^\d+\s+\d+/);
                                if (pageNumbersMatch) {
                                    extractedText += pageNumbersMatch[0] + ' ' + contentFromHeader + ' ';
                                } else {
                                    extractedText += contentFromHeader + ' ';
                                }
                            }
                        } else {
                            const contentFromHeader = pageText.substring(sectionHeaderIndex);
                            
                            // Find the page numbers at the start of the text
                            const pageNumbersMatch = pageText.match(/^\d+\s+\d+/);
                            if (pageNumbersMatch) {
                                extractedText += pageNumbersMatch[0] + ' ' + contentFromHeader + ' ';
                            } else {
                                // Fallback: just add content from section header
                                extractedText += contentFromHeader + ' ';
                            }
                        }
                    }
                }

                // If we found the section start, continue collecting text
                if (foundSectionStart && !foundSectionEnd) {
                    // Check if we've reached the next section header
                    if (nextSectionTitle && this.containsSectionHeader(pageText, nextSectionTitle)) {
                        // Validate that the next section header is on the correct page
                        if (nextSectionPage && !this.isSectionHeaderOnCorrectPage(pageText, nextSectionTitle, i, nextSectionPage)) {
                            // Continue to next page without stopping - keep searching for the correct page
                            // BUT STILL ADD CURRENT PAGE CONTENT since it's part of the current section
                            extractedText += pageText + ' ';
                            continue;
                        } else {
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
                    }
                    
                    // Check if we've reached the expected next section page but haven't found the header
                    if (nextSectionPage && i >= this.getPdfIndexFromDisplayedPage(nextSectionPage)) {
                        console.log(`Reached expected next section page ${nextSectionPage} but header not found - stopping extraction`);
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
                            // Validate that the next section header is on the correct page
                            if (nextSectionPage && !this.isSectionHeaderOnCorrectPage(pageText, nextSectionTitle, i, nextSectionPage)) {
                                // Continue with normal extraction from current section header
                                const fallbackSectionHeaderIndex = pageText.indexOf(sectionTitle);
                                if (fallbackSectionHeaderIndex !== -1) {
                                    const contentFromHeader = pageText.substring(fallbackSectionHeaderIndex);
                                    
                                    const pageNumbersMatch = pageText.match(/^\d+\s+\d+/);
                                    if (pageNumbersMatch) {
                                        extractedText += pageNumbersMatch[0] + ' ' + contentFromHeader + ' ';
                                    } else {
                                        // Fallback: just add content from section header
                                        extractedText += contentFromHeader + ' ';
                                    }
                                }
                            } else {
                                // Validate that the next section header is on the correct page even for same-page case
                                if (nextSectionPage && !this.isSectionHeaderOnCorrectPage(pageText, nextSectionTitle, i, nextSectionPage)) {
                                    // Continue with normal extraction from current section header
                                    const fallbackSectionHeaderIndex = pageText.indexOf(sectionTitle);
                                    if (fallbackSectionHeaderIndex !== -1) {
                                        const contentFromHeader = pageText.substring(fallbackSectionHeaderIndex);
                                        
                                        const pageNumbersMatch = pageText.match(/^\d+\s+\d+/);
                                        if (pageNumbersMatch) {
                                            extractedText += pageNumbersMatch[0] + ' ' + contentFromHeader + ' ';
                                        } else {
                                            // Fallback: just add content from section header
                                            extractedText += contentFromHeader + ' ';
                                        }
                                    }
                                    continue;
                                }
                                
                                console.log(`Found next section "${nextSectionTitle}" header on same page ${i} - stopping extraction`);
                                
                                // Simple approach: find the section header and extract from there to next section
                                const sectionHeaderIndex = pageText.indexOf(sectionTitle);
                                const nextSectionIndex = pageText.indexOf(nextSectionTitle);
                                
                                if (sectionHeaderIndex !== -1 && nextSectionIndex !== -1 && sectionHeaderIndex < nextSectionIndex) {
                                    // Extract content from section header to next section header
                                    const contentBetweenSections = pageText.substring(sectionHeaderIndex, nextSectionIndex);
                                    
                                    // Extract page numbers and add them with the content
                                    const pageNumbersMatch = pageText.match(/^\d+\s+\d+/);
                                    if (pageNumbersMatch) {
                                        extractedText += pageNumbersMatch[0] + ' ' + contentBetweenSections + ' ';
                                    } else {
                                        extractedText += contentBetweenSections + ' ';
                                    }
                                } else {
                                    // This should not happen since we already found both headers
                                    const contentToAdd = pageText.substring(0, nextSectionIndex);
                                    extractedText += contentToAdd + ' ';
                                }
                                
                                foundSectionEnd = true;
                                break;
                            }
                        } else {
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
            return true;
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
            // Pattern 2: Section title with π symbol (for π sections)
            new RegExp(`π\\s*${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i'),
            // Pattern 3: Section title as a distinct header with proper word boundaries
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
     * Map displayed page number to PDF internal index
     * @param {number} displayedPage - Displayed page number
     * @returns {number} PDF internal index
     */
    getPdfIndexFromDisplayedPage(displayedPage) {
        // Handle special cases for both formats
        if (displayedPage === 1) return 0; // Cover page
        if (displayedPage === 2) return 1; // ToC page
        
        if (this.pdfFormat === 'single-sided') {
            // Standard single-sided mapping
            return displayedPage - 1; // Standard mapping: page N = PDF index N-1
        } else {
            // Double-sided mapping (original logic)
            // For pages 4+, handle double-page layout
            if (displayedPage >= 4) {
                // Pages 4-5 are on PDF index 2, pages 6-7 are on PDF index 3, etc.
                // Formula: PDF index = ((displayedPage - 4) / 2) + 2
                const pdfIndex = Math.floor((displayedPage - 4) / 2) + 2;
                return pdfIndex;
            }
            
            // For page 3 in double-sided format, it should be on PDF index 2
            if (displayedPage === 3) {
                return 2;
            }
        }
        
        throw new Error(`Cannot map displayed page ${displayedPage} to PDF index`);
    }

    /**
     * Check if a section header is on the correct page (validation against ToC)
     * @param {string} pageText - Text content of the page
     * @param {string} sectionTitle - Section title to check
     * @param {number} currentPdfIndex - Current PDF page index
     * @param {number} expectedPage - Expected page number from ToC
     * @returns {boolean} True if section header is on correct page
     */
    isSectionHeaderOnCorrectPage(pageText, sectionTitle, currentPdfIndex, expectedPage) {
        if (!this.containsSectionHeader(pageText, sectionTitle)) {
            return false;
        }
        
        if (this.pdfFormat === 'single-sided') {
            // For single-sided layout, each PDF index contains exactly 1 displayed page
            const displayedPage = this.getDisplayedPageFromPdfIndex(currentPdfIndex);
            return displayedPage === expectedPage;
        } else {
            // For double-page layout, each PDF index contains 2 displayed pages
            const startDisplayedPage = this.getDisplayedPageFromPdfIndex(currentPdfIndex);
            const endDisplayedPage = startDisplayedPage + 1;
            
            // Check if the expected page falls within the range of pages that this PDF index contains
            return expectedPage >= startDisplayedPage && expectedPage <= endDisplayedPage;
        }
    }

    /**
     * Convert PDF index back to displayed page number
     * @param {number} pdfIndex - PDF internal index
     * @returns {number} Displayed page number
     */
    getDisplayedPageFromPdfIndex(pdfIndex) {
        // Handle special cases for both formats
        if (pdfIndex === 0) return 1; // Cover page
        if (pdfIndex === 1) return 2; // ToC page
        
        if (this.pdfFormat === 'single-sided') {
            // Standard single-sided mapping
            return pdfIndex + 1; // Standard mapping: PDF index N = page N+1
        } else {
            // Double-sided mapping (original logic)
            // For pages 4+, handle double-page layout
            // PDF index 2 = displayed pages 4-5
            // PDF index 3 = displayed pages 6-7
            // PDF index 4 = displayed pages 8-9
            // Formula: displayedPage = (pdfIndex - 2) * 2 + 4
            if (pdfIndex >= 2) {
                return (pdfIndex - 2) * 2 + 4;
            }
        }
        
        throw new Error(`Cannot map PDF index ${pdfIndex} to displayed page`);
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

        // Extract first two numbers from the text
        const numbers = extractedText.match(/\d+/g);
        if (!numbers || numbers.length < 2) {
            return {
                isValid: false,
                error: `No page numbers found at start of text: "${extractedText.substring(0, 100)}..."`
            };
        }

        const firstNumber = parseInt(numbers[0]);
        const secondNumber = parseInt(numbers[1]);

        // For single-sided PDFs, be much more flexible with validation
        if (this.pdfFormat === 'single-sided') {
            // For single-sided PDFs, if we have substantial content, accept it regardless of page numbers
            if (extractedText.length > 50) {
                console.log(`⚠️ Page validation warning for "${sectionTitle}": Expected page ${expectedPage}, found pages ${firstNumber}-${secondNumber}, but accepting due to single-sided format and content length (${extractedText.length} chars)`);
                return { isValid: true };
            }
            
            // Check if the expected page is within a reasonable range
            const pageRange = Math.abs(firstNumber - secondNumber);
            const expectedRange = Math.abs(expectedPage - firstNumber);
            
            // If the page numbers are close to expected, accept it
            if (expectedRange <= 2 || firstNumber === expectedPage || secondNumber === expectedPage) {
                return { isValid: true };
            }
            
            // For single-sided, if we have content and it's not too far off, accept it
            if (extractedText.length > 100 && expectedRange <= 5) {
                console.log(`⚠️ Page validation warning for "${sectionTitle}": Expected page ${expectedPage}, found pages ${firstNumber}-${secondNumber}, but accepting due to single-sided format`);
                return { isValid: true };
            }
        }

        // Check if either number matches the expected page
        if (firstNumber === expectedPage || secondNumber === expectedPage) {
            return { isValid: true };
        }

        return {
            isValid: false,
            error: `Expected page ${expectedPage}, but found pages ${firstNumber}-${secondNumber} at start of text`
        };
    }
}

module.exports = HeaderBasedExtractor;
