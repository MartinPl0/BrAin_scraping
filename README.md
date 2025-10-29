# BrAIn PDF Scraper System

**Automated PDF extraction and monitoring system for telecommunications providers in Slovakia.**

Extracts pricing and service data from telecom provider websites with intelligent change detection, automated monitoring, and seamless BrAIn platform integration.

## 🎯 **What This System Does**

This system automatically monitors telecom provider websites for pricing updates, downloads new PDFs, extracts structured data, and sends it to the BrAIn platform. Currently supports **7 providers** with automated change detection and selective processing.

### **Supported Providers** ✅
- **O2 Slovakia** - Complete pricing extraction (π Voľnosť, π Paušál, π Fér programs)
- **Telekom Slovakia** - Voice plans, mobile internet, Magio services
- **Orange Slovakia** - Complete pricing data extraction (6 PDFs)
- **4ka Slovakia** - Multi-PDF consolidated processing (9 PDFs)
- **Tesco Mobile Slovakia** - Complete service extraction (2 PDFs)
- **RAD Slovakia** - Section-based extraction with header aliases
- **Okay fón Slovakia** - Euro-symbol-based extraction

### **Key Features** 🚀
- **Intelligent Change Detection** - Only processes PDFs that have actually changed
- **Automated Monitoring** - Manual execution (scheduling requires setup)
- **Email Notifications** - Not Yet Configured (requires SMTP credentials)
- **Consolidated Data** - Merges multiple PDFs into unified datasets
- **Backup System** - Atomic file operations with automatic backups
- **Dynamic Extraction** - Adapts to PDF structure changes
- **Multiple Extraction Methods** - Section-based, euro-symbol-based, and mixed extraction
- **Header Aliases** - Handles discrepancies between ToC and actual PDF headers

## 🚀 **Quick Start**

### **Installation**
```bash
npm install
```

### **Production Usage (Recommended)**
```bash
# Run automated monitoring system
node src/monitor.js

# Test system configuration
node src/monitor.js --test
```

### **Individual Provider Testing**
```bash
# Run individual scrapers
node src/main.js o2               # O2 Slovakia
node src/main.js telekom          # Telekom Slovakia  
node src/main.js orange           # Orange Slovakia
node src/main.js tesco            # Tesco Mobile
node src/main.js fourka           # 4ka Slovakia
node src/main.js rad              # RAD Slovakia
node src/main.js okayfon          # Okay fón Slovakia

# Run all providers with change detection
node src/main.js --all

# Show system status
node src/main.js --changes       # Change detection status
node src/main.js --sections      # Configurable sections
```

### **REST API Server**
```bash
# Start the API server
npm run api

# API will be available at http://localhost:3000
```

## 🏗️ **System Architecture**

### **Core Components**

