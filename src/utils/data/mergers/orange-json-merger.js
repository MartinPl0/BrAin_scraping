const BaseJsonMerger = require('./base-json-merger');

/**
 * Orange JSON Merger
 * Handles merging of Orange consolidated JSON data to preserve unchanged PDFs
 * when only some PDFs are updated during selective processing
 */
class OrangeJsonMerger extends BaseJsonMerger {
    constructor() {
        super('orange');
    }

    /**
     * Get identity key for a PDF (prefer pdfType, fallback to cennikName, else url)
     * @param {Object} pdf - PDF object
     * @returns {string} Identity key
     */
    getIdentityKey(pdf) {
        if (pdf && pdf.pdfType) {
            return pdf.pdfType.trim().toLowerCase();
        }
        if (pdf?.cennikName) {
            return pdf.cennikName.trim().toLowerCase();
        }
        return pdf?.pdfUrl || '';
    }

    /**
     * Get JSON file name for this provider
     * @returns {string} File name
     */
    getFileName() {
        return 'orange.json';
    }

    /**
     * Get provider display name for logging
     * @returns {string} Display name
     */
    getProviderDisplayName() {
        return 'Orange';
    }

    /**
     * Detect if this is a selective processing update
     * @param {Object} newData - New consolidated data
     * @returns {boolean} True if selective processing
     */
    detectSelectiveProcessing(newData) {
        return newData.selectiveProcessing && newData.selectiveProcessing.enabled;
    }

    /**
     * Get selective processing information for logging
     * @param {Object} newData - New consolidated data
     * @returns {Object} Object with message and updatedPdfs count
     */
    getSelectiveProcessingInfo(newData) {
        const processedCount = newData.selectiveProcessing?.processedCount || 0;
        const totalAvailable = newData.selectiveProcessing?.totalAvailable || 0;
        return {
            message: `${processedCount}/${totalAvailable} PDFs`,
            updatedPdfs: processedCount
        };
    }

    /**
     * Get additional statistics specific to provider
     * @param {Object} existingData - Existing consolidated data
     * @returns {Object} Additional statistics
     */
    getAdditionalStatistics(existingData) {
        return {
            selectiveProcessing: existingData.selectiveProcessing
        };
    }
}

module.exports = OrangeJsonMerger;
