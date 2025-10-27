/**
 * Data Validator for PDF Extraction Results
 * Validates extracted data to prevent garbage data from reaching production
 */
class DataValidator {
    constructor() {
        this.validationErrors = [];
        this.validationWarnings = [];
    }

    /**
     * Validate extracted PDF data
     * @param {Object} data - Extracted data to validate
     * @param {string} provider - Provider name (o2, telekom, orange)
     * @returns {Object} Validation result with errors and warnings
     */
    validateExtractedData(data, provider) {
        this.validationErrors = [];
        this.validationWarnings = [];

        console.log(`🔍 Validating extracted data for ${provider}...`);

        this.validateBasicStructure(data, provider);

        switch (provider.toLowerCase()) {
            case 'o2':
                this.validateO2Data(data);
                break;
            case 'telekom':
                this.validateTelekomData(data);
                break;
            case 'orange':
                this.validateOrangeData(data);
                break;
            default:
                console.warn(`⚠️  Unknown provider: ${provider}, skipping provider-specific validation`);
        }

        this.validatePrices(data);

        this.validateSummary(data);

        const result = {
            isValid: this.validationErrors.length === 0,
            errors: this.validationErrors,
            warnings: this.validationWarnings,
            errorCount: this.validationErrors.length,
            warningCount: this.validationWarnings.length
        };

        console.log(`📊 Validation complete: ${result.errorCount} errors, ${result.warningCount} warnings`);
        
        if (result.errorCount > 0) {
            console.error(`❌ Validation failed with ${result.errorCount} errors:`);
            result.errors.forEach((error, index) => {
                console.error(`   ${index + 1}. ${error}`);
            });
        }

        if (result.warningCount > 0) {
            console.warn(`⚠️  ${result.warningCount} warnings:`);
            result.warnings.forEach((warning, index) => {
                console.warn(`   ${index + 1}. ${warning}`);
            });
        }

        return result;
    }

    /**
     * Validate basic data structure
     * @param {Object} data - Data to validate
     * @param {string} provider - Provider name
     */
    validateBasicStructure(data, provider) {
        if (!data) {
            this.validationErrors.push('Data is null or undefined');
            return;
        }

        // Check required fields
        const requiredFields = ['cennikName', 'pdfUrl', 'data'];
        requiredFields.forEach(field => {
            if (!data[field]) {
                this.validationErrors.push(`Missing required field: ${field}`);
            }
        });

        // Check data structure
        if (data.data) {
            if (!data.data.sections) {
                this.validationErrors.push('Missing data.sections field');
            }
            if (!data.data.summary) {
                this.validationErrors.push('Missing data.summary field');
            }
        }

        // Check metadata
        if (data.metadata) {
            if (!data.metadata.totalSections || data.metadata.totalSections < 0) {
                this.validationWarnings.push('Invalid or missing totalSections in metadata');
            }
            if (!data.metadata.totalCharacters || data.metadata.totalCharacters < 0) {
                this.validationWarnings.push('Invalid or missing totalCharacters in metadata');
            }
        }
    }

    /**
     * Validate O2-specific data
     * @param {Object} data - O2 data to validate
     */
    validateO2Data(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;
        const expectedSections = [
            'programs.volnost',
            'programs.pausal', 
            'internetServices.vzduchom',
            'internetServices.optikou',
            'tvServices',
            'programs.fer',
            'dátovka',
            'internationalCalls',
            'roaming',
            'payments'
        ];

        expectedSections.forEach(sectionKey => {
            if (!sections[sectionKey]) {
                this.validationWarnings.push(`Missing expected O2 section: ${sectionKey}`);
            }
        });

        // Validate O2-specific price ranges
        this.validateO2Prices(sections);
    }

    /**
     * Validate Telekom-specific data
     * @param {Object} data - Telekom data to validate
     */
    validateTelekomData(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;
        const expectedSections = [
            'plans.telekom',
            'internet.mobilny',
            'internet.magio',
            'plans.predplatenka',
            'services.doplnkove',
            'services.roaming'
        ];

        expectedSections.forEach(sectionKey => {
            if (!sections[sectionKey]) {
                this.validationWarnings.push(`Missing expected Telekom section: ${sectionKey}`);
            }
        });

        // Validate Telekom-specific price ranges
        this.validateTelekomPrices(sections);
    }

    /**
     * Validate Orange-specific data
     * @param {Object} data - Orange data to validate
     */
    validateOrangeData(data) {
        if (!data.data || !data.data.sections) return;

        // Orange uses fullContent instead of specific sections
        if (!data.data.sections.fullContent) {
            this.validationWarnings.push('Missing Orange fullContent section');
        } else {
            const contentLength = data.data.sections.fullContent.length;
            if (contentLength < 100) {
                this.validationWarnings.push(`Orange content seems too short: ${contentLength} characters`);
            }
            if (contentLength > 1000000) {
                this.validationWarnings.push(`Orange content seems too long: ${contentLength} characters`);
            }
        }
    }

