const fs = require('fs').promises;
const path = require('path');

/**
 * Data Service for reading and processing provider JSON files
 */
class DataService {
    constructor(config) {
        this.config = config;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Read and parse JSON file with retry logic
     */
    async readJsonFile(filePath, maxAttempts = 3) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const fullPath = path.resolve(filePath);
                const data = await fs.readFile(fullPath, 'utf8');
                return JSON.parse(data);
            } catch (error) {
                console.warn(`Attempt ${attempt}/${maxAttempts} failed to read ${filePath}:`, error.message);
                
                if (attempt === maxAttempts) {
                    throw new Error(`Failed to read ${filePath} after ${maxAttempts} attempts: ${error.message}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, this.config.retry.delayMs));
            }
        }
    }

    /**
     * Extract title and rawText from PDF data
     */
    extractPdfData(pdf) {
        const title = pdf.cennikName || pdf.pdfType || 'Unknown Document';
        
        if (!pdf.rawText || pdf.rawText.trim().length === 0) {
            return null;
        }

        return {
            title: title.trim(),
            rawText: pdf.rawText.trim()
        };
    }

    /**
     * Process provider data and extract relevant fields
     */
    processProviderData(data) {
        if (!data || !data.pdfs || !Array.isArray(data.pdfs)) {
            return [];
        }

        return data.pdfs
            .map(pdf => this.extractPdfData(pdf))
            .filter(item => item !== null);
    }

    /**
     * Get cached data or fetch fresh data
     */
    async getCachedData(providerKey) {
        const cached = this.cache.get(providerKey);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }

        const providerConfig = this.config.providers[providerKey];
        if (!providerConfig) {
            throw new Error(`Unknown provider: ${providerKey}`);
        }

        try {
            const rawData = await this.readJsonFile(providerConfig.filePath);
            const processedData = this.processProviderData(rawData);

            this.cache.set(providerKey, {
                data: processedData,
                timestamp: now
            });

            return processedData;
        } catch (error) {
            console.error(`Failed to load data for ${providerKey}:`, error.message);
            return [];
        }
    }

    /**
     * Get data for a specific provider
     */
    async getProviderData(providerKey) {
        try {
            const data = await this.getCachedData(providerKey);
            const providerConfig = this.config.providers[providerKey];
            
            return {
                provider: providerConfig.name,
                data: data
            };
        } catch (error) {
            console.error(`Error getting data for ${providerKey}:`, error.message);
            return {
                provider: providerKey,
                data: [],
                error: error.message
            };
        }
    }

    /**
     * Get data for all providers
     */
    async getAllProvidersData() {
        const providerKeys = Object.keys(this.config.providers);
        const results = [];

        for (const providerKey of providerKeys) {
            try {
                const providerData = await this.getProviderData(providerKey);
                results.push(providerData);
            } catch (error) {
                console.error(`Failed to get data for ${providerKey}:`, error.message);
                results.push({
                    provider: providerKey,
                    data: [],
                    error: error.message
                });
            }
        }

        return {
            providers: results,
            totalProviders: providerKeys.length,
            successfulProviders: results.filter(r => !r.error).length,
            failedProviders: results.filter(r => r.error).length
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache status
     */
    getCacheStatus() {
        const now = Date.now();
        const status = {};

        for (const [key, value] of this.cache.entries()) {
            status[key] = {
                cached: true,
                age: now - value.timestamp,
                dataCount: value.data.length
            };
        }

        return status;
    }
}

module.exports = DataService;
