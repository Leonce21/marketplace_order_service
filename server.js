require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const swagger = require('./config/swagger');
const swaggerJsdoc = require('swagger-jsdoc');
const orderRoutes = require('./routes/orderRoutes');
const { runMigrations, getMigrationStatus } = require('./models/migrations');

const app = express();
const PORT = process.env.PORT || 4004;

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// SWAGGER DOCS - JSON SPEC (for Vercel)
// ============================================

// Serve raw OpenAPI JSON spec
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Order Service API',
            version: '1.0.0',
            description: 'Order Microservice for SaaS Marketplace',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: ['./routes/*.js']
};

const specs = swaggerJsdoc(swaggerOptions);

app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
});

// ============================================
// SWAGGER UI (with CDN assets for Vercel)
// ============================================

// Serve swagger-ui-dist static files manually for Vercel
const swaggerUiDist = require('swagger-ui-dist');
const swaggerUiAbsolutePath = swaggerUiDist.getAbsoluteFSPath();

app.use('/api-docs', express.static(swaggerUiAbsolutePath));
app.get('/api-docs', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Order Service API - Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        .swagger-ui .topbar { display: none }
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
        window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: '/api-docs.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>
    `);
});

console.log(`📚 [Server] Swagger docs available at http://localhost:${PORT}/api-docs`);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Order Service is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ============================================
// MIGRATION STATUS
// ============================================

app.get('/migrations', async (req, res) => {
    try {
        const status = await getMigrationStatus();
        res.json({ success: true, data: status });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/v1/orders', orderRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
    console.log(`⚠️  [Server] Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ success: false, message: 'Route not found', path: req.path });
});

app.use((err, req, res, next) => {
    console.error('❌ [Server] Unhandled error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error', errors: [err.message] });
});

// ============================================
// START SERVER (Local) / EXPORT (Vercel)
// ============================================

if (process.env.NODE_ENV !== 'production') {
    async function startServer() {
        try {
            console.log('🚀 [Server] Running database migrations...');
            await runMigrations();
            console.log('✅ [Server] Migrations completed, starting server...');
            
            app.listen(PORT, () => {
                console.log('📚 API Documentation: http://localhost:' + PORT + '/api-docs');
                console.log('🔍 Health Check:      http://localhost:' + PORT + '/health');
                console.log('📋 Migration Status:  http://localhost:' + PORT + '/migrations');
            });
        } catch (error) {
            console.error('❌ [Server] Failed to start server:', error.message);
            process.exit(1);
        }
    }
    startServer();
}

module.exports = app;