```
src/
├── monitor.js                    # 🚀 Main production orchestrator
├── main.js                       # 🔧 Individual scraper interface
├── config/
│   ├── scraper-config.json       # ⚙️ Provider configurations
├── crawlers/                     # 🕷️ Website crawling system
│   ├── crawler-manager.js        # 🎯 Crawler orchestrator
│   ├── base-crawler.js           # 🏗️ Base crawler class
│   ├── o2-crawler.js             # 🕷️ O2 website crawler
│   ├── telekom-crawler.js        # 🕷️ Telekom website crawler
│   ├── orange-crawler.js        # 🕷️ Orange website crawler
│   ├── tesco-crawler.js          # 🕷️ Tesco Mobile crawler
│   ├── 4ka-crawler.js            # 🕷️ 4ka website crawler
│   ├── rad-crawler.js            # 🕷️ RAD website crawler
│   └── okayfon-crawler.js        # 🕷️ Okay fón website crawler
├── scrapers/                     # 📄 PDF processing system
│   ├── o2-pdf-scraper.js         # 📄 O2 PDF scraper
│   ├── telekom-pdf-scraper.js    # 📄 Telekom PDF scraper
│   ├── orange-pdf-scraper.js     # 📄 Orange PDF scraper
│   ├── tesco-pdf-scraper.js      # 📄 Tesco PDF scraper
│   ├── 4ka-pdf-scraper.js        # 📄 4ka PDF scraper
│   ├── rad-pdf-scraper.js        # 📄 RAD PDF scraper
│   └── okayfon-pdf-scraper.js    # 📄 Okay fón PDF scraper
├── extractors/                   # 📊 Data extraction system
│   ├── o2-section-extractor.js   # 📊 O2 section extraction
│   ├── telekom-section-extractor.js # 📊 Telekom section extraction
│   ├── orange-section-extractor.js # 📊 Orange section extraction
│   ├── tesco-section-extractor.js # 📊 Tesco section extraction
│   ├── 4ka-section-extractor.js  # 📊 4ka section extraction
│   ├── rad-section-extractor.js  # 📊 RAD section extraction
│   └── orange-euro-extractor.js # 📊 Orange euro-symbol extraction
├── utils/                        # 🔧 Utility system
│   ├── change-detector.js        # 🔍 Change detection logic
│   ├── pdf-downloader.js          # 📥 PDF processing
│   ├── config-loader.js          # 🔧 Configuration management
│   ├── data-validator.js          # ✅ Data validation
│   ├── dynamic-waiter.js         # ⏳ Smart waiting system
│   ├── page-extractor.js         # 📄 Page content extraction
│   ├── error-handler.js          # ⚠️ Error handling utilities
│   ├── parsers/                  # 📋 Table of Contents parsers
│   │   ├── o2-toc-parser.js      # 📋 O2 ToC parsing
│   │   ├── telekom-toc-parser.js # 📋 Telekom ToC parsing
│   │   └── 4ka-toc-parser.js     # 📋 4ka ToC parsing
│   ├── extractors/               # 🔍 Header-based extractors
│   │   ├── o2-header-extractor.js    # 🔍 O2 header extraction
│   │   └── telekom-header-extractor.js # 🔍 Telekom header extraction
│   └── mergers/                   # 🔗 JSON data mergers
│       ├── orange-json-merger.js # 🔗 Orange data consolidation
│       ├── tesco-json-merger.js  # 🔗 Tesco data consolidation
│       └── fourka-json-merger.js  # 🔗 4ka data consolidation

├── notifications/                # 📧 Notification system
│   └── email-notifier.js         # 📧 Email notifications
└── storage/                      # 💾 Data persistence
    └── data-storage.js           # 💾 Data storage management
```

### **Data Storage Structure**

```
storage/
├── datasets/                     # 📊 Extracted data storage
│   ├── o2/
│   │   ├── o2.json              # Single source of truth for O2
│   │   └── 000000001.json       # Debug files (when debug=true)
│   ├── telekom/
│   │   ├── telekom.json         # Single source of truth for Telekom
│   │   └── 000000001.json       # Debug files (when debug=true)
│   ├── orange/
│   │   ├── orange.json          # Single source of truth for Orange (multi-PDF)
│   │   └── 000000001.json       # Debug files (when debug=true)
│   ├── tesco/
│   │   ├── tesco.json           # Single source of truth for Tesco (multi-PDF)
│   │   └── 000000001.json       # Debug files (when debug=true)
│   ├── fourka/
│   │   ├── fourka.json          # Single source of truth for 4ka (multi-PDF)
│   │   └── 000000001.json       # Debug files (when debug=true)
│   ├── rad/
│   │   ├── rad.json             # Single source of truth for RAD
│   │   └── 000000001.json       # Debug files (when debug=true)
│   └── okayfon/
│       ├── okayfon.json         # Single source of truth for Okay fón
│       └── 000000001.json       # Debug files (when debug=true)
├── metadata/                     # 📋 System metadata
│   ├── latest-pdf-urls.json     # PDF URL tracking for change detection
│   └── latest-pdf-urls.json.backup  # Atomic operation backup
└── key_value_stores/             # 🔄 Apify session data
    └── default/                  # Session and statistics
```

