# Utils Directory Structure

This directory contains utility modules organized by functional domain.

## Directory Organization

### `core/` - Core Utilities
Utilities used across the entire application that don't depend on specific domains.

- **config-loader.js** - Configuration file loading and environment variable integration
- **error-monitor.js** - Error monitoring and reporting system
- **validation-constants.js** - Validation thresholds and constants
- **paths.js** - Centralized path calculation utilities

### `data/` - Data Processing Utilities
Utilities for data processing, validation, and merging.

- **data-validator.js** - Data validation for extracted PDF content
- **change-detector.js** - Change detection for PDF URLs and content
- **mergers/** - JSON data merging utilities
  - **base-json-merger.js** - Base class for provider-specific JSON mergers
  - **tesco-json-merger.js** - Tesco Mobile JSON merger
  - **orange-json-merger.js** - Orange JSON merger
  - **fourka-json-merger.js** - 4ka JSON merger

### `pdf/` - PDF-Specific Utilities
Utilities specifically for PDF processing, parsing, and extraction.

- **pdf-downloader.js** - PDF file downloading utility
- **parsers/** - Table of Contents parsers
  - **o2-toc-parser.js** - O2 ToC parser
  - **telekom-toc-parser.js** - Telekom ToC parser
  - **4ka-toc-parser.js** - 4ka ToC parser
  - **funfon-toc-parser.js** - Funfon ToC parser
  - **rad-toc-parser.js** - RAD ToC parser
- **extractors/** - Header and section extractors
  - **o2-header-extractor.js** - O2 header-based extractor
  - **telekom-header-extractor.js** - Telekom header-based extractor

### `web/` - Web Scraping Utilities
Utilities for web scraping and browser/page interaction.

- **dynamic-waiter.js** - Dynamic waiting for page elements
- **page-extractor.js** - Page content extraction utilities

## Import Patterns

When importing utilities, use these patterns:

```javascript
// Core utilities
const { loadConfig } = require('../utils/core/config-loader');
const ErrorMonitor = require('../utils/core/error-monitor');
const { getStorageDir } = require('../utils/core/paths');

// Data utilities
const DataValidator = require('../utils/data/data-validator');
const ChangeDetector = require('../utils/data/change-detector');
const TescoJsonMerger = require('../utils/data/mergers/tesco-json-merger');

// PDF utilities
const PdfDownloader = require('../utils/pdf/pdf-downloader');
const O2TocParser = require('../utils/pdf/parsers/o2-toc-parser');
const HeaderExtractor = require('../utils/pdf/extractors/o2-header-extractor');

// Web utilities
const DynamicWaiter = require('../utils/web/dynamic-waiter');
const PageExtractor = require('../utils/web/page-extractor');
```

## Path Utilities

The `core/paths.js` module provides centralized path calculations. Use these functions instead of hardcoding `path.join()` chains:

- `getStorageDir(providerName)` - Get storage directory for a provider's datasets
- `getMetadataDir()` - Get metadata storage directory
- `getTempDir()` - Get temporary files directory
- `getConfigDir()` - Get configuration files directory
- `getMetadataUrlFile()` - Get PDF URLs metadata file path
- `getMetadataHashFile()` - Get PDF hashes metadata file path
- `getDefaultConfigPath()` - Get default config file path

## Adding New Utilities

When adding new utilities:

1. Determine the appropriate category (core, data, pdf, web)
2. Place the file in the correct subdirectory
3. Use the centralized paths utility for path calculations
4. Update this README if adding a new category or significant utility
5. Follow the import patterns above for consistency

