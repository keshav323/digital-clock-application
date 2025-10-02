# Create MongoDB models
import os

# Create models directory
if not os.path.exists('models'):
    os.makedirs('models')

# User model
user_model = '''
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\\S+@\\S+\\.\\S+$/, 'Please enter a valid email']
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
'''

with open('models/User.js', 'w') as f:
    f.write(user_model)

# Clock Session model
clock_session_model = '''
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
'''

with open('models/ClockSession.js', 'w') as f:
    f.write(clock_session_model)

# Weather Cache model
weather_cache_model = '''
const mongoose = require('mongoose');

const weatherCacheSchema = new mongoose.Schema({
    location: {
        city: {
            type: String,
            required: true
        },
        country: String,
        coordinates: {
            lat: {
                type: Number,
                required: true
            },
            lon: {
                type: Number,
                required: true
            }
        }
    },
    
    // Current weather data
    current: {
        temperature: Number,
        feelsLike: Number,
        humidity: Number,
        pressure: Number,
        windSpeed: Number,
        windDirection: Number,
        visibility: Number,
        uvIndex: Number,
        
        condition: {
            main: String, // e.g., "Clear", "Clouds", "Rain"
            description: String, // e.g., "clear sky", "broken clouds"
            icon: String // weather icon code
        },
        
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    
    // Hourly forecast (next 24 hours)
    hourly: [{
        time: Date,
        temperature: Number,
        feelsLike: Number,
        humidity: Number,
        precipitation: Number,
        condition: {
            main: String,
            description: String,
            icon: String
        }
    }],
    
    // Daily forecast (next 7 days)
    daily: [{
        date: Date,
        temperature: {
            min: Number,
            max: Number,
            morning: Number,
            day: Number,
            evening: Number,
            night: Number
        },
        humidity: Number,
        precipitation: Number,
        condition: {
            main: String,
            description: String,
            icon: String
        },
        sunrise: Date,
        sunset: Date
    }],
    
    // Cache metadata
    source: {
        type: String,
        enum: ['openweather', 'weatherapi', 'accuweather'],
        required: true
    },
    cachedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: function() {
            return new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        }
    }
}, {
    timestamps: true
});

// Index for efficient location-based queries
weatherCacheSchema.index({ 
    'location.coordinates': '2dsphere'
});
weatherCacheSchema.index({ 
    'location.city': 1, 
    'location.country': 1,
    expiresAt: 1 
});

// TTL index to automatically remove expired cache entries
weatherCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('WeatherCache', weatherCacheSchema);
'''

with open('models/WeatherCache.js', 'w') as f:
    f.write(weather_cache_model)

print("Created MongoDB models: User, ClockSession, WeatherCache")