**Note**: Each provider saves to a single `{provider}.json` file as the production source of truth. When `debug: true` is set in `scraper-config.json`, numbered files (`000000001.json`, etc.) are also saved for comparison purposes. Multi-PDF providers (Orange, 4ka, Tesco) use JSON mergers for selective updates, while single-PDF providers (O2, Telekom, RAD, Okay fón) save directly.

## 📊 **How It Works**

### **1. Production Monitoring Flow**
```
Website Crawl → PDF Discovery → Change Detection → Selective Processing → Data Extraction → BrAIn Integration → Email Notifications
```

**Key Features:**
- **Dynamic PDF Discovery**: Searches for specific text patterns to find PDF links
- **Intelligent Change Detection**: Compares URLs, dates, and content to detect changes
- **Selective Processing**: Only processes changed PDFs, preserving unchanged data
- **Consolidated Data**: Merges multiple PDFs into unified datasets per provider
- **Atomic Operations**: Safe file operations with automatic backups

### **2. Individual Scraper Flow**
```
PDF URL → Download → Extract Text → Parse Sections → Structure Data → Validate → Save
```

### **3. Data Processing Pipeline**
```
Raw PDF → Text Extraction → Section Parsing → Price Extraction → Data Validation → JSON Structure → Storage
```

### **4. Change Detection System**
```
Current URLs → Compare with Stored URLs → Identify Changes → Process Only Changed PDFs → Update Storage
```

### **5. Extraction Methods**

The system supports multiple extraction strategies based on PDF structure:

#### **Section-Based Extraction** (O2, Telekom, RAD)
- Extracts Table of Contents (ToC) from PDF
- Maps configured sections to page numbers
- Uses header detection to find section boundaries
- Supports header aliases for ToC/PDF mismatches
- **Used by**: O2, Telekom, RAD

#### **Euro-Symbol-Based Extraction** (Orange, Tesco, 4ka, Okay fón)
- Scans PDF pages for € symbols
- Extracts content only from pages containing pricing
- Filters out non-pricing pages automatically
- **Used by**: Orange, Tesco, 4ka, Okay fón

#### **Mixed Extraction** (Some Orange PDFs)
- Combines both methods for complex PDFs
- Uses section-based for structured content
- Falls back to euro-symbol-based for unstructured content

## 🔧 **Configuration**

### **Environment Variables Setup**

The system uses environment variables for sensitive configuration like email credentials. This keeps sensitive data out of version control.

#### **Setup Steps:**

1. **Create `.env` file** in the project root:
```bash
# Email Configuration
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=your-email@gmail.com,another-email@example.com

# Debug mode
DEBUG=false
```

2. **The `.env` file is already added to `.gitignore`** to prevent committing sensitive data.

3. **Environment variables override** the values in `scraper-config.json` when present.

#### **Email Configuration:**
- **EMAIL_SMTP_USER**: Your Gmail address
- **EMAIL_SMTP_PASS**: Gmail App Password (not your regular password)
- **EMAIL_FROM**: Sender email address
- **EMAIL_TO**: Comma-separated list of recipient emails

#### **Gmail App Password Setup:**
1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account settings → Security → App passwords
3. Generate an app password for "Mail"
4. Use this 16-character password (not your regular Gmail password)

### **Provider Configuration** (`src/config/scraper-config.json`)
```json
{
  "providers": {
    "o2": {
      "crawlUrl": "https://www.o2.sk/...",
      "displayName": "O2 Slovakia",
      "pdfUrl": "https://ppt.o2.sk/..."
    },
    "telekom": {
      "crawlUrl": "https://www.telekom.sk/...",
      "displayName": "Telekom Slovakia"
    }
  }
}
```

## 🌐 **REST API Documentation**

The system includes a REST API server that provides access to scraped telecom data for integration with external applications.

### **Starting the API Server**
```bash
npm run api
```

The API server will start on `http://localhost:3000` by default.

### **API Endpoints**

#### **Health Check**
```http
GET /health
```
Returns server status and uptime information.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### **All Providers Data**
```http
GET /all
```
Returns combined data from all providers.

