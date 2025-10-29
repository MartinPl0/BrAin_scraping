/**
 * Table of Contents Parser for Funfon PDF
 * Extracts section names and page numbers from the ToC
 * Handles Funfon's ToC format: "Section Title ................. PageNumber"
 */
class FunfonTocParser {
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
        
        // Clean up the ToC text
        let cleanedTocText = tocText.replace(/^\d+\s+OBSAH\s*/, '').trim();
        
        // Split into lines - Funfon ToC seems to have sections on separate lines or concatenated
        const lines = cleanedTocText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Pattern to match: "Section Title ................. PageNumber" or "Section Title PageNumber"
        // Funfon format: Title followed by dots/spaces and page number
        const sectionPattern = /([A-ZÁČĎÉÍĽĹŇÓŔŠŤÚÝŽ][A-ZÁČĎÉÍĽĹŇÓŔŠŤÚÝŽa-záčďéíľĺňóôŕšťúýž\s\d,\-–\(\)\/]+?)(?:\.{2,}|\s+)(\d+)/g;
        
        // Try to match sections in the entire text first
        let match;
        const foundTitles = new Set();
        
        // Process each line separately
        for (const line of lines) {
            // Reset regex for each line
            sectionPattern.lastIndex = 0;
            
            while ((match = sectionPattern.exec(line)) !== null) {
                const title = match[1].trim();
                const page = parseInt(match[2]);
                
                // Basic validation
                if (title.length > 2 && 
                    !/^\d+$/.test(title) && 
                    !title.includes('Poznámka:') &&
                    page > 0) {
                    
                    // Avoid duplicates
                    const titleKey = title.toLowerCase().trim();
                    if (!foundTitles.has(titleKey)) {
                        allSections.push({ title, page });
                        foundTitles.add(titleKey);
                        console.log(`Found section: "${title}" -> Page ${page}`);
                    }
                }
            }
        }
        
        // If no sections found, try a more relaxed pattern on the whole text
        if (allSections.length === 0) {
            console.log('No sections found with line-by-line parsing, trying full-text pattern...');
            cleanedTocText = cleanedTocText.replace(/\s+/g, ' '); // Normalize spaces
            
            // More relaxed pattern: any text followed by page number
            const relaxedPattern = /([A-ZÁČĎÉÍĽĹŇÓŔŠŤÚÝŽ][A-ZÁČĎÉÍĽĹŇÓŔŠŤÚÝŽa-záčďéíľĺňóôŕšťúýž\s\d,\-–\(\)\/\.]{3,}?)(\d{1,2})(?=\s|$)/g;
            
            while ((match = relaxedPattern.exec(cleanedTocText)) !== null) {
                const title = match[1].trim().replace(/\.+$/, '').trim(); // Remove trailing dots
                const page = parseInt(match[2]);
                
                if (title.length > 3 && 
                    !/^\d+$/.test(title) && 
                    page > 0 && page < 100) { // Reasonable page number
                    
                    const titleKey = title.toLowerCase().trim();
                    if (!foundTitles.has(titleKey)) {
                        allSections.push({ title, page });
                        foundTitles.add(titleKey);
                        console.log(`Found section (relaxed): "${title}" -> Page ${page}`);
                    }
                }
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
        const allSections = this.extractAllSectionsFromToc(tocText);
        
        allSections.forEach((section, index) => {
            const sectionKey = this.generateSectionKey(section.title);
            sections[sectionKey] = {
                title: section.title,
                startPage: section.page,
                originalLine: section.title
            };
        });
        
        console.log(`Parsed ${Object.keys(sections).length} sections from ToC`);
        return sections;
    }

    /**
     * Generate a dynamic section key from the title
     * @param {string} title - Section title from ToC
     * @returns {string} Dynamic section key
     */
    generateSectionKey(title) {
        let key = title
            .toLowerCase()
            .replace(/[áàâä]/g, 'a')
            .replace(/[éèêë]/g, 'e')
            .replace(/[íìîï]/g, 'i')
            .replace(/[óòôö]/g, 'o')
            .replace(/[úùûü]/g, 'u')
            .replace(/[ýỳŷÿ]/g, 'y')
            .replace(/[č]/g, 'c')
            .replace(/[ď]/g, 'd')
            .replace(/[ľ]/g, 'l')
            .replace(/[ň]/g, 'n')
            .replace(/[ŕ]/g, 'r')
            .replace(/[š]/g, 's')
            .replace(/[ť]/g, 't')
            .replace(/[ž]/g, 'z')
            .replace(/[^\w\s]/g, '') // Remove special characters
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/_+/g, '_') // Replace multiple underscores with single
            .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
        
        if (!key || key.length < 3) {
            key = 'section_' + Math.random().toString(36).substr(2, 9);
        }
        
        return key;
    }
}

module.exports = FunfonTocParser;
