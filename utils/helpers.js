// utils/helpers.js

/**
 * Format currency with XAF symbol
 */
function formatCurrency(amount, currency = 'XAF') {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

/**
 * Generate a unique order number
 */
function generateOrderNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 900 + 100);
    return `ORD-${dateStr}-${random}`;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Sanitize string input
 */
function sanitizeString(str) {
    if (!str) return '';
    return str.trim().replace(/[<>]/g, '');
}

/**
 * Calculate date range for queries
 */
function getDateRange(period = '30d') {
    const now = new Date();
    const from = new Date();
    
    switch(period) {
        case '7d': from.setDate(now.getDate() - 7); break;
        case '30d': from.setDate(now.getDate() - 30); break;
        case '90d': from.setDate(now.getDate() - 90); break;
        case '1y': from.setFullYear(now.getFullYear() - 1); break;
        default: from.setDate(now.getDate() - 30);
    }
    
    return {
        from: from.toISOString().split('T')[0],
        to: now.toISOString().split('T')[0]
    };
}

module.exports = {
    formatCurrency,
    generateOrderNumber,
    isValidEmail,
    sanitizeString,
    getDateRange
};