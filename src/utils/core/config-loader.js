const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { getDefaultConfigPath } = require('./paths');

/**
 * Load scraper configuration from JSON file and environment variables
 * @param {string} configPath - Path to configuration file
 * @returns {Object} Configuration object
 */
function loadConfig(configPath = null) {
    const configFile = configPath || getDefaultConfigPath();
    
    try {
        const configData = fs.readFileSync(configFile, 'utf8');
        const config = JSON.parse(configData);
        
        // Override with environment variables if they exist
        if (process.env.EMAIL_SMTP_HOST) {
            config.email.smtp.host = process.env.EMAIL_SMTP_HOST;
        }
        if (process.env.EMAIL_SMTP_PORT) {
            config.email.smtp.port = parseInt(process.env.EMAIL_SMTP_PORT);
        }
        if (process.env.EMAIL_SMTP_SECURE) {
            config.email.smtp.secure = process.env.EMAIL_SMTP_SECURE === 'true';
        }
        if (process.env.EMAIL_SMTP_USER) {
            config.email.smtp.auth.user = process.env.EMAIL_SMTP_USER;
        }
        if (process.env.EMAIL_SMTP_PASS) {
            config.email.smtp.auth.pass = process.env.EMAIL_SMTP_PASS;
        }
        if (process.env.EMAIL_FROM) {
            config.email.from = process.env.EMAIL_FROM;
        }
        if (process.env.EMAIL_TO) {
            config.email.to = process.env.EMAIL_TO.split(',').map(email => email.trim());
        }
        if (process.env.DEBUG) {
            config.debug = process.env.DEBUG === 'true';
        }
        
        return config;
    } catch (error) {
        throw new Error(`Failed to load configuration: ${error.message}`);
    }
}


module.exports = {
    loadConfig
};


