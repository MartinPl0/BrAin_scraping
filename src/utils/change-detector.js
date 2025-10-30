const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

/**
 * Change Detector
 * Just compares PDF URLs - if URL changed, document was updated
 * Much simpler than complex metadata comparison
 */
class ChangeDetector {
    constructor() {
        this.metadataFile = path.join(__dirname, '..', '..', 'storage', 'metadata', 'latest-pdf-urls.json');
        this.hashMetadataFile = path.join(__dirname, '..', '..', 'storage', 'metadata', 'latest-pdf-hashes.json');
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
     * Calculate MD5 hash of PDF content
     * @param {string} pdfUrl - PDF URL to hash
     * @returns {Promise<string>} MD5 hash of PDF content
     */
    async calculatePdfHash(pdfUrl) {
        try {
            console.log(`🔍 Calculating hash for PDF: ${pdfUrl}`);
            const response = await axios.get(pdfUrl, { 
                responseType: 'arraybuffer',
                timeout: 30000 // 30 second timeout
            });
            
            const buffer = Buffer.from(response.data);
            const hash = crypto.createHash('md5').update(buffer).digest('hex');
            console.log(`✅ PDF hash calculated: ${hash.substring(0, 8)}...`);
            return hash;
        } catch (error) {
            console.error(`❌ Failed to calculate PDF hash for ${pdfUrl}:`, error.message);
            return null;
        }
    }

    /**
     * Compare PDF content hashes to detect changes
     * @param {Array} currentUrls - Current PDF URLs
     * @param {Array} storedUrls - Stored PDF URLs
     * @param {string} provider - Provider name
     * @returns {Promise<boolean>} True if content changed
     */
    async comparePdfContentHashes(currentUrls, storedUrls, provider) {
        try {
            // For now, just compare URLs (we'll add hash comparison later)
            // This is a simplified version - in production, you'd want to store and compare hashes
            const hasUrlChanges = this.comparePdfUrls(currentUrls, storedUrls);
            
            if (hasUrlChanges) {
                console.log(`🔍 ${provider}: URL changes detected, treating as content change`);
                // When URLs changed, compute current hashes to persist later
                const currentHashes = await this.computeHashesForUrls(currentUrls);
                return { hasChanges: true, hashes: currentHashes };
            }
            
            // Compare content hashes when URLs are the same
            const storedHashesAll = await this.loadStoredHashes();
            const providerStoredHashes = storedHashesAll[provider] || {};
            const currentHashes = await this.computeHashesForUrls(currentUrls);

            let contentChanged = false;
            for (const url of currentUrls) {
                const newHash = currentHashes[url];
                const oldHash = providerStoredHashes[url];
                if (!newHash || !oldHash || newHash !== oldHash) {
                    contentChanged = true;
                    break;
                }
            }

            if (contentChanged) {
                console.log(`📝 ${provider}: Content hash difference detected with identical URLs`);
                return { hasChanges: true, hashes: currentHashes };
            }

            console.log(`✅ ${provider}: URLs and content hashes unchanged`);
            return { hasChanges: false, hashes: currentHashes };
            
        } catch (error) {
            console.error(`❌ Error comparing content hashes for ${provider}:`, error.message);
            // If we can't compare, assume there are changes to be safe
            const currentHashes = await this.computeHashesForUrls(currentUrls).catch(() => ({}));
            return { hasChanges: true, hashes: currentHashes };
        }
    }

    /**
     * Compute MD5 hashes for a set of URLs
     * @param {Array<string>} urls
     * @returns {Promise<Object>} Map of url -> hash
     */
    async computeHashesForUrls(urls) {
        const result = {};
        for (const url of urls) {
            const hash = await this.calculatePdfHash(url);
            if (hash) {
                result[url] = hash;
            }
        }
        return result;
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
     * Load stored content hashes
     * @returns {Promise<Object>} Stored hashes: { provider: { url: hash } }
     */
    async loadStoredHashes() {
        try {
            if (!await this.fileExists(this.hashMetadataFile)) {
                return {};
            }
            const data = await fs.readFile(this.hashMetadataFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ Failed to load stored PDF hashes:', error.message);
            return {};
        }
    }

    /**
     * Save content hashes with atomic write
     * @param {Object} hashes - { provider: { url: hash } }
     */
    async saveHashes(hashes) {
        try {
            const data = JSON.stringify(hashes, null, 2);
            const tempFile = this.hashMetadataFile + '.tmp';
            const backupFile = this.hashMetadataFile + '.backup';

            if (await this.fileExists(this.hashMetadataFile)) {
                try {
                    await fs.copyFile(this.hashMetadataFile, backupFile);
                } catch (backupError) {
                    console.warn('⚠️  Could not create hash backup file:', backupError.message);
                }
            }

            await fs.writeFile(tempFile, data, 'utf8');
            await fs.rename(tempFile, this.hashMetadataFile);
            console.log('💾 PDF hashes saved atomically');
        } catch (error) {
            console.error('❌ Failed to save PDF hashes:', error.message);
            const backupFile = this.hashMetadataFile + '.backup';
            if (await this.fileExists(backupFile)) {
                try {
                    await fs.copyFile(backupFile, this.hashMetadataFile);
                    console.log('🔄 Restored hashes from backup file');
                } catch (restoreError) {
                    console.error('❌ Failed to restore hashes from backup:', restoreError.message);
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
                if (result.error) {
                    errorProviders.push({
                        provider: result.provider,
                        error: result.error
                    });
                    continue;
                }

                const provider = result.provider;
                
                let currentUrls = [];
                if (result.pdfs && Array.isArray(result.pdfs)) {
                    // Multiple PDFs (Orange, RAD, Okayfon case)
                    currentUrls = result.pdfs.map(pdf => pdf.pdfUrl);
                    console.log(`🔍 ${provider}: Found ${currentUrls.length} PDFs in result.pdfs array`);
                } else if (result.result && result.result.pdfs && Array.isArray(result.result.pdfs)) {
                    // Multiple PDFs (legacy structure)
                    currentUrls = result.result.pdfs.map(pdf => pdf.pdfUrl);
                    console.log(`🔍 ${provider}: Found ${currentUrls.length} PDFs in result.result.pdfs array`);
                } else if (result.result && result.result.pdfUrl) {
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
                    // For providers without date-based URLs (like okayfon), use content hash comparison
                    if (provider === 'okayfon') {
                        console.log(`🔍 Using content hash comparison for ${provider}...`);
                        const contentResult = await this.comparePdfContentHashes(currentUrls, storedUrlsArray, provider);
                        
                        if (contentResult.hasChanges) {
                            providersWithChanges.push({
                                provider,
                                changeType: 'content_updated',
                                changes: [`PDF content changed for ${provider}`],
                                crawlResult: result,
                                oldUrls: storedUrlsArray,
                                newUrls: currentUrls,
                                hashes: contentResult.hashes
                            });
                            console.log(`📝 Content changes detected for ${provider}`);
                        } else {
                            unchangedProviders.push({
                                provider,
                                reason: 'Content unchanged'
                            });
                            console.log(`✅ No content changes for ${provider}`);
                        }
                    } else {
                        // Compare URLs to detect changes (for date-based providers)
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
            const storedHashes = await this.loadStoredHashes();
            
            for (const providerData of providersWithChanges) {
                const { provider, newUrls } = providerData;
                // Store as array for multiple PDFs, single value for one PDF
                if (newUrls.length > 1) {
                    storedUrls[provider] = newUrls;
                    console.log(`✅ Updated stored URLs for ${provider} (${newUrls.length} PDFs) - stored as array`);
                } else {
                    storedUrls[provider] = newUrls[0];
                    console.log(`✅ Updated stored URLs for ${provider} (${newUrls.length} PDFs) - stored as single value`);
                }

                // Also persist hashes if provided (used for okayfon content comparison)
                if (providerData.hashes && Object.keys(providerData.hashes).length > 0) {
                    storedHashes[provider] = providerData.hashes;
                    console.log(`🔒 Stored content hashes for ${provider} (${Object.keys(providerData.hashes).length} PDFs)`);
                }
            }
            
            await this.saveUrls(storedUrls);
            await this.saveHashes(storedHashes);
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
