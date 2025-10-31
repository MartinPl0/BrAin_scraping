const PdfDownloader = require('../utils/pdf/pdf-downloader');
const OrangeSectionExtractor = require('../extractors/orange-section-extractor');
const OrangeEuroExtractor = require('../extractors/orange-euro-extractor');
const DataStorage = require('../storage/data-storage');
const DataValidator = require('../utils/data/data-validator');

/**
 * Orange PDF Scraper for Orange Slovakia price lists
 * Uses simple full-text extraction (no ToC needed)
 */
class OrangePdfScraper {
    constructor(errorMonitor = null) {
        this.pdfDownloader = new PdfDownloader();
        this.sectionExtractor = new OrangeSectionExtractor();
        this.errorMonitor = errorMonitor;
        this.euroExtractor = new OrangeEuroExtractor();
        this.dataStorage = new DataStorage();
        this.dataValidator = new DataValidator();
    }

    /**
     * Scrape Orange PDF price list using simple full-text extraction
     * @param {string} pdfUrl - PDF file URL
     * @param {string} cennikName - Price list name
     * @param {string} localPdfPath - Optional local PDF path
     * @param {boolean} skipStorage - Skip saving to storage (for consolidated mode)
     * @returns {Promise<Object>} Scraping results
     */
    async scrapePdf(pdfUrl, cennikName = null, localPdfPath = null, skipStorage = false) {
        try {
            if (!cennikName) {
                const { loadConfig } = require('../utils/core/config-loader');
                const config = loadConfig();
                cennikName = config.providers?.orange?.displayName || 'Orange Cenník služieb';
            }
            
            console.log(`Starting Orange PDF simple extraction for: ${cennikName}`);
            console.log(`PDF URL: ${pdfUrl}`);
            
            let pdfFilePath = localPdfPath;
            
            if (!localPdfPath) {
                console.log(`Downloading PDF from: ${pdfUrl}`);
                const result = await this.pdfDownloader.downloadAndExtractPdf(pdfUrl, true);
                pdfFilePath = result.filePath;
                console.log(`PDF downloaded to: ${pdfFilePath}`);
            } else {
                console.log(`Using local PDF: ${localPdfPath}`);
                pdfFilePath = localPdfPath;
            }
            
            const { loadConfig } = require('../utils/core/config-loader');
            const config = loadConfig();
            const extractionMethod = config.providers?.orange?.extractionMethod || 'simple-full-text';
            
            let extractionResult;
            
            if (extractionMethod === 'euro-symbol-based') {
                console.log(`\nStarting euro symbol based extraction...`);
                extractionResult = await this.euroExtractor.extractContent(pdfFilePath);
                
                const euroResult = extractionResult;
                extractionResult = {
                    sections: {
                        fullContent: euroResult.totalContent
                    },
                    summary: {
                        totalSections: 1,
                        successfulExtractions: 1,
                        failedExtractions: 0,
                        totalCharacters: euroResult.extractionStats.extractedCharacters,
                        originalCharacters: euroResult.extractionStats.totalCharactersInPdf
                    },
                    extractionInfo: {
                        extractionMethod: 'euro-symbol-based',
                        pagesWithEuro: euroResult.extractionStats.pagesWithEuro,
                        totalPages: euroResult.extractionStats.totalPages
                    }
                };
            } else {
                console.log(`\nStarting simple full-text extraction...`);
                extractionResult = await this.sectionExtractor.extractFullContent(pdfFilePath);
            }
            
            
            console.log(`\nExtraction results:`);
            console.log(`   Total sections: ${extractionResult.summary.totalSections}`);
            console.log(`   Successful extractions: ${extractionResult.summary.successfulExtractions}`);
            console.log(`   Failed extractions: ${extractionResult.summary.failedExtractions}`);
            console.log(`   Extracted characters: ${extractionResult.summary.totalCharacters}`);
            console.log(`   Original characters: ${extractionResult.summary.originalCharacters}`);
            
            const summary = extractionResult.summary || { 
                totalSections: 0, 
                successfulExtractions: 0, 
                failedExtractions: 0, 
                totalCharacters: 0,
                originalCharacters: 0
            };
            const sections = extractionResult.sections || {};
            const extractionInfo = extractionResult.extractionInfo || {};
            
            // Extract rawText from fullContent for validator and crawler
            const rawText = sections.fullContent || '';
            
            const enrichedData = {
                cennikName: cennikName,
                pdfUrl: localPdfPath ? `LOCAL: ${localPdfPath}` : pdfUrl,
                rawText: rawText,
                data: {
                    sections: sections,
                    summary: summary,
                    extractionInfo: extractionInfo
                },
                scrapedAt: new Date().toISOString(),
                metadata: {
                    totalSections: summary.totalSections,
                    successfulExtractions: summary.successfulExtractions,
                    failedExtractions: summary.failedExtractions,
                    totalCharacters: summary.totalCharacters,
                    source: 'Orange PDF Euro Symbol Extractor',
                    isLocalFile: !!localPdfPath,
                    originalUrl: pdfUrl,
                    extractionMethod: 'euro-symbol-based'
                }
            };

            console.log(`\n🔍 Validating extracted Orange data...`);
            const validationResult = this.dataValidator.validateExtractedData(enrichedData, 'orange');
            console.log(this.dataValidator.getValidationSummary(validationResult));
            
            // Record validation warnings in ErrorMonitor
            if (this.errorMonitor && validationResult.warnings.length > 0) {
                validationResult.warnings.forEach(warning => {
                    this.errorMonitor.recordWarning({
                        provider: 'Orange Slovakia',
                        operation: 'data-validation',
                        message: warning,
                        context: {
                            pdfUrl: pdfUrl,
                            cennikName: cennikName,
                            validationType: 'extracted-data'
                        }
                    });
                });
            }

            // Record validation errors (if any pass through)
            if (this.errorMonitor && validationResult.errors.length > 0) {
                validationResult.errors.forEach(error => {
                    this.errorMonitor.recordError({
                        provider: 'Orange Slovakia',
                        operation: 'data-validation',
                        type: 'VALIDATION_ERROR',
                        message: error,
                        severity: 'error',
                        context: {
                            pdfUrl: pdfUrl,
                            cennikName: cennikName,
                            validationType: 'extracted-data'
                        }
                    });
                });
            }
            
            enrichedData.metadata.validation = {
                isValid: validationResult.isValid,
                errorCount: validationResult.errorCount,
                warningCount: validationResult.warningCount,
                errors: validationResult.errors,
                warnings: validationResult.warnings
            };

            if (!validationResult.isValid) {
                console.error(`❌ Critical validation errors detected. Data will not be saved.`);
                return {
                    success: false,
                    error: `Data validation failed: ${validationResult.errors.join(', ')}`,
                    cennikName: cennikName,
                    pdfUrl: pdfUrl,
                    validationResult: validationResult,
                    timestamp: new Date().toISOString()
                };
            }
            
            let storageInfo = null;
            
            if (!localPdfPath && pdfFilePath) {
                const fs = require('fs');
                try {
                    fs.unlinkSync(pdfFilePath);
                    console.log(`Cleaned up temp file: ${pdfFilePath}`);
                } catch (err) {
                    console.warn(`⚠️  Could not delete temp file: ${err.message}`);
                }
            }
            
            if (skipStorage) {
                return {
                    success: true,
                    cennikName: cennikName,
                    pdfUrl: pdfUrl,
                    data: enrichedData.data,
                    summary: enrichedData.data.summary,
                    extractionInfo: enrichedData.data.extractionInfo,
                    metadata: enrichedData.metadata,
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    success: true,
                    cennikName: cennikName,
                    pdfUrl: pdfUrl,
                    totalSections: extractionResult.summary.totalSections,
                    successfulExtractions: extractionResult.summary.successfulExtractions,
                    failedExtractions: extractionResult.summary.failedExtractions,
                    totalCharacters: extractionResult.summary.totalCharacters,
                    originalCharacters: extractionResult.summary.originalCharacters,
                    storage: storageInfo,
                    timestamp: new Date().toISOString()
                };
            }
            
        } catch (error) {
            console.error(`❌ Error in Orange PDF simple scraping: ${error.message}`);
            
            if (!localPdfPath && pdfFilePath) {
                const fs = require('fs');
                try {
                    fs.unlinkSync(pdfFilePath);
                    console.log(`Cleaned up temp file: ${pdfFilePath}`);
                } catch (err) {
                    console.warn(`⚠️  Could not delete temp file: ${err.message}`);
                }
            }
            
            return {
                success: false,
                error: error.message,
                cennikName: cennikName,
                pdfUrl: pdfUrl,
                timestamp: new Date().toISOString()
            };
        }
    }


    /**
     * Clean up temporary files
     */
    cleanup() {
        this.pdfDownloader.cleanup();
    }
}

module.exports = OrangePdfScraper;
