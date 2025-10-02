
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
