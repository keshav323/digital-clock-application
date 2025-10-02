
const express = require('express');
const ClockSession = require('../models/ClockSession');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Start a new Pomodoro session
router.post('/start', async (req, res) => {
    try {
        const { type = 'work', duration, task, ambientSound } = req.body;

        if (!duration || duration < 60 || duration > 3600) {
            return res.status(400).json({
                error: 'Invalid duration',
                message: 'Duration must be between 1 minute and 1 hour'
            });
        }

        // Check if user has an active session
        const activeSession = await ClockSession.findOne({
            userId: req.user.userId,
            endTime: null,
            type: { $in: ['pomodoro', 'break', 'focus'] }
        });

        if (activeSession) {
            return res.status(409).json({
                error: 'Session already active',
                message: 'Please complete or stop your current session first'
            });
        }

        // Create new session
        const session = new ClockSession({
            userId: req.user.userId,
            type: type === 'work' ? 'pomodoro' : 'break',
            subType: type,
            plannedDuration: duration,
            data: {
                task: task || '',
                ambientSound: ambientSound || 'none'
            }
        });

        await session.save();

        res.status(201).json({
            message: 'Pomodoro session started',
            session: {
                id: session._id,
                type: session.subType,
                startTime: session.startTime,
                plannedDuration: session.plannedDuration,
                task: session.data.task
            }
        });

    } catch (error) {
        console.error('Pomodoro start error:', error);
        res.status(500).json({
            error: 'Session start failed',
            message: 'Unable to start Pomodoro session'
        });
    }
});

// Complete current session
router.post('/complete', async (req, res) => {
    try {
        const { productivity, notes } = req.body;

        const session = await ClockSession.findOneAndUpdate(
            {
                userId: req.user.userId,
                endTime: null,
                type: { $in: ['pomodoro', 'break', 'focus'] }
            },
            {
                endTime: new Date(),
                completed: true,
                productivity: productivity || null,
                'data.notes': notes || ''
            },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({
                error: 'No active session',
                message: 'No active session found to complete'
            });
        }

        // Update user statistics
        if (session.type === 'pomodoro' && session.actualDuration) {
            await User.findByIdAndUpdate(req.user.userId, {
                $inc: {
                    'stats.completedPomodoros': 1,
                    'stats.totalFocusTime': Math.floor(session.actualDuration / 60), // convert to minutes
                    'stats.totalSessions': 1
                },
                $set: {
                    'stats.lastSessionDate': session.endTime
                }
            });
        }

        res.json({
            message: 'Session completed successfully',
            session: {
                id: session._id,
                type: session.subType,
                duration: session.actualDuration,
                completed: true
            }
        });

    } catch (error) {
        console.error('Pomodoro complete error:', error);
        res.status(500).json({
            error: 'Session completion failed',
            message: 'Unable to complete session'
        });
    }
});

// Pause/Resume session
router.post('/pause', async (req, res) => {
    try {
        const { pausedTime = 0 } = req.body;

        const session = await ClockSession.findOneAndUpdate(
            {
                userId: req.user.userId,
                endTime: null,
                type: { $in: ['pomodoro', 'break', 'focus'] }
            },
            {
                $inc: { pausedTime: pausedTime }
            },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({
                error: 'No active session',
                message: 'No active session found to pause'
            });
        }

        res.json({
            message: 'Session pause recorded',
            totalPausedTime: session.pausedTime
        });

    } catch (error) {
        console.error('Pomodoro pause error:', error);
        res.status(500).json({
            error: 'Pause failed',
            message: 'Unable to record pause'
        });
    }
});

// Stop/Cancel session
router.post('/stop', async (req, res) => {
    try {
        const { reason = 'user_cancelled' } = req.body;

        const session = await ClockSession.findOneAndUpdate(
            {
                userId: req.user.userId,
                endTime: null,
                type: { $in: ['pomodoro', 'break', 'focus'] }
            },
            {
                endTime: new Date(),
                completed: false,
                interrupted: true,
                'data.interruptionReason': reason
            },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({
                error: 'No active session',
                message: 'No active session found to stop'
            });
        }

        res.json({
            message: 'Session stopped',
            session: {
                id: session._id,
                type: session.subType,
                duration: session.actualDuration,
                interrupted: true
            }
        });

    } catch (error) {
        console.error('Pomodoro stop error:', error);
        res.status(500).json({
            error: 'Session stop failed',
            message: 'Unable to stop session'
        });
    }
});

