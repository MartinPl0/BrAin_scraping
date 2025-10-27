const fs = require('fs');
const path = require('path');

/**
 * Load scraper configuration from JSON file
 * @param {string} configPath - Path to configuration file
 * @returns {Object} Configuration object
 */
function loadConfig(configPath = null) {
    const defaultPath = path.join(__dirname, '..', 'config', 'scraper-config.json');
    const configFile = configPath || defaultPath;
    
    try {
        const configData = fs.readFileSync(configFile, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
    }
}


module.exports = {
    loadConfig
};


