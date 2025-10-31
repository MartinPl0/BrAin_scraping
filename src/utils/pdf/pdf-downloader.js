const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

/**
 * Utility for downloading and processing PDF files
 */
class PdfDownloader {
    constructor() {
        const { getTempDir } = require('../core/paths');
        this.tempDir = getTempDir();
        this.ensureTempDir();
    }

    /**
     * Create temp directory if it doesn't exist
     */
    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Download PDF file from URL
     * @param {string} url - PDF file URL
     * @returns {Promise<string>} Path to downloaded file
     */
    async downloadPdf(url) {
        return new Promise((resolve, reject) => {
            const fileName = `pdf_${Date.now()}.pdf`;
            const filePath = path.join(this.tempDir, fileName);
            const file = fs.createWriteStream(filePath);
            
            const protocol = url.startsWith('https:') ? https : http;
            
            const downloadWithRedirects = (downloadUrl, redirectCount = 0) => {
                if (redirectCount > 5) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                
                protocol.get(downloadUrl, {
                    rejectUnauthorized: false // Allow self-signed certificates
                }, (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307 || response.statusCode === 308) {
                        const redirectUrl = response.headers.location;
                        if (redirectUrl) {
                            const absoluteRedirectUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, downloadUrl).href;
                            console.log(`🔄 Following redirect to: ${absoluteRedirectUrl}`);
                            downloadWithRedirects(absoluteRedirectUrl, redirectCount + 1);
                            return;
                        } else {
                            reject(new Error(`HTTP ${response.statusCode}: No redirect location provided`));
                            return;
                        }
                    }
                    
                    if (response.statusCode !== 200) {
                        const error = new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`);
                        error.statusCode = response.statusCode;
                        error.statusMessage = response.statusMessage;
                        reject(error);
                        return;
                    }
                    
                    response.pipe(file);
                    
                    file.on('finish', () => {
                        file.close();
                        resolve(filePath);
                    });
                    
                    file.on('error', (err) => {
                        fs.unlink(filePath, () => {}); // Delete the file on error
                        reject(err);
                    });
                }).on('error', (err) => {
                    reject(err);
                });
            };
            
            downloadWithRedirects(url);
        });
    }

    /**
     * Extract text from PDF file (basic implementation)
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<string>} Extracted text
     */
    async extractTextFromPdf(filePath) {
        const pdf = require('pdf.js-extract');
        const pdfExtract = new pdf.PDFExtract();
        
        return new Promise((resolve, reject) => {
            pdfExtract.extract(filePath, {}, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                let text = '';
                data.pages.forEach(page => {
                    page.content.forEach(item => {
                        if (item.str) {
                            text += item.str + ' ';
                        }
                    });
                });
                
                resolve(text);
            });
        });
    }

    /**
     * Download and process PDF file
     * @param {string} pdfUrl - PDF file URL
     * @param {boolean} keepFile - Keep the temp file for table detection (default: false)
     * @returns {Promise<Object>} { text, filePath } - Extracted text and file path
     */
    async downloadAndExtractPdf(pdfUrl, keepFile = false) {
        try {
            console.log(`Downloading PDF from: ${pdfUrl}`);
            const filePath = await this.downloadPdf(pdfUrl);
            console.log(`PDF downloaded to: ${filePath}`);
            
            const text = await this.extractTextFromPdf(filePath);
            console.log(`Text extracted from PDF (${text.length} characters)`);
            
            // Keep the file if requested (for table detection), otherwise delete it
            if (!keepFile) {
                fs.unlinkSync(filePath);
            }
            
            return { text, filePath: keepFile ? filePath : null };
        } catch (error) {
            console.error(`Error downloading PDF: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clean up temp directory
     */
    cleanup() {
        if (fs.existsSync(this.tempDir)) {
            const files = fs.readdirSync(this.tempDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(this.tempDir, file));
            });
        }
    }
}

module.exports = PdfDownloader;
