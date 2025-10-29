const PdfDownloader = require('../utils/pdf-downloader');
const OrangeEuroExtractor = require('../extractors/orange-euro-extractor');
const DataStorage = require('../storage/data-storage');
const DataValidator = require('../utils/data-validator');

/**
 * Okay fón PDF Scraper for Okay fón Slovakia price lists
 * Uses euro-symbol-based extraction
 */
class OkayfonPdfScraper {
    constructor(errorMonitor = null) {
        this.pdfDownloader = new PdfDownloader();
        this.euroExtractor = new OrangeEuroExtractor(); // Reuse Orange's euro extractor
        this.errorMonitor = errorMonitor;
        this.dataStorage = new DataStorage();
        this.dataValidator = new DataValidator();
    }

    /**
     * Scrape Okay fón PDF price list using euro-symbol-based extraction
     * @param {string} pdfUrl - PDF file URL
     * @param {string} cennikName - Price list name
     * @param {string} localPdfPath - Optional local PDF path
     * @param {boolean} skipStorage - Skip saving to storage (for consolidated mode)
     * @returns {Promise<Object>} Scraping results
     */
    async scrapePdf(pdfUrl, cennikName = null, localPdfPath = null, skipStorage = false) {
        try {
            if (!cennikName) {
                const { loadConfig } = require('../utils/config-loader');
                const config = loadConfig();
                cennikName = config.providers?.okayfon?.displayName || 'Okay fón Cenník dátových balíkov';
            }
            
            console.log(`Starting Okay fón PDF extraction for: ${cennikName}`);
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
            
            console.log(`\nStarting euro symbol based extraction...`);
            const euroResult = await this.euroExtractor.extractContent(pdfFilePath);
            
            const extractionResult = {
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
            
            const enrichedData = {
                cennikName: cennikName,
                pdfUrl: localPdfPath ? `LOCAL: ${localPdfPath}` : pdfUrl,
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
                    source: 'Okay fón PDF Section Extractor',
                    isLocalFile: !!localPdfPath,
                    originalUrl: pdfUrl,
                    extractionMethod: 'section-based'
                }
            };

            console.log(`\n🔍 Validating extracted Okay fón data...`);
            const validationResult = this.dataValidator.validateExtractedData(enrichedData, 'okayfon');
            console.log(this.dataValidator.getValidationSummary(validationResult));
            
            // Record validation warnings in ErrorMonitor
            if (this.errorMonitor && validationResult.warnings.length > 0) {
                validationResult.warnings.forEach(warning => {
                    this.errorMonitor.recordWarning({
                        provider: 'Okay fón',
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
                        provider: 'Okay fón',
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
            }
            
            storageInfo = await this.dataStorage.saveToDataset([enrichedData], null, 'okayfon');
            
            return {
                success: true,
                cennikName: cennikName,
                pdfUrl: pdfUrl,
                data: enrichedData.data,
                summary: enrichedData.data.summary,
                extractionInfo: enrichedData.data.extractionInfo,
                storageInfo: storageInfo,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ Error in Okay fón PDF scraping:`, error.message);
            
            // Clean up temp file if it exists
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
}

module.exports = OkayfonPdfScraper;
