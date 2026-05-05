// routes/orderRoutes.js
const express = require('express');
const { body, query, param } = require('express-validator');
const orderController = require('../controllers/orderController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// ============================================
// SWAGGER TAGS DEFINITION
// ============================================

/**
 * @swagger
 * tags:
 *   - name: Orders
 *     description: Order management endpoints
 *   - name: Order Status
 *     description: Order status and payment management
 *   - name: Analytics
 *     description: Order statistics and reporting
 */

// ============================================
// ROUTES
// ============================================

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Create a new order
 *     description: |
 *       Creates a new order with validated products.
 *       - Validates store exists and is active
 *       - Validates all products exist and have sufficient stock
 *       - Calculates totals (subtotal, shipping, total)
 *       - Returns complete order with items
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *                 message:
 *                   type: string
 *                   example: "Order ORD-20240429-001 created successfully"
 *       400:
 *         description: Validation error or invalid products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       500:
 *         description: Server error
 */
router.post(
    '/',
    authenticateToken,
    [
        body('store_id').notEmpty().withMessage('Store ID is required'),
        body('customer_name').trim().notEmpty().withMessage('Customer name is required'),
        body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
        body('items.*.product_id').notEmpty().withMessage('Product ID is required for each item'),
        body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
    ],
    orderController.createOrder
);

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: List orders
 *     description: |
 *       Retrieve orders with filtering and pagination.
 *       - Super admins see all orders
 *       - Merchant admins see only their orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: string
 *         description: Filter by store ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *         description: Filter by order status
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *         description: Filter by payment status
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date (YYYY-MM-DD)
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 */
router.get(
    '/',
    authenticateToken,
    orderController.listOrders
);

/**
 * @swagger
 * /api/v1/orders/stats/merchant:
 *   get:
 *     summary: Get merchant order statistics
 *     description: Revenue, order counts, and monthly breakdown for the authenticated merchant
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Merchant statistics
 */
router.get(
    '/stats/merchant',
    authenticateToken,
    orderController.getMerchantStats
);

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Get order by ID
 *     description: Retrieve complete order details including items and status history
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Order UUID
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get(
    '/:id',
    authenticateToken,
    [
        param('id').isUUID().withMessage('Valid order ID (UUID) is required')
    ],
    orderController.getOrder
);

/**
 * @swagger
 * /api/v1/orders/number/{orderNumber}:
 *   get:
 *     summary: Get order by order number
 *     description: Lookup order using the human-readable order number (e.g., ORD-20240429-001)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Order number (e.g., ORD-20240429-001)
 *     responses:
 *       200:
 *         description: Order details
 *       404:
 *         description: Order not found
 */
router.get(
    '/number/:orderNumber',
    authenticateToken,
    orderController.getOrderByNumber
);

/**
 * @swagger
 * /api/v1/orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     description: |
 *       Update the status of an order. Valid transitions:
 *       - pending → confirmed, cancelled
 *       - confirmed → processing, cancelled
 *       - processing → shipped, cancelled
 *       - shipped → delivered, cancelled
 *       - delivered → refunded
 *     tags: [Order Status]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, processing, shipped, delivered, cancelled, refunded]
 *                 example: confirmed
 *               notes:
 *                 type: string
 *                 example: "Payment verified, preparing shipment"
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status transition
 */
router.patch(
    '/:id/status',
    authenticateToken,
    [
        param('id').isUUID().withMessage('Valid order ID is required'),
        body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
            .withMessage('Invalid status value')
    ],
    orderController.updateStatus
);

/**
 * @swagger
 * /api/v1/orders/{id}/payment:
 *   patch:
 *     summary: Update payment status
 *     description: Update payment information and trigger status changes
 *     tags: [Order Status]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payment_status
 *             properties:
 *               payment_status:
 *                 type: string
 *                 enum: [pending, paid, failed, refunded]
 *                 example: paid
 *               payment_method:
 *                 type: string
 *                 example: "mobile_money"
 *               payment_reference:
 *                 type: string
 *                 example: "MM-123456789"
 *     responses:
 *       200:
 *         description: Payment status updated
 */
router.patch(
    '/:id/payment',
    authenticateToken,
    [
        param('id').isUUID().withMessage('Valid order ID is required'),
        body('payment_status').isIn(['pending', 'paid', 'failed', 'refunded'])
            .withMessage('Invalid payment status')
    ],
    orderController.updatePayment
);

/**
 * @swagger
 * /api/v1/orders/{id}/cancel:
 *   post:
 *     summary: Cancel an order
 *     description: Cancel order if it hasn't been delivered or refunded
 *     tags: [Order Status]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Customer requested cancellation"
 *     responses:
 *       200:
 *         description: Order cancelled
 *       400:
 *         description: Cannot cancel delivered/refunded order
 */
router.post(
    '/:id/cancel',
    authenticateToken,
    [
        param('id').isUUID().withMessage('Valid order ID is required')
    ],
    orderController.cancelOrder
);

module.exports = router;