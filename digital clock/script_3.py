# Create remaining routes - weather and pomodoro

# Weather routes
weather_routes = '''
const express = require('express');
const axios = require('axios');
const WeatherCache = require('../models/WeatherCache');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Weather API configuration
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Get current weather for coordinates
router.get('/current/:lat/:lon', async (req, res) => {
    try {
        const { lat, lon } = req.params;
        const { units = 'metric' } = req.query;
        
        // Validate coordinates
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({
                error: 'Invalid coordinates',
                message: 'Valid latitude and longitude are required'
            });
        }
        
        // Check cache first
        const cacheKey = { 
            'location.coordinates.lat': parseFloat(lat),
            'location.coordinates.lon': parseFloat(lon),
            expiresAt: { $gt: new Date() }
        };
        
        let cachedWeather = await WeatherCache.findOne(cacheKey);
        
        if (cachedWeather) {
            return res.json({
                weather: cachedWeather.current,
                cached: true,
                location: cachedWeather.location
            });
        }
        
        // Fetch from API if no cache or expired
        if (!WEATHER_API_KEY) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Weather service is not configured'
            });
        }
        
        const weatherResponse = await axios.get(`${WEATHER_BASE_URL}/weather`, {
            params: {
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                appid: WEATHER_API_KEY,
                units
            },
            timeout: 5000
        });
        
        const weatherData = weatherResponse.data;
        
        // Process weather data
        const processedWeather = {
            temperature: Math.round(weatherData.main.temp),
            feelsLike: Math.round(weatherData.main.feels_like),
            humidity: weatherData.main.humidity,
            pressure: weatherData.main.pressure,
            windSpeed: weatherData.wind?.speed || 0,
            windDirection: weatherData.wind?.deg || 0,
            visibility: weatherData.visibility ? weatherData.visibility / 1000 : null, // km
            uvIndex: null, // Not available in current weather endpoint
            condition: {
                main: weatherData.weather[0].main,
                description: weatherData.weather[0].description,
                icon: weatherData.weather[0].icon
            },
            timestamp: new Date()
        };
        
        // Cache the weather data
        const weatherCache = new WeatherCache({
            location: {
                city: weatherData.name,
                country: weatherData.sys.country,
                coordinates: {
                    lat: parseFloat(lat),
                    lon: parseFloat(lon)
                }
            },
            current: processedWeather,
            source: 'openweather'
        });
        
        await weatherCache.save();
        
        res.json({
            weather: processedWeather,
            cached: false,
            location: weatherCache.location
        });
        
    } catch (error) {
        console.error('Weather fetch error:', error);
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Weather service is temporarily unavailable'
            });
        }
        
        if (error.response?.status === 401) {
            return res.status(503).json({
                error: 'Service configuration error',
                message: 'Weather service is not properly configured'
            });
        }
        
        res.status(500).json({
            error: 'Weather fetch failed',
            message: 'Unable to fetch weather data'
        });
    }
});

// Get weather by city name
router.get('/city/:cityName', async (req, res) => {
    try {
        const { cityName } = req.params;
        const { units = 'metric' } = req.query;
        
        if (!cityName) {
            return res.status(400).json({
                error: 'Missing city name',
                message: 'City name is required'
            });
        }
        
        if (!WEATHER_API_KEY) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Weather service is not configured'
            });
        }
        
        // First get city coordinates
        const geoResponse = await axios.get(`http://api.openweathermap.org/geo/1.0/direct`, {
            params: {
                q: cityName,
                limit: 1,
                appid: WEATHER_API_KEY
            },
            timeout: 5000
        });
        
        if (!geoResponse.data || geoResponse.data.length === 0) {
            return res.status(404).json({
                error: 'City not found',
                message: `Could not find weather data for "${cityName}"`
            });
        }
        
        const location = geoResponse.data[0];
        
        // Forward to coordinate-based endpoint
        req.params.lat = location.lat;
        req.params.lon = location.lon;
        
        // Call the coordinate-based handler
        return router._router.stack.find(layer => 
            layer.route?.path === '/current/:lat/:lon'
        ).route.stack[0].handle(req, res);
        
    } catch (error) {
        console.error('Weather by city error:', error);
        res.status(500).json({
            error: 'Weather fetch failed',
            message: 'Unable to fetch weather data for the specified city'
        });
    }
});

// Get forecast
router.get('/forecast/:lat/:lon', async (req, res) => {
    try {
        const { lat, lon } = req.params;
        const { units = 'metric', days = 5 } = req.query;
        
        if (!WEATHER_API_KEY) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Weather service is not configured'
            });
        }
        
        const forecastResponse = await axios.get(`${WEATHER_BASE_URL}/forecast`, {
            params: {
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                appid: WEATHER_API_KEY,
                units,
                cnt: Math.min(parseInt(days) * 8, 40) // 8 forecasts per day, max 40
            },
            timeout: 5000
        });
        
        const forecastData = forecastResponse.data;
        
        // Process hourly forecast
        const hourlyForecast = forecastData.list.map(item => ({
            time: new Date(item.dt * 1000),
            temperature: Math.round(item.main.temp),
            feelsLike: Math.round(item.main.feels_like),
            humidity: item.main.humidity,
            precipitation: item.rain ? item.rain['3h'] || 0 : 0,
            condition: {
                main: item.weather[0].main,
                description: item.weather[0].description,
                icon: item.weather[0].icon
            }
        }));
        
        // Group by day for daily forecast
        const dailyForecast = [];
        const days = {};
        
        hourlyForecast.forEach(hour => {
            const day = hour.time.toDateString();
            if (!days[day]) {
                days[day] = [];
            }
            days[day].push(hour);
        });
        
        Object.keys(days).forEach(day => {
            const dayData = days[day];
            const temps = dayData.map(h => h.temperature);
            
            dailyForecast.push({
                date: new Date(day),
                temperature: {
                    min: Math.min(...temps),
                    max: Math.max(...temps),
                    avg: Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
                },
                condition: dayData[Math.floor(dayData.length / 2)].condition, // midday condition
                humidity: Math.round(dayData.reduce((sum, h) => sum + h.humidity, 0) / dayData.length),
                precipitation: dayData.reduce((sum, h) => sum + h.precipitation, 0)
            });
        });
        
        res.json({
            location: {
                city: forecastData.city.name,
                country: forecastData.city.country,
                coordinates: {
                    lat: forecastData.city.coord.lat,
                    lon: forecastData.city.coord.lon
                }
            },
            hourly: hourlyForecast,
            daily: dailyForecast
        });
        
    } catch (error) {
        console.error('Forecast fetch error:', error);
        res.status(500).json({
            error: 'Forecast fetch failed',
            message: 'Unable to fetch weather forecast'
        });
    }
});

// Search cities
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { limit = 5 } = req.query;
        
        if (!query || query.length < 2) {
            return res.status(400).json({
                error: 'Invalid query',
                message: 'Search query must be at least 2 characters'
            });
        }
        
        if (!WEATHER_API_KEY) {
            return res.status(503).json({
                error: 'Service unavailable',
                message: 'Weather service is not configured'
            });
        }
        
        const searchResponse = await axios.get(`http://api.openweathermap.org/geo/1.0/direct`, {
            params: {
                q: query,
                limit: Math.min(parseInt(limit), 10),
                appid: WEATHER_API_KEY
            },
            timeout: 5000
        });
        
        const cities = searchResponse.data.map(city => ({
            name: city.name,
            country: city.country,
            state: city.state,
            coordinates: {
                lat: city.lat,
                lon: city.lon
            },
            displayName: `${city.name}${city.state ? ', ' + city.state : ''}, ${city.country}`
        }));
        
        res.json({ cities });
        
    } catch (error) {
        console.error('City search error:', error);
        res.status(500).json({
            error: 'Search failed',
            message: 'Unable to search for cities'
        });
    }
});

module.exports = router;
'''

with open('routes/weather.js', 'w') as f:
    f.write(weather_routes)

# Pomodoro routes
pomodoro_routes = '''
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
'''

with open('routes/pomodoro.js', 'w') as f:
    f.write(pomodoro_routes)

print("Created remaining API routes: weather, pomodoro")