const PdfDownloader = require('../utils/pdf-downloader');
const RadSectionExtractor = require('../extractors/rad-section-extractor');
const DataStorage = require('../storage/data-storage');
const DataValidator = require('../utils/data-validator');

/**
 * RAD PDF Scraper for RAD Slovakia price lists
 * Extracts sections using RAD-specific ToC-guided header detection
 */
class RadPdfScraper {
    constructor() {
        this.pdfDownloader = new PdfDownloader();
        this.sectionExtractor = new RadSectionExtractor();
        this.dataStorage = new DataStorage();
        this.dataValidator = new DataValidator();
    }

    /**
     * Scrape RAD PDF price list using RAD-specific ToC-guided section extraction
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
                cennikName = config.providers?.rad?.displayName || 'RAD Cenník služieb';
            }
            
            console.log(`Starting RAD PDF section-based scraping for: ${cennikName}`);
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
            
            console.log(`\nStarting RAD section extraction...`);
            const extractionResult = await this.sectionExtractor.extractAllSectionsByHeader(pdfFilePath);
            
            console.log(`\nRAD section extraction results:`);
            console.log(`   Total sections: ${extractionResult.summary.totalSections}`);
            console.log(`   Successful extractions: ${extractionResult.summary.successfulExtractions}`);
            console.log(`   Failed extractions: ${extractionResult.summary.failedExtractions}`);
            console.log(`   Total characters: ${extractionResult.summary.totalCharacters}`);
            
            const summary = extractionResult.summary || { totalSections: 0, successfulExtractions: 0, failedExtractions: 0, totalCharacters: 0 };
            const sections = extractionResult.sections || {};
            const extractionInfo = extractionResult.extractionInfo || {};
            
            let consolidatedRawText = '';
            if (sections) {
                Object.values(sections).forEach(section => {
                    if (section.rawText) {
                        consolidatedRawText += section.rawText + '\n\n';
                    }
                });
            }
            
            if (!consolidatedRawText || consolidatedRawText.trim().length === 0) {
                console.error(`❌ No content extracted from RAD PDF. This may indicate a download failure or extraction error.`);
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
                rawText: consolidatedRawText,
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
                    source: 'RAD PDF Section Extractor',
                    isLocalFile: !!localPdfPath,
                    originalUrl: pdfUrl,
                    extractionMethod: 'rad-section-based'
                }
            };

            console.log(`\n🔍 Validating extracted RAD data...`);
            const validationResult = this.dataValidator.validateExtractedData(enrichedData, 'rad');
            console.log(this.dataValidator.getValidationSummary(validationResult));
            
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
                storageInfo = await this.dataStorage.saveToDataset([enrichedData], `rad-section-extraction-${Date.now()}`, 'rad');
            }
            
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
                    rawText: consolidatedRawText, // Add rawText for crawler compatibility
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
                    storage: storageInfo,
                    timestamp: new Date().toISOString()
                };
            }
            
        } catch (error) {
            console.error(`❌ Error in RAD PDF section scraping: ${error.message}`);
            
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

module.exports = RadPdfScraper;
