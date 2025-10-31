/**
 * Validation Constants
 * Centralized thresholds and configuration for data validation
 */

module.exports = {
    // Content length thresholds
    CONTENT_LENGTH: {
        MIN_SHORT: 50,          // Minimum length for short content sections
        MIN_STANDARD: 100,       // Minimum length for standard content
        MIN_RICH: 500,           // Minimum length for rich content sections
        MAX_CONTENT: 1000000,    // Maximum expected content length
        MAX_TOTAL_CHARS: 10000000 // Maximum total characters
    },

    // Summary validation thresholds
    SUMMARY: {
        MAX_SECTIONS: 100,       // Maximum expected sections
        MIN_CHARS_WARNING: 100   // Minimum characters before warning
    },

    // Silent failure detection thresholds
    SILENT_FAILURE: {
        MIN_CONTENT_CHARS: 100   // Minimum content to avoid silent failure detection
    }
};

