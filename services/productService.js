// services/productService.js
const axios = require('axios');

const PRODUCT_BASE_URL = process.env.PRODUCT_BASE_URL || 'http://localhost:4002';

/**
 * Product Service Client
 * Handles communication with the Product microservice
 */

/**
 * Get product details by ID
 * @param {string} productId - Product UUID
 * @param {string} authToken - Bearer token for authentication
 */
async function getProductById(productId, authToken) {
    console.log(`🔍 [ProductService] Fetching product: ${productId}`);
    
    try {
        const response = await axios.get(
            `${PRODUCT_BASE_URL}/api/v1/products/${productId}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': authToken
                },
                timeout: 5000
            }
        );
        
        if (response.data && response.data.success) {
            console.log(`✅ [ProductService] Product found: ${response.data.data.name}`);
            return response.data.data;
        }
        
        console.log(`⚠️ [ProductService] Product not found: ${productId}`);
        return null;
        
    } catch (error) {
        console.error(`❌ [ProductService] Error fetching product ${productId}:`, error.message);
        throw new Error(`Product service unavailable: ${error.message}`);
    }
}

/**
 * Validate multiple products and calculate totals
 * @param {Array} items - Array of {product_id, quantity}
 * @param {string} authToken - Bearer token
 */
async function validateProducts(items, authToken) {
    console.log(`🔍 [ProductService] Validating ${items.length} products`);
    
    const validatedItems = [];
    let subtotal = 0;
    const errors = [];
    
    for (const item of items) {
        try {
            const product = await getProductById(item.product_id, authToken);
            
            if (!product) {
                errors.push(`Product not found: ${item.product_id}`);
                continue;
            }
            
            // Check if product is active
            if (product.status !== 'active') {
                errors.push(`Product ${product.name} is not available`);
                continue;
            }
            
            // Check stock availability
            const availableQty = product.quantity || 0;
            if (availableQty < item.quantity) {
                errors.push(`Insufficient stock for ${product.name}. Available: ${availableQty}, Requested: ${item.quantity}`);
                continue;
            }
            
            const unitPrice = parseFloat(product.price) || 0;
            const totalPrice = unitPrice * item.quantity;
            subtotal += totalPrice;
            
            validatedItems.push({
                product_id: product.id,
                product_name: product.name,
                product_sku: product.sku || product.slug,
                quantity: item.quantity,
                unit_price: unitPrice,
                total_price: totalPrice,
                product_image_url: product.images?.[0]?.url || null,
                stock_available: availableQty
            });
            
        } catch (error) {
            errors.push(`Failed to validate product ${item.product_id}: ${error.message}`);
        }
    }
    
    console.log(`✅ [ProductService] Validation complete: ${validatedItems.length} valid, ${errors.length} errors`);
    
    return {
        items: validatedItems,
        subtotal,
        errors,
        isValid: errors.length === 0 && validatedItems.length > 0
    };
}

module.exports = {
    getProductById,
    validateProducts
};