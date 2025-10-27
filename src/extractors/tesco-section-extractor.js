const PageExtractor = require('../utils/page-extractor');
const { loadConfig } = require('../utils/config-loader');

/**
 * Tesco Mobile Section Extractor for Tesco Mobile Slovakia
 * Uses simple start-to-end extraction (no ToC needed)
 */
class TescoSectionExtractor {
    constructor() {
        this.pageExtractor = new PageExtractor();
    }

    /**
     * Extract full content from Tesco Mobile PDF using simple start-to-end method
     * @param {string} pdfPath - Path to PDF file
     * @returns {Promise<Object>} Extracted content with metadata
     */
    async extractFullContent(pdfPath) {
        console.log(`Starting Tesco Mobile simple full-text extraction...`);
        console.log(`PDF Path: ${pdfPath}`);

        try {
            const config = loadConfig();
            const tescoConfig = config.providers?.tesco;
            
            if (!tescoConfig) {
                throw new Error('Tesco Mobile configuration not found');
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
            console.error(`❌ Error in Tesco Mobile content extraction: ${error.message}`);
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
            const tescoConfig = config.providers?.tesco;
            
            if (!tescoConfig) {
                return [];
            }

            return Object.entries(tescoConfig.sections || {}).map(([key, title]) => ({ key, title }));
        } catch (error) {
            console.warn('Failed to load Tesco Mobile section configuration:', error.message);
            return [];
        }
    }

    /**
     * Get Tesco Mobile configuration
     * @returns {Object} Tesco Mobile configuration
     */
    getTescoConfiguration() {
        try {
            const config = loadConfig();
            return config.providers?.tesco || {};
        } catch (error) {
            console.warn('Failed to load Tesco Mobile configuration:', error.message);
            return {};
        }
    }
}

module.exports = TescoSectionExtractor;
