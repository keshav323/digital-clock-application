
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
