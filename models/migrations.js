// models/migrations.js
const pool = require('../config/db');

/**
 * Migration System
 * Tracks and applies schema changes safely without data loss
 * Uses a migrations table to track what's already been applied
 */

// Migration tracking table
const MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

/**
 * Calculate simple checksum for migration content
 */
function checksum(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

/**
 * Check if migration was already applied
 */
async function isMigrationApplied(version) {
    const [rows] = await pool.execute(
        'SELECT * FROM schema_migrations WHERE version = ?',
        [version]
    );
    return rows.length > 0;
}

/**
 * Record applied migration
 */
async function recordMigration(version, name, content) {
    await pool.execute(
        'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)',
        [version, name, checksum(content)]
    );
}

/**
 * Run single migration safely
 */
async function runMigration(version, name, sql) {
    console.log(`🔧 [Migration] Checking ${version}: ${name}`);
    
    if (await isMigrationApplied(version)) {
        console.log(`⏭️  [Migration] ${version} already applied, skipping`);
        return;
    }
    
    const connection = await pool.getConnection();
    try {
        console.log(`📝 [Migration] Applying ${version}: ${name}`);
        await connection.query(sql);
        await recordMigration(version, name, sql);
        console.log(`✅ [Migration] ${version} applied successfully`);
    } catch (error) {
        console.error(`❌ [Migration] Failed to apply ${version}:`, error.message);
        throw error;
    } finally {
        connection.release();
    }
}

// ============================================
// MIGRATION DEFINITIONS
// Each migration is idempotent (safe to run multiple times)
// ============================================

const MIGRATIONS = [
    {
        version: '001',
        name: 'create_orders_table',
        sql: `
            CREATE TABLE IF NOT EXISTS orders (
                id CHAR(36) PRIMARY KEY,
                order_number VARCHAR(50) NOT NULL UNIQUE,
                store_id VARCHAR(50) NOT NULL,
                merchant_id VARCHAR(50) NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                customer_email VARCHAR(255) NOT NULL,
                customer_phone VARCHAR(50),
                status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending',
                payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
                payment_method VARCHAR(50),
                payment_reference VARCHAR(255),
                subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
                shipping_cost DECIMAL(15, 2) NOT NULL DEFAULT 0,
                tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
                discount_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
                total DECIMAL(15, 2) NOT NULL DEFAULT 0,
                currency VARCHAR(10) DEFAULT 'XAF',
                shipping_address TEXT,
                billing_address TEXT,
                notes TEXT,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_store_id (store_id),
                INDEX idx_merchant_id (merchant_id),
                INDEX idx_status (status),
                INDEX idx_payment_status (payment_status),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        version: '002',
        name: 'create_order_items_table',
        sql: `
            CREATE TABLE IF NOT EXISTS order_items (
                id CHAR(36) PRIMARY KEY,
                order_id CHAR(36) NOT NULL,
                product_id VARCHAR(50) NOT NULL,
                product_name VARCHAR(255) NOT NULL,
                product_sku VARCHAR(100),
                quantity INT NOT NULL DEFAULT 1,
                unit_price DECIMAL(15, 2) NOT NULL,
                total_price DECIMAL(15, 2) NOT NULL,
                product_image_url VARCHAR(500),
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                INDEX idx_order_id (order_id),
                INDEX idx_product_id (product_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    },
    {
        version: '003',
        name: 'create_order_status_history_table',
        sql: `
            CREATE TABLE IF NOT EXISTS order_status_history (
                id CHAR(36) PRIMARY KEY,
                order_id CHAR(36) NOT NULL,
                previous_status VARCHAR(50),
                new_status VARCHAR(50) NOT NULL,
                changed_by VARCHAR(255),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                INDEX idx_order_id (order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `
    }
    // ADD NEW MIGRATIONS HERE - they will be applied automatically
    // Example adding a new column in the future:
    // {
    //     version: '004',
    //     name: 'add_customer_id_to_orders',
    //     sql: `
    //         ALTER TABLE orders 
    //         ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) AFTER customer_email,
    //         ADD INDEX idx_customer_id (customer_id);
    //     `
    // }
];

/**
 * Initialize migration tracking and run all pending migrations
 */
async function runMigrations() {
    console.log('🚀 [Migrations] Starting migration system...');
    
    // Ensure migration table exists first
    const connection = await pool.getConnection();
    try {
        await connection.query(MIGRATION_TABLE_SQL);
        console.log('✅ [Migrations] Migration tracking table ready');
    } finally {
        connection.release();
    }
    
    // Run each migration in order
    for (const migration of MIGRATIONS) {
        await runMigration(migration.version, migration.name, migration.sql);
    }
    
    console.log('✅ [Migrations] All migrations completed');
}

/**
 * Get migration status for debugging
 */
async function getMigrationStatus() {
    const [applied] = await pool.execute(
        'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
    );
    
    const pending = MIGRATIONS.filter(m => 
        !applied.some(a => a.version === m.version)
    ).map(m => ({ version: m.version, name: m.name }));
    
    return {
        applied: applied.length,
        pending: pending.length,
        applied_migrations: applied,
        pending_migrations: pending
    };
}

module.exports = {
    runMigrations,
    getMigrationStatus,
    checksum
};