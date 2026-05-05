// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * MySQL connection pool configuration
 * multipleStatements: true REQUIRED for running migrations with multiple SQL statements
 */
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'order_service_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // CRITICAL: Enable multiple statements for migrations
    multipleStatements: true,
    dateStrings: true
});

// Test connection
pool.getConnection()
    .then(connection => {
        console.log('✅ [DB] MySQL connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ [DB] MySQL connection failed:', err.message);
        process.exit(1);
    });

pool.on('error', (err) => {
    console.error('❌ [DB] Pool error:', err.message);
});

module.exports = pool;