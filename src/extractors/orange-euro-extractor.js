const pdf = require('pdf.js-extract');

/**
 * Orange Euro Symbol Based Extractor
 * Extracts content from pages containing € symbols
 */
class OrangeEuroExtractor {
    constructor() {
        this.pdfExtract = new pdf.PDFExtract();
    }

    /**
     * Extract content from PDF using euro symbol detection
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<Object>} Extracted content organized by pages with € symbols
     */
    async extractContent(filePath) {
        try {
            console.log('🔍 Extracting Orange PDF content using euro symbol detection...');
            
            return new Promise((resolve, reject) => {
                this.pdfExtract.extract(filePath, {}, (err, data) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    const result = {
                        totalPages: data.pages.length,
                        pagesWithEuro: [],
                        totalContent: '',
                        extractionStats: {
                            totalPages: data.pages.length,
                            pagesWithEuro: 0,
                            extractedCharacters: 0,  // Characters from pages with €
                            totalCharactersInPdf: 0  // Total characters from ALL pages
                        }
                    };

                    data.pages.forEach((page, pageIndex) => {
                        const pageText = this.extractTextFromPage(page);
                        const hasEuro = pageText.includes('€');
                        
                        result.extractionStats.totalCharactersInPdf += pageText.length;
                        
                        if (hasEuro) {
                            console.log(`💰 Page ${pageIndex + 1} contains € symbols`);
                            
                            // Clean content around € symbols
                            const cleanedContent = this.cleanContentAroundEuro(pageText);
                            
                            result.pagesWithEuro.push({
                                pageNumber: pageIndex + 1,
                                originalContent: pageText,
                                cleanedContent: cleanedContent,
                                euroCount: (pageText.match(/€/g) || []).length,
                                characterCount: cleanedContent.length
                            });
                            
                            result.totalContent += cleanedContent + '\n\n';
                            result.extractionStats.pagesWithEuro++;
                            result.extractionStats.extractedCharacters += cleanedContent.length;
                        }
                    });

                    console.log(`✅ Orange extraction complete: ${result.extractionStats.pagesWithEuro} pages with € symbols`);
                    resolve(result);
                });
            });
        } catch (error) {
            console.error('❌ Error extracting Orange PDF:', error.message);
            throw error;
        }
    }

    /**
     * Extract text from a single page
     * @param {Object} page - Page data from PDF extract
     * @returns {string} Extracted text
     */
    extractTextFromPage(page) {
        let text = '';
        page.content.forEach(item => {
            if (item.str) {
                text += item.str + ' ';
            }
        });
        return text;
    }

    /**
     * Clean content around € symbols
     * Removes long text blocks that don't contain € symbols
     * @param {string} content - Original page content
     * @returns {string} Cleaned content
     */
    cleanContentAroundEuro(content) {
        if (!content.includes('€')) {
            return '';
        }

        // Split content into lines
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const cleanedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Keep lines that contain €
            if (line.includes('€')) {
                cleanedLines.push(line);
                continue;
            }

            // For lines without €, check if they're part of a pricing context
            // Look for patterns like numbers, prices, or service names
            const isPricingContext = this.isPricingContext(line, lines, i);
            
            if (isPricingContext) {
                cleanedLines.push(line);
            }
            // Skip long text blocks without € that are likely not pricing-related
            else if (line.length > 100 && !this.containsPricingKeywords(line)) {
                // Skip this line as it's likely non-pricing content
                continue;
            }
            else if (line.length <= 50) {
                // Keep short lines as they might be headers or labels
                cleanedLines.push(line);
            }
        }

        return cleanedLines.join('\n');
    }

    /**
     * Check if a line is part of pricing context
     * @param {string} line - Current line
     * @param {Array} allLines - All lines in the page
     * @param {number} currentIndex - Current line index
     * @returns {boolean} True if line is pricing context
     */
    isPricingContext(line, allLines, currentIndex) {
        // Check if nearby lines contain €
        const nearbyRange = 3;
        for (let i = Math.max(0, currentIndex - nearbyRange); i <= Math.min(allLines.length - 1, currentIndex + nearbyRange); i++) {
            if (allLines[i].includes('€')) {
                return true;
            }
        }

        // Check for pricing-related patterns
        const pricingPatterns = [
            /\d+[,.]?\d*\s*€/,  // Numbers with €
            /EUR|euro/i,        // Euro currency
            /cena|price|cost/i, // Price keywords
            /\d+\s*(min|hod|mesiac|rok)/i, // Time periods with numbers
            /služba|service/i   // Service keywords
        ];

        return pricingPatterns.some(pattern => pattern.test(line));
    }

    /**
     * Check if line contains pricing keywords
     * @param {string} line - Line to check
     * @returns {boolean} True if contains pricing keywords
     */
    containsPricingKeywords(line) {
        const keywords = [
            'cena', 'price', 'cost', 'tarif', 'tariff',
            'služba', 'service', 'balík', 'package',
            'internet', 'mobil', 'telefón', 'TV',
            '€', 'EUR', 'euro', 'platba', 'payment'
        ];

        const lowerLine = line.toLowerCase();
        return keywords.some(keyword => lowerLine.includes(keyword));
    }
}

module.exports = OrangeEuroExtractor;
