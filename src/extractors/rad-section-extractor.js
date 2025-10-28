const RadTocParser = require('../utils/parsers/rad-toc-parser');
const PageExtractor = require('../utils/page-extractor');
const HeaderBasedExtractor = require('../utils/extractors/o2-header-extractor');
const { loadConfig } = require('../utils/config-loader');

/**
 * RAD Section Text Extractor
 * Extracts sections using RAD-specific ToC parsing and header detection
 */
class RadSectionExtractor {
    constructor() {
        this.tocParser = new RadTocParser();
        this.pageExtractor = new PageExtractor();
        this.headerExtractor = new HeaderBasedExtractor();
    }

    /**
     * Extract sections using RAD ToC page numbers and header detection
     * @param {string} pdfPath - Path to PDF file
     * @param {Array} customSections - Optional custom section definitions
     * @returns {Promise<Object>} Sections with raw text and metadata
     */
    async extractAllSectionsByHeader(pdfPath, customSections = null) {
        console.log(`Starting RAD section extraction...`);
        console.log(`PDF Path: ${pdfPath}`);

        const sections = {};
        let successfulExtractions = 0;
        let failedExtractions = 0;
        let totalCharacters = 0;

        try {
            console.log('\nExtracting Table of Contents...');
            const tocText = await this.pageExtractor.extractTocText(pdfPath);
            const allTocSections = this.tocParser.extractAllSectionsFromToc(tocText);
            console.log(`Found ${allTocSections.length} sections in RAD ToC`);
            
            // Map configured sections to ToC sections
            const parsedToc = this.mapConfiguredSections(allTocSections);
            
            console.log(`Found ${Object.keys(parsedToc).length} mapped sections in RAD ToC:`);
            Object.entries(parsedToc).forEach(([key, section]) => {
                console.log(`   ${key}: "${section.title}" -> Page ${section.startPage}`);
            });

            console.log('\nExtracting sections...');
            
            let sectionDefinitions;
            if (customSections) {
                sectionDefinitions = customSections;
                console.log(`Using ${sectionDefinitions.length} custom sections`);
            } else {
                const config = loadConfig();
                const sections = config.providers?.rad?.sections || {};
                sectionDefinitions = Object.entries(sections).map(([key, title]) => ({ key, title }));
                console.log(`Using ${sectionDefinitions.length} configured sections`);
            }

            for (const sectionDef of sectionDefinitions) {
                try {
                    console.log(`\nExtracting section: ${sectionDef.title}`);
                    
                    const tocSection = parsedToc[sectionDef.key];
                    if (!tocSection) {
                        console.log(`❌ Section "${sectionDef.title}" not found in RAD ToC`);
                        sections[sectionDef.key] = {
                            rawText: null
                        };
                        failedExtractions++;
                        continue;
                    }

                    const correctTocSection = allTocSections.find(section => section.title === sectionDef.title);
                    const correctStartPage = correctTocSection ? correctTocSection.page : tocSection.startPage;
                    
                    console.log(`Starting from RAD ToC page ${correctStartPage} for "${sectionDef.title}"`);
                    
                    const nextSectionToc = this.tocParser.findNextSectionFromToc(allTocSections, sectionDef.title);
                    const nextSectionPage = nextSectionToc ? nextSectionToc.startPage : null;
                    const nextTitle = nextSectionToc ? nextSectionToc.title : null;
                    
                    console.log(`Next section: "${nextTitle}"`);
                    
                    // Get header aliases for this section if available
                    const config = loadConfig();
                    const headerAliases = config.providers?.rad?.headerAliases?.[sectionDef.key] || [sectionDef.title];
                    console.log(`Using header aliases for "${sectionDef.title}": ${headerAliases.join(', ')}`);
                    
                    const text = await this.extractSectionWithAliases(
                        pdfPath, 
                        sectionDef.title,
                        headerAliases,
                        nextTitle,
                        correctStartPage,
                        nextSectionPage
                    );
                    
                    sections[sectionDef.key] = {
                        rawText: text
                    };
                    
                    successfulExtractions++;
                    totalCharacters += text.length;
                    console.log(`✅ Successfully extracted "${sectionDef.title}" (${text.length} characters)`);
                    
                } catch (error) {
                    console.error(`❌ Failed to extract "${sectionDef.title}": ${error.message}`);
                    sections[sectionDef.key] = {
                        rawText: null
                    };
                    failedExtractions++;
                }
            }

            const summary = {
                totalSections: sectionDefinitions.length,
                successfulExtractions: successfulExtractions,
                failedExtractions: failedExtractions,
                totalCharacters: totalCharacters
            };

            console.log(`\nRAD Extraction Summary:`);
            console.log(`   Total sections: ${summary.totalSections}`);
            console.log(`   Successful extractions: ${summary.successfulExtractions}`);
            console.log(`   Failed extractions: ${summary.failedExtractions}`);
            console.log(`   Total characters: ${summary.totalCharacters}`);

            return { 
                sections, 
                summary, 
                extractionInfo: { 
                    method: 'rad-toc-guided-header', 
                    tocSections: Object.keys(parsedToc).length,
                    provider: 'RAD'
                } 
            };

        } catch (error) {
            console.error(`❌ Error in RAD section extraction: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract section using multiple header aliases
     * @param {string} pdfPath - Path to PDF file
     * @param {string} sectionTitle - Original section title
     * @param {Array} headerAliases - Array of possible header names
     * @param {string} nextSectionTitle - Next section title
     * @param {number} startPage - Starting page number
     * @param {number} nextSectionPage - Next section page number
     * @returns {Promise<string>} Extracted text
     */
    async extractSectionWithAliases(pdfPath, sectionTitle, headerAliases, nextSectionTitle, startPage, nextSectionPage) {
        console.log(`Extracting section "${sectionTitle}" with aliases: ${headerAliases.join(', ')}`);
        
        // Try each alias until one works
        for (const alias of headerAliases) {
            try {
                console.log(`Trying alias: "${alias}"`);
                const text = await this.headerExtractor.extractSectionByHeaderFromPage(
                    pdfPath, 
                    alias, 
                    nextSectionTitle,
                    startPage,
                    nextSectionPage
                );
                
                if (text && text.trim().length > 0) {
                    console.log(`✅ Successfully extracted using alias: "${alias}"`);
                    return text;
                }
            } catch (error) {
                console.log(`❌ Failed with alias "${alias}": ${error.message}`);
                continue;
            }
        }
        
        // If all aliases failed, throw an error
        throw new Error(`All header aliases failed for section "${sectionTitle}": ${headerAliases.join(', ')}`);
    }

    /**
     * Get current section configuration
     * @returns {Array} Current section definitions
     */
    getSectionConfiguration() {
        try {
            const config = loadConfig();
            const sections = config.providers?.rad?.sections || {};
            return Object.entries(sections).map(([key, title]) => ({ key, title }));
        } catch (error) {
            console.warn('Failed to load RAD section configuration:', error.message);
            return [];
        }
    }

    /**
     * Map configured sections to ToC sections
     * @param {Array} allTocSections - All sections found in ToC
     * @returns {Object} Mapped sections with keys matching configuration
     */
    mapConfiguredSections(allTocSections) {
        const config = loadConfig();
        const configuredSections = config.providers?.rad?.sections || {};
        const mappedSections = {};
        
        Object.entries(configuredSections).forEach(([key, title]) => {
            const tocSection = allTocSections.find(section => 
                this.normalizeTitle(section.title) === this.normalizeTitle(title)
            );
            
            if (tocSection) {
                mappedSections[key] = {
                    title: tocSection.title,
                    startPage: tocSection.page
                };
                console.log(`✅ Mapped ${key}: "${tocSection.title}" -> Page ${tocSection.page}`);
            } else {
                console.log(`⚠️  Section not found for mapping: ${key} -> "${title}"`);
            }
        });
        
        return mappedSections;
    }

    /**
     * Normalize title for comparison (remove extra spaces, normalize case, etc.)
     * @param {string} title - Title to normalize
     * @returns {string} Normalized title
     */
    normalizeTitle(title) {
        return title.toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '')
            .trim();
    }
}

module.exports = RadSectionExtractor;