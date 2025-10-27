const { loadConfig } = require('./config-loader');

/**
 * Table of Contents Parser for 4ka PDFs
 * Extracts section titles and page numbers from ToC text
 */
class FourKaTocParser {
    constructor() {
        this.sectionMappings = this.loadSectionMappings();
        this.buildDynamicPatterns();
    }

    /**
     * Load section mappings from config
     */
    loadSectionMappings() {
        try {
            const config = loadConfig();
            const sections = config.providers?.fourka?.sections || {};
            // Return sections as-is (key -> title mapping)
            return sections;
        } catch (error) {
            console.warn('Failed to load section mappings from config, using empty object:', error.message);
            return {};
        }
    }

    /**
     * Build patterns from config sections for regex matching
     */
    buildDynamicPatterns() {
        this.sectionPatterns = Object.values(this.sectionMappings);
        
        this.directPatterns = Object.entries(this.sectionMappings).map(([key, title]) => ({
            pattern: new RegExp(`${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+.*?(\\d+)`),
            key: key,
            title: title
        }));
    }

    /**
     * Extract all sections from ToC using regex pattern matching
     * @param {string} tocText - Raw text from ToC page
     * @returns {Array} Array of all sections with titles and page numbers
     */
    extractAllSectionsFromToc(tocText) {
        const sections = [];
        const lines = tocText.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.length === 0) continue;
            
            // Clean up malformed text patterns
            let cleanLine = trimmedLine;
            
            cleanLine = cleanLine.replace(/([A-Z\s]+)\d+\.\s*\1/g, '$1');
            
            // Look for patterns like:
            // "1. SECTION NAME" (numbered sections)
            // "SECTION NAME ... Page X" (with dots)
            // "SECTION NAME X" (with page number)
            // "SECTION NAME" (just the title)
            
            const numberedMatch = cleanLine.match(/^(\d+)\.\s*(.+)$/);
            const pageMatch = cleanLine.match(/(.+?)\s+\.{2,}\s+(\d+)$/) || 
                            cleanLine.match(/(.+?)\s+(\d+)$/);
            const titleOnlyMatch = cleanLine.match(/^([A-Z\s]+)$/);
            
