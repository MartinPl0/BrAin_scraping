const fs = require('fs').promises;
const path = require('path');

/**
 * Base JSON Merger
 * Provides shared functionality for merging consolidated JSON data across providers
 * Subclasses implement provider-specific identity key strategies and selective detection
 */
class BaseJsonMerger {
    /**
     * Constructor - subclasses should call super() and set this.providerName
     * @param {string} providerName - Provider name (e.g., 'tesco', 'orange', 'fourka')
     */
    constructor(providerName) {
        if (new.target === BaseJsonMerger) {
            throw new Error('BaseJsonMerger is abstract and cannot be instantiated directly');
        }
        this.providerName = providerName;
        const { getStorageDir } = require('../../core/paths');
        this.storageDir = getStorageDir(providerName);
    }

    /**
     * Find the most recent consolidated JSON file
     * @returns {Promise<string|null>} Path to the most recent file or null if none found
     */
    async findLatestConsolidatedFile() {
        try {
            const files = await fs.readdir(this.storageDir);
            
            const fileName = this.getFileName();
            const consolidatedFiles = files.filter(file => file === fileName);
            
            if (consolidatedFiles.length === 0) {
                console.log(`📄 No existing consolidated ${this.getProviderDisplayName()} JSON found`);
                return null;
            }
            
            const latestFile = consolidatedFiles[0];
            const latestPath = path.join(this.storageDir, latestFile);
            
            console.log(`📄 Found latest consolidated file: ${latestFile}`);
            return latestPath;
            
        } catch (error) {
            console.warn(`⚠️  Could not find existing consolidated file: ${error.message}`);
            return null;
        }
    }

    /**
     * Load existing consolidated JSON data
     * @returns {Promise<Object|null>} Existing consolidated data or null if not found
     */
    async loadExistingData() {
        try {
            const latestFile = await this.findLatestConsolidatedFile();
            if (!latestFile) {
                return null;
            }
            
            const fileContent = await fs.readFile(latestFile, 'utf8');
            const existingData = JSON.parse(fileContent);
            
            console.log(`📊 Loaded existing data: ${existingData.totalPdfs || 0} PDFs`);
            return existingData;
            
        } catch (error) {
            console.warn(`⚠️  Could not load existing data: ${error.message}`);
            return null;
        }
    }

    /**
     * Merge new PDF data with existing consolidated data
     * Uses provider-specific identity key strategy
     * @param {Object} newData - New consolidated data from selective processing
     * @param {Object} existingData - Existing consolidated data
     * @returns {Object} Merged consolidated data
     */
    mergeConsolidatedData(newData, existingData) {
        console.log(`🔄 Merging ${this.getProviderDisplayName()} consolidated data...`);
        
        const mergedData = {
            provider: newData.provider,
            crawlDate: newData.crawlDate,
            lastChecked: newData.lastChecked,
            totalPdfs: 0,
            successfulPdfs: 0,
            failedPdfs: 0,
            pdfs: [],
            lastUpdate: newData.lastUpdate
        };

        // Use provider-specific identity key strategy
        const getIdentityKey = (pdf) => this.getIdentityKey(pdf);

        const newPdfKeys = new Set();
        if (newData.pdfs) {
            newData.pdfs.forEach(pdf => {
                newPdfKeys.add(getIdentityKey(pdf));
            });
        }

        // Build existing map by identity key
        const existingByKey = new Map();
        if (existingData && existingData.pdfs) {
            existingData.pdfs.forEach(pdf => {
                const key = getIdentityKey(pdf);
                if (!existingByKey.has(key)) {
                    existingByKey.set(key, pdf);
                }
            });
        }

        // Add/replace new PDFs
        if (newData.pdfs) {
            newData.pdfs.forEach(pdf => {
                const key = getIdentityKey(pdf);
                mergedData.pdfs.push(pdf);
                if (existingByKey.has(key)) {
                    console.log(`♻️  Replaced existing PDF by identity '${pdf.pdfType || pdf.cennikName || pdf.pdfUrl}' with new URL ${pdf.pdfUrl}`);
                } else {
                    console.log(`✅ Added new PDF: ${pdf.pdfType || pdf.cennikName || pdf.pdfUrl} (${pdf.pdfUrl})`);
                }
            });
        }

        // Preserve unchanged PDFs
        if (existingData && existingData.pdfs) {
            existingData.pdfs.forEach(pdf => {
                const key = getIdentityKey(pdf);
                if (!newPdfKeys.has(key)) {
                    mergedData.pdfs.push(pdf);
                    console.log(`📋 Preserved unchanged PDF: ${pdf.pdfType || pdf.cennikName || pdf.pdfUrl} (${pdf.pdfUrl})`);
                }
            });
        }

        // Update statistics
        mergedData.totalPdfs = mergedData.pdfs.length;
        mergedData.successfulPdfs = mergedData.pdfs.filter(pdf => !pdf.error).length;
        mergedData.failedPdfs = mergedData.pdfs.filter(pdf => pdf.error).length;

        console.log(`📊 Merged data summary:`);
        console.log(`   Total PDFs: ${mergedData.totalPdfs}`);
        console.log(`   Successful: ${mergedData.successfulPdfs}`);
        console.log(`   Failed: ${mergedData.failedPdfs}`);
        console.log(`   Updated: ${newPdfKeys.size}`);
        console.log(`   Preserved: ${mergedData.totalPdfs - newPdfKeys.size}`);

        return mergedData;
    }

