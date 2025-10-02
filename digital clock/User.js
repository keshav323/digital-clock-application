
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: function() {
            return this.authProvider === 'local';
        },
        minlength: 6
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    authProvider: {
        type: String,
        enum: ['local', 'google', 'guest'],
        default: 'local'
    },

    // User settings
    settings: {
        // Display settings
        theme: {
            type: String,
            enum: ['light', 'dark', 'auto'],
            default: 'auto'
        },
        colorScheme: {
            type: String,
            enum: ['default', 'neon', 'minimal', 'retro', 'nature'],
            default: 'default'
        },
        fontFamily: {
            type: String,
            enum: ['digital', 'sans-serif', 'serif', 'monospace'],
            default: 'digital'
        },

        // Time settings
        timeFormat: {
            type: String,
            enum: ['12', '24'],
            default: '12'
        },
        showSeconds: {
            type: Boolean,
            default: true
        },
        timezone: {
            type: String,
            default: 'auto'
        },

        // Weather settings
        weatherUnit: {
            type: String,
            enum: ['celsius', 'fahrenheit'],
            default: 'celsius'
        },
        windUnit: {
            type: String,
            enum: ['kmh', 'mph', 'ms'],
            default: 'kmh'
        },
        showWeather: {
            type: Boolean,
            default: true
        },
        weatherLocation: {
            city: String,
            country: String,
            lat: Number,
            lon: Number
        },

        // Pomodoro settings
        pomodoro: {
            workDuration: {
                type: Number,
                default: 25 // minutes
            },
            shortBreakDuration: {
                type: Number,
                default: 5 // minutes
            },
            longBreakDuration: {
                type: Number,
                default: 15 // minutes
            },
            sessionsUntilLongBreak: {
                type: Number,
                default: 4
            },
            autoStartBreaks: {
                type: Boolean,
                default: false
            },
            autoStartPomodoros: {
                type: Boolean,
                default: false
            },
            soundEnabled: {
                type: Boolean,
                default: true
            },
            ambientSound: {
                type: String,
                enum: ['none', 'rain', 'forest', 'whitenoise', 'ocean', 'cafe'],
                default: 'none'
            }
        },

        // Notification settings
        notifications: {
            enabled: {
                type: Boolean,
                default: true
            },
            sound: {
                type: Boolean,
                default: true
            },
            desktop: {
                type: Boolean,
                default: true
            }
        }
    },

    // World clocks
    worldClocks: [{
        city: {
            type: String,
            required: true
        },
        country: String,
        timezone: {
            type: String,
            required: true
        },
        order: {
            type: Number,
            default: 0
        },
        showWeather: {
            type: Boolean,
            default: true
        },
        coordinates: {
            lat: Number,
            lon: Number
        }
    }],

    // Statistics
    stats: {
        totalFocusTime: {
            type: Number,
            default: 0 // in minutes
        },
        completedPomodoros: {
            type: Number,
            default: 0
        },
        totalSessions: {
            type: Number,
            default: 0
        },
        longestStreak: {
            type: Number,
            default: 0
        },
        currentStreak: {
            type: Number,
            default: 0
        },
        lastSessionDate: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
    const userObject = this.toObject();
    delete userObject.password;
    return userObject;
};

module.exports = mongoose.model('User', userSchema);
