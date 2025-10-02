# Create routes directory and API routes
import os

if not os.path.exists('routes'):
    os.makedirs('routes')

# Auth routes
auth_routes = '''
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
'''

with open('routes/auth.js', 'w') as f:
    f.write(auth_routes)

# User routes
user_routes = '''
const express = require('express');
const User = require('../models/User');
const ClockSession = require('../models/ClockSession');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get user profile
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account no longer exists'
            });
        }
        
        res.json({
            user: user.toJSON()
        });
        
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            error: 'Profile fetch failed',
            message: 'Unable to fetch user profile'
        });
    }
});

// Update user settings
router.patch('/settings', async (req, res) => {
    try {
        const { settings } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { $set: { settings: { ...settings } } },
            { new: true, runValidators: true }
        );
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account no longer exists'
            });
        }
        
        res.json({
            message: 'Settings updated successfully',
            settings: user.settings
        });
        
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({
            error: 'Settings update failed',
            message: 'Unable to update settings'
        });
    }
});

// Get user statistics
router.get('/stats', async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account no longer exists'
            });
        }
        
        // Calculate additional statistics from sessions
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Get session statistics
        const sessionStats = await ClockSession.aggregate([
            { $match: { userId: user._id, completed: true } },
            {
                $group: {
                    _id: null,
                    totalSessions: { $sum: 1 },
                    totalFocusTime: { $sum: '$actualDuration' },
                    averageSessionDuration: { $avg: '$actualDuration' }
                }
            }
        ]);
        
        // Get today's statistics
        const todayStats = await ClockSession.aggregate([
            { 
                $match: { 
                    userId: user._id, 
                    completed: true,
                    startTime: { $gte: startOfDay }
                } 
            },
            {
                $group: {
                    _id: null,
                    todaySessions: { $sum: 1 },
                    todayFocusTime: { $sum: '$actualDuration' }
                }
            }
        ]);
        
        // Get this week's statistics
        const weekStats = await ClockSession.aggregate([
            { 
                $match: { 
                    userId: user._id, 
                    completed: true,
                    startTime: { $gte: startOfWeek }
                } 
            },
            {
                $group: {
                    _id: null,
                    weekSessions: { $sum: 1 },
                    weekFocusTime: { $sum: '$actualDuration' }
                }
            }
        ]);
        
        const stats = {
            ...user.stats,
            calculated: {
                total: sessionStats[0] || { totalSessions: 0, totalFocusTime: 0, averageSessionDuration: 0 },
                today: todayStats[0] || { todaySessions: 0, todayFocusTime: 0 },
                week: weekStats[0] || { weekSessions: 0, weekFocusTime: 0 }
            }
        };
        
        res.json({ stats });
        
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({
            error: 'Stats fetch failed',
            message: 'Unable to fetch user statistics'
        });
    }
});

// Update world clocks
router.post('/world-clocks', async (req, res) => {
    try {
        const { worldClocks } = req.body;
        
        if (!Array.isArray(worldClocks)) {
            return res.status(400).json({
                error: 'Invalid data',
                message: 'World clocks must be an array'
            });
        }
        
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { $set: { worldClocks } },
            { new: true, runValidators: true }
        );
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account no longer exists'
            });
        }
        
        res.json({
            message: 'World clocks updated successfully',
            worldClocks: user.worldClocks
        });
        
    } catch (error) {
        console.error('World clocks update error:', error);
        res.status(500).json({
            error: 'Update failed',
            message: 'Unable to update world clocks'
        });
    }
});

// Delete account
router.delete('/account', async (req, res) => {
    try {
        // Delete user's sessions first
        await ClockSession.deleteMany({ userId: req.user.userId });
        
        // Delete user account
        const user = await User.findByIdAndDelete(req.user.userId);
        
        if (!user) {
            return res.status(404).json({
                error: 'User not found',
                message: 'User account no longer exists'
            });
        }
        
        res.json({
            message: 'Account deleted successfully'
        });
        
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({
            error: 'Deletion failed',
            message: 'Unable to delete account'
        });
    }
});

module.exports = router;
'''

with open('routes/user.js', 'w') as f:
    f.write(user_routes)