    /**
     * Validate O2-specific prices
     * @param {Object} sections - O2 sections to validate
     */
    validateO2Prices(sections) {
        // Validate π Voľnosť prices
        if (sections['programs.volnost']) {
            this.validatePriceRange(sections['programs.volnost'], 'O2 π Voľnosť', 0, 100);
        }

        // Validate π Paušál prices
        if (sections['programs.pausal']) {
            this.validatePriceRange(sections['programs.pausal'], 'O2 π Paušál', 0, 200);
        }

        // Validate internet services
        if (sections['internetServices.vzduchom']) {
            this.validatePriceRange(sections['internetServices.vzduchom'], 'O2 Internet vzduchom', 0, 100);
        }
    }

    /**
     * Validate Telekom-specific prices
     * @param {Object} sections - Telekom sections to validate
     */
    validateTelekomPrices(sections) {
        // Validate Telekom plans
        if (sections['plans.telekom']) {
            this.validatePriceRange(sections['plans.telekom'], 'Telekom plans', 0, 300);
        }

        // Validate mobile internet
        if (sections['internet.mobilny']) {
            this.validatePriceRange(sections['internet.mobilny'], 'Telekom mobile internet', 0, 150);
        }
    }

    /**
     * Validate price ranges in a section
     * @param {Object} section - Section to validate
     * @param {string} sectionName - Name of section for error messages
     * @param {number} minPrice - Minimum expected price
     * @param {number} maxPrice - Maximum expected price
     */
    validatePriceRange(section, sectionName, minPrice, maxPrice) {
        if (!section || typeof section !== 'object') return;

        // Look for price patterns in the section content
        const content = JSON.stringify(section);
        const pricePattern = /(\d+(?:[.,]\d{1,2})?)\s*(?:€|EUR|euro)/gi;
        const matches = content.match(pricePattern);

        if (matches) {
            matches.forEach(match => {
                const priceStr = match.replace(/[€EUR\s]/gi, '').replace(',', '.');
                const price = parseFloat(priceStr);
                
                if (!isNaN(price)) {
                    if (price < minPrice) {
                        this.validationWarnings.push(`${sectionName}: Price ${price}€ seems too low (expected ${minPrice}+)`);
                    }
                    if (price > maxPrice) {
                        this.validationWarnings.push(`${sectionName}: Price ${price}€ seems too high (expected ${maxPrice}-)`);
                    }
                    if (price < 0) {
                        this.validationErrors.push(`${sectionName}: Negative price detected: ${price}€`);
                    }
                }
            });
        }
    }

    /**
     * Validate prices across all data
     * @param {Object} data - Data to validate
     */
    validatePrices(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;
        
        // Look for common price patterns and validate them
        Object.keys(sections).forEach(sectionKey => {
            const section = sections[sectionKey];
            if (section && typeof section === 'object') {
                this.validatePriceRange(section, sectionKey, 0, 1000); // General price validation
            }
        });
    }

    /**
     * Validate summary data
     * @param {Object} data - Data to validate
     */
    validateSummary(data) {
        if (!data.data || !data.data.summary) return;

        const summary = data.data.summary;

        // Validate summary fields
        if (summary.totalSections !== undefined) {
            if (summary.totalSections < 0) {
                this.validationErrors.push('totalSections cannot be negative');
            }
            if (summary.totalSections > 100) {
                this.validationWarnings.push(`totalSections seems high: ${summary.totalSections}`);
            }
        }

        if (summary.totalCharacters !== undefined) {
            if (summary.totalCharacters < 0) {
                this.validationErrors.push('totalCharacters cannot be negative');
            }
            if (summary.totalCharacters < 100) {
                this.validationWarnings.push(`totalCharacters seems low: ${summary.totalCharacters}`);
            }
            if (summary.totalCharacters > 10000000) {
                this.validationWarnings.push(`totalCharacters seems high: ${summary.totalCharacters}`);
            }
        }

        if (summary.successfulExtractions !== undefined && summary.failedExtractions !== undefined) {
            const total = summary.successfulExtractions + summary.failedExtractions;
            if (summary.totalSections !== undefined && total !== summary.totalSections) {
                this.validationWarnings.push(`Extraction counts don't match total sections: ${total} vs ${summary.totalSections}`);
            }
        }
    }

    /**
     * Get validation summary for logging
     * @param {Object} validationResult - Result from validateExtractedData
     * @returns {string} Summary string
     */
    getValidationSummary(validationResult) {
        if (validationResult.isValid) {
            return `✅ Data validation passed (${validationResult.warningCount} warnings)`;
        } else {
            return `❌ Data validation failed (${validationResult.errorCount} errors, ${validationResult.warningCount} warnings)`;
        }
    }
}

module.exports = DataValidator;