            if (numberedMatch) {
                const page = parseInt(numberedMatch[1]);
                const title = numberedMatch[2].trim();
                
                if (title && !isNaN(page) && page > 0) {
                    sections.push({
                        title: title,
                        startPage: page
                    });
                }
            } else if (pageMatch) {
                const title = pageMatch[1].trim();
                const page = parseInt(pageMatch[2]);
                
                if (title && !isNaN(page) && page > 0) {
                    sections.push({
                        title: title,
                        startPage: page
                    });
                }
            } else if (titleOnlyMatch) {
                const title = titleOnlyMatch[1].trim();
                
                // For title-only matches, try to find page number in nearby context
                // Look for page numbers in the same line or nearby lines
                const pageNumberMatch = cleanLine.match(/(\d+)/);
                if (pageNumberMatch) {
                    const page = parseInt(pageNumberMatch[1]);
                    if (page > 0) {
                        sections.push({
                            title: title,
                            startPage: page
                        });
                    }
                }
            }
        }
        
        // Sort sections by page number
        sections.sort((a, b) => a.startPage - b.startPage);
        
        return sections;
    }

    /**
     * Parse ToC text and extract section mappings
     * @param {string} tocText - Raw text from ToC page
     * @returns {Object} Object with section key -> {title, startPage} mappings
     */
    parseToc(tocText) {
        const parsedSections = {};
        const lines = tocText.split('\n');
        
        console.log(`Extracted ToC text (${tocText.length} characters)`);
        console.log(`ToC content preview: ${tocText.substring(0, 200)}...`);
        
        const allSections = this.extractAllSectionsFromToc(tocText);
        console.log(`Found ${allSections.length} sections in ToC`);
        
        for (const [key, configuredTitle] of Object.entries(this.sectionMappings)) {
            const matchedSection = this.findBestMatch(allSections, configuredTitle);
            if (matchedSection) {
                // Based on the logs, it seems like page 1 in ToC corresponds to page 1 in PDF
                // But some sections are failing, so let's try a different approach
                let pageNumber = matchedSection.startPage;
                
                // For some sections, we might need to adjust the page number
                // Let's try to be more flexible with page detection
                parsedSections[key] = {
                    title: matchedSection.title,
                    startPage: pageNumber
                };
            }
        }
        
        console.log(`Parsed ${Object.keys(parsedSections).length} sections from ToC`);
        return parsedSections;
    }

    /**
     * Find the best matching section for a configured title
     * @param {Array} allSections - All sections found in ToC
     * @param {string} configuredTitle - Title from configuration
     * @returns {Object|null} Best matching section or null
     */
    findBestMatch(allSections, configuredTitle) {
        let match = allSections.find(section => 
            section.title.toLowerCase() === configuredTitle.toLowerCase()
        );
        
        if (match) return match;
        
        // Try partial match (configured title contains section title or vice versa)
        match = allSections.find(section => 
            section.title.toLowerCase().includes(configuredTitle.toLowerCase()) ||
            configuredTitle.toLowerCase().includes(section.title.toLowerCase())
        );
        
        if (match) return match;
        
        // Try keyword-based matching
        const configuredKeywords = configuredTitle.toLowerCase().split(/\s+/);
        match = allSections.find(section => {
            const sectionKeywords = section.title.toLowerCase().split(/\s+/);
            // Check if at least 2 keywords match
            const matchingKeywords = configuredKeywords.filter(keyword => 
                sectionKeywords.some(sectionKeyword => 
                    sectionKeyword.includes(keyword) || keyword.includes(sectionKeyword)
                )
            );
            return matchingKeywords.length >= Math.min(2, configuredKeywords.length);
        });
        
        if (match) return match;
        
        // Try fuzzy matching for common variations
        const fuzzyMatches = {
            'OPTICKÝ INTERNET': ['OPTICKÝ', 'INTERNET'],
            '5G INTERNET': ['5G', 'INTERNET'],
            'LTE INTERNET': ['LTE', 'INTERNET'],
            'DSL INTERNET': ['DSL', 'INTERNET'],
            'OPTIK PARTNER INTERNET': ['OPTIK', 'PARTNER', 'INTERNET'],
            'DIGITÁLNA TELEVÍZIA': ['DIGITÁLNA', 'TELEVÍZIA'],
            'PEVNÁ TELEFÓNNA LINKA': ['PEVNÁ', 'TELEFÓNNA', 'LINKA'],
            'KOMBINÁCIA BALÍKOV SLUŽIEB + ESET': ['KOMBINÁCIA', 'BALÍKOV', 'SLUŽIEB', 'ESET'],
            'ZRIADENIE SLUŽBY': ['ZRIADENIE', 'SLUŽBY'],
            'NEOBMEDZENÝ INTERNET': ['NEOBMEDZENÝ', 'INTERNET'],
            'BALÍKY SLUŽIEB': ['BALÍKY', 'SLUŽIEB'],
            'DIGITÁLNA KÁBLOVÁ TELEVÍZIA': ['DIGITÁLNA', 'KÁBLOVÁ', 'TELEVÍZIA'],
            'BALÍKY SLUŽIEB S DIGITÁLNOU KÁBLOVOU TELEVÍZIOU': ['BALÍKY', 'SLUŽIEB', 'DIGITÁLNOU', 'KÁBLOVOU', 'TELEVÍZIOU']
        };
        
        const fuzzyKeywords = fuzzyMatches[configuredTitle];
        if (fuzzyKeywords) {
            match = allSections.find(section => {
                const sectionText = section.title.toLowerCase();
                const matchingKeywords = fuzzyKeywords.filter(keyword => 
                    sectionText.includes(keyword.toLowerCase())
                );
                return matchingKeywords.length >= Math.min(2, fuzzyKeywords.length);
            });
        }
        
        return match;
    }

    /**
     * Normalize title for fuzzy matching
     * @param {string} title - Title to normalize
     * @returns {string} Normalized title
     */
    normalizeTitle(title) {
        return title
            .toLowerCase()
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    }

    /**
     * Calculate similarity between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score (0-1)
     */
    calculateSimilarity(str1, str2) {
        const words1 = str1.split(' ');
        const words2 = str2.split(' ');
        
        let matches = 0;
        for (const word1 of words1) {
            for (const word2 of words2) {
                if (word1 === word2) {
                    matches++;
                    break;
                }
            }
        }
        
        return matches / Math.max(words1.length, words2.length);
    }
}

module.exports = FourKaTocParser;
