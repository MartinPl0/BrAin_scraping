const TelekomTocParser = require('../utils/pdf/parsers/telekom-toc-parser');
const PageExtractor = require('../utils/web/page-extractor');
const TelekomHeaderExtractor = require('../utils/pdf/extractors/telekom-header-extractor');
const { loadConfig } = require('../utils/core/config-loader');

/**
 * Section Text Extractor for Telekom PDF
 * Extracts sections using ToC-guided header detection
 */
class TelekomSectionExtractor {
    constructor() {
        this.tocParser = new TelekomTocParser();
        this.pageExtractor = new PageExtractor();
        this.headerExtractor = new TelekomHeaderExtractor();
    }

    /**
     * Extract sections using ToC page numbers and header detection
     * @param {string} pdfPath - Path to PDF file
     * @param {Array} customSections - Optional custom section definitions
     * @returns {Promise<Object>} Sections with raw text and metadata
     */
    async extractAllSectionsByHeader(pdfPath, customSections = null) {
        console.log(`Starting section extraction for Telekom...`);
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
            
            Object.entries(parsedToc).forEach(([key, section]) => {
            });

            console.log('\nExtracting sections...');
            
            let sectionDefinitions;
            if (customSections) {
                sectionDefinitions = customSections;
            } else {
                const config = loadConfig();
                const sections = config.providers?.telekom?.sections || {};
                sectionDefinitions = Object.entries(sections).map(([key, title]) => ({ key, title }));
            }

            for (const sectionDef of sectionDefinitions) {
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
                    
                    const nextSectionToc = this.findNextSectionFromToc(allTocSections, sectionDef.title);
                    const nextSectionPage = nextSectionToc ? nextSectionToc.startPage : null;
                    const nextTitle = nextSectionToc ? nextSectionToc.title : null;
                    
                    console.log(`Next section: "${nextTitle}"`);
                    
                    const text = await this.headerExtractor.extractSectionByHeaderFromPage(
                        pdfPath, 
                        sectionDef.title, 
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
        // Special handling for "INTERNET V ZAHRANIČÍ" - use second occurrence (page 33)
        if (targetTitle === "INTERNET V ZAHRANIČÍ") {
            
            // Find all sections with this title
            const matchingSections = Object.entries(parsedToc)
                .filter(([key, section]) => section.title === targetTitle);
            
            console.log(`Found ${matchingSections.length} sections with title "${targetTitle}":`, 
                matchingSections.map(([key, section]) => `${key}: ${section.title} (page ${section.startPage})`));
            
            if (matchingSections.length >= 2) {
                const secondOccurrence = matchingSections[1];
                console.log(`Using second occurrence: ${secondOccurrence[0]} (page ${secondOccurrence[1].startPage})`);
                return secondOccurrence[1];
            } else if (matchingSections.length === 1) {
                // Fallback to first occurrence if only one found
                console.log(`Only one occurrence found, using it: ${matchingSections[0][0]} (page ${matchingSections[0][1].startPage})`);
                return matchingSections[0][1];
            }
        }
        
        // Standard logic for other sections
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
        
        // Look for partial title match (for cases where titles might be slightly different)
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
     * Get current section configuration
     * @returns {Array} Current section definitions
     */
    getSectionConfiguration() {
        try {
            const config = loadConfig();
            const sections = config.providers?.telekom?.sections || {};
            return Object.entries(sections).map(([key, title]) => ({ key, title }));
        } catch (error) {
            console.warn('Failed to load Telekom section configuration:', error.message);
            return [];
        }
    }

    /**
     * Find the next section from ToC based on page order
     * @param {Array} allTocSections - All sections from ToC
     * @param {string} currentTitle - Current section title
     * @returns {Object|null} Next section from ToC or null
     */
    findNextSectionFromToc(allTocSections, currentTitle) {
        console.log(`Looking for next section after "${currentTitle}"`);
        console.log(`Available sections in ToC:`, allTocSections.map(s => s.title));
        
        // All sections are already sorted by page number from extractAllSections
        console.log(`All sections sorted by page:`, allTocSections.map(s => `${s.title} (page ${s.page})`));
        
        // Special handling for "INTERNET V ZAHRANIČÍ" - ignore first occurrence (page 14)
        // and use the second occurrence (page 33) instead
        let currentIndex = -1;
        if (currentTitle === "INTERNET V ZAHRANIČÍ") {
            
            // Find all occurrences of "INTERNET V ZAHRANIČÍ"
            const allOccurrences = allTocSections
                .map((section, index) => ({ section, index }))
                .filter(({ section }) => section.title === currentTitle);
            
            console.log(`Found ${allOccurrences.length} occurrences of "${currentTitle}":`, 
                allOccurrences.map(({ section, index }) => `${section.title} (page ${section.page}, index ${index})`));
            
            if (allOccurrences.length >= 2) {
                // Use the second occurrence (index 1) instead of the first
                currentIndex = allOccurrences[1].index;
                console.log(`Using second occurrence at index ${currentIndex} (page ${allOccurrences[1].section.page})`);
            } else {
                // Fallback to first occurrence if only one found
                currentIndex = allOccurrences[0]?.index ?? -1;
                console.log(`Only one occurrence found, using it at index ${currentIndex}`);
            }
        } else {
            // Standard logic for other sections
            currentIndex = allTocSections.findIndex(section => section.title === currentTitle);
            if (currentIndex === -1) {
                currentIndex = allTocSections.findIndex(section => 
                    section.title.includes(currentTitle) ||
                    currentTitle.includes(section.title) ||
                    this.normalizeTitle(section.title) === this.normalizeTitle(currentTitle)
                );
            }
        }
        
        console.log(`Current section "${currentTitle}" found at index: ${currentIndex}`);
        
        if (currentIndex === -1) {
            console.log(`❌ Current section "${currentTitle}" not found in ToC`);
            return null;
        }
        
        if (currentIndex === allTocSections.length - 1) {
            console.log(`⚠️  Current section is the last section in ToC`);
            return null; // No next section
        }
        
        const nextSection = allTocSections[currentIndex + 1];
        console.log(`Found next section: "${nextSection.title}" (page ${nextSection.page})`);
        return {
            title: nextSection.title,
            startPage: nextSection.page
        };
    }
}

module.exports = TelekomSectionExtractor;
