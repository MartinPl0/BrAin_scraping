const fs = require('fs').promises;
const path = require('path');

/**
 * Orange JSON Merger
 * Handles merging of Orange consolidated JSON data to preserve unchanged PDFs
 * when only some PDFs are updated during selective processing
 */
class OrangeJsonMerger {
    constructor() {
        this.storageDir = path.join(__dirname, '..', '..', '..', 'storage', 'datasets', 'orange');
    }

    /**
     * Find the most recent consolidated JSON file
     * @returns {Promise<string|null>} Path to the most recent file or null if none found
     */
    async findLatestConsolidatedFile() {
        try {
            const files = await fs.readdir(this.storageDir);
            
            const consolidatedFiles = files.filter(file => 
                file === 'orange.json'
            );
            
            if (consolidatedFiles.length === 0) {
                console.log('📄 No existing consolidated Orange JSON found');
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
     * @param {Object} newData - New consolidated data from selective processing
     * @param {Object} existingData - Existing consolidated data
     * @returns {Object} Merged consolidated data
     */
    mergeConsolidatedData(newData, existingData) {
        console.log(`🔄 Merging Orange consolidated data...`);
        
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

        // Identity key: prefer pdfType, fallback to cennikName, else url
        const getIdentityKey = (pdf) => (pdf && pdf.pdfType ? pdf.pdfType.trim().toLowerCase() : pdf?.cennikName?.trim().toLowerCase() || pdf?.pdfUrl);

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
                if (!existingByKey.has(key)) existingByKey.set(key, pdf);
            });
        }

        // Add/replace new
        if (newData.pdfs) {
            newData.pdfs.forEach(pdf => {
                const key = getIdentityKey(pdf);
                mergedData.pdfs.push(pdf);
                if (existingByKey.has(key)) {
                    console.log(`♻️  Replaced existing PDF by identity '${pdf.pdfType}' with new URL ${pdf.pdfUrl}`);
                } else {
                    console.log(`✅ Added new PDF: ${pdf.pdfType} (${pdf.pdfUrl})`);
                }
            });
        }

        // Preserve unchanged by identity
        if (existingData && existingData.pdfs) {
            existingData.pdfs.forEach(pdf => {
                const key = getIdentityKey(pdf);
                if (!newPdfKeys.has(key)) {
                    mergedData.pdfs.push(pdf);
                    console.log(`📋 Preserved unchanged PDF: ${pdf.pdfType} (${pdf.pdfUrl})`);
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
     * @param {Object} mergedData - Merged consolidated data
     * @returns {Promise<Object>} Save result information
     */
    async saveMergedData(mergedData) {
        try {
            const fileName = `orange.json`;
            const filePath = path.join(this.storageDir, fileName);
            
            await fs.writeFile(filePath, JSON.stringify(mergedData, null, '\t'));
            
            console.log(`💾 Merged data saved to: ${fileName}`);
            
            return {
                filePath: fileName,
                fullPath: filePath,
                provider: 'orange',
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
     * Process selective update for Orange consolidated JSON
     * @param {Object} newData - New consolidated data from selective processing
     * @returns {Promise<Object>} Final merged consolidated data
     */
    async processSelectiveUpdate(newData) {
        try {
            console.log(`🔄 Processing selective update for Orange...`);
            
            if (!newData.selectiveProcessing || !newData.selectiveProcessing.enabled) {
                console.log(`📄 Full processing detected, no merging needed`);
                return await this.saveMergedData(newData);
            }
            
            console.log(`🎯 Selective processing detected: ${newData.selectiveProcessing.processedCount}/${newData.selectiveProcessing.totalAvailable} PDFs`);
            
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
                updatedPdfs: newData.selectiveProcessing.processedCount,
                preservedPdfs: mergedData.totalPdfs - newData.selectiveProcessing.processedCount
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
            
            return {
                hasData: true,
                totalPdfs: existingData.totalPdfs || 0,
                successfulPdfs: existingData.successfulPdfs || 0,
                failedPdfs: existingData.failedPdfs || 0,
                lastCrawlDate: existingData.crawlDate,
                pdfTypes: existingData.pdfs ? existingData.pdfs.map(pdf => pdf.pdfType) : [],
                selectiveProcessing: existingData.selectiveProcessing
            };
            
        } catch (error) {
            console.error(`❌ Failed to get data statistics: ${error.message}`);
            return {
                hasData: false,
                error: error.message
            };
        }
    }
}

module.exports = OrangeJsonMerger;
