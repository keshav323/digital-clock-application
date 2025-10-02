
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register a new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Email, password, and name are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                error: 'Invalid password',
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                error: 'User already exists',
                message: 'A user with this email already exists'
            });
        }

        // Create new user
        const user = new User({
            email,
            password,
            name,
            authProvider: 'local'
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: user.toJSON(),
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Registration failed',
            message: 'An error occurred while creating your account'
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Missing credentials',
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await User.findOne({ email }).select('+password');
        if (!user || !await user.comparePassword(password)) {
            return res.status(401).json({
                error: 'Invalid credentials',
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            user: user.toJSON(),
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login failed',
            message: 'An error occurred while logging you in'
        });
    }
});

// Guest access
router.post('/guest', async (req, res) => {
    try {
        // Generate a unique guest user
        const guestName = `Guest_${Date.now()}`;
        const guestEmail = `guest_${Date.now()}@temp.local`;

        const user = new User({
            email: guestEmail,
            name: guestName,
            authProvider: 'guest'
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email, isGuest: true },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '24h' } // Shorter expiration for guest users
        );

        res.json({
            message: 'Guest access granted',
            user: user.toJSON(),
            token,
            isGuest: true
        });

    } catch (error) {
        console.error('Guest access error:', error);
        res.status(500).json({
            error: 'Guest access failed',
            message: 'Unable to create guest session'
        });
    }
});

// Verify token
router.get('/verify', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account no longer exists'
            });
        }

        res.json({
            message: 'Token valid',
            user: user.toJSON(),
            isGuest: user.authProvider === 'guest'
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            error: 'Verification failed',
            message: 'Unable to verify token'
        });
    }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account no longer exists'
            });
        }

        // Generate new token
        const token = jwt.sign(
            { 
                userId: user._id, 
                email: user.email,
                isGuest: user.authProvider === 'guest'
            },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: user.authProvider === 'guest' ? '24h' : '7d' }
        );

        res.json({
            message: 'Token refreshed',
            token
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            error: 'Refresh failed',
            message: 'Unable to refresh token'
        });
    }
});

module.exports = router;
