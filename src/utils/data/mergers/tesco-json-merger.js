const BaseJsonMerger = require('./base-json-merger');

/**
 * Tesco Mobile JSON Merger
 * Handles merging of Tesco Mobile consolidated JSON data to preserve unchanged PDFs
 * when only some PDFs are updated during selective processing
 */
class TescoJsonMerger extends BaseJsonMerger {
    constructor() {
        super('tesco');
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
        return 'tesco.json';
    }

    /**
     * Get provider display name for logging
     * @returns {string} Display name
     */
    getProviderDisplayName() {
        return 'Tesco Mobile';
    }

    /**
     * Detect if this is a selective processing update
     * @param {Object} newData - New consolidated data
     * @returns {boolean} True if selective processing
     */
    detectSelectiveProcessing(newData) {
        return newData.lastUpdate && newData.lastUpdate.updateType === 'selective';
    }

    /**
     * Get selective processing information for logging
     * @param {Object} newData - New consolidated data
     * @returns {Object} Object with message and updatedPdfs count
     */
    getSelectiveProcessingInfo(newData) {
        const updatedPdfs = newData.lastUpdate?.updatedPdfs || 0;
        return {
            message: `${updatedPdfs} PDFs updated`,
            updatedPdfs: updatedPdfs
        };
    }

    /**
     * Get additional statistics specific to provider
     * @param {Object} existingData - Existing consolidated data
     * @returns {Object} Additional statistics
     */
    getAdditionalStatistics(existingData) {
        return {
            lastUpdate: existingData.lastUpdate
        };
    }
}

module.exports = TescoJsonMerger;
