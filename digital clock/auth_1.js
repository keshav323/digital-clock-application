
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Authentication token is required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

        // Verify user still exists
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'User account no longer exists'
            });
        }

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            isGuest: decoded.isGuest || false
        };

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please log in again.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Authentication token is invalid'
            });
        }

        console.error('Authentication error:', error);
        res.status(500).json({
            error: 'Authentication failed',
            message: 'Unable to authenticate request'
        });
    }
};

// Optional authentication - for endpoints that work with or without auth
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await User.findById(decoded.userId);

        if (user) {
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                isGuest: decoded.isGuest || false
            };
        } else {
            req.user = null;
        }

        next();

    } catch (error) {
        // If token is invalid, just proceed without authentication
        req.user = null;
        next();
    }
};

// Rate limiting for specific endpoints
const createRateLimit = (windowMs, max, message) => {
    const rateLimit = require('express-rate-limit');
    return rateLimit({
        windowMs,
        max,
        message: {
            error: 'Rate limit exceeded',
            message: message || `Too many requests, please try again later.`
        },
        standardHeaders: true,
        legacyHeaders: false
    });
};

// Admin middleware (for future admin features)
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please log in to access this resource'
            });
        }

        const user = await User.findById(req.user.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({
                error: 'Admin access required',
                message: 'You do not have permission to access this resource'
            });
        }

        next();

    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({
            error: 'Authorization failed',
            message: 'Unable to verify admin access'
        });
    }
};

module.exports = {
    authenticateToken,
    optionalAuth,
    createRateLimit,
    requireAdmin
};