    /**
     * Save merged consolidated data
     * Subclasses can override to add provider-specific functionality (e.g., debug files)
     * @param {Object} mergedData - Merged consolidated data
     * @returns {Promise<Object>} Save result information
     */
    async saveMergedData(mergedData) {
        try {
            const fileName = this.getFileName();
            const filePath = path.join(this.storageDir, fileName);
            
            // Ensure directory exists
            await fs.mkdir(this.storageDir, { recursive: true });
            
            await fs.writeFile(filePath, JSON.stringify(mergedData, null, '\t'));
            
            console.log(`💾 Merged data saved to: ${fileName}`);
            
            // Allow subclasses to add additional save operations (e.g., debug files)
            await this.afterSave(mergedData, filePath);
            
            return {
                filePath: fileName,
                fullPath: filePath,
                provider: this.providerName,
                totalPdfs: mergedData.totalPdfs,
                successfulPdfs: mergedData.successfulPdfs,
                failedPdfs: mergedData.failedPdfs
            };
            
        } catch (error) {
            console.error(`❌ Failed to save merged data: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process selective update for consolidated JSON
     * Uses provider-specific selective detection logic
     * @param {Object} newData - New consolidated data from selective processing
     * @returns {Promise<Object>} Final merged consolidated data
     */
    async processSelectiveUpdate(newData) {
        try {
            console.log(`🔄 Processing selective update for ${this.getProviderDisplayName()}...`);
            
            const isSelective = this.detectSelectiveProcessing(newData);
            
            if (!isSelective) {
                console.log(`📄 Full processing detected, no merging needed`);
                return await this.saveMergedData(newData);
            }
            
            const selectiveInfo = this.getSelectiveProcessingInfo(newData);
            console.log(`🎯 Selective processing detected: ${selectiveInfo.message}`);
            
            const existingData = await this.loadExistingData();
            
            if (!existingData) {
                console.log(`📄 No existing data found, saving new data as-is`);
                return await this.saveMergedData(newData);
            }
            
            // Merge the data
            const mergedData = this.mergeConsolidatedData(newData, existingData);
            
            const saveResult = await this.saveMergedData(mergedData);
            
            console.log(`✅ Selective update completed successfully`);
            
            return {
                ...saveResult,
                merged: true,
                updatedPdfs: selectiveInfo.updatedPdfs,
                preservedPdfs: mergedData.totalPdfs - selectiveInfo.updatedPdfs
            };
            
        } catch (error) {
            console.error(`❌ Failed to process selective update: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get statistics about the current consolidated data
     * @returns {Promise<Object>} Statistics about the consolidated data
     */
    async getDataStatistics() {
        try {
            const existingData = await this.loadExistingData();
            if (!existingData) {
                return {
                    hasData: false,
                    message: 'No consolidated data found'
                };
            }
            
            const stats = {
                hasData: true,
                totalPdfs: existingData.totalPdfs || 0,
                successfulPdfs: existingData.successfulPdfs || 0,
                failedPdfs: existingData.failedPdfs || 0,
                lastCrawlDate: existingData.crawlDate,
                pdfTypes: existingData.pdfs ? existingData.pdfs.map(pdf => pdf.pdfType) : []
            };
            
            // Add provider-specific stats
            const additionalStats = this.getAdditionalStatistics(existingData);
            return { ...stats, ...additionalStats };
            
        } catch (error) {
            console.error(`❌ Failed to get data statistics: ${error.message}`);
            return {
                hasData: false,
                error: error.message
            };
        }
    }

    // ==================== Abstract Methods - Must be implemented by subclasses ====================

    /**
     * Get identity key for a PDF (for merging)
     * @param {Object} pdf - PDF object
     * @returns {string} Identity key
     */
    getIdentityKey(pdf) {
        throw new Error('getIdentityKey() must be implemented by subclass');
    }

    /**
     * Get JSON file name for this provider
     * @returns {string} File name (e.g., 'tesco.json')
     */
    getFileName() {
        throw new Error('getFileName() must be implemented by subclass');
    }

    /**
     * Detect if this is a selective processing update
     * @param {Object} newData - New consolidated data
     * @returns {boolean} True if selective processing
     */
    detectSelectiveProcessing(newData) {
        throw new Error('detectSelectiveProcessing() must be implemented by subclass');
    }

    /**
     * Get selective processing information for logging
     * @param {Object} newData - New consolidated data
     * @returns {Object} Object with message and updatedPdfs count
     */
    getSelectiveProcessingInfo(newData) {
        throw new Error('getSelectiveProcessingInfo() must be implemented by subclass');
    }

    /**
     * Get provider display name for logging
     * @returns {string} Display name (e.g., 'Tesco Mobile')
     */
    getProviderDisplayName() {
        return this.providerName.charAt(0).toUpperCase() + this.providerName.slice(1);
    }

    /**
     * Hook for additional save operations (e.g., debug files)
     * Override in subclass if needed
     * @param {Object} mergedData - Merged consolidated data
     * @param {string} filePath - Path where main file was saved
     * @returns {Promise<void>}
     */
    async afterSave(mergedData, filePath) {
        // Default: no additional operations
    }

    /**
     * Get additional statistics specific to provider
     * Override in subclass if needed
     * @param {Object} existingData - Existing consolidated data
     * @returns {Object} Additional statistics
     */
    getAdditionalStatistics(existingData) {
        // Default: no additional stats
        return {};
    }
}

module.exports = BaseJsonMerger;