**Response:**
```json
{
  "providers": [
    {
      "provider": "O2 Slovakia",
      "data": [
        {
          "title": "O2 Cenník služieb",
          "rawText": "Extracted pricing text..."
        }
      ]
    }
  ],
  "totalProviders": 7,
  "successfulProviders": 7,
  "failedProviders": 0
}
```

#### **Individual Provider Endpoints**
```http
GET /o2              # O2 Slovakia
GET /telekom         # Slovak Telekom  
GET /orange          # Orange Slovakia
GET /fourka          # 4ka Slovakia
GET /4ka             # 4ka Slovakia (alias)
GET /tesco           # Tesco Mobile
GET /rad             # RAD Slovakia
GET /okayfon         # Okay fón Slovakia
```

**Response Format:**
```json
{
  "provider": "O2 Slovakia",
  "data": [
    {
      "title": "PDF Document Name",
      "rawText": "Extracted text content from PDF"
    }
  ]
}
```

#### **Cache Management**
```http
GET /cache/status     # View cache status
POST /cache/clear    # Clear data cache
```

### **API Configuration**

The API server configuration is stored in `src/config/api-config.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "cors": {
    "enabled": true,
    "origin": "*"
  },
  "providers": {
    "o2": {
      "name": "O2 Slovakia",
      "filePath": "storage/datasets/o2/o2.json"
    }
  }
}
```

### **Data Format**

The API returns only essential data:
- **title**: Document name (from `cennikName` or `pdfType`)
- **rawText**: Extracted text content from PDFs

This simplified format is optimized for integration with external systems that need clean, structured data without the internal metadata.

## 📈 **Data Structure**

### **Consolidated Provider Data**
```json
{
  "provider": "O2 Slovakia",
  "totalPdfs": 1,
  "successfulPdfs": 1,
  "failedPdfs": 0,
  "extractedAt": "2025-01-17T12:00:00.000Z",
  "pdfs": [
    {
      "pdfType": "main-cennik",
      "pdfUrl": "https://ppt.o2.sk/...",
      "summary": {
        "totalSections": 8,
        "successfulExtractions": 8,
        "totalCharacters": 15420
      },
      "data": {
        "programs": {
          "volnost": { "prices": {...}, "dataPackages": [...] },
          "pausal": { "plans": {...} },
          "fer": { "prices": {...}, "dataPackages": [...] }
        },
        "internetServices": { "vzduchom": [...], "optikou": [...] },
        "tvServices": [...],
        "roaming": { "zone1": {...}, "zone2": {...} }
      }
    }
  ]
}
```

## 🔍 **File System Explained**

### **Backup Files (.backup)**
- **Purpose**: Atomic file operations safety
- **Created by**: `src/utils/change-detector.js`
- **Trigger**: Every time PDF URLs are updated
- **Location**: `storage/metadata/latest-pdf-urls.json.backup`
- **Why**: Prevents data corruption during file writes

### **Key-Value Stores**
- **Purpose**: Apify session management and statistics
- **Created by**: Apify SDK during crawler execution
- **Contains**: Session cookies, request statistics, crawler state
- **Location**: `storage/key_value_stores/default/`
- **Why**: Maintains session state across crawler runs

### **Dataset Storage**
- **Purpose**: Extracted data persistence
- **Created by**: `src/storage/data-storage.js`
- **Contains**: Consolidated provider data in JSON format
- **Location**: `storage/datasets/{provider}/`
- **Format**: 
  - **Production**: Single `{provider}.json` file per provider (source of truth)
  - **Debug Mode**: When `debug: true` in config, also saves numbered files (000000001.json, etc.) for comparison
  - **Multi-PDF Providers**: Orange, 4ka, and Tesco use JSON mergers for selective updates (only changed PDFs updated, unchanged PDFs preserved)

### **Debug Mode**
Enable debug mode in `src/config/scraper-config.json`:
```json
{
  "debug": true,
  "providers": {...}
}
```

When enabled:
- **Production file**: Always saved to `{provider}.json`
- **Debug files**: Additionally saves to numbered files for run comparison
- **Purpose**: Compare runs without losing production data

