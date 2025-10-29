const FunfonTocParser = require('../utils/parsers/funfon-toc-parser');
const PageExtractor = require('../utils/page-extractor');
const TelekomHeaderExtractor = require('../utils/extractors/telekom-header-extractor');
const { loadConfig } = require('../utils/config-loader');

/**
 * Section Text Extractor for Funfon PDF
 * Extracts sections using ToC-guided header detection
 */
class FunfonSectionExtractor {
    constructor() {
        this.tocParser = new FunfonTocParser(); // Use Funfon-specific ToC parser
        this.pageExtractor = new PageExtractor();
        this.headerExtractor = new TelekomHeaderExtractor(); // Reuse Telekom's header extractor for now
    }

    /**
     * Extract sections using ToC page numbers and header detection
     * @param {string} pdfPath - Path to PDF file
     * @param {Array} customSections - Optional custom section definitions
     * @returns {Promise<Object>} Sections with raw text and metadata
     */
    async extractAllSectionsByHeader(pdfPath, customSections = null) {
        console.log(`Starting section extraction for Funfon...`);
        console.log(`PDF Path: ${pdfPath}`);

        const sections = {};
        let successfulExtractions = 0;
        let failedExtractions = 0;
        let totalCharacters = 0;

        try {
            console.log('\nExtracting Table of Contents...');
            const tocText = await this.pageExtractor.extractTocText(pdfPath);
            const parsedToc = this.tocParser.parseToc(tocText);
            
            const allTocSections = this.extractAllSectionsFromToc(tocText);
            
            console.log(`\nFound ${allTocSections.length} sections in ToC`);
            allTocSections.forEach((section, index) => {
                console.log(`  ${index + 1}. "${section.title}" - page ${section.page}`);
            });

            console.log('\nExtracting sections...');
            
            let sectionDefinitions;
            if (customSections) {
                sectionDefinitions = customSections;
            } else {
                const config = loadConfig();
                const sections = config.providers?.funfon?.sections || {};
                sectionDefinitions = Object.entries(sections).map(([key, title]) => ({ key, title }));
            }

            // If no sections configured, extract all sections from ToC
            if (sectionDefinitions.length === 0) {
                console.log('No sections configured, extracting all sections from ToC...');
                sectionDefinitions = allTocSections.map((section, index) => ({
                    key: `section_${index + 1}`,
                    title: section.title
                }));
            }

            // Find next section based on config order (not just ToC order)
            for (let i = 0; i < sectionDefinitions.length; i++) {
                const sectionDef = sectionDefinitions[i];
                try {
                    // Find the section in ToC by title
                    const tocSection = this.findSectionByTitle(parsedToc, sectionDef.title);
                    if (!tocSection) {
                        console.log(`❌ Section "${sectionDef.title}" not found in ToC`);
                        sections[sectionDef.key] = {
                            rawText: null
                        };
                        failedExtractions++;
                        continue;
                    }

                    console.log(`Starting from ToC page ${tocSection.startPage} for "${sectionDef.title}"`);
                    
                    // Find next section from config order (not all ToC sections)
                    // This ensures we extract from start of current section to start of next configured section
                    let nextSectionDef = null;
                    let nextSectionToc = null;
                    
                    // Look for the next configured section in the list
                    for (let j = i + 1; j < sectionDefinitions.length; j++) {
                        const candidateNextSection = sectionDefinitions[j];
                        const candidateTocSection = this.findSectionByTitle(parsedToc, candidateNextSection.title);
                        if (candidateTocSection) {
                            nextSectionDef = candidateNextSection;
                            nextSectionToc = candidateTocSection;
                            break;
                        }
                    }
                    
                    // If no next configured section found, try to find next section from ToC as fallback
                    if (!nextSectionToc) {
                        nextSectionToc = this.findNextSectionFromToc(allTocSections, sectionDef.title);
                    }
                    
                    const nextSectionPage = nextSectionToc ? nextSectionToc.startPage : null;
                    const nextTitle = nextSectionToc ? nextSectionToc.title : null;
                    
                    if (nextSectionDef) {
                        console.log(`Next configured section: "${nextTitle}" (page ${nextSectionPage || 'end'})`);
                    } else if (nextTitle) {
                        console.log(`Next section (from ToC): "${nextTitle}" (page ${nextSectionPage || 'end'})`);
                    } else {
                        console.log(`Next section: (end of document)`);
                    }
                    
                    // Get header aliases for this section if available
                    const config = loadConfig();
                    const headerAliases = config.providers?.funfon?.headerAliases?.[sectionDef.key] || [sectionDef.title];
                    console.log(`Using header aliases for "${sectionDef.title}": ${headerAliases.join(', ')}`);
                    
                    const text = await this.extractSectionWithAliases(
                        pdfPath,
                        sectionDef.title,
                        headerAliases,
                        nextTitle,
                        tocSection.startPage,
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

            console.log(`\nExtraction Summary:`);
            console.log(`   Total sections: ${summary.totalSections}`);
            console.log(`   Successful extractions: ${summary.successfulExtractions}`);
            console.log(`   Failed extractions: ${summary.failedExtractions}`);
            console.log(`   Total characters: ${summary.totalCharacters}`);

            return { sections, summary, extractionInfo: { method: 'toc-guided-header', tocSections: Object.keys(parsedToc).length } };

        } catch (error) {
            console.error(`❌ Error in section extraction: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract all sections from ToC using regex pattern matching
     * @param {string} tocText - Raw ToC text
     * @returns {Array} Array of sections with title and page
     */
    extractAllSectionsFromToc(tocText) {
        return this.tocParser.extractAllSectionsFromToc(tocText);
    }

    /**
     * Find a section in the parsed ToC by title
     * @param {Object} parsedToc - Parsed ToC sections
     * @param {string} targetTitle - Title to find
     * @returns {Object|null} Section info or null if not found
     */
    findSectionByTitle(parsedToc, targetTitle) {
        // Look for exact title match first
        for (const [key, section] of Object.entries(parsedToc)) {
            if (section.title === targetTitle) {
                return section;
            }
        }
        
        // Look for normalized title match
        const normalizedTarget = this.normalizeTitle(targetTitle);
        for (const [key, section] of Object.entries(parsedToc)) {
            if (this.normalizeTitle(section.title) === normalizedTarget) {
                return section;
            }
        }
        
        // Look for partial title match
        for (const [key, section] of Object.entries(parsedToc)) {
            if (this.normalizeTitle(section.title).includes(normalizedTarget) || 
                normalizedTarget.includes(this.normalizeTitle(section.title))) {
                return section;
            }
        }
        
        return null;
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
     * Find the next section from ToC based on page order
     * @param {Array} allTocSections - All sections from ToC
     * @param {string} currentTitle - Current section title
     * @returns {Object|null} Next section from ToC or null
     */
    findNextSectionFromToc(allTocSections, currentTitle) {
        const currentIndex = allTocSections.findIndex(section => section.title === currentTitle);
        
        if (currentIndex === -1) {
            // Try normalized match
            const normalizedTarget = this.normalizeTitle(currentTitle);
            const foundIndex = allTocSections.findIndex(section => 
                this.normalizeTitle(section.title) === normalizedTarget ||
                this.normalizeTitle(section.title).includes(normalizedTarget) ||
                normalizedTarget.includes(this.normalizeTitle(section.title))
            );
            
            if (foundIndex === -1) {
                console.log(`❌ Current section "${currentTitle}" not found in ToC`);
                return null;
            }
            
            if (foundIndex === allTocSections.length - 1) {
                return null; // No next section
            }
            
            return {
                title: allTocSections[foundIndex + 1].title,
                startPage: allTocSections[foundIndex + 1].page
            };
        }
        
        if (currentIndex === allTocSections.length - 1) {
            return null; // No next section
        }
        
        const nextSection = allTocSections[currentIndex + 1];
        return {
            title: nextSection.title,
            startPage: nextSection.page
        };
    }
}

module.exports = FunfonSectionExtractor;
