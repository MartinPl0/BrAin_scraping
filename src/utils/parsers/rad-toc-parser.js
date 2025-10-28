const PageExtractor = require('../page-extractor');

/**
 * RAD-specific Table of Contents parser
 * Handles the unique ToC format: "04   Radosť 05   Spoločné ustanovenia pre službu Radosť 06   Dátové služby..."
 */
class RadTocParser {
    constructor() {
        this.pageExtractor = new PageExtractor();
    }

    /**
     * Extract all sections from RAD ToC text
     * @param {string} tocText - Raw ToC text from page 2
     * @returns {Array} Array of sections with title and page
     */
    extractAllSectionsFromToc(tocText) {
        console.log('🔍 Extracting sections from RAD ToC...');
        
        // Clean the text
        const cleanText = tocText.trim();
        console.log(`📄 Clean ToC text: "${cleanText}"`);
        
        // Split by page numbers (2-digit numbers)
        const pagePattern = /(\d{2})\s+/g;
        const parts = cleanText.split(pagePattern);
        
        console.log(`📄 Split into ${parts.length} parts`);
        
        const sections = [];
        
        // Process pairs: page number + title
        for (let i = 1; i < parts.length; i += 2) {
            if (i + 1 < parts.length) {
                const pageNumber = parseInt(parts[i]);
                const title = parts[i + 1].trim();
                
                if (pageNumber && title && title.length > 2) {
                    sections.push({
                        page: pageNumber,
                        title: title,
                        originalText: `${pageNumber}   ${title}`
                    });
                }
            }
        }
        
        // Sort by page number
        sections.sort((a, b) => a.page - b.page);
        
        console.log(`✅ Extracted ${sections.length} sections from RAD ToC:`);
        sections.forEach((section, index) => {
            console.log(`   ${index + 1}. Page ${section.page}: "${section.title}"`);
        });
        
        return sections;
    }

    /**
     * Parse RAD ToC and return mapped sections
     * @param {string} tocText - Raw ToC text
     * @returns {Object} Mapped sections by key
     */
    parseToc(tocText) {
        console.log('🔍 Parsing RAD ToC with section mapping...');
        
        const allSections = this.extractAllSectionsFromToc(tocText);
        
        // Map sections to configuration keys
        const mappedSections = {};
        
        // Define section mappings based on the extracted sections
        const sectionMappings = {
            'radost': 'Radosť',
            'spolocne_ustanovenia': 'Spoločné ustanovenia pre službu Radosť',
            'datove_sluzby': 'Dátové služby',
            'doplnkove_sluzby': 'Doplnkové služby',
            'ostatne_volania': 'Ostatné volania, služby a poplatky',
            'automaticky_aktivovane': 'Automaticky aktivované služby',
            'roaming': 'Roaming',
            'sluzby_zabavy': 'Služby mobilnej a nemobilnej zábavy',
            'spolocne_ustanovenia_obsah': 'Spoločné ustanovenia Obsah 2'
        };
        
        // Create mapped sections
        for (const [key, title] of Object.entries(sectionMappings)) {
            const section = allSections.find(s => s.title === title);
            if (section) {
                mappedSections[key] = {
                    title: section.title,
                    startPage: section.page,
                    originalText: section.originalText
                };
                console.log(`✅ Mapped ${key}: "${section.title}" -> Page ${section.page}`);
            } else {
                console.log(`⚠️  Section not found for mapping: ${key} -> "${title}"`);
            }
        }
        
        console.log(`📊 Successfully mapped ${Object.keys(mappedSections).length} sections`);
        return mappedSections;
    }

    /**
     * Find the next section from ToC based on page order
     * @param {Array} allTocSections - All sections from ToC
     * @param {string} currentTitle - Current section title
     * @returns {Object|null} Next section from ToC or null
     */
    findNextSectionFromToc(allTocSections, currentTitle) {
        console.log(`🔍 Looking for next section after "${currentTitle}"`);
        
        // Find current section index
        const currentIndex = allTocSections.findIndex(section => 
            section.title === currentTitle ||
            section.title.includes(currentTitle) ||
            currentTitle.includes(section.title)
        );
        
        if (currentIndex === -1) {
            console.log(`❌ Current section "${currentTitle}" not found in ToC`);
            return null;
        }
        
        if (currentIndex === allTocSections.length - 1) {
            console.log(`⚠️  Current section is the last section in ToC`);
            return null;
        }
        
        const nextSection = allTocSections[currentIndex + 1];
        console.log(`✅ Found next section: "${nextSection.title}" (page ${nextSection.page})`);
        
        return {
            title: nextSection.title,
            startPage: nextSection.page
        };
    }

    /**
     * Normalize title for comparison
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

module.exports = RadTocParser;
