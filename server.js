// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const swagger = require('./config/swagger');
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

app.use((req, res, next) => {
    next();
});

// ============================================
// SWAGGER DOCS
// ============================================

app.use('/api-docs', swagger.serve, swagger.setup);
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
// MIGRATION STATUS ENDPOINT (for debugging)
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

// For local development
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

// Export for Vercel serverless
module.exports = app;