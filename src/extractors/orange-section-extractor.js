const PageExtractor = require('../utils/page-extractor');
const { loadConfig } = require('../utils/config-loader');

/**
 * Orange Section Extractor for Orange Slovakia
 * Uses simple start-to-end extraction (no ToC needed)
 */
class OrangeSectionExtractor {
    constructor() {
        this.pageExtractor = new PageExtractor();
    }

    /**
     * Extract full content from Orange PDF using simple start-to-end method
     * @param {string} pdfPath - Path to PDF file
     * @returns {Promise<Object>} Extracted content with metadata
     */
    async extractFullContent(pdfPath) {
        console.log(`Starting Orange simple full-text extraction...`);
        console.log(`PDF Path: ${pdfPath}`);

        try {
            const config = loadConfig();
            const orangeConfig = config.providers?.orange;
            
            if (!orangeConfig) {
                throw new Error('Orange configuration not found');
            }

            console.log('\nExtracting full text from PDF...');
            const fullText = await this.pageExtractor.extractFullText(pdfPath);
            console.log(`Full text extracted: ${fullText.length} characters`);

            const cleanedContent = this.cleanExtractedContent(fullText);

            const sections = {
                fullContent: {
                    rawText: cleanedContent
                }
            };

            const summary = {
                totalSections: 1,
                successfulExtractions: 1,
                failedExtractions: 0,
                totalCharacters: cleanedContent.length,
                originalCharacters: fullText.length
            };

            console.log(`\nExtraction Summary:`);
            console.log(`   Total sections: ${summary.totalSections}`);
            console.log(`   Successful extractions: ${summary.successfulExtractions}`);
            console.log(`   Failed extractions: ${summary.failedExtractions}`);
            console.log(`   Extracted characters: ${summary.totalCharacters}`);
            console.log(`   Original characters: ${summary.originalCharacters}`);

            return { 
                sections, 
                summary, 
                extractionInfo: {
                    extractionMethod: 'simple-full-text'
                }
            };

        } catch (error) {
            console.error(`❌ Error in Orange content extraction: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clean and normalize extracted content
     * @param {string} content - Raw extracted content
     * @returns {string} Cleaned content
     */
    cleanExtractedContent(content) {
        if (!content) return '';

        return content
            // Remove excessive whitespace
            .replace(/\s+/g, ' ')
            // Remove page numbers and headers that might be repeated
            .replace(/\d+\s*\n/g, '')
            .replace(/\n\s*\n/g, '\n')
            // Trim whitespace
            .trim();
    }


    /**
     * Get current section configuration
     * @returns {Array} Current section definitions
     */
    getSectionConfiguration() {
        try {
            const config = loadConfig();
            const orangeConfig = config.providers?.orange;
            
            if (!orangeConfig) {
                return [];
            }

            return Object.entries(orangeConfig.sections || {}).map(([key, title]) => ({ key, title }));
        } catch (error) {
            console.warn('Failed to load Orange section configuration:', error.message);
            return [];
        }
    }

    /**
     * Get Orange configuration
     * @returns {Object} Orange configuration
     */
    getOrangeConfiguration() {
        try {
            const config = loadConfig();
            return config.providers?.orange || {};
        } catch (error) {
            console.warn('Failed to load Orange configuration:', error.message);
            return {};
        }
    }
}

module.exports = OrangeSectionExtractor;
