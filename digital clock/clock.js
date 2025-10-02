
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
