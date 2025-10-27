/**
 * Text Extractor for PDF ToC
 * Extracts raw text from Table of Contents page
 */
class PageExtractor {
    constructor() {
        // Simple ToC text extraction
    }


    /**
     * Extract text from Table of Contents page
     * @param {string} pdfPath - Path to PDF file
     * @returns {Promise<string>} ToC text
     */
    async extractTocText(pdfPath) {
        console.log('Extracting Table of Contents from page 2...');
        
        try {
            const pdf = require('pdf.js-extract');
            const pdfExtract = new pdf.PDFExtract();
            
            const data = await new Promise((resolve, reject) => {
                pdfExtract.extract(pdfPath, {
                    normalizeWhitespace: false,
                    disableCombineTextItems: true
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            const tocPageIndex = 1; // Page 2 in PDF is index 1
            const page = data.pages[tocPageIndex];
            
            if (!page) {
                throw new Error(`ToC page not found in PDF`);
            }
            
            let pageText = '';
            page.content.forEach((item, index) => {
                if (item.str) {
                    pageText += item.str;
                    if (index < page.content.length - 1) {
                        const nextItem = page.content[index + 1];
                        if (nextItem && nextItem.y && item.y && Math.abs(nextItem.y - item.y) > 5) {
                            pageText += '\n';
                        } else {
                            pageText += ' ';
                        }
                    }
                }
            });
            
            console.log(`Extracted ToC text (${pageText.length} characters)`);
            return pageText.trim();
            
        } catch (error) {
            console.error(`❌ Error extracting ToC text:`, error.message);
            throw error;
        }
    }

    /**
     * Extract full text from entire PDF
     * @param {string} pdfPath - Path to PDF file
     * @returns {Promise<string>} Full PDF text
     */
    async extractFullText(pdfPath) {
        console.log('Extracting full text from PDF...');
        
        try {
            const pdf = require('pdf.js-extract');
            const pdfExtract = new pdf.PDFExtract();
            
            const data = await new Promise((resolve, reject) => {
                pdfExtract.extract(pdfPath, {
                    normalizeWhitespace: false,
                    disableCombineTextItems: true
                }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            let fullText = '';
            
            // Extract text from all pages
            data.pages.forEach((page, pageIndex) => {
                console.log(`Processing page ${pageIndex + 1}...`);
                
                page.content.forEach((item, index) => {
                    if (item.str) {
                        fullText += item.str;
                        if (index < page.content.length - 1) {
                            const nextItem = page.content[index + 1];
                            if (nextItem && nextItem.y && item.y && Math.abs(nextItem.y - item.y) > 5) {
                                fullText += '\n';
                            } else {
                                fullText += ' ';
                            }
                        }
                    }
                });
                
                // Add page break between pages
                if (pageIndex < data.pages.length - 1) {
                    fullText += '\n\n';
                }
            });
            
            console.log(`Extracted full text (${fullText.length} characters) from ${data.pages.length} pages`);
            return fullText.trim();
            
        } catch (error) {
            console.error(`❌ Error extracting full text:`, error.message);
            throw error;
        }
    }

}

module.exports = PageExtractor;
