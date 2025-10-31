/**
 * Data Validator for PDF Extraction Results
 * Validates extracted data to prevent garbage data from reaching production
 */

const VALIDATION_CONSTANTS = require('../core/validation-constants');

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
            case 'juro':
                // Juro uses euro-symbol-based extraction, similar to Orange
                this.validateOrangeData(data);
                break;
            case 'funfon':
                // Funfon uses ToC-based extraction with its own sections
                this.validateFunfonData(data);
                break;
            case 'fourka':
            case '4ka':
                this.validateFourkaData(data);
                break;
            case 'tesco':
                this.validateTescoData(data);
                break;
            case 'okayfon':
                this.validateOkayfonData(data);
                break;
            case 'rad':
                this.validateRadData(data);
                break;
            default:
                console.warn(`⚠️  Unknown provider: ${provider}, skipping provider-specific validation`);
        }

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
     * Detect extraction mode (ToC-based vs Simple)
     * @param {Object} data - Data to analyze
     * @returns {Object} Mode detection result with isTocMode and extractionMethod
     */
    detectExtractionMode(data) {
        // Check extractionMethod in multiple possible locations
        const extractionMethod = data.data?.extractionInfo?.extractionMethod 
            || data.data?.extractionInfo?.method
            || data.extractionInfo?.extractionMethod
            || data.extractionInfo?.method
            || data.summary?.extractionMethod
            || null;
        
        const isTocMode = extractionMethod === 'toc-guided-header';
        const hasDataWrapper = data.data && data.data.sections;
        const hasMultipleSections = hasDataWrapper 
            && Object.keys(data.data.sections).length > 1 
            && !data.data.sections.fullContent;
        
        // Determine mode: ToC if explicitly marked OR has multiple sections (not just fullContent)
        const shouldUseTocMode = isTocMode || (hasDataWrapper && hasMultipleSections);
        
        return {
            isTocMode: shouldUseTocMode,
            extractionMethod,
            hasDataWrapper,
            hasMultipleSections
        };
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

        // Check required fields (basic)
        const requiredFields = ['cennikName', 'pdfUrl'];
        requiredFields.forEach(field => {
            if (!data[field]) {
                this.validationErrors.push(`Missing required field: ${field}`);
            }
        });

        const modeInfo = this.detectExtractionMode(data);
        
        if (modeInfo.isTocMode) {
            this.validateTocModeStructure(data);
        } else {
            this.validateSimpleModeStructure(data);
        }

        this.validateLegacyMetadata(data);
    }

    /**
     * Validate ToC-based extraction mode structure
     * @param {Object} data - Data to validate
     */
    validateTocModeStructure(data) {
        if (!data.data || !data.data.sections) {
            this.validationErrors.push('Missing data.sections field');
            return;
        }

        if (!data.data.summary) {
            this.validationErrors.push('Missing data.summary field');
        }

        if (!data.data.extractionInfo) {
            this.validationWarnings.push('Missing data.extractionInfo field');
        }
        
        // Check for root-level duplicates (should not exist in ToC mode)
        if (data.summary && data.data.summary) {
            this.validationWarnings.push('Duplicate summary: found both data.summary and root summary (should only be in data)');
        }
        if (data.extractionInfo && data.data.extractionInfo) {
            this.validationWarnings.push('Duplicate extractionInfo: found both data.extractionInfo and root extractionInfo (should only be in data)');
        }
    }

    /**
     * Validate simple extraction mode structure
     * @param {Object} data - Data to validate
     */
    validateSimpleModeStructure(data) {
        // Note: During scraping, rawText/summary/extractionInfo may still be in data.* format
        // (crawler will move them to root level), so check both locations to avoid false warnings
        const hasRawText = data.rawText 
            || (data.data && data.data.sections && data.data.sections.fullContent);
        
        if (!hasRawText) {
            this.validationErrors.push('Missing rawText field (neither root-level nor data.sections.fullContent found)');
        }
        
        // Check for summary (root or data.summary - both acceptable during scraping)
        const hasSummary = data.summary || (data.data && data.data.summary);
        if (!hasSummary) {
            this.validationWarnings.push('Missing summary field (neither root-level nor data.summary found)');
        }
        
        // Check for extractionInfo (root or data.extractionInfo - both acceptable during scraping)
        const hasExtractionInfo = data.extractionInfo || (data.data && data.data.extractionInfo);
        if (!hasExtractionInfo) {
            this.validationWarnings.push('Missing extractionInfo field (neither root-level nor data.extractionInfo found)');
        }
        
        // Check for unnecessary data wrapper (should not exist in simple mode)
        // Exception: data.sections.fullContent is OK for simple mode (single PDF extraction)
        if (data.data && data.data.sections && !data.data.sections.fullContent) {
            const sectionKeys = Object.keys(data.data.sections);
            if (sectionKeys.length > 1) {
                this.validationWarnings.push('Unnecessary data wrapper in simple mode (no ToC sections)');
            }
        }
    }

    /**
     * Validate legacy metadata (kept for backward compatibility)
     * @param {Object} data - Data to validate
     */
    validateLegacyMetadata(data) {
        // Legacy metadata validation - kept for backward compatibility
        // Note: This is mostly deprecated but kept to catch edge cases
        if (!data.metadata) return;

        if (data.metadata.totalSections !== undefined && data.metadata.totalSections < 0) {
            this.validationWarnings.push('Invalid totalSections in metadata');
        }
        if (data.metadata.totalCharacters !== undefined && data.metadata.totalCharacters < 0) {
            this.validationWarnings.push('Invalid totalCharacters in metadata');
        }
    }

    /**
     * Validate expected sections exist
     * @param {Object} sections - Sections object to check
     * @param {Array<string>} expectedSections - List of expected section keys
     * @param {string} providerName - Provider name for error messages
     */
    validateExpectedSections(sections, expectedSections, providerName) {
        if (!sections) return;

        expectedSections.forEach(sectionKey => {
            if (!sections[sectionKey]) {
                this.validationWarnings.push(`Missing expected ${providerName} section: ${sectionKey}`);
            }
        });
    }

    /**
     * Validate content sections exist and meet minimum length requirements
     * @param {Object} sections - Sections object to check
     * @param {Array<string>} expectedContentTypes - List of expected content section keys
     * @param {string} providerName - Provider name for error messages
     * @param {number} minLength - Minimum content length threshold
     */
    validateContentSections(sections, expectedContentTypes, providerName, minLength = VALIDATION_CONSTANTS.CONTENT_LENGTH.MIN_SHORT) {
        if (!sections) return;

        let hasContent = false;
        expectedContentTypes.forEach(contentType => {
            const content = sections[contentType];
            if (content && typeof content === 'string' && content.length > minLength) {
                hasContent = true;
            }
        });

        // Fallback: accept section-based extraction where sections are objects with rawText
        if (!hasContent) {
            const richSectionExists = Object.values(sections).some(sec => {
                return sec 
                    && typeof sec === 'object' 
                    && typeof sec.rawText === 'string' 
                    && sec.rawText.length > VALIDATION_CONSTANTS.CONTENT_LENGTH.MIN_RICH;
            });
            
            if (!richSectionExists) {
                this.validationWarnings.push(`Missing expected ${providerName} content sections`);
            }
        }
    }

    /**
     * Validate content length for a specific section
     * @param {string|undefined} content - Content to validate
     * @param {string} sectionName - Name of section for error messages
     * @param {number} minLength - Minimum expected length
     */
    validateContentLength(content, sectionName, minLength = VALIDATION_CONSTANTS.CONTENT_LENGTH.MIN_STANDARD) {
        if (!content) return;

        const contentLength = typeof content === 'string' ? content.length : 0;
        if (contentLength < minLength) {
            this.validationWarnings.push(`${sectionName} content seems too short: ${contentLength} characters`);
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

        this.validateExpectedSections(sections, expectedSections, 'O2');
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

        this.validateExpectedSections(sections, expectedSections, 'Telekom');
    }

    /**
     * Validate Funfon-specific data
     * @param {Object} data - Funfon data to validate
     */
    validateFunfonData(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;
        const { loadConfig } = require('../core/config-loader');
        const config = loadConfig();
        const funfonSections = config.providers?.funfon?.sections || {};
        const expectedSections = Object.keys(funfonSections);

        this.validateExpectedSections(sections, expectedSections, 'Funfon');
    }

    /**
     * Validate Orange-specific data
     * @param {Object} data - Orange data to validate
     */
    validateOrangeData(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;

        // Orange uses fullContent instead of specific sections
        if (!sections.fullContent) {
            this.validationWarnings.push('Missing Orange fullContent section');
            return;
        }

        const contentLength = sections.fullContent.length;
        if (contentLength < VALIDATION_CONSTANTS.CONTENT_LENGTH.MIN_STANDARD) {
            this.validationWarnings.push(`Orange content seems too short: ${contentLength} characters`);
        }
        if (contentLength > VALIDATION_CONSTANTS.CONTENT_LENGTH.MAX_CONTENT) {
            this.validationWarnings.push(`Orange content seems too long: ${contentLength} characters`);
        }
    }

    /**
     * Validate Fourka-specific data
     * @param {Object} data - Fourka data to validate
     */
    validateFourkaData(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;
        
        // Fourka uses mixed extraction method, check for expected content
        const expectedContentTypes = ['fullContent', 'mobilnych_sluzieb', 'premiovych_cisel'];
        this.validateContentSections(sections, expectedContentTypes, 'Fourka');

        // Check for specific section content lengths
        this.validateContentLength(sections.mobilnych_sluzieb, 'Fourka mobile services');
        this.validateContentLength(
            sections.premiovych_cisel, 
            'Fourka premium numbers', 
            VALIDATION_CONSTANTS.CONTENT_LENGTH.MIN_SHORT
        );
    }

    /**
     * Validate Tesco-specific data
     * @param {Object} data - Tesco data to validate
     */
    validateTescoData(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;
        
        // Tesco uses euro-symbol-based extraction, check for expected content
        const expectedContentTypes = ['fullContent', 'topka', 'trio'];
        this.validateContentSections(sections, expectedContentTypes, 'Tesco');

        // Check for specific section content lengths
        this.validateContentLength(sections.topka, 'Tesco Topka');
        this.validateContentLength(sections.trio, 'Tesco Trio');
    }

    /**
     * Validate Okayfon-specific data
     * @param {Object} data - Okayfon data to validate
     */
    validateOkayfonData(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;
        
        // Okayfon uses euro-symbol-based extraction, check for expected content
        const expectedContentTypes = ['fullContent', 'datovych_balikov'];
        this.validateContentSections(sections, expectedContentTypes, 'Okayfon');

        // Check for data packages content
        this.validateContentLength(sections.datovych_balikov, 'Okayfon data packages');
    }

    /**
     * Validate RAD-specific data
     * @param {Object} data - RAD data to validate
     */
    validateRadData(data) {
        if (!data.data || !data.data.sections) return;

        const sections = data.data.sections;
        const expectedSections = [
            'radost',
            'datove_sluzby',
            'doplnkove_sluzby',
            'ostatne_volania',
            'roaming',
            'sluzby_zabavy'
        ];

        this.validateExpectedSections(sections, expectedSections, 'RAD');
    }

    /**
     * Validate summary data
     * @param {Object} data - Data to validate
     */
    validateSummary(data) {
        if (!data.data || !data.data.summary) return;

        const summary = data.data.summary;
        const { CONTENT_LENGTH, SUMMARY } = VALIDATION_CONSTANTS;

        // Validate summary fields
        if (summary.totalSections !== undefined) {
            if (summary.totalSections < 0) {
                this.validationErrors.push('totalSections cannot be negative');
            }
            if (summary.totalSections > SUMMARY.MAX_SECTIONS) {
                this.validationWarnings.push(`totalSections seems high: ${summary.totalSections}`);
            }
        }

        if (summary.totalCharacters !== undefined) {
            if (summary.totalCharacters < 0) {
                this.validationErrors.push('totalCharacters cannot be negative');
            }
            if (summary.totalCharacters < SUMMARY.MIN_CHARS_WARNING) {
                this.validationWarnings.push(`totalCharacters seems low: ${summary.totalCharacters}`);
            }
            if (summary.totalCharacters > CONTENT_LENGTH.MAX_TOTAL_CHARS) {
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

    /**
     * Check for validation failures that indicate silent failures
     * @param {Object} data - Extracted data
     * @param {string} provider - Provider name
     * @returns {Object|null} Failure information or null if no issues
     */
    detectSilentFailures(data, provider) {
        const failures = [];
        const { SILENT_FAILURE } = VALIDATION_CONSTANTS;

        // Check if data is missing critical fields
        if (!data || !data.data) {
            failures.push({
                type: 'MISSING_DATA',
                message: 'Data object is missing or incomplete',
                severity: 'error'
            });
            return { hasFailures: true, failures };
        }

        // Check if sections are empty
        if (!data.data.sections || Object.keys(data.data.sections).length === 0) {
            failures.push({
                type: 'EMPTY_SECTIONS',
                message: 'No sections extracted from PDF',
                severity: 'critical'
            });
        }

        // Check if extracted content is suspiciously small
        const totalChars = data.data.summary?.totalCharacters || 0;
        if (totalChars < SILENT_FAILURE.MIN_CONTENT_CHARS) {
            failures.push({
                type: 'INSUFFICIENT_CONTENT',
                message: `Extracted content is too small (${totalChars} characters) - possible extraction failure`,
                severity: 'critical'
            });
        }

        // Check if summary indicates failures
        const failedExtractions = data.data.summary?.failedExtractions || 0;
        const totalSections = data.data.summary?.totalSections || 0;
        if (totalSections > 0 && failedExtractions === totalSections) {
            failures.push({
                type: 'ALL_EXTRACTIONS_FAILED',
                message: `All ${totalSections} extractions failed`,
                severity: 'critical'
            });
        }

        if (failures.length > 0) {
            return { hasFailures: true, failures };
        }

        return null;
    }
}

module.exports = DataValidator;
