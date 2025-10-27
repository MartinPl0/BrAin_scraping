const PdfDownloader = require('../utils/pdf-downloader');
const TescoSectionExtractor = require('../extractors/tesco-section-extractor');
const OrangeEuroExtractor = require('../extractors/orange-euro-extractor');
const DataStorage = require('../storage/data-storage');
const DataValidator = require('../utils/data-validator');

/**
 * Tesco Mobile PDF Scraper for Tesco Mobile Slovakia price lists
 * Uses euro-symbol-based extraction similar to Orange
 */
class TescoPdfScraper {
    constructor() {
        this.pdfDownloader = new PdfDownloader();
        this.sectionExtractor = new TescoSectionExtractor();
        this.euroExtractor = new OrangeEuroExtractor();
        this.dataStorage = new DataStorage();
        this.dataValidator = new DataValidator();
    }

    /**
     * Scrape Tesco Mobile PDF price list using euro-symbol-based extraction
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
                cennikName = config.providers?.tesco?.displayName || 'Tesco Mobile Cenník služieb';
            }
            
            console.log(`Starting Tesco Mobile PDF extraction for: ${cennikName}`);
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
            
            const { loadConfig } = require('../utils/config-loader');
            const config = loadConfig();
            const extractionMethod = config.providers?.tesco?.extractionMethod || 'euro-symbol-based';
            
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
            
            const enrichedData = {
                cennikName: cennikName,
                pdfUrl: localPdfPath ? `LOCAL: ${localPdfPath}` : pdfUrl,
                data: {
                    sections: sections,
                    summary: summary,
                    extractionInfo: extractionInfo
                },
                scrapedAt: new Date().toISOString()
            };

            console.log(`\n🔍 Validating extracted Tesco Mobile data...`);
            const validationResult = this.dataValidator.validateExtractedData(enrichedData, 'tesco');
            console.log(this.dataValidator.getValidationSummary(validationResult));
            

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
                    summary: enrichedData.summary,
                    extractionInfo: enrichedData.extractionInfo,
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
            console.error(`❌ Error in Tesco Mobile PDF scraping: ${error.message}`);
            
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

module.exports = TescoPdfScraper;
