const PdfDownloader = require('../utils/pdf-downloader');
const FunfonSectionExtractor = require('../extractors/funfon-section-extractor');
const DataStorage = require('../storage/data-storage');
const DataValidator = require('../utils/data-validator');

/**
 * Funfon PDF Scraper for Funfon Slovakia price lists
 * Extracts sections using ToC-guided header detection
 */
class FunfonPdfScraper {
    constructor(errorMonitor = null) {
        this.pdfDownloader = new PdfDownloader();
        this.sectionExtractor = new FunfonSectionExtractor();
        this.dataStorage = new DataStorage();
        this.dataValidator = new DataValidator();
        this.errorMonitor = errorMonitor;
    }

    /**
     * Scrape Funfon PDF price list using ToC-guided section extraction
     * @param {string} pdfUrl - PDF file URL
     * @param {string} cennikName - Price list name
     * @param {string} localPdfPath - Optional local PDF path
     * @param {boolean} skipStorage - Skip saving to storage (for consolidated mode)
     * @returns {Promise<Object>} Scraping results
     */
    async scrapePdf(pdfUrl, cennikName = null, localPdfPath = null, skipStorage = false) {
        let pdfFilePath = null; // Declare at function scope
        try {
            if (!cennikName) {
                const { loadConfig } = require('../utils/config-loader');
                const config = loadConfig();
                cennikName = config.providers?.funfon?.displayName || 'Funfon Cenník služieb';
            }
            
            console.log(`Starting Funfon PDF section-based scraping for: ${cennikName}`);
            console.log(`PDF URL: ${pdfUrl}`);
            
            let pdfFilePath = localPdfPath;
            
            if (!localPdfPath) {
                console.log(`Downloading PDF from: ${pdfUrl}`);
                try {
                    const result = await this.pdfDownloader.downloadAndExtractPdf(pdfUrl, true);
                    pdfFilePath = result.filePath;
                    console.log(`PDF downloaded to: ${pdfFilePath}`);
                } catch (downloadError) {
                    // Record provider failure in error monitor
                    if (this.errorMonitor) {
                        this.errorMonitor.recordError({
                            provider: 'Funfon Slovakia',
                            operation: 'pdf-download',
                            type: downloadError.statusCode === 403 ? 'FORBIDDEN_ERROR' : 'NETWORK_ERROR',
                            message: downloadError.statusCode 
                                ? `HTTP ${downloadError.statusCode}: Failed to download PDF from ${pdfUrl} - ${downloadError.statusMessage || downloadError.message}`
                                : `Failed to download PDF from ${pdfUrl}: ${downloadError.message}`,
                            errorCode: downloadError.statusCode || null,
                            severity: downloadError.statusCode === 403 ? 'critical' : 'error',
                            context: {
                                pdfUrl: pdfUrl,
                                cennikName: cennikName
                            }
                        });
                    }
                    throw downloadError;
                }
            } else {
                console.log(`Using local PDF: ${localPdfPath}`);
                pdfFilePath = localPdfPath;
            }
            
            console.log(`\nStarting section extraction...`);
            const extractionResult = await this.sectionExtractor.extractAllSectionsByHeader(pdfFilePath);
            
            console.log(`\nSection extraction results:`);
            console.log(`   Total sections: ${extractionResult.summary.totalSections}`);
            console.log(`   Successful extractions: ${extractionResult.summary.successfulExtractions}`);
            console.log(`   Failed extractions: ${extractionResult.summary.failedExtractions}`);
            console.log(`   Total characters: ${extractionResult.summary.totalCharacters}`);
            
            const summary = extractionResult.summary || { totalSections: 0, successfulExtractions: 0, failedExtractions: 0, totalCharacters: 0 };
            const sections = extractionResult.sections || {};
            const extractionInfo = extractionResult.extractionInfo || {};
            
            // Create consolidated rawText from all sections (like Telekom)
            let consolidatedRawText = '';
            if (sections) {
                Object.values(sections).forEach(section => {
                    if (section.rawText) {
                        consolidatedRawText += section.rawText + '\n\n';
                    }
                });
            }
            
            if (!consolidatedRawText || consolidatedRawText.trim().length === 0) {
                console.error(`❌ No content extracted from PDF. This may indicate a download failure or extraction error.`);
                return {
                    success: false,
                    cennikName: cennikName,
                    pdfUrl: pdfUrl,
                    error: 'No content extracted from PDF - possible download failure or extraction error',
                    timestamp: new Date().toISOString()
                };
            }
            
            const enrichedData = {
                cennikName: cennikName,
                pdfUrl: localPdfPath ? `LOCAL: ${localPdfPath}` : pdfUrl,
                rawText: consolidatedRawText.trim(),
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
                    source: 'Funfon PDF Section Extractor',
                    isLocalFile: !!localPdfPath,
                    originalUrl: pdfUrl,
                    extractionMethod: 'section-based'
                }
            };

            console.log(`\n🔍 Validating extracted Funfon data...`);
            const validationResult = this.dataValidator.validateExtractedData(enrichedData, 'funfon');
            console.log(this.dataValidator.getValidationSummary(validationResult));
            
            // Record validation warnings in ErrorMonitor
            if (this.errorMonitor && validationResult.warnings.length > 0) {
                validationResult.warnings.forEach(warning => {
                    this.errorMonitor.recordWarning({
                        provider: 'Funfon',
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
                        provider: 'Funfon',
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
            if (!skipStorage) {
                storageInfo = await this.dataStorage.saveToDataset([enrichedData], `funfon-section-extraction-${Date.now()}`, 'funfon');
            }

            return {
                success: true,
                cennikName: cennikName,
                pdfUrl: pdfUrl,
                totalSections: extractionResult.summary.totalSections,
                successfulExtractions: extractionResult.summary.successfulExtractions,
                failedExtractions: extractionResult.summary.failedExtractions,
                totalCharacters: extractionResult.summary.totalCharacters,
                storage: storageInfo,
                timestamp: new Date().toISOString(),
                data: enrichedData.data,
                summary: enrichedData.data.summary,
                extractionInfo: enrichedData.data.extractionInfo,
                rawText: enrichedData.rawText, // Include rawText for consolidated processing
                metadata: enrichedData.metadata // Include metadata for validation
            };

        } catch (error) {
            console.error(`❌ Error in Funfon PDF section-based scraping: ${error.message}`);
            return {
                success: false,
                error: error.message,
                cennikName: cennikName,
                pdfUrl: pdfUrl,
                timestamp: new Date().toISOString()
            };
        } finally {
            if (!localPdfPath && pdfFilePath) {
                const fs = require('fs');
                try {
                    fs.unlinkSync(pdfFilePath);
                    console.log(`Cleaned up temp file: ${pdfFilePath}`);
                } catch (err) {
                    console.warn(`⚠️  Could not delete temp file: ${err.message}`);
                }
            }
        }
    }

    /**
     * Clean up temporary files
     */
    cleanup() {
        this.pdfDownloader.cleanup();
    }
}

module.exports = FunfonPdfScraper;
