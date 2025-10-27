const fs = require('fs').promises;
const path = require('path');
const { loadConfig } = require('../config-loader');

/**
 * FourKa JSON Merger
 * Handles merging of 4ka consolidated JSON data to preserve unchanged PDFs
 * when only some PDFs are updated during selective processing
 */
class FourKaJsonMerger {
    constructor() {
        this.storageDir = path.join(__dirname, '..', '..', '..', 'storage', 'datasets', 'fourka');
    }

    /**
     * Find the most recent consolidated JSON file
     * @returns {Promise<string|null>} Path to the most recent file or null if none found
     */
    async findLatestConsolidatedFile() {
        try {
            const files = await fs.readdir(this.storageDir);
            
            const consolidatedFiles = files.filter(file => 
                file === 'fourka.json'
            );
            
            if (consolidatedFiles.length === 0) {
                console.log('📄 No existing consolidated 4ka JSON found');
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
        console.log(`🔄 Merging 4ka consolidated data...`);
        
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

        const existingPdfsMap = new Map();
        if (existingData && existingData.pdfs) {
            existingData.pdfs.forEach(pdf => {
                existingPdfsMap.set(pdf.pdfUrl, pdf);
            });
        }

        const newPdfUrls = new Set();
        if (newData.pdfs) {
            newData.pdfs.forEach(pdf => {
                newPdfUrls.add(pdf.pdfUrl);
                mergedData.pdfs.push(pdf);
                console.log(`✅ Added/Updated PDF: ${pdf.pdfType} (${pdf.pdfUrl})`);
            });
        }

        if (existingData && existingData.pdfs) {
            existingData.pdfs.forEach(pdf => {
                if (!newPdfUrls.has(pdf.pdfUrl)) {
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
        console.log(`   Updated: ${newPdfUrls.size}`);
        console.log(`   Preserved: ${mergedData.totalPdfs - newPdfUrls.size}`);

        return mergedData;
    }

    /**
     * Save merged consolidated data
     * @param {Object} mergedData - Merged consolidated data
     * @returns {Promise<Object>} Save result information
     */
    async saveMergedData(mergedData) {
        try {
            const fileName = `fourka.json`;
            const filePath = path.join(this.storageDir, fileName);
            
            // Ensure directory exists
            await fs.mkdir(this.storageDir, { recursive: true });
            
            await fs.writeFile(filePath, JSON.stringify(mergedData, null, '\t'));
            
            console.log(`💾 Merged data saved to: ${fileName}`);
            
            const config = loadConfig();
            if (config.debug === true) {
                const debugFileName = await this.generateDebugFileName();
                const debugFilePath = path.join(this.storageDir, debugFileName);
                
                await fs.writeFile(debugFilePath, JSON.stringify(mergedData, null, '\t'));
                console.log(`🐛 Debug file created: ${debugFileName}`);
            }
            
            return {
                filePath: fileName,
                fullPath: filePath,
                provider: 'fourka',
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
     * Generate debug file name with sequential numbering (consistent with DataStorage)
     * @returns {string} Debug file name
     */
    async generateDebugFileName() {
        const fs = require('fs').promises;
        const path = require('path');
        
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
            const fs = require('fs').promises;
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Process selective update for 4ka consolidated JSON
     * @param {Object} newData - New consolidated data from selective processing
     * @returns {Promise<Object>} Final merged consolidated data
     */
    async processSelectiveUpdate(newData) {
        try {
            console.log(`🔄 Processing consolidated update for 4ka...`);
            
            if (!newData.selectiveProcessing || !newData.selectiveProcessing.enabled) {
                console.log(`📄 Full processing detected, replacing all data`);
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
            
            console.log(`✅ Consolidated update completed successfully`);
            return {
                ...saveResult,
                merged: true,
                updatedPdfs: newData.selectiveProcessing.processedCount,
                preservedPdfs: mergedData.totalPdfs - newData.selectiveProcessing.processedCount
            };
            
        } catch (error) {
            console.error(`❌ Failed to process consolidated update: ${error.message}`);
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

module.exports = FourKaJsonMerger;
