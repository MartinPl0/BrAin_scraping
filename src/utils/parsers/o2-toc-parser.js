const { loadConfig } = require('../config-loader');

/**
 * Table of Contents Parser for O2 PDF
 * Extracts section names and page numbers from the ToC
 * Handles O2's special page numbering: missing page 3, double-page layout
 */
class TocParser {
    constructor() {
        this.sectionMappings = this.loadSectionMappings();
        this.buildDynamicPatterns();
    }

    /**
     * Load section mappings from configuration
     * @returns {Object} Section mappings from config
     */
    loadSectionMappings() {
        try {
            const config = loadConfig();
            const sections = config.providers?.o2?.sections || {};
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
    extractAllSections(tocText) {
        let lines;
        if (tocText.includes('\n')) {
            lines = tocText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        } else {
            // Single line format - keep as single line for now
            lines = [tocText];
        }
        
        // If we have too many small lines, reconstruct
        if (lines.length > 10) {
            const reconstructedLine = lines.join(' ');
            lines = [reconstructedLine];
        }

        const allSections = [];
        
        // Use direct pattern matching for single-line ToC
        if (lines.length === 1) {
            // Use dynamic direct patterns from config
            const directPatterns = this.directPatterns;
            
            for (const { pattern, key, title } of directPatterns) {
                const match = lines[0].match(pattern);
                if (match) {
                    const pageNumber = parseInt(match[1]);
                    allSections.push({
                        title: title,
                        page: pageNumber,
                        originalLine: match[0]
                    });
                }
            }
        }
        
        // Sort by page number
        allSections.sort((a, b) => a.page - b.page);
        
        return allSections;
    }

    /**
     * Parse Table of Contents from ToC page
     * @param {string} tocText - Raw text from ToC page
     * @returns {Object} Parsed sections with page numbers
     */
    parseToc(tocText) {
        const sections = {};
        
        let lines;
        if (tocText.includes('\n')) {
            lines = tocText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        } else {
            // Single line format - keep as single line for now
            lines = [tocText];
        }
        
        // If we have too many small lines, reconstruct
        if (lines.length > 10) {
            const reconstructedLine = lines.join(' ');
            lines = [reconstructedLine];
        }
        
        // For single long line, use direct pattern matching
        if (lines.length === 1 && lines[0].length > 100) {
            const longLine = lines[0];
            
            // Direct pattern matching for known sections
            const directPatterns = this.directPatterns;
            
            for (const { pattern, key, title } of directPatterns) {
                const match = longLine.match(pattern);
                if (match) {
                    const pageNumber = parseInt(match[1]);
                    sections[key] = {
                        title: title,
                        startPage: pageNumber,
                        originalLine: match[0]
                    };
                }
            }
        } else {
            // Use line-by-line parsing for multi-line ToC
            for (const line of lines) {
                const sectionInfo = this.parseTocLine(line);
                if (sectionInfo) {
                    sections[sectionInfo.key] = {
                        title: sectionInfo.title,
                        startPage: sectionInfo.startPage,
                        originalLine: line
                    };
                    console.log(`Found section: ${sectionInfo.title} -> Page ${sectionInfo.startPage}`);
                }
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
        // Look for patterns like "π Voľnosť ................... 4" or "π Voľnosť   . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .   4"
        const patterns = [
            // Pattern: "Section Name ................... PageNumber" - continuous dots
            /^([^\.\d]+?)\s+\.+\s+(\d+)$/,
            // Pattern: "Section Name   . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .   PageNumber" - spaced dots
            /^([^\.\d]+?)\s+\s*\.\s+\.\s+\.\s+.*?\s+(\d+)$/,
            // Pattern: "Section Name PageNumber" (no dots)
            /^([^0-9]+)\s+(\d+)$/,
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
                
                // Clean up title (remove extra spaces, dots, etc.)
                const cleanTitle = title.replace(/[\.\s]+$/, '').trim();
                
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
     * Find the section key for a given title
     * @param {string} title - Section title from ToC
     * @returns {string|null} Section key or null if not found
     */
    findSectionKey(title) {
        // Direct mapping (title -> key)
        for (const [key, mappedTitle] of Object.entries(this.sectionMappings)) {
            if (title === mappedTitle) {
                return key;
            }
        }

        // Fuzzy matching for variations
        const normalizedTitle = title.toLowerCase().replace(/[^\w\s]/g, '');
        
        for (const [key, mappedTitle] of Object.entries(this.sectionMappings)) {
            const normalizedMappedTitle = mappedTitle.toLowerCase().replace(/[^\w\s]/g, '');
            if (normalizedTitle.includes(normalizedMappedTitle) || normalizedMappedTitle.includes(normalizedTitle)) {
                return key;
            }
        }

        return null;
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

module.exports = TocParser;
