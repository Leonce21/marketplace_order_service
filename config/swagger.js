// config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

/**
 * Swagger/OpenAPI configuration for Order Service
 */
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Order Service API',
            version: '1.0.0',
            description: `
## Order Microservice for SaaS Marketplace

Handles order creation, management, and lifecycle tracking.
            `,
        },
        
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token'
                }
            },
            schemas: {
                Order: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
                        order_number: { type: 'string', example: 'ORD-20240429-001' },
                        store_id: { type: 'string', example: '10' },
                        merchant_id: { type: 'string', example: '2' },
                        customer_name: { type: 'string', example: 'John Doe' },
                        customer_email: { type: 'string', format: 'email', example: 'john@example.com' },
                        customer_phone: { type: 'string', example: '+237 6XX XXX XXX' },
                        status: { 
                            type: 'string', 
                            enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
                            example: 'pending'
                        },
                        payment_status: {
                            type: 'string',
                            enum: ['pending', 'paid', 'failed', 'refunded'],
                            example: 'pending'
                        },
                        subtotal: { type: 'number', example: 50000 },
                        shipping_cost: { type: 'number', example: 2500 },
                        tax_amount: { type: 'number', example: 0 },
                        discount_amount: { type: 'number', example: 0 },
                        total: { type: 'number', example: 52500 },
                        currency: { type: 'string', example: 'XAF' },
                        shipping_address: { type: 'string', example: '123 Main St, Douala' },
                        notes: { type: 'string', example: 'Leave at front door' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' }
                    }
                },
                OrderItem: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        order_id: { type: 'string', format: 'uuid' },
                        product_id: { type: 'string', example: 'bb1412ee-372b-4680-8d1d-ccd7e35eea47' },
                        product_name: { type: 'string', example: 'Chair' },
                        quantity: { type: 'integer', example: 2 },
                        unit_price: { type: 'number', example: 10000 },
                        total_price: { type: 'number', example: 20000 }
                    }
                },
                CreateOrderRequest: {
                    type: 'object',
                    required: ['store_id', 'customer_name', 'customer_email', 'items'],
                    properties: {
                        store_id: { type: 'string', example: '10' },
                        customer_name: { type: 'string', example: 'John Doe' },
                        customer_email: { type: 'string', format: 'email', example: 'john@example.com' },
                        customer_phone: { type: 'string', example: '+237 6XX XXX XXX' },
                        shipping_address: { type: 'string', example: '123 Main St, Douala' },
                        notes: { type: 'string', example: 'Special instructions' },
                        currency: { type: 'string', default: 'XAF', example: 'XAF' },
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['product_id', 'quantity'],
                                properties: {
                                    product_id: { type: 'string', example: 'bb1412ee-372b-4680-8d1d-ccd7e35eea47' },
                                    quantity: { type: 'integer', minimum: 1, example: 2 }
                                }
                            }
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'Error message' },
                        errors: { type: 'array', items: { type: 'string' } }
                    }
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: ['./routes/*.js'] // Path to route files with JSDoc annotations
};

const specs = swaggerJsdoc(options);

module.exports = {
    serve: swaggerUi.serve,
    setup: swaggerUi.setup(specs, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Order Service API'
    })
};