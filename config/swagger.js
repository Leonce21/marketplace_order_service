const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
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
            },
            schemas: {
                Order: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        order_number: { type: 'string' },
                        store_id: { type: 'string' },
                        merchant_id: { type: 'string' },
                        customer_name: { type: 'string' },
                        customer_email: { type: 'string', format: 'email' },
                        customer_phone: { type: 'string' },
                        status: { 
                            type: 'string', 
                            enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']
                        },
                        payment_status: {
                            type: 'string',
                            enum: ['pending', 'paid', 'failed', 'refunded']
                        },
                        subtotal: { type: 'number' },
                        shipping_cost: { type: 'number' },
                        tax_amount: { type: 'number' },
                        discount_amount: { type: 'number' },
                        total: { type: 'number' },
                        currency: { type: 'string', example: 'XAF' },
                        shipping_address: { type: 'string' },
                        notes: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        updated_at: { type: 'string', format: 'date-time' }
                    }
                },
                OrderItem: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        order_id: { type: 'string', format: 'uuid' },
                        product_id: { type: 'string' },
                        product_name: { type: 'string' },
                        quantity: { type: 'integer' },
                        unit_price: { type: 'number' },
                        total_price: { type: 'number' }
                    }
                },
                CreateOrderRequest: {
                    type: 'object',
                    required: ['store_id', 'customer_name', 'customer_email', 'items'],
                    properties: {
                        store_id: { type: 'string' },
                        customer_name: { type: 'string' },
                        customer_email: { type: 'string', format: 'email' },
                        customer_phone: { type: 'string' },
                        shipping_address: { type: 'string' },
                        notes: { type: 'string' },
                        currency: { type: 'string', default: 'XAF' },
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['product_id', 'quantity'],
                                properties: {
                                    product_id: { type: 'string' },
                                    quantity: { type: 'integer', minimum: 1 }
                                }
                            }
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        errors: { type: 'array', items: { type: 'string' } }
                    }
                }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: ['./routes/*.js']
};

const specs = swaggerJsdoc(options);

// Custom CSS to fix Vercel loading issues
const customCss = `
    .swagger-ui .topbar { display: none }
    body { margin: 0; }
`;

module.exports = {
    serve: swaggerUi.serve,
    setup: swaggerUi.setup(specs, {
        explorer: true,
        customCss,
        customSiteTitle: 'Order Service API',
        // Use CDN for swagger UI assets instead of local files
        swaggerOptions: {
            url: '/api-docs.json',
            layout: 'StandaloneLayout'
        }
    })
};