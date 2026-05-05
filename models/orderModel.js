// models/orderModel.js
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Order Model - Raw SQL queries for order management
 * No ORM/Sequelize - direct MySQL queries with parameterized statements
 * NOTE: Table creation is handled by migrations.js, not here
 */

/**
 * Generate unique order number
 * Format: ORD-YYYYMMDD-XXX
 */
function generateOrderNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 900 + 100);
    return `ORD-${dateStr}-${random}`;
}

/**
 * Create a new order with items
 */
async function createOrder(orderData, itemsData) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const orderId = uuidv4();
        const orderNumber = generateOrderNumber();
        
        console.log(`📝 [OrderModel] Creating order ${orderNumber} for store ${orderData.store_id}`);
        
        const [orderResult] = await connection.execute(
            `INSERT INTO orders (
                id, order_number, store_id, merchant_id, customer_name, 
                customer_email, customer_phone, status, payment_status,
                subtotal, shipping_cost, tax_amount, discount_amount, total,
                currency, shipping_address, billing_address, notes, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderId, orderNumber, orderData.store_id, orderData.merchant_id,
                orderData.customer_name, orderData.customer_email,
                orderData.customer_phone || null,
                orderData.status || 'pending',
                orderData.payment_status || 'pending',
                orderData.subtotal || 0,
                orderData.shipping_cost || 0,
                orderData.tax_amount || 0,
                orderData.discount_amount || 0,
                orderData.total || 0,
                orderData.currency || 'XAF',
                orderData.shipping_address || null,
                orderData.billing_address || null,
                orderData.notes || null,
                orderData.metadata ? JSON.stringify(orderData.metadata) : null
            ]
        );
        
        console.log(`✅ [OrderModel] Order header created: ${orderId}`);
        
        const itemIds = [];
        for (const item of itemsData) {
            const itemId = uuidv4();
            await connection.execute(
                `INSERT INTO order_items (
                    id, order_id, product_id, product_name, product_sku,
                    quantity, unit_price, total_price, product_image_url, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    itemId, orderId, item.product_id, item.product_name,
                    item.product_sku || null, item.quantity, item.unit_price,
                    item.total_price, item.product_image_url || null,
                    item.metadata ? JSON.stringify(item.metadata) : null
                ]
            );
            itemIds.push(itemId);
        }
        
        console.log(`✅ [OrderModel] ${itemsData.length} order items created`);
        
        await connection.execute(
            `INSERT INTO order_status_history (id, order_id, new_status, notes) VALUES (?, ?, ?, ?)`,
            [uuidv4(), orderId, 'pending', 'Order created']
        );
        
        await connection.commit();
        console.log(`✅ [OrderModel] Transaction committed for order ${orderNumber}`);
        
        return { orderId, orderNumber };
        
    } catch (error) {
        await connection.rollback();
        console.error('❌ [OrderModel] Transaction rolled back:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Get order by ID with items and history
 */
async function getOrderById(orderId) {
    console.log(`🔍 [OrderModel] Fetching order: ${orderId}`);
    
    const [orders] = await pool.execute(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    
    if (orders.length === 0) {
        console.log(`⚠️ [OrderModel] Order not found: ${orderId}`);
        return null;
    }
    
    const order = orders[0];
    const [items] = await pool.execute(`SELECT * FROM order_items WHERE order_id = ?`, [orderId]);
    const [history] = await pool.execute(
        `SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC`,
        [orderId]
    );
    
    console.log(`✅ [OrderModel] Order found with ${items.length} items`);
    
    return { ...order, items, status_history: history };
}

/**
 * Get order by order number
 */
async function getOrderByNumber(orderNumber) {
    console.log(`🔍 [OrderModel] Fetching order by number: ${orderNumber}`);
    
    const [orders] = await pool.execute(`SELECT * FROM orders WHERE order_number = ?`, [orderNumber]);
    if (orders.length === 0) return null;
    
    const order = orders[0];
    const [items] = await pool.execute(`SELECT * FROM order_items WHERE order_id = ?`, [order.id]);
    
    return { ...order, items };
}

/**
 * List orders with filters and pagination
 */
async function listOrders(filters = {}, page = 1, limit = 20) {
    console.log(`🔍 [OrderModel] Listing orders with filters:`, filters);
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (filters.store_id) { whereClause += ' AND store_id = ?'; params.push(filters.store_id); }
    if (filters.merchant_id) { whereClause += ' AND merchant_id = ?'; params.push(filters.merchant_id); }
    if (filters.status) { whereClause += ' AND status = ?'; params.push(filters.status); }
    if (filters.payment_status) { whereClause += ' AND payment_status = ?'; params.push(filters.payment_status); }
    if (filters.customer_email) { whereClause += ' AND customer_email = ?'; params.push(filters.customer_email); }
    if (filters.date_from) { whereClause += ' AND created_at >= ?'; params.push(filters.date_from); }
    if (filters.date_to) { whereClause += ' AND created_at <= ?'; params.push(filters.date_to); }
    
    const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM orders ${whereClause}`, params);
    const total = countResult[0].total;
    
    const offset = (page - 1) * limit;
    const [orders] = await pool.execute(
        `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );
    
    console.log(`✅ [OrderModel] Found ${orders.length} orders (total: ${total})`);
    
    return {
        orders,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    };
}

/**
 * Update order status with history tracking
 */
async function updateOrderStatus(orderId, newStatus, changedBy = 'system', notes = '') {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        console.log(`📝 [OrderModel] Updating order ${orderId} status to: ${newStatus}`);
        
        const [current] = await connection.execute(`SELECT status FROM orders WHERE id = ?`, [orderId]);
        if (current.length === 0) throw new Error('Order not found');
        
        const previousStatus = current[0].status;
        
        await connection.execute(`UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?`, [newStatus, orderId]);
        
        await connection.execute(
            `INSERT INTO order_status_history (id, order_id, previous_status, new_status, changed_by, notes) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), orderId, previousStatus, newStatus, changedBy, notes]
        );
        
        await connection.commit();
        console.log(`✅ [OrderModel] Status updated: ${previousStatus} → ${newStatus}`);
        
        return { previousStatus, newStatus };
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Update payment status
 */
async function updatePaymentStatus(orderId, paymentStatus, paymentMethod = null, paymentReference = null) {
    console.log(`📝 [OrderModel] Updating payment status for ${orderId}: ${paymentStatus}`);
    
    const [result] = await pool.execute(
        `UPDATE orders SET payment_status = ?, payment_method = ?, payment_reference = ?, updated_at = NOW() WHERE id = ?`,
        [paymentStatus, paymentMethod, paymentReference, orderId]
    );
    
    return result.affectedRows > 0;
}

/**
 * Get merchant revenue statistics
 */
async function getMerchantStats(merchantId, dateFrom = null, dateTo = null) {
    console.log(`📊 [OrderModel] Getting stats for merchant: ${merchantId}`);
    
    let dateFilter = '';
    const params = [merchantId];
    
    if (dateFrom) { dateFilter += ' AND created_at >= ?'; params.push(dateFrom); }
    if (dateTo) { dateFilter += ' AND created_at <= ?'; params.push(dateTo); }
    
    const [stats] = await pool.execute(
        `SELECT COUNT(*) as total_orders,
            SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
            SUM(total) as total_revenue,
            SUM(subtotal) as total_subtotal,
            SUM(shipping_cost) as total_shipping,
            AVG(total) as average_order_value
        FROM orders WHERE merchant_id = ? ${dateFilter}`,
        params
    );
    
    const [monthly] = await pool.execute(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
            COUNT(*) as orders_count,
            SUM(total) as revenue
        FROM orders WHERE merchant_id = ? AND status = 'delivered' ${dateFilter}
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY month DESC LIMIT 12`,
        params
    );
    
    console.log(`✅ [OrderModel] Stats retrieved for merchant ${merchantId}`);
    
    return { summary: stats[0], monthly_breakdown: monthly };
}

/**
 * Soft delete order (mark as cancelled)
 */
async function deleteOrder(orderId) {
    console.log(`🗑️ [OrderModel] Cancelling order: ${orderId}`);
    
    const [result] = await pool.execute(
        `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [orderId]
    );
    
    return result.affectedRows > 0;
}

module.exports = {
    createOrder,
    getOrderById,
    getOrderByNumber,
    listOrders,
    updateOrderStatus,
    updatePaymentStatus,
    getMerchantStats,
    deleteOrder,
    pool
};