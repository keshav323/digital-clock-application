
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const clockRoutes = require('./routes/clock');
const weatherRoutes = require('./routes/weather');
const pomodoroRoutes = require('./routes/pomodoro');

// Import models
const User = require('./models/User');
const ClockSession = require('./models/ClockSession');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/digital-clock-pro';

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Store active socket connections
const activeConnections = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);

    // Store connection
    activeConnections.set(socket.id, {
        socketId: socket.id,
        connectedAt: new Date(),
        userId: null
    });

    // Handle user authentication
    socket.on('authenticate', (data) => {
        if (data.userId) {
            const connection = activeConnections.get(socket.id);
            if (connection) {
                connection.userId = data.userId;
                socket.join(`user_${data.userId}`);
                console.log(`🔐 User ${data.userId} authenticated on socket ${socket.id}`);
            }
        }
    });

    // Handle real-time clock synchronization
    socket.on('time_sync', (data) => {
        socket.broadcast.emit('time_sync', {
            timestamp: Date.now(),
            timezone: data.timezone
        });
    });

    // Handle world clock updates
    socket.on('world_clock_update', (data) => {
        const connection = activeConnections.get(socket.id);
        if (connection && connection.userId) {
            // Broadcast to other sessions of the same user
            socket.to(`user_${connection.userId}`).emit('world_clock_updated', data);
        }
    });

    // Handle Pomodoro timer events
    socket.on('pomodoro_start', (data) => {
        console.log('🍅 Pomodoro started:', data);
        const connection = activeConnections.get(socket.id);
        if (connection && connection.userId) {
            // Save session to database
            const session = new ClockSession({
                userId: connection.userId,
                type: 'pomodoro',
                startTime: new Date(),
                data: data
            });
            session.save();

            // Broadcast to user's other devices
            socket.to(`user_${connection.userId}`).emit('pomodoro_started', data);
        }
    });

    socket.on('pomodoro_complete', (data) => {
        console.log('✅ Pomodoro completed:', data);
        const connection = activeConnections.get(socket.id);
        if (connection && connection.userId) {
            // Update session in database
            ClockSession.findOneAndUpdate(
                { 
                    userId: connection.userId, 
                    type: 'pomodoro',
                    endTime: null 
                },
                { 
                    endTime: new Date(),
                    completed: true,
                    $set: { 'data.completedDuration': data.duration }
                }
            ).exec();

            // Broadcast completion
            socket.to(`user_${connection.userId}`).emit('pomodoro_completed', data);
        }
    });

    // Handle settings synchronization
    socket.on('settings_update', (data) => {
        const connection = activeConnections.get(socket.id);
        if (connection && connection.userId) {
            // Update user settings in database
            User.findByIdAndUpdate(connection.userId, {
                $set: { settings: data }
            }).exec();

            // Broadcast to user's other devices
            socket.to(`user_${connection.userId}`).emit('settings_updated', data);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('👋 User disconnected:', socket.id);
        activeConnections.delete(socket.id);
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/clock', clockRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/pomodoro', pomodoroRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeConnections: activeConnections.size
    });
});

// Time endpoint for synchronization
app.get('/api/time', (req, res) => {
    const now = new Date();
    res.json({
        timestamp: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
});

// Cleanup inactive connections every 5 minutes
cron.schedule('*/5 * * * *', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    let cleaned = 0;

    for (const [socketId, connection] of activeConnections.entries()) {
        if (connection.connectedAt < fiveMinutesAgo) {
            activeConnections.delete(socketId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} inactive connections`);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested resource was not found'
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Digital Clock Pro server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Socket.IO enabled for real-time features`);
});

module.exports = { app, server, io };