// Get current active session
router.get('/current', async (req, res) => {
    try {
        const session = await ClockSession.findOne({
            userId: req.user.userId,
            endTime: null,
            type: { $in: ['pomodoro', 'break', 'focus'] }
        });

        if (!session) {
            return res.json({ 
                session: null,
                message: 'No active session' 
            });
        }

        const now = new Date();
        const elapsed = Math.floor((now - session.startTime) / 1000) - session.pausedTime;
        const remaining = Math.max(0, session.plannedDuration - elapsed);

        res.json({
            session: {
                id: session._id,
                type: session.subType,
                startTime: session.startTime,
                plannedDuration: session.plannedDuration,
                elapsed: elapsed,
                remaining: remaining,
                task: session.data.task,
                ambientSound: session.data.ambientSound,
                pausedTime: session.pausedTime
            }
        });

    } catch (error) {
        console.error('Current session error:', error);
        res.status(500).json({
            error: 'Session fetch failed',
            message: 'Unable to fetch current session'
        });
    }
});

// Get session history
router.get('/history', async (req, res) => {
    try {
        const { page = 1, limit = 20, type, dateFrom, dateTo } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build query
        let query = { userId: req.user.userId };

        if (type && ['work', 'short_break', 'long_break'].includes(type)) {
            query.subType = type;
        }

        if (dateFrom || dateTo) {
            query.startTime = {};
            if (dateFrom) query.startTime.$gte = new Date(dateFrom);
            if (dateTo) query.startTime.$lte = new Date(dateTo);
        }

        const sessions = await ClockSession.find(query)
            .sort({ startTime: -1 })
            .limit(parseInt(limit))
            .skip(skip)
            .select('type subType startTime endTime plannedDuration actualDuration completed interrupted data.task productivity createdAt');

        const totalSessions = await ClockSession.countDocuments(query);

        res.json({
            sessions,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalSessions / parseInt(limit)),
                totalSessions,
                hasNext: skip + sessions.length < totalSessions,
                hasPrevious: parseInt(page) > 1
            }
        });

    } catch (error) {
        console.error('Session history error:', error);
        res.status(500).json({
            error: 'History fetch failed',
            message: 'Unable to fetch session history'
        });
    }
});

// Get productivity analytics
router.get('/analytics', async (req, res) => {
    try {
        const { period = 'week' } = req.query; // week, month, year

        let startDate;
        const endDate = new Date();

        switch (period) {
            case 'week':
                startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(endDate.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Aggregate session data
        const analytics = await ClockSession.aggregate([
            {
                $match: {
                    userId: req.user.userId,
                    startTime: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$startTime" } },
                        type: "$subType"
                    },
                    count: { $sum: 1 },
                    totalDuration: { $sum: "$actualDuration" },
                    completedSessions: {
                        $sum: { $cond: ["$completed", 1, 0] }
                    },
                    avgProductivity: { $avg: "$productivity" }
                }
            },
            {
                $group: {
                    _id: "$_id.date",
                    sessions: {
                        $push: {
                            type: "$_id.type",
                            count: "$count",
                            totalDuration: "$totalDuration",
                            completedSessions: "$completedSessions",
                            avgProductivity: "$avgProductivity"
                        }
                    },
                    totalSessions: { $sum: "$count" },
                    totalFocusTime: { $sum: "$totalDuration" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({ 
            period,
            analytics,
            summary: {
                totalDays: analytics.length,
                totalSessions: analytics.reduce((sum, day) => sum + day.totalSessions, 0),
                totalFocusTime: Math.floor(analytics.reduce((sum, day) => sum + day.totalFocusTime, 0) / 60), // minutes
                avgSessionsPerDay: analytics.length > 0 ? 
                    (analytics.reduce((sum, day) => sum + day.totalSessions, 0) / analytics.length).toFixed(1) : 0
            }
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            error: 'Analytics fetch failed',
            message: 'Unable to fetch productivity analytics'
        });
    }
});

module.exports = router;
