const fs = require('fs').promises;
const path = require('path');

/**
 * Change Detector
 * Just compares PDF URLs - if URL changed, document was updated
 * Much simpler than complex metadata comparison
 */
class ChangeDetector {
    constructor() {
        this.metadataFile = path.join(__dirname, '..', '..', 'storage', 'metadata', 'latest-pdf-urls.json');
        this.ensureMetadataDir();
    }

    /**
     * Ensure metadata directory exists
     */
    async ensureMetadataDir() {
        try {
            const metadataDir = path.dirname(this.metadataFile);
            await fs.mkdir(metadataDir, { recursive: true });
        } catch (error) {
            console.error('❌ Failed to create metadata directory:', error.message);
            throw error;
        }
    }

    /**
     * Load stored PDF URLs
     * @returns {Promise<Object>} Stored PDF URLs by provider
     */
    async loadStoredUrls() {
        try {
            if (!await this.fileExists(this.metadataFile)) {
                console.log('📄 No existing PDF URLs file found, creating new one');
                return {};
            }

            const data = await fs.readFile(this.metadataFile, 'utf8');
            const storedUrls = JSON.parse(data);
            
            console.log(`📄 Loaded PDF URLs for ${Object.keys(storedUrls).length} providers`);
            return storedUrls;
        } catch (error) {
            console.error('❌ Failed to load stored PDF URLs:', error.message);
            return {};
        }
    }

