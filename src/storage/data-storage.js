const fs = require('fs').promises;
const path = require('path');
const { loadConfig } = require('../utils/core/config-loader');

/**
 * Data Storage Manager
 * Handles saving extracted data to storage/datasets/{provider}/ directory
 * Follows the same pattern as JSON mergers:
 * - Always saves to {provider}.json (single source of truth)
 * - When debug=true, also saves numbered files (000000001.json, etc.)
 */
class DataStorage {
    constructor() {
        this.baseStorageDir = path.join(__dirname, '..', '..', 'storage', 'datasets');
    }

    /**
     * Save dataset to provider-specific directory
     * @param {Array} data - Array of data objects to save
     * @param {string} backupFile - Optional backup file name
     * @param {string} provider - Provider name (o2, telekom, etc.)
     * @returns {Promise<Object>} Save result information
     */
    async saveToDataset(data, backupFile = null, provider = null) {
        try {
            if (!provider) {
                throw new Error('Provider name is required');
            }

            const providerDir = path.join(this.baseStorageDir, provider);
            const fileName = `${provider}.json`;
            const filePath = path.join(providerDir, fileName);

            // Ensure directory exists
            await fs.mkdir(providerDir, { recursive: true });

            // Prepare data for saving
            let dataToSave;
            if (Array.isArray(data) && data.length === 1) {
                // Single data object
                dataToSave = data[0];
            } else if (Array.isArray(data)) {
                // Multiple data objects - create consolidated structure
                dataToSave = {
                    provider: provider,
                    crawlDate: new Date().toISOString(),
                    lastChecked: new Date().toISOString(),
                    totalPdfs: data.length,
                    successfulPdfs: data.filter(item => !item.error).length,
                    failedPdfs: data.filter(item => item.error).length,
                    pdfs: data,
                    lastUpdate: {
                        updatedPdfs: data.length,
                        updatedPdfUrls: data.map(item => item.pdfUrl).filter(url => url),
                        updateType: 'full'
                    }
                };
            } else {
                // Single data object
                dataToSave = data;
            }

            // Save main file (single source of truth)
            await fs.writeFile(filePath, JSON.stringify(dataToSave, null, '\t'));
            console.log(`💾 Data saved to: ${fileName}`);

            // Check if debug mode is enabled
            const config = loadConfig();
            let debugFileName = null;
            
            if (config.debug === true) {
                debugFileName = await this.generateDebugFileName(providerDir);
                const debugFilePath = path.join(providerDir, debugFileName);
                
                await fs.writeFile(debugFilePath, JSON.stringify(dataToSave, null, '\t'));
                console.log(`🐛 Debug file created: ${debugFileName}`);
            }

            return {
                filePath: fileName,
                fullPath: filePath,
                provider: provider,
                debugFile: debugFileName,
                totalPdfs: dataToSave.totalPdfs || (Array.isArray(data) ? data.length : 1),
                successfulPdfs: dataToSave.successfulPdfs || (Array.isArray(data) ? data.filter(item => !item.error).length : 1),
                failedPdfs: dataToSave.failedPdfs || (Array.isArray(data) ? data.filter(item => item.error).length : 0)
            };

        } catch (error) {
            console.error(`❌ Failed to save dataset: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate debug file name with sequential numbering
     * @param {string} providerDir - Provider directory path
     * @returns {Promise<string>} Debug file name
     */
    async generateDebugFileName(providerDir) {
        let fileNumber = 1;
        let numberedFileName;
        let numberedFilePath;
        
        do {
            numberedFileName = `${String(fileNumber).padStart(9, '0')}.json`;
            numberedFilePath = path.join(providerDir, numberedFileName);
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
     * Load existing dataset for a provider
     * @param {string} provider - Provider name
     * @returns {Promise<Object|null>} Existing data or null if not found
     */
    async loadDataset(provider) {
        try {
            const providerDir = path.join(this.baseStorageDir, provider);
            const fileName = `${provider}.json`;
            const filePath = path.join(providerDir, fileName);

            if (!(await this.fileExists(filePath))) {
                return null;
            }

            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);

        } catch (error) {
            console.error(`❌ Failed to load dataset for ${provider}: ${error.message}`);
            return null;
        }
    }

    /**
     * Update only the lastChecked timestamp in an existing dataset file
     * @param {string} provider - Provider name
     * @param {string} timestampIso - ISO timestamp to set; defaults to now
     */
    async updateLastChecked(provider, timestampIso = null) {
        try {
            const providerDir = path.join(this.baseStorageDir, provider);
            const fileName = `${provider}.json`;
            const filePath = path.join(providerDir, fileName);

            if (!(await this.fileExists(filePath))) {
                return false;
            }

            const raw = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(raw);

            const ts = timestampIso || new Date().toISOString();
            data.lastChecked = ts;

            await fs.writeFile(filePath, JSON.stringify(data, null, '\t'));
            return true;
        } catch (error) {
            console.error(`❌ Failed to update lastChecked for ${provider}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get storage directory for a provider
     * @param {string} provider - Provider name
     * @returns {string} Storage directory path
     */
    getProviderStorageDir(provider) {
        return path.join(this.baseStorageDir, provider);
    }
}

module.exports = DataStorage;
