
const mongoose = require('mongoose');

const clockSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['pomodoro', 'break', 'focus'],
        required: true
    },
    subType: {
        type: String,
        enum: ['work', 'short_break', 'long_break', 'custom'],
        default: 'work'
    },

    // Timing
    startTime: {
        type: Date,
        required: true,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    plannedDuration: {
        type: Number, // in seconds
        required: true
    },
    actualDuration: {
        type: Number // in seconds, calculated on completion
    },

    // Status
    completed: {
        type: Boolean,
        default: false
    },
    interrupted: {
        type: Boolean,
        default: false
    },
    pausedTime: {
        type: Number,
        default: 0 // total paused time in seconds
    },

    // Session data
    data: {
        task: String, // what the user was working on
        notes: String,
        interruptions: Number,
        sessionNumber: Number, // pomodoro session number
        ambientSound: String,
        customSettings: mongoose.Schema.Types.Mixed
    },

    // Analytics
    productivity: {
        type: Number,
        min: 1,
        max: 5 // 1-5 rating set by user
    },
    tags: [String],

    // Device info
    device: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet'],
        default: 'desktop'
    },
    userAgent: String
}, {
    timestamps: true
});

// Indexes for efficient queries
clockSessionSchema.index({ userId: 1, startTime: -1 });
clockSessionSchema.index({ userId: 1, type: 1, startTime: -1 });
clockSessionSchema.index({ createdAt: -1 });

// Virtual for duration calculation
clockSessionSchema.virtual('duration').get(function() {
    if (this.endTime && this.startTime) {
        return Math.floor((this.endTime - this.startTime) / 1000) - this.pausedTime;
    }
    return null;
});

// Update actualDuration when session ends
clockSessionSchema.pre('save', function(next) {
    if (this.endTime && this.startTime && !this.actualDuration) {
        this.actualDuration = Math.floor((this.endTime - this.startTime) / 1000) - this.pausedTime;
    }
    next();
});

module.exports = mongoose.model('ClockSession', clockSessionSchema);