## 🚀 **Production Deployment**

### **Current Status**
The system is **fully functional** for web crawling, PDF extraction, and data storage. Integration features require additional configuration.

### **Ready to Use (No Configuration Required)**
- ✅ Web crawling and PDF discovery
- ✅ PDF text extraction and parsing
- ✅ Change detection and selective processing
- ✅ Data storage and consolidation
- ✅ Individual provider scraping

### **Requires Configuration**
- ⚠️ **Email Notifications** - Needs SMTP credentials
- ⚠️ **Automated Scheduling** - Needs Task Scheduler/cron setup

### **Setup Instructions**

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Test Core Functionality**
   ```bash
   node src/main.js --all
   ```

4. **Optional: Set Up Automated Scheduling**

**Windows (Task Scheduler):**
- Create weekly task: `node src/monitor.js`
- Trigger: Weekly on Sunday at 2:00 AM

**Linux/Mac (Cron):**
```bash
# Add to crontab
0 2 * * 0 cd /path/to/project && node src/monitor.js
```

## 📊 **System Status**

### **Fully Implemented & Ready**
- **Core Functionality**: ✅ Complete
- **O2 PDF Extraction**: ✅ 100% Accurate  
- **Telekom PDF Extraction**: ✅ 87.5% Success Rate (7/8 sections)
- **Orange PDF Extraction**: ✅ Complete pricing data extraction (6 PDFs)
- **4ka PDF Extraction**: ✅ Multi-PDF consolidated processing (9 PDFs)
- **Tesco Mobile PDF Extraction**: ✅ Complete service extraction (2 PDFs)
- **RAD PDF Extraction**: ✅ Section-based extraction with header aliases
- **Okay fón PDF Extraction**: ✅ Euro-symbol-based extraction
- **Data Structure**: ✅ Hierarchical JSON with consolidated rawText
- **Error Handling**: ✅ Comprehensive
- **Multi-Provider Support**: ✅ 7 providers with dynamic detection
- **Dynamic Extraction**: ✅ Adapts to PDF changes
- **Scalability**: ✅ Ready for expansion

### **Implemented But Requires Configuration**
- **Email Notifications**: ✅ Code complete, needs SMTP credentials
- **Automated Scheduling**: ✅ Manual execution ready, needs cron/Task Scheduler setup

The system is **production-ready** for core functionality and **easily extensible** for additional providers and data sources.

## 🔧 **Development & Testing**

### **Individual Provider Testing**
```bash
# Test specific providers
node src/main.js o2               # O2 Slovakia
node src/main.js telekom          # Telekom Slovakia
node src/main.js orange           # Orange Slovakia
node src/main.js tesco            # Tesco Mobile
node src/main.js fourka           # 4ka Slovakia
node src/main.js rad              # RAD Slovakia
node src/main.js okayfon          # Okay fón Slovakia

# Test with local PDF files
node src/main.js o2 /path/to/local.pdf
```

### **System Diagnostics**
```bash
# Check change detection status
node src/main.js --changes

# Show configurable sections
node src/main.js --sections

# Run all providers
node src/main.js --all
```

### **Data Validation**
- All extracted data is validated using `src/utils/data-validator.js`
- Validation includes structure checks, price validation, and provider-specific rules
- Failed validations are logged with detailed error information

## 📚 **Documentation**

- **System Overview**: See code comments and JSDoc documentation
- **Configuration**: Edit files in `src/config/` directory
- **Data Structure**: Check `storage/datasets/` for example outputs
- **Error Handling**: Comprehensive error logging and recovery mechanisms

## 🤝 **Contributing**

The system is designed for easy extension:
1. Add new provider configuration to `scraper-config.json`
2. Create provider-specific crawler in `src/crawlers/`
3. Create provider-specific scraper in `src/scrapers/`
4. Create provider-specific extractor in `src/extractors/`
5. Update `crawler-manager.js` to include new provider

## 📄 **License**

This project is part of the BrAIn platform ecosystem for automated data extraction and monitoring.