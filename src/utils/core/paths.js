const path = require('path');

/**
 * Centralized Path Utilities
 * Provides consistent path calculations across the application
 * All paths are relative to the project root
 */

// Get the project root directory (two levels up from utils/core/)
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

/**
 * Get storage directory for a specific provider's datasets
 * @param {string} providerName - Provider name (e.g., 'tesco', 'orange', 'fourka')
 * @returns {string} Path to provider's dataset storage directory
 */
function getStorageDir(providerName) {
    return path.join(PROJECT_ROOT, 'storage', 'datasets', providerName);
}

/**
 * Get metadata directory
 * @returns {string} Path to metadata storage directory
 */
function getMetadataDir() {
    return path.join(PROJECT_ROOT, 'storage', 'metadata');
}

/**
 * Get temp directory
 * @returns {string} Path to temporary files directory
 */
function getTempDir() {
    return path.join(PROJECT_ROOT, 'temp');
}

/**
 * Get config directory
 * @returns {string} Path to configuration files directory
 */
function getConfigDir() {
    return path.join(PROJECT_ROOT, 'src', 'config');
}

/**
 * Get metadata file path for PDF URLs
 * @returns {string} Path to latest PDF URLs metadata file
 */
function getMetadataUrlFile() {
    return path.join(getMetadataDir(), 'latest-pdf-urls.json');
}

/**
 * Get metadata file path for PDF hashes
 * @returns {string} Path to latest PDF hashes metadata file
 */
function getMetadataHashFile() {
    return path.join(getMetadataDir(), 'latest-pdf-hashes.json');
}

/**
 * Get default config file path
 * @returns {string} Path to default scraper config file
 */
function getDefaultConfigPath() {
    return path.join(getConfigDir(), 'scraper-config.json');
}

module.exports = {
    PROJECT_ROOT,
    getStorageDir,
    getMetadataDir,
    getTempDir,
    getConfigDir,
    getMetadataUrlFile,
    getMetadataHashFile,
    getDefaultConfigPath
};