    /**
     * Save PDF URLs with atomic write to prevent corruption
     * @param {Object} urls - PDF URLs by provider
     */
    async saveUrls(urls) {
        try {
            const data = JSON.stringify(urls, null, 2);
            
            // Atomic write: write to temp file first, then rename
            const tempFile = this.metadataFile + '.tmp';
            const backupFile = this.metadataFile + '.backup';
            
            // Create backup of existing file if it exists
            if (await this.fileExists(this.metadataFile)) {
                try {
                    await fs.copyFile(this.metadataFile, backupFile);
                } catch (backupError) {
                    console.warn('⚠️  Could not create backup file:', backupError.message);
                }
            }
            
            // Write to temp file first
            await fs.writeFile(tempFile, data, 'utf8');
            
            // Atomic rename (this is atomic on most filesystems)
            await fs.rename(tempFile, this.metadataFile);
            
            console.log(`💾 PDF URLs saved atomically for ${Object.keys(urls).length} providers`);
        } catch (error) {
            console.error('❌ Failed to save PDF URLs:', error.message);
            
            // Try to restore from backup if available
            const backupFile = this.metadataFile + '.backup';
            if (await this.fileExists(backupFile)) {
                try {
                    await fs.copyFile(backupFile, this.metadataFile);
                    console.log('🔄 Restored from backup file');
                } catch (restoreError) {
                    console.error('❌ Failed to restore from backup:', restoreError.message);
                }
            }
            
            throw error;
        }
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
     * Detect changes by comparing PDF URLs
     * @param {Array} crawlResults - Array of crawl results with PDF URLs
     * @returns {Promise<Object>} Change detection results
     */
    async detectChanges(crawlResults) {
        try {
            console.log(`🔍 Detecting changes by comparing PDF URLs for ${crawlResults.length} providers...`);
            
            const storedUrls = await this.loadStoredUrls();
            const providersWithChanges = [];
            const unchangedProviders = [];
            const errorProviders = [];

            for (const result of crawlResults) {
                if (!result.success) {
                    errorProviders.push({
                        provider: result.provider,
                        error: result.error
                    });
                    continue;
                }

                const provider = result.provider;
                
                let currentUrls = [];
                if (result.result.pdfs && Array.isArray(result.result.pdfs)) {
                    // Multiple PDFs (Orange case)
                    currentUrls = result.result.pdfs.map(pdf => pdf.pdfUrl);
                    console.log(`🔍 ${provider}: Found ${currentUrls.length} PDFs in result.pdfs array`);
                } else if (result.result.pdfUrl) {
                    // Single PDF (O2, Telekom case)
                    currentUrls = [result.result.pdfUrl];
                    console.log(`🔍 ${provider}: Found single PDF URL`);
                } else {
                    console.log(`🔍 ${provider}: No PDF URLs found in result`);
                }
                
                const storedUrl = storedUrls[provider];
                const storedUrlsArray = storedUrl ? (Array.isArray(storedUrl) ? storedUrl : [storedUrl]) : [];

                if (!storedUrl || storedUrlsArray.length === 0) {
                    // New provider - treat as change
                    providersWithChanges.push({
                        provider,
                        changeType: 'new',
                        changes: [`New provider detected with ${currentUrls.length} PDF(s)`],
                        crawlResult: result.result,
                        oldUrls: [],
                        newUrls: currentUrls
                    });
                    console.log(`🆕 New provider detected: ${provider} (${currentUrls.length} PDFs)`);
                } else {
                    // Compare URLs to detect changes
                    const hasChanges = this.comparePdfUrls(currentUrls, storedUrlsArray);
                    
                    if (hasChanges) {
                        const changes = this.getChangeDetails(currentUrls, storedUrlsArray);
                        const changedPdfs = this.getChangedPdfs(currentUrls, storedUrlsArray);
                        
                        providersWithChanges.push({
                            provider,
                            changeType: 'updated',
                            changes: changes,
                            crawlResult: result.result,
                            oldUrls: storedUrlsArray,
                            newUrls: currentUrls,
                            changedPdfs: changedPdfs  // Add specific PDF change info
                        });
                        console.log(`📝 Changes detected for ${provider}: ${changes.length} change(s)`);
                        console.log(`   📄 Changed PDFs: ${changedPdfs.changed.length}`);
                        console.log(`   📄 Unchanged PDFs: ${changedPdfs.unchanged.length}`);
                    } else {
                        // No changes
                        unchangedProviders.push({
                            provider,
                            pdfUrls: currentUrls
                        });
                        console.log(`✅ No changes detected for ${provider} (${currentUrls.length} PDFs)`);
                    }
                }
            }

            const summary = {
                totalProviders: crawlResults.length,
                providersWithChanges: providersWithChanges.length,
                unchangedProviders: unchangedProviders.length,
                errorProviders: errorProviders.length,
                changeRate: crawlResults.length > 0 ? (providersWithChanges.length / crawlResults.length) * 100 : 0
            };

            console.log(`\n📊 Simple Change Detection Summary:`);
            console.log(`   📝 Providers with changes: ${summary.providersWithChanges}`);
            console.log(`   ✅ Unchanged providers: ${summary.unchangedProviders}`);
            console.log(`   ❌ Error providers: ${summary.errorProviders}`);
            console.log(`   📈 Change rate: ${summary.changeRate.toFixed(1)}%`);

            return {
                summary,
                providersWithChanges,
                unchangedProviders,
                errorProviders
            };
        } catch (error) {
            console.error('❌ Failed to detect changes:', error.message);
            throw error;
        }
    }

    /**
     * Compare two arrays of PDF URLs to detect changes
     * @param {Array} currentUrls - Current PDF URLs
     * @param {Array} storedUrls - Stored PDF URLs
     * @returns {boolean} True if changes detected
     */
    comparePdfUrls(currentUrls, storedUrls) {
        if (currentUrls.length !== storedUrls.length) {
            return true; // Different number of PDFs
        }
        
        // Sort both arrays for comparison
        const sortedCurrent = [...currentUrls].sort();
        const sortedStored = [...storedUrls].sort();
        
        // Compare each URL
        for (let i = 0; i < sortedCurrent.length; i++) {
            if (sortedCurrent[i] !== sortedStored[i]) {
                return true; // At least one URL changed
            }
        }
        
        return false; // No changes
    }

    /**
     * Get specific PDFs that changed (for selective processing)
     * @param {Array} currentUrls - Current PDF URLs
     * @param {Array} storedUrls - Stored PDF URLs
     * @returns {Object} Object with changed, new, and removed PDFs
     */
    getChangedPdfs(currentUrls, storedUrls) {
        const changedPdfs = {
            new: [],      // PDFs that are new
            removed: [],  // PDFs that were removed
            changed: [],  // PDFs that changed URLs
            unchanged: [] // PDFs that didn't change
        };

        changedPdfs.new = currentUrls.filter(url => !storedUrls.includes(url));
        
        changedPdfs.removed = storedUrls.filter(url => !currentUrls.includes(url));
        
        changedPdfs.unchanged = currentUrls.filter(url => storedUrls.includes(url));
        
        // For PDFs that changed URLs, we need to map them
        // For now, treat all new PDFs as "changed" for processing purposes
        changedPdfs.changed = [...changedPdfs.new];
        
        return changedPdfs;
    }

    /**
     * Get detailed change information
     * @param {Array} currentUrls - Current PDF URLs
     * @param {Array} storedUrls - Stored PDF URLs
     * @returns {Array} Array of change descriptions
     */
    getChangeDetails(currentUrls, storedUrls) {
        const changes = [];
        
        if (currentUrls.length !== storedUrls.length) {
            changes.push(`Number of PDFs changed: ${storedUrls.length} → ${currentUrls.length}`);
        }
        
        const newUrls = currentUrls.filter(url => !storedUrls.includes(url));
        if (newUrls.length > 0) {
            changes.push(`New PDFs: ${newUrls.length} added`);
        }
        
        const removedUrls = storedUrls.filter(url => !currentUrls.includes(url));
        if (removedUrls.length > 0) {
            changes.push(`Removed PDFs: ${removedUrls.length} removed`);
        }
        
        if (currentUrls.length === storedUrls.length && newUrls.length > 0) {
            changes.push(`PDF URLs updated: ${newUrls.length} changed`);
        }
        
        return changes;
    }

    /**
     * Update stored URLs for providers with changes
     * @param {Array} providersWithChanges - Array of providers with changes
     */
    async updateStoredUrls(providersWithChanges) {
        try {
            if (providersWithChanges.length === 0) {
                console.log('📝 No changes to update in stored URLs');
                return;
            }

            console.log(`💾 Updating stored URLs for ${providersWithChanges.length} providers with changes...`);
            
            const storedUrls = await this.loadStoredUrls();
            
            for (const providerData of providersWithChanges) {
                const { provider, newUrls } = providerData;
                // Always store array for Orange (multiple PDFs), single value for others
                if (provider.toLowerCase().includes('orange')) {
                    storedUrls[provider] = newUrls;
                    console.log(`✅ Updated stored URLs for ${provider} (${newUrls.length} PDFs)`);
                } else {
                    // For single PDF providers (O2, Telekom)
                    storedUrls[provider] = newUrls.length === 1 ? newUrls[0] : newUrls;
                    console.log(`✅ Updated stored URLs for ${provider} (${newUrls.length} PDFs)`);
                }
            }
            
            await this.saveUrls(storedUrls);
            console.log(`✅ Stored URLs updated for ${providersWithChanges.length} providers`);
        } catch (error) {
            console.error('❌ Failed to update stored URLs:', error.message);
            throw error;
        }
    }

    /**
     * Get summary of stored URLs
     * @returns {Promise<Object>} Summary of stored URLs
     */
    async getUrlSummary() {
        try {
            const storedUrls = await this.loadStoredUrls();
            
            // Count total PDFs across all providers
            let totalPdfs = 0;
            const providerDetails = {};
            
            for (const [provider, urls] of Object.entries(storedUrls)) {
                const urlArray = Array.isArray(urls) ? urls : [urls];
                totalPdfs += urlArray.length;
                providerDetails[provider] = {
                    pdfCount: urlArray.length,
                    urls: urlArray
                };
            }
            
            return {
                totalProviders: Object.keys(storedUrls).length,
                totalPdfs: totalPdfs,
                providers: Object.keys(storedUrls),
                providerDetails: providerDetails,
                urls: storedUrls,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Failed to get URL summary:', error.message);
            return {
                totalProviders: 0,
                totalPdfs: 0,
                providers: [],
                providerDetails: {},
                urls: {},
                lastUpdated: new Date().toISOString()
            };
        }
    }
}

module.exports = ChangeDetector;
