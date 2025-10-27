const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const ApiRoutes = require('./routes');

/**
 * REST API Server for telecom data
 */
class ApiServer {
    constructor() {
        this.app = express();
        this.config = null;
        this.server = null;
        this.setupMiddleware();
    }

    /**
     * Load API configuration
     */
    async loadConfig() {
        try {
            const configPath = path.join(__dirname, '../config/api-config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            this.config = JSON.parse(configData);
            console.log('✅ API configuration loaded');
        } catch (error) {
            console.error('❌ Failed to load API configuration:', error.message);
            throw error;
        }
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            console.log(`${timestamp} ${req.method} ${req.path}`);
            next();
        });
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        const apiRoutes = new ApiRoutes(this.config);
        this.app.use('/', apiRoutes.getRouter());
    }

    /**
     * Setup error handling middleware
     */
    setupErrorHandling() {
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Route ${req.method} ${req.path} not found`,
                timestamp: new Date().toISOString()
            });
        });

        this.app.use((error, req, res, next) => {
            console.error('Unhandled error:', error);
            
            res.status(500).json({
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * Start the API server
     */
    async start() {
        try {
            console.log('🚀 Starting Telecom Data API Server...');

            await this.loadConfig();

            this.setupRoutes();

            this.setupErrorHandling();

            const port = process.env.PORT || this.config.server.port || 3000;
            const host = process.env.HOST || this.config.server.host || 'localhost';

            this.server = this.app.listen(port, host, () => {
                console.log(`✅ API Server running on http://${host}:${port}`);
                console.log('📡 Available endpoints:');
                console.log('   GET  /health          - Health check');
                console.log('   GET  /all             - All providers data');
                console.log('   GET  /o2              - O2 Slovakia data');
                console.log('   GET  /telekom         - Slovak Telekom data');
                console.log('   GET  /orange          - Orange Slovakia data');
                console.log('   GET  /fourka          - 4ka Slovakia data');
                console.log('   GET  /4ka              - 4ka Slovakia data (alias)');
                console.log('   GET  /tesco           - Tesco Mobile data');
                console.log('   GET  /cache/status    - Cache status');
                console.log('   POST /cache/clear     - Clear cache');
            });

            this.setupGracefulShutdown();

        } catch (error) {
            console.error('❌ Failed to start API server:', error.message);
            process.exit(1);
        }
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = (signal) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);
            
            if (this.server) {
                this.server.close(() => {
                    console.log('✅ API Server closed');
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    /**
     * Stop the server
     */
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log('✅ API Server stopped');
                    resolve();
                });
            });
        }
    }
}

if (require.main === module) {
    const server = new ApiServer();
    server.start().catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

module.exports = ApiServer;
