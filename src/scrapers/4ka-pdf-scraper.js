const PdfDownloader = require('../utils/pdf-downloader');
const FourKaSectionExtractor = require('../extractors/4ka-section-extractor');
const OrangeEuroExtractor = require('../extractors/orange-euro-extractor');
const DataValidator = require('../utils/data-validator');
const fs = require('fs').promises;
const path = require('path');

class FourKaPdfScraper {
    constructor(errorMonitor = null) {
        this.pdfDownloader = new PdfDownloader();
        this.sectionExtractor = new FourKaSectionExtractor();
        this.euroExtractor = new OrangeEuroExtractor();
        this.validator = new DataValidator();
        this.errorMonitor = errorMonitor;
    }

    /**
     * Scrape PDF from URL and extract text content
     * @param {string} pdfUrl - URL of the PDF to scrape
     * @param {string} cennikName - Price list name
     * @param {string} localPdfPath - Optional local PDF path
     * @param {boolean} skipStorage - Skip saving to storage (for consolidated mode)
     * @param {string} category - Category name for extraction method selection
     * @returns {Promise<Object>} Scraping results
     */
    async scrapePdf(pdfUrl, cennikName = null, localPdfPath = null, skipStorage = false, category = null) {
        let localPdfPath_final = localPdfPath;
        
        try {
            if (!cennikName) {
                const { loadConfig } = require('../utils/config-loader');
                const config = loadConfig();
                cennikName = config.providers?.fourka?.displayName || '4ka Cenník služieb';
            }

            console.log(`Starting 4ka PDF extraction for: ${cennikName}`);
            console.log(`PDF URL: ${pdfUrl}`);

            if (!localPdfPath_final) {
                console.log(`Downloading PDF from: ${pdfUrl}`);
                localPdfPath_final = await this.pdfDownloader.downloadPdf(pdfUrl);
                console.log(`PDF downloaded to: ${localPdfPath_final}`);
            }

            const extractionMethod = this.getExtractionMethod(category?.name || category);
            let extractionResult;

            if (extractionMethod === 'euro-symbol-based') {
                console.log(`\nStarting euro symbol based extraction...`);
                const euroExtractionResult = await this.euroExtractor.extractContent(localPdfPath_final);
                
                extractionResult = {
                    sections: {
                        fullContent: euroExtractionResult.totalContent
                    },
                    summary: {
                        totalSections: 1,
                        successfulExtractions: 1,
                        failedExtractions: 0,
                        totalCharacters: euroExtractionResult.extractionStats.extractedCharacters,
                        originalCharacters: euroExtractionResult.extractionStats.totalCharactersInPdf,
                        extractionMethod: 'euro-symbol-based',
                        pagesWithEuro: euroExtractionResult.extractionStats.pagesWithEuro,
                        totalPages: euroExtractionResult.extractionStats.totalPages
                    }
                };
            } else if (extractionMethod === 'tos-based') {
                console.log(`\nStarting ToS-based section extraction...`);
                
                const pdfSections = this.getPdfSections(cennikName);
                console.log(`Using ${pdfSections.length} specific sections for this PDF`);
                
                extractionResult = await this.sectionExtractor.extractAllSectionsByHeader(localPdfPath_final, pdfSections);
            } else if (extractionMethod === 'section-based') {
                console.log(`\nStarting section-based extraction...`);
                
                const pdfSections = this.getPdfSections(cennikName);
                console.log(`Using ${pdfSections.length} specific sections for this PDF`);
                
                extractionResult = await this.sectionExtractor.extractAllSectionsByHeader(localPdfPath_final, pdfSections);
            } else {
                console.log(`\nStarting simple full-text extraction...`);
                extractionResult = await this.sectionExtractor.extractFullContent(localPdfPath_final);
            }

            console.log(`\nExtraction results:`);
            console.log(`   Total sections: ${extractionResult.summary.totalSections}`);
            console.log(`   Successful extractions: ${extractionResult.summary.successfulExtractions}`);
            console.log(`   Failed extractions: ${extractionResult.summary.failedExtractions}`);
            console.log(`   Extracted characters: ${extractionResult.summary.totalCharacters}`);
            console.log(`   Original characters: ${extractionResult.summary.originalCharacters}`);

            const sections = extractionResult.sections || {};
            const summary = extractionResult.summary || {};
            
            // Consolidate all section content into rawText for ToS-based extraction
            let consolidatedRawText = '';
            if (extractionMethod === 'tos-based' && sections) {
                Object.values(sections).forEach(section => {
                    if (section.rawText) {
                        consolidatedRawText += section.rawText + '\n\n';
                    }
                });
            } else if (extractionMethod === 'section-based' && sections) {
                Object.values(sections).forEach(section => {
                    if (section.rawText) {
                        consolidatedRawText += section.rawText + '\n\n';
                    }
                });
            } else if (extractionMethod === 'euro-symbol-based' && sections.fullContent) {
                consolidatedRawText = sections.fullContent;
            } else if (sections.fullContent) {
                consolidatedRawText = sections.fullContent;
            }
            
            const enrichedData = {
                cennikName: cennikName,
                pdfUrl: pdfUrl,
                rawText: consolidatedRawText,
                data: {
                    sections: sections,
                    summary: summary
                },
                scrapedAt: new Date().toISOString(),
                metadata: {
                    totalSections: summary.totalSections,
                    successfulExtractions: summary.successfulExtractions,
                    failedExtractions: summary.failedExtractions,
                    totalCharacters: summary.totalCharacters,
                    originalCharacters: summary.originalCharacters,
                    extractionMethod: summary.extractionMethod || 'simple-full-text',
                    pagesWithEuro: summary.pagesWithEuro || 0,
                    totalPages: summary.totalPages || 0
                }
            };

            console.log(`\n🔍 Validating extracted 4ka data...`);
            const validationResult = await this.validator.validateExtractedData(enrichedData, 'fourka');
            console.log(`📊 Validation complete: ${validationResult.errors.length} errors, ${validationResult.warnings.length} warnings`);
            
            // Record validation warnings in ErrorMonitor
            if (this.errorMonitor && validationResult.warnings.length > 0) {
                validationResult.warnings.forEach(warning => {
                    this.errorMonitor.recordWarning({
                        provider: '4ka',
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
                        provider: '4ka',
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
            
            if (validationResult.errors.length > 0) {
                console.log(`❌ Data validation failed:`, validationResult.errors);
                throw new Error(`Data validation failed: ${validationResult.errors.join(', ')}`);
            }
            
            if (validationResult.warnings.length > 0) {
                console.log(`⚠️  Data validation warnings:`, validationResult.warnings);
            } else {
                console.log(`✅ Data validation passed (${validationResult.warnings.length} warnings)`);
            }


            enrichedData.metadata.validation = {
                errors: validationResult.errors,
                warnings: validationResult.warnings,
                isValid: validationResult.errors.length === 0
            };

            if (skipStorage) {
                return {
                    success: true,
                    cennikName: cennikName,
                    pdfUrl: pdfUrl,
                    rawText: enrichedData.rawText,
                    data: enrichedData.data,
                    summary: enrichedData.metadata,
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    success: true,
                    cennikName: cennikName,
                    pdfUrl: pdfUrl,
                    summary: enrichedData.metadata,
                    timestamp: new Date().toISOString()
                };
            }

        } catch (error) {
            console.error(`❌ Error in 4ka PDF scraping:`, error.message);
            throw error;
        } finally {
            if (!localPdfPath && localPdfPath_final) {
                try {
                    await fs.unlink(localPdfPath_final);
                    console.log(`Cleaned up temp file: ${localPdfPath_final}`);
                } catch (err) {
                    console.warn(`⚠️  Could not delete temp file: ${err.message}`);
                }
            }
        }
    }

    /**
     * Get the extraction method from config
     * @param {string} category - Category name to get extraction method for
     * @returns {string} Extraction method
     */
    getExtractionMethod(category = null) {
        try {
            const { loadConfig } = require('../utils/config-loader');
            const config = loadConfig();
            const fourkaConfig = config.providers?.fourka;
            
            // If category is specified, check if it has a specific extraction method
            if (category && fourkaConfig?.categories) {
                const categoryConfig = fourkaConfig.categories.find(cat => cat.name === category);
                if (categoryConfig?.extractionMethod) {
                    return categoryConfig.extractionMethod;
                }
            }
            
            // Fall back to default extraction method
            return fourkaConfig?.extractionMethod || 'euro-symbol-based';
        } catch (error) {
            console.warn('⚠️  Could not load config, using default extraction method');
            return 'euro-symbol-based';
        }
    }

    /**
     * Get specific sections for a PDF based on its name
     * @param {string} cennikName - Name of the PDF
     * @returns {Array} Array of section definitions
     */
    getPdfSections(cennikName) {
        try {
            const { loadConfig } = require('../utils/config-loader');
            const config = loadConfig();
            const fourkaConfig = config.providers?.fourka;
            
            if (!fourkaConfig?.categories) {
                console.warn('⚠️  No categories found in 4ka config');
                return [];
            }
            
            // Find the PDF in the configuration
            for (const category of fourkaConfig.categories) {
                if (category.targetPdfs) {
                    for (const pdf of category.targetPdfs) {
                        if (cennikName.includes(pdf.name) || pdf.name.includes(cennikName.replace('4ka ', ''))) {
                            if (pdf.sections) {
                                console.log(`Found specific sections for PDF: ${pdf.name}`);
                                return Object.entries(pdf.sections).map(([key, title]) => ({ key, title }));
                            }
                        }
                    }
                }
            }
            
            // Fall back to default sections if no specific sections found
            console.log('Using default sections for PDF');
            const defaultSections = fourkaConfig.sections || {};
            return Object.entries(defaultSections).map(([key, title]) => ({ key, title }));
            
        } catch (error) {
            console.warn('⚠️  Could not load PDF sections, using default sections');
            return [];
        }
    }

}

module.exports = FourKaPdfScraper;
