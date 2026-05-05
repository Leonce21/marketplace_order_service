// controllers/orderController.js
const { validationResult } = require('express-validator');
const orderService = require('../services/orderService');

/**
 * Order Controller
 * Handles HTTP requests and delegates to services
 */

/**
 * @desc Create a new order
 * @route POST /api/v1/orders
 */
async function createOrder(req, res) {
    console.log('📥 [OrderController] POST /api/v1/orders');
    
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('❌ [OrderController] Validation errors:', errors.array());
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(e => e.msg)
        });
    }
    
    try {
        const authToken = req.headers.authorization;
        const result = await orderService.createOrder(req.body, authToken);
        res.status(201).json(result);
        
    } catch (error) {
        console.error('❌ [OrderController] Create order failed:', error.message);
        res.status(400).json({
            success: false,
            message: error.message,
            errors: [error.message]
        });
    }
}

/**
 * @desc Get order by ID
 * @route GET /api/v1/orders/:id
 */
async function getOrder(req, res) {
    console.log(`📥 [OrderController] GET /api/v1/orders/${req.params.id}`);
    
    try {
        const result = await orderService.getOrder(req.params.id);
        res.status(200).json(result);
        
    } catch (error) {
        console.error('❌ [OrderController] Get order failed:', error.message);
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * @desc Get order by order number
 * @route GET /api/v1/orders/number/:orderNumber
 */
async function getOrderByNumber(req, res) {
    console.log(`📥 [OrderController] GET /api/v1/orders/number/${req.params.orderNumber}`);
    
    try {
        const result = await orderService.getOrderByNumber(req.params.orderNumber);
        res.status(200).json(result);
        
    } catch (error) {
        console.error('❌ [OrderController] Get order by number failed:', error.message);
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * @desc List orders with filters
 * @route GET /api/v1/orders
 */
async function listOrders(req, res) {
    console.log('📥 [OrderController] GET /api/v1/orders', req.query);
    
    try {
        const userRole = req.user?.role;
        const userMerchantId = req.user?.tenant_id;
        
        const result = await orderService.listOrders(req.query, userRole, userMerchantId);
        res.status(200).json(result);
        
    } catch (error) {
        console.error('❌ [OrderController] List orders failed:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * @desc Update order status
 * @route PATCH /api/v1/orders/:id/status
 */
async function updateStatus(req, res) {
    console.log(`📥 [OrderController] PATCH /api/v1/orders/${req.params.id}/status`);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(e => e.msg)
        });
    }
    
    try {
        const { status, notes } = req.body;
        const changedBy = req.user?.email || 'system';
        
        const result = await orderService.updateStatus(
            req.params.id,
            status,
            changedBy,
            notes
        );
        
        res.status(200).json(result);
        
    } catch (error) {
        console.error('❌ [OrderController] Update status failed:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * @desc Update payment status
 * @route PATCH /api/v1/orders/:id/payment
 */
async function updatePayment(req, res) {
    console.log(`📥 [OrderController] PATCH /api/v1/orders/${req.params.id}/payment`);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(e => e.msg)
        });
    }
    
    try {
        const { payment_status, payment_method, payment_reference } = req.body;
        
        const result = await orderService.updatePayment(
            req.params.id,
            payment_status,
            payment_method,
            payment_reference
        );
        
        res.status(200).json(result);
        
    } catch (error) {
        console.error('❌ [OrderController] Update payment failed:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * @desc Get merchant statistics
 * @route GET /api/v1/orders/stats/merchant
 */
async function getMerchantStats(req, res) {
    console.log('📥 [OrderController] GET /api/v1/orders/stats/merchant');
    
    try {
        const merchantId = req.user?.tenant_id;
        if (!merchantId) {
            return res.status(400).json({
                success: false,
                message: 'Merchant ID not found in token'
            });
        }
        
        const result = await orderService.getMerchantStats(merchantId, req.query);
        res.status(200).json(result);
        
    } catch (error) {
        console.error('❌ [OrderController] Get stats failed:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * @desc Cancel order
 * @route POST /api/v1/orders/:id/cancel
 */
async function cancelOrder(req, res) {
    console.log(`📥 [OrderController] POST /api/v1/orders/${req.params.id}/cancel`);
    
    try {
        const { reason } = req.body;
        const result = await orderService.cancelOrder(req.params.id, reason);
        res.status(200).json(result);
        
    } catch (error) {
        console.error('❌ [OrderController] Cancel order failed:', error.message);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
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