// services/orderService.js
const orderModel = require('../models/orderModel');
const productService = require('./productService');
const storeService = require('./storeService');

/**
 * Order Service - Business logic layer
 * Orchestrates between controllers, models, and external services
 */

// Shipping cost calculation (can be moved to config)
const SHIPPING_THRESHOLD = 100000; // Free shipping over 100,000 XAF
const SHIPPING_COST = 2500; // Standard shipping cost

/**
 * Calculate shipping cost based on subtotal
 */
function calculateShipping(subtotal) {
    return subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
}

/**
 * Create a new order
 * Validates store/products, calculates totals, persists order
 */
async function createOrder(orderData, authToken) {
    console.log('🛒 [OrderService] Starting order creation...');
    
    // Step 1: Validate store
    const store = await storeService.validateStore(orderData.store_id, authToken);
    
    // Step 2: Validate products and get pricing
    const productValidation = await productService.validateProducts(
        orderData.items, 
        authToken
    );
    
    if (!productValidation.isValid) {
        console.error('❌ [OrderService] Product validation failed:', productValidation.errors);
        throw new Error(`Product validation failed: ${productValidation.errors.join(', ')}`);
    }
    
    // Step 3: Calculate totals
    const subtotal = productValidation.subtotal;
    const shippingCost = calculateShipping(subtotal);
    const total = subtotal + shippingCost; // Add tax logic here if needed
    
    console.log(`💰 [OrderService] Calculated totals - Subtotal: ${subtotal}, Shipping: ${shippingCost}, Total: ${total}`);
    
    // Step 4: Prepare order data
    const orderPayload = {
        store_id: store.id,
        merchant_id: store.merchant_id,
        customer_name: orderData.customer_name,
        customer_email: orderData.customer_email,
        customer_phone: orderData.customer_phone,
        status: 'pending',
        payment_status: 'pending',
        subtotal,
        shipping_cost: shippingCost,
        tax_amount: 0, // TODO: Implement tax calculation
        discount_amount: 0, // TODO: Implement discount logic
        total,
        currency: orderData.currency || 'XAF',
        shipping_address: orderData.shipping_address,
        billing_address: orderData.billing_address || orderData.shipping_address,
        notes: orderData.notes,
        metadata: {
            store_name: store.name,
            ip_address: orderData.ip_address || null,
            user_agent: orderData.user_agent || null
        }
    };
    
    // Step 5: Create order in database
    const { orderId, orderNumber } = await orderModel.createOrder(
        orderPayload,
        productValidation.items
    );
    
    console.log(`✅ [OrderService] Order created successfully: ${orderNumber}`);
    
    // Step 6: Return complete order
    const createdOrder = await orderModel.getOrderById(orderId);
    
    return {
        success: true,
        data: createdOrder,
        message: `Order ${orderNumber} created successfully`
    };
}

/**
 * Get order by ID with full details
 */
async function getOrder(orderId) {
    console.log(`🔍 [OrderService] Fetching order: ${orderId}`);
    
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
        throw new Error('Order not found');
    }
    
    return {
        success: true,
        data: order
    };
}

/**
 * Get order by order number
 */
async function getOrderByNumber(orderNumber) {
    console.log(`🔍 [OrderService] Fetching order by number: ${orderNumber}`);
    
    const order = await orderModel.getOrderByNumber(orderNumber);
    
    if (!order) {
        throw new Error('Order not found');
    }
    
    return {
        success: true,
        data: order
    };
}

/**
 * List orders with filtering
 */
async function listOrders(queryParams, userRole, userMerchantId) {
    console.log(`🔍 [OrderService] Listing orders with params:`, queryParams);
    
    const filters = {};
    
    // Apply role-based filtering
    if (userRole === 'merchant_admin' && userMerchantId) {
        filters.merchant_id = userMerchantId;
    }
    
    // Apply query filters
    if (queryParams.store_id) filters.store_id = queryParams.store_id;
    if (queryParams.status) filters.status = queryParams.status;
    if (queryParams.payment_status) filters.payment_status = queryParams.payment_status;
    if (queryParams.customer_email) filters.customer_email = queryParams.customer_email;
    if (queryParams.date_from) filters.date_from = queryParams.date_from;
    if (queryParams.date_to) filters.date_to = queryParams.date_to;
    
    const page = parseInt(queryParams.page) || 1;
    const limit = parseInt(queryParams.limit) || 20;
    
    const result = await orderModel.listOrders(filters, page, limit);
    
    return {
        success: true,
        data: result.orders,
        pagination: result.pagination
    };
}

/**
 * Update order status with validation
 */
async function updateStatus(orderId, newStatus, changedBy, notes) {
    console.log(`📝 [OrderService] Updating order ${orderId} status to ${newStatus}`);
    
    const validTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'cancelled'],
        'delivered': ['refunded'],
        'cancelled': [],
        'refunded': []
    };
    
    // Get current order
    const order = await orderModel.getOrderById(orderId);
    if (!order) {
        throw new Error('Order not found');
    }
    
    // Validate status transition
    const allowedTransitions = validTransitions[order.status] || [];
    if (!allowedTransitions.includes(newStatus) && order.status !== newStatus) {
        throw new Error(`Invalid status transition: ${order.status} → ${newStatus}`);
    }
    
    const result = await orderModel.updateOrderStatus(orderId, newStatus, changedBy, notes);
    
    return {
        success: true,
        data: {
            order_id: orderId,
            previous_status: result.previousStatus,
            new_status: result.newStatus
        },
        message: `Order status updated to ${newStatus}`
    };
}

/**
 * Update payment status
 */
async function updatePayment(orderId, paymentStatus, paymentMethod, paymentReference) {
    console.log(`💳 [OrderService] Updating payment status for ${orderId}: ${paymentStatus}`);
    
    const order = await orderModel.getOrderById(orderId);
    if (!order) {
        throw new Error('Order not found');
    }
    
    await orderModel.updatePaymentStatus(orderId, paymentStatus, paymentMethod, paymentReference);
    
    // If payment is successful, auto-confirm order
    if (paymentStatus === 'paid' && order.status === 'pending') {
        await orderModel.updateOrderStatus(orderId, 'confirmed', 'system', 'Payment received');
    }
    
    return {
        success: true,
        message: `Payment status updated to ${paymentStatus}`
    };
}

/**
 * Get merchant dashboard statistics
 */
async function getMerchantStats(merchantId, queryParams) {
    console.log(`📊 [OrderService] Getting stats for merchant: ${merchantId}`);
    
    const stats = await orderModel.getMerchantStats(
        merchantId,
        queryParams.date_from,
        queryParams.date_to
    );
    
    return {
        success: true,
        data: stats
    };
}

/**
 * Cancel order
 */
async function cancelOrder(orderId, reason) {
    console.log(`🚫 [OrderService] Cancelling order: ${orderId}`);
    
    const order = await orderModel.getOrderById(orderId);
    if (!order) {
        throw new Error('Order not found');
    }
    
    if (['delivered', 'refunded'].includes(order.status)) {
        throw new Error('Cannot cancel delivered or refunded orders');
    }
    
    const result = await orderModel.updateOrderStatus(
        orderId, 
        'cancelled', 
        'system', 
        reason || 'Order cancelled by customer'
    );
    
    return {
        success: true,
        message: 'Order cancelled successfully'
    };
}

module.exports = {
    createOrder,
    getOrder,
    getOrderByNumber,
    listOrders,
    updateStatus,
    updatePayment,
    getMerchantStats,
    cancelOrder
};