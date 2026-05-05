// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

/**
 * JWT Authentication Middleware
 * Verifies Bearer token and extracts user info
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        console.log('🚫 [Auth] No token provided');
        return res.status(401).json({
            success: false,
            message: 'Access token required',
            errors: ['No authorization token provided']
        });
    }
    
    try {
        const decoded = jwt.decode(token);
        
        // Attach user info to request
        req.user = {
            user_id: decoded.user_id,
            tenant_id: decoded.tenant_id,
            role: decoded.role,
            email: decoded.email
        };
        
        console.log(`✅ [Auth] Token verified for user: ${decoded.user_id}, role: ${decoded.role}`);
        next();
        
    } catch (error) {
        console.error('🚫 [Auth] Token verification failed:', error.message);
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token',
            errors: [error.message]
        });
    }
}

/**
 * Role-based authorization middleware
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            console.log(`🚫 [Auth] Role ${req.user.role} not allowed. Required: ${allowedRoles.join(', ')}`);
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions',
                errors: [`Role '${req.user.role}' is not authorized for this action`]
            });
        }
        
        next();
    };
}

/**
 * Optional auth - attaches user if token present, doesn't block if missing
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = {
                user_id: decoded.user_id,
                tenant_id: decoded.tenant_id,
                role: decoded.role
            };
        } catch (error) {
            // Silently fail for optional auth
            console.log('⚠️ [Auth] Optional auth failed:', error.message);
        }
    }
    
    next();
}

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth
};