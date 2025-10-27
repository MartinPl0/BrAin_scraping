const FourKaTocParser = require('../utils/parsers/4ka-toc-parser');
const PageExtractor = require('../utils/page-extractor');
const HeaderBasedExtractor = require('../utils/extractors/o2-header-extractor');
const { loadConfig } = require('../utils/config-loader');

/**
 * Section Text Extractor for 4ka PDF
 * Extracts sections using ToC-guided header detection
 */
class FourKaSectionExtractor {
    constructor() {
        this.tocParser = new FourKaTocParser();
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
        console.log(`Starting section extraction for 4ka...`);
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
                const sections = config.providers?.fourka?.sections || {};
                sectionDefinitions = Object.entries(sections).map(([key, title]) => ({ key, title }));
                console.log(`Using ${sectionDefinitions.length} configured sections`);
            }

            for (const sectionDef of sectionDefinitions) {
                try {
                    console.log(`\nExtracting section: ${sectionDef.title}`);
                    
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

                    if (text && text.trim().length > 0) {
                        console.log(`✅ Successfully extracted "${sectionDef.title}" (${text.length} characters)`);
                        sections[sectionDef.key] = {
                            rawText: text
                        };
                        successfulExtractions++;
                        totalCharacters += text.length;
                    } else {
                        console.log(`❌ No content extracted for "${sectionDef.title}"`);
                        sections[sectionDef.key] = {
                            rawText: null
                        };
                        failedExtractions++;
                    }
                } catch (error) {
                    console.log(`❌ Error extracting section "${sectionDef.title}": ${error.message}`);
                    sections[sectionDef.key] = {
                        rawText: null
                    };
                    failedExtractions++;
                }
            }

            console.log('\nExtraction Summary:');
            console.log(`   Total sections: ${sectionDefinitions.length}`);
            console.log(`   Successful extractions: ${successfulExtractions}`);
            console.log(`   Failed extractions: ${failedExtractions}`);
            console.log(`   Total characters: ${totalCharacters}`);

            return {
                sections: sections,
                summary: {
                    totalSections: sectionDefinitions.length,
                    successfulExtractions: successfulExtractions,
                    failedExtractions: failedExtractions,
                    totalCharacters: totalCharacters,
                    extractionMethod: 'toc-guided-header',
                    tocSectionsFound: allTocSections.length,
                    mappedSections: Object.keys(parsedToc).length
                }
            };

        } catch (error) {
            console.error(`❌ Error in section extraction: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract all sections from ToC text for dynamic next section detection
     * @param {string} tocText - Raw ToC text
     * @returns {Array} Array of section objects with title and page
     */
    extractAllSectionsFromToc(tocText) {
        const sections = [];
        const lines = tocText.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0) continue;
            
            // Look for patterns like "SECTION NAME ... Page X" or "SECTION NAME X"
            const pageMatch = trimmedLine.match(/(.+?)\s+\.{2,}\s+(\d+)$/) || 
                            trimmedLine.match(/(.+?)\s+(\d+)$/);
            
            if (pageMatch) {
                const title = pageMatch[1].trim();
                const page = parseInt(pageMatch[2]);
                
                if (title && !isNaN(page) && page > 0) {
                    sections.push({
                        title: title,
                        startPage: page
                    });
                }
            }
        }
        
        // Sort sections by page number
        sections.sort((a, b) => a.startPage - b.startPage);
        
        return sections;
    }

    /**
     * Find section by title in parsed ToC
     * @param {Object} parsedToc - Parsed ToC object
     * @param {string} title - Section title to find
     * @returns {Object|null} Section object or null if not found
     */
    findSectionByTitle(parsedToc, title) {
        // First try exact match
        for (const [key, section] of Object.entries(parsedToc)) {
            if (section.title === title) {
                return section;
            }
        }
        
        // Then try partial match
        for (const [key, section] of Object.entries(parsedToc)) {
            if (section.title.includes(title) || title.includes(section.title)) {
                return section;
            }
        }
        
        return null;
    }

    /**
     * Find the next section after the given section title
     * @param {Array} allTocSections - All sections from ToC
     * @param {string} currentTitle - Current section title
     * @returns {Object|null} Next section or null if not found
     */
    findNextSectionFromToc(allTocSections, currentTitle) {
        const currentIndex = allTocSections.findIndex(section => 
            section.title === currentTitle || 
            section.title.includes(currentTitle) || 
            currentTitle.includes(section.title)
        );
        
        if (currentIndex === -1 || currentIndex >= allTocSections.length - 1) {
            return null;
        }
        
        return allTocSections[currentIndex + 1];
    }

    /**
     * Extract full content from 4ka PDF using simple start-to-end method
     * @param {string} pdfPath - Path to PDF file
     * @returns {Promise<Object>} Extracted content with metadata
     */
    async extractFullContent(pdfPath) {
        console.log(`Starting 4ka simple full-text extraction...`);
        console.log(`PDF Path: ${pdfPath}`);

        try {
            const config = loadConfig();
            const fourkaConfig = config.providers?.fourka;
            
            if (!fourkaConfig) {
                throw new Error('4ka configuration not found');
            }

            console.log('\nExtracting full text from PDF...');
            const fullText = await this.pageExtractor.extractFullText(pdfPath);
            console.log(`Full text extracted: ${fullText.length} characters`);

            const cleanedContent = this.cleanExtractedContent(fullText);

            const sections = {
                fullContent: {
                    rawText: cleanedContent
                }
            };

            const summary = {
                totalSections: 1,
                successfulExtractions: 1,
                failedExtractions: 0,
                totalCharacters: cleanedContent.length,
                originalCharacters: fullText.length
            };

            console.log(`\nExtraction Summary:`);
            console.log(`   Total sections: ${summary.totalSections}`);
            console.log(`   Successful extractions: ${summary.successfulExtractions}`);
            console.log(`   Failed extractions: ${summary.failedExtractions}`);
            console.log(`   Extracted characters: ${summary.totalCharacters}`);
            console.log(`   Original characters: ${summary.originalCharacters}`);

            return { 
                sections, 
                summary: {
                    ...summary,
                    extractionMethod: 'simple-full-text',
                    totalPages: 'unknown',
                    extractionTime: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error(`❌ Error in 4ka full-text extraction: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clean extracted content by removing excessive whitespace and formatting
     * @param {string} content - Raw extracted content
     * @returns {string} Cleaned content
     */
    cleanExtractedContent(content) {
        if (!content) return '';

        return content
            .replace(/\r\n/g, '\n')           // Normalize line endings
            .replace(/\n{3,}/g, '\n\n')       // Replace multiple newlines with double newlines
            .replace(/[ \t]+/g, ' ')          // Replace multiple spaces/tabs with single space
            .replace(/^\s+|\s+$/g, '')        // Trim start and end
            .trim();
    }
}

module.exports = FourKaSectionExtractor;