const TocParser = require('../utils/parsers/o2-toc-parser');
const PageExtractor = require('../utils/page-extractor');
const HeaderBasedExtractor = require('../utils/extractors/o2-header-extractor');
const { loadConfig } = require('../utils/config-loader');

/**
 * Section Text Extractor for O2 PDF
 * Extracts sections using ToC-guided header detection
 */
class SectionTextExtractor {
    constructor() {
        this.tocParser = new TocParser();
        this.pageExtractor = new PageExtractor();
        this.headerExtractor = new HeaderBasedExtractor();
    }

    /**
     * Extract sections using ToC page numbers and header detection
     * @param {string} pdfPath - Path to PDF file
     * @param {Array} customSections - Optional custom section definitions
     * @returns {Promise<Object>} Sections with raw text and metadata
     */
    async extractAllSectionsByHeader(pdfPath, customSections = null) {
        console.log(`Starting section extraction...`);
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
            console.log(`Found ${allTocSections.length} sections in ToC`);
            
            console.log(`Found ${Object.keys(parsedToc).length} mapped sections in ToC:`);
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
                const sections = config.providers?.o2?.sections || {};
                sectionDefinitions = Object.entries(sections).map(([key, title]) => ({ key, title }));
                console.log(`Using ${sectionDefinitions.length} configured sections`);
            }

            for (const sectionDef of sectionDefinitions) {
                try {
                    console.log(`\nExtracting section: ${sectionDef.title}`);
                    
                    const tocSection = parsedToc[sectionDef.key];
                    if (!tocSection) {
                        console.log(`❌ Section "${sectionDef.title}" not found in ToC`);
                        sections[sectionDef.key] = {
                            rawText: null
                        };
                        failedExtractions++;
                        continue;
                    }

                    const correctTocSection = allTocSections.find(section => section.title === sectionDef.title);
                    const correctStartPage = correctTocSection ? correctTocSection.page : tocSection.startPage;
                    
                    console.log(`Starting from ToC page ${correctStartPage} for "${sectionDef.title}"`);
                    
                    const nextSectionToc = this.findNextSectionFromToc(allTocSections, sectionDef.title);
                    const nextSectionPage = nextSectionToc ? nextSectionToc.startPage : null;
                    const nextTitle = nextSectionToc ? nextSectionToc.title : null;
                    
                    console.log(`Next section: "${nextTitle}"`);
                    
                    const text = await this.headerExtractor.extractSectionByHeaderFromPage(
                        pdfPath, 
                        sectionDef.title, 
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
        const sections = [];
        const sectionPattern = /([^0-9]+?)\s+[.\s]+\s+(\d+)/g;
        let match;
        
        while ((match = sectionPattern.exec(tocText)) !== null) {
            const title = match[1].trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
            const page = parseInt(match[2]);
            
            // Skip if title is too short or contains only dots
            if (title.length > 3 && !title.match(/^[.\s]+$/)) {
                sections.push({ title, page });
            }
        }
        
        // Sort by page number
        sections.sort((a, b) => a.page - b.page);
        return sections;
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
            const sections = config.providers?.o2?.sections || {};
            return Object.entries(sections).map(([key, title]) => ({ key, title }));
        } catch (error) {
            console.warn('Failed to load section configuration:', error.message);
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
        
        // Find current section (exact matching first, then flexible)
        let currentIndex = allTocSections.findIndex(section => section.title === currentTitle);
        if (currentIndex === -1) {
            currentIndex = allTocSections.findIndex(section => 
                section.title.includes(currentTitle) ||
                currentTitle.includes(section.title) ||
                this.normalizeTitle(section.title) === this.normalizeTitle(currentTitle)
            );
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

module.exports = SectionTextExtractor;
