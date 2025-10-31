const BaseJsonMerger = require('./base-json-merger');
const fs = require('fs').promises;
const path = require('path');
const { loadConfig } = require('../../core/config-loader');

/**
 * FourKa JSON Merger
 * Handles merging of 4ka consolidated JSON data to preserve unchanged PDFs
 * when only some PDFs are updated during selective processing
 */
class FourKaJsonMerger extends BaseJsonMerger {
    constructor() {
        super('fourka');
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
        return 'fourka.json';
    }

    /**
     * Get provider display name for logging
     * @returns {string} Display name
     */
    getProviderDisplayName() {
        return '4ka';
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
     * Hook for additional save operations (debug files)
     * @param {Object} mergedData - Merged consolidated data
     * @param {string} filePath - Path where main file was saved
     * @returns {Promise<void>}
     */
    async afterSave(mergedData, filePath) {
        const config = loadConfig();
        if (config.debug === true) {
            const debugFileName = await this.generateDebugFileName();
            const debugFilePath = path.join(this.storageDir, debugFileName);
            
            await fs.writeFile(debugFilePath, JSON.stringify(mergedData, null, '\t'));
            console.log(`🐛 Debug file created: ${debugFileName}`);
        }
    }

    /**
     * Generate debug file name with sequential numbering (consistent with DataStorage)
     * @returns {Promise<string>} Debug file name
     */
    async generateDebugFileName() {
        let fileNumber = 1;
        let numberedFileName;
        let numberedFilePath;
        
        do {
            numberedFileName = `${String(fileNumber).padStart(9, '0')}.json`;
            numberedFilePath = path.join(this.storageDir, numberedFileName);
            fileNumber++;
        } while (await this.fileExists(numberedFilePath));
        
        return numberedFileName;
    }

    /**
     * Check if file exists
     * @param {string} filePath - Path to check
     * @returns {Promise<boolean>} True if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
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

module.exports = FourKaJsonMerger;
