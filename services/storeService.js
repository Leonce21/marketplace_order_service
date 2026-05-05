// services/storeService.js
const axios = require('axios');

const STORE_BASE_URL = process.env.STORE_BASE_URL || 'http://localhost:4001';

/**
 * Store Service Client
 * Handles communication with the Store microservice
 */

/**
 * Get store details by ID
 * @param {string} storeId - Store ID
 * @param {string} authToken - Bearer token for authentication
 */
async function getStoreById(storeId, authToken) {
    console.log(`🔍 [StoreService] Fetching store: ${storeId}`);
    
    try {
        const response = await axios.get(
            `${STORE_BASE_URL}/api/v1/stores/${storeId}`,
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': authToken
                },
                timeout: 5000
            }
        );
        
        if (response.data && response.data.success) {
            console.log(`✅ [StoreService] Store found: ${response.data.data.name}`);
            return response.data.data;
        }
        
        console.log(`⚠️ [StoreService] Store not found: ${storeId}`);
        return null;
        
    } catch (error) {
        console.error(`❌ [StoreService] Error fetching store ${storeId}:`, error.message);
        throw new Error(`Store service unavailable: ${error.message}`);
    }
}

/**
 * Validate store exists and is active
 * @param {string} storeId - Store ID
 * @param {string} authToken - Bearer token
 */
async function validateStore(storeId, authToken) {
    console.log(`🔍 [StoreService] Validating store: ${storeId}`);
    
    const store = await getStoreById(storeId, authToken);
    
    if (!store) {
        throw new Error('Store not found');
    }
    
    if (store.status !== 'active') {
        throw new Error('Store is not active');
    }
    
    if (store.deleted_at) {
        throw new Error('Store has been deleted');
    }
    
    console.log(`✅ [StoreService] Store validated: ${store.name} (merchant: ${store.merchant_id})`);
    
    return {
        id: String(store.id),
        name: store.name,
        merchant_id: String(store.merchant_id),
        status: store.status
    };
}

module.exports = {
    getStoreById,
    validateStore
};