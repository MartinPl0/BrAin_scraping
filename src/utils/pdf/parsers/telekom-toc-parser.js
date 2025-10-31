/**
 * Table of Contents Parser for Telekom PDF
 * Extracts section names and page numbers from the ToC
 * Uses standard page numbering
 */
class TelekomTocParser {
    constructor() {
        // Dynamic section discovery from ToC
    }

    /**
     * Extract all sections from ToC using regex pattern matching
     * @param {string} tocText - Raw text from ToC page
     * @returns {Array} Array of all sections with titles and page numbers
     */
    extractAllSectionsFromToc(tocText) {
        const allSections = [];
        
        let cleanedTocText = tocText.replace(/^\d+\s+OBSAH\s+/, '').trim();
        cleanedTocText = cleanedTocText.replace(/\s+/g, ' '); // Normalize multiple spaces to single space
        
        // Use regex pattern matching
        // Pattern: "SECTION TITLE PAGE_NUMBER" (section title followed by page number)
        const sectionPattern = /([A-ZÁČĎÉÍĽĹŇÓŔŠŤÚÝŽ\s\d,\-–\(\)\/]+?)(\d+)/g;
        
        let match;
        const foundTitles = new Set();
        
        while ((match = sectionPattern.exec(cleanedTocText)) !== null) {
            const title = match[1].trim();
            const page = parseInt(match[2]);
            
            // Basic validation to avoid extracting non-section titles
            if (title.length > 3 && 
                !/^\d+$/.test(title) && 
                !title.includes('Poznámka:')) {
                
                allSections.push({ title, page });
                foundTitles.add(title);
                console.log(`Found section: ${title} -> Page ${page}`);
            }
        }
        
        // Sort by page number
        allSections.sort((a, b) => a.page - b.page);
        
        console.log(`Extracted ${allSections.length} sections from ToC`);
        return allSections;
    }

    /**
     * Parse Table of Contents from ToC page
     * @param {string} tocText - Raw text from ToC page
     * @returns {Object} Parsed sections with page numbers
     */
    parseToc(tocText) {
        const sections = {};
        
        let cleanedTocText = tocText.replace(/^\d+\s+OBSAH\s+/, '').trim();
        cleanedTocText = cleanedTocText.replace(/\s+/g, ' '); // Normalize multiple spaces to single space
        
        // Use dynamic pattern matching to find all sections
        const sectionPattern = /([A-ZÁČĎÉÍĽĹŇÓŔŠŤÚÝŽ\s\d,\-–\(\)\/]+?)(\d+)/g;
        
        let match;
        const foundTitles = new Set();
        
        while ((match = sectionPattern.exec(cleanedTocText)) !== null) {
            const title = match[1].trim();
            const pageNumber = parseInt(match[2]);
            
            // Basic validation to avoid extracting non-section titles
            if (title.length > 3 && 
                !/^\d+$/.test(title) && 
                !title.includes('Poznámka:')) {
                
                // Generate a dynamic section key from the title, but allow duplicates
                // For duplicate titles, append page number to make unique keys
                let sectionKey = this.generateSectionKey(title);
                if (foundTitles.has(title)) {
                    sectionKey = `${sectionKey}_page${pageNumber}`;
                }
                
                sections[sectionKey] = {
                    title: title,
                    startPage: pageNumber,
                    originalLine: match[0]
                };
                foundTitles.add(title);
            }
        }
        
        console.log(`Parsed ${Object.keys(sections).length} sections from ToC`);
        return sections;
    }

    /**
     * Parse a single ToC line to extract section name and page number
     * @param {string} line - Single line from ToC
     * @returns {Object|null} Parsed section info or null if not a valid section
     */
    parseTocLine(line) {
        // Look for patterns like "SECTION NAME   PAGE_NUMBER" or "SECTION NAME PAGE_NUMBER"
        const patterns = [
            // Pattern: "Section Name   PageNumber" - multiple spaces
            /^([^0-9]+?)\s{2,}(\d+)$/,
            // Pattern: "Section Name PageNumber" (single space)
            /^([^0-9]+?)\s+(\d+)$/,
            // Pattern: "Section Name - PageNumber"
            /^([^-]+)\s*-\s*(\d+)$/,
            // Pattern: "Section Name" followed by page number anywhere in the line
            /^([^0-9]+?)\s+.*?(\d+)$/
        ];

        for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
                const title = match[1].trim();
                const pageNumber = parseInt(match[2]);
                
                // Clean up title (remove extra spaces, etc.)
                const cleanTitle = title.replace(/\s+$/, '').trim();
                
                // Check if this title maps to a known section
                const sectionKey = this.findSectionKey(cleanTitle);
                if (sectionKey) {
                    return {
                        key: sectionKey,
                        title: cleanTitle,
                        startPage: pageNumber
                    };
                }
            }
        }

        // Try to find known section names in the line
        for (const [key, value] of Object.entries(this.sectionMappings)) {
            if (line.includes(key)) {
                // Try to extract page number from the line
                const pageMatch = line.match(/(\d+)/);
                if (pageMatch) {
                    return {
                        key: value,
                        title: key,
                        startPage: parseInt(pageMatch[1])
                    };
                }
            }
        }

        return null;
    }

    /**
     * Generate a dynamic section key from the title
     * @param {string} title - Section title from ToC
     * @returns {string} Dynamic section key
     */
    generateSectionKey(title) {
        // Convert title to a clean key format
        let key = title
            .toLowerCase()
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/_+/g, '_') // Replace multiple underscores with single
        
        if (!key || key.length < 3) {
            key = 'section_' + Math.random().toString(36).substr(2, 9);
        }
        
        return key;
    }

    /**
     * Get section boundaries for text extraction
     * @param {Object} sections - Parsed sections from ToC
     * @returns {Array} Array of section boundaries with start/end pages
     */
    getSectionBoundaries(sections) {
        const boundaries = [];
        const sortedSections = Object.entries(sections)
            .sort(([,a], [,b]) => a.startPage - b.startPage);

        for (let i = 0; i < sortedSections.length; i++) {
            const [key, section] = sortedSections[i];
            const nextSection = sortedSections[i + 1];
            
            boundaries.push({
                key: key,
                title: section.title,
                startPage: section.startPage,
                endPage: nextSection ? nextSection[1].startPage - 1 : null,
                originalLine: section.originalLine
            });
        }

        return boundaries;
    }

}

module.exports = TelekomTocParser;