# Clock routes
clock_routes = '''
const express = require('express');
const moment = require('moment-timezone');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get current time for specified timezone
router.get('/time/:timezone?', (req, res) => {
    try {
        const timezone = req.params.timezone || 'UTC';
        const now = moment.tz(timezone);
        
        res.json({
            timezone,
            timestamp: now.toISOString(),
            unix: now.unix(),
            formatted: {
                '12h': now.format('h:mm:ss A'),
                '24h': now.format('HH:mm:ss'),
                date: now.format('YYYY-MM-DD'),
                dayOfWeek: now.format('dddd'),
                full: now.format('LLLL')
            },
            utcOffset: now.utcOffset() / 60, // hours
            isDST: now.isDST()
        });
        
    } catch (error) {
        console.error('Time fetch error:', error);
        res.status(400).json({
            error: 'Invalid timezone',
            message: 'The specified timezone is not valid'
        });
    }
});

// Get world clock times
router.post('/world-times', (req, res) => {
    try {
        const { timezones = [] } = req.body;
        
        if (!Array.isArray(timezones)) {
            return res.status(400).json({
                error: 'Invalid data',
                message: 'Timezones must be an array'
            });
        }
        
        const worldTimes = timezones.map(tz => {
            try {
                const now = moment.tz(tz.timezone);
                return {
                    city: tz.city,
                    country: tz.country,
                    timezone: tz.timezone,
                    timestamp: now.toISOString(),
                    formatted: {
                        '12h': now.format('h:mm:ss A'),
                        '24h': now.format('HH:mm:ss'),
                        date: now.format('MMM DD'),
                        dayOfWeek: now.format('ddd')
                    },
                    utcOffset: now.utcOffset() / 60,
                    isDST: now.isDST(),
                    isNextDay: now.date() !== moment.utc().date()
                };
            } catch (error) {
                return {
                    city: tz.city,
                    country: tz.country,
                    timezone: tz.timezone,
                    error: 'Invalid timezone'
                };
            }
        });
        
        res.json({ worldTimes });
        
    } catch (error) {
        console.error('World times fetch error:', error);
        res.status(500).json({
            error: 'Fetch failed',
            message: 'Unable to fetch world times'
        });
    }
});

// Get timezone list
router.get('/timezones', (req, res) => {
    try {
        const { search } = req.query;
        let timezones = moment.tz.names();
        
        if (search) {
            const searchLower = search.toLowerCase();
            timezones = timezones.filter(tz => 
                tz.toLowerCase().includes(searchLower)
            );
        }
        
        // Format timezone data
        const formattedTimezones = timezones.map(tz => {
            const now = moment.tz(tz);
            const parts = tz.split('/');
            
            return {
                timezone: tz,
                city: parts[parts.length - 1].replace(/_/g, ' '),
                region: parts[0],
                utcOffset: now.utcOffset() / 60,
                offsetString: now.format('Z'),
                isDST: now.isDST()
            };
        });
        
        res.json({ 
            timezones: formattedTimezones.slice(0, 100) // Limit results
        });
        
    } catch (error) {
        console.error('Timezones fetch error:', error);
        res.status(500).json({
            error: 'Fetch failed',
            message: 'Unable to fetch timezones'
        });
    }
});

// Convert time between timezones
router.post('/convert', (req, res) => {
    try {
        const { time, fromTimezone, toTimezone } = req.body;
        
        if (!time || !fromTimezone || !toTimezone) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'Time, fromTimezone, and toTimezone are required'
            });
        }
        
        const sourceTime = moment.tz(time, fromTimezone);
        const convertedTime = sourceTime.clone().tz(toTimezone);
        
        res.json({
            conversion: {
                from: {
                    time: sourceTime.format('YYYY-MM-DD HH:mm:ss'),
                    timezone: fromTimezone,
                    offset: sourceTime.format('Z')
                },
                to: {
                    time: convertedTime.format('YYYY-MM-DD HH:mm:ss'),
                    timezone: toTimezone,
                    offset: convertedTime.format('Z')
                },
                timeDifference: convertedTime.utcOffset() - sourceTime.utcOffset() // in minutes
            }
        });
        
    } catch (error) {
        console.error('Time conversion error:', error);
        res.status(400).json({
            error: 'Conversion failed',
            message: 'Unable to convert time - check your inputs'
        });
    }
});

module.exports = router;
'''

with open('routes/clock.js', 'w') as f:
    f.write(clock_routes)

print("Created API routes: auth, user, clock")