const express = require('express');
const DataService = require('./data-service');

/**
 * API Routes for telecom data endpoints
 */
class ApiRoutes {
    constructor(config) {
        this.config = config;
        this.dataService = new DataService(config);
        this.router = express.Router();
        this.setupRoutes();
    }

    /**
     * Setup all API routes
     */
    setupRoutes() {
        this.router.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '1.0.0'
            });
        });

        this.router.get('/all', async (req, res) => {
            try {
                const data = await this.dataService.getAllProvidersData();
                res.json(data);
            } catch (error) {
                console.error('Error in /all endpoint:', error.message);
                res.status(500).json({
                    error: 'Failed to fetch all providers data',
                    message: error.message
                });
            }
        });

        this.setupProviderRoutes();

        this.router.get('/cache/status', (req, res) => {
            try {
                const status = this.dataService.getCacheStatus();
                res.json({
                    cache: status,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get cache status',
                    message: error.message
                });
            }
        });

        this.router.post('/cache/clear', (req, res) => {
            try {
                this.dataService.clearCache();
                res.json({
                    message: 'Cache cleared successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to clear cache',
                    message: error.message
                });
            }
        });

        this.router.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                availableEndpoints: [
                    'GET /health',
                    'GET /all',
                    'GET /o2',
                    'GET /telekom',
                    'GET /orange',
                    'GET /fourka',
                    'GET /4ka',
                    'GET /tesco',
                    'GET /cache/status',
                    'POST /cache/clear'
                ]
            });
        });
    }

    /**
     * Setup individual provider routes
     */
    setupProviderRoutes() {
        const providers = Object.keys(this.config.providers);

        providers.forEach(providerKey => {
            const providerConfig = this.config.providers[providerKey];

            this.router.get(`/${providerKey}`, async (req, res) => {
                try {
                    const data = await this.dataService.getProviderData(providerKey);
                    res.json(data);
                } catch (error) {
                    console.error(`Error in /${providerKey} endpoint:`, error.message);
                    res.status(500).json({
                        error: `Failed to fetch ${providerKey} data`,
                        message: error.message
                    });
                }
            });

            if (providerConfig.aliases) {
                providerConfig.aliases.forEach(alias => {
                    this.router.get(`/${alias}`, async (req, res) => {
                        try {
                            const data = await this.dataService.getProviderData(providerKey);
                            res.json(data);
                        } catch (error) {
                            console.error(`Error in /${alias} endpoint:`, error.message);
                            res.status(500).json({
                                error: `Failed to fetch ${alias} data`,
                                message: error.message
                            });
                        }
                    });
                });
            }
        });
    }

    /**
     * Get the Express router
     */
    getRouter() {
        return this.router;
    }
}

module.exports = ApiRoutes;
