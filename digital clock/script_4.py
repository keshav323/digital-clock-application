# Create middleware directory and auth middleware
import os

if not os.path.exists('middleware'):
    os.makedirs('middleware')

# Authentication middleware
auth_middleware = '''
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Authentication token is required'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        
        // Verify user still exists
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'User account no longer exists'
            });
        }
        
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            isGuest: decoded.isGuest || false
        };
        
        next();
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Your session has expired. Please log in again.'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Authentication token is invalid'
            });
        }
        
        console.error('Authentication error:', error);
        res.status(500).json({
            error: 'Authentication failed',
            message: 'Unable to authenticate request'
        });
    }
};

// Optional authentication - for endpoints that work with or without auth
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            req.user = null;
            return next();
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        const user = await User.findById(decoded.userId);
        
        if (user) {
            req.user = {
                userId: decoded.userId,
                email: decoded.email,
                isGuest: decoded.isGuest || false
            };
        } else {
            req.user = null;
        }
        
        next();
        
    } catch (error) {
        // If token is invalid, just proceed without authentication
        req.user = null;
        next();
    }
};

// Rate limiting for specific endpoints
const createRateLimit = (windowMs, max, message) => {
    const rateLimit = require('express-rate-limit');
    return rateLimit({
        windowMs,
        max,
        message: {
            error: 'Rate limit exceeded',
            message: message || `Too many requests, please try again later.`
        },
        standardHeaders: true,
        legacyHeaders: false
    });
};

// Admin middleware (for future admin features)
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please log in to access this resource'
            });
        }
        
        const user = await User.findById(req.user.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({
                error: 'Admin access required',
                message: 'You do not have permission to access this resource'
            });
        }
        
        next();
        
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({
            error: 'Authorization failed',
            message: 'Unable to verify admin access'
        });
    }
};

module.exports = {
    authenticateToken,
    optionalAuth,
    createRateLimit,
    requireAdmin
};
'''

with open('middleware/auth.js', 'w') as f:
    f.write(auth_middleware)

# Environment configuration file
env_example = '''
# Server Configuration
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/digital-clock-pro

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Weather API Configuration
OPENWEATHER_API_KEY=your-openweather-api-key

# Additional API Keys (Optional)
WEATHERAPI_KEY=your-weatherapi-key
ACCUWEATHER_API_KEY=your-accuweather-key

# Email Configuration (for future features)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Redis Configuration (for advanced caching, optional)
REDIS_URL=redis://localhost:6379

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Session Configuration
SESSION_SECRET=your-session-secret-key
SESSION_TIMEOUT=86400000

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads/

# Feature Flags
ENABLE_WEATHER_CACHING=true
ENABLE_ANALYTICS=true
ENABLE_NOTIFICATIONS=true
ENABLE_GUEST_MODE=true

# External Service URLs
TIMEZONE_API_URL=http://worldtimeapi.org/api
WEATHER_ICONS_BASE_URL=https://openweathermap.org/img/wn/

# Security Settings
CORS_ORIGIN=http://localhost:3000
COOKIE_SECURE=false
HELMET_ENABLED=true

# Performance Settings
DB_CONNECTION_POOL_SIZE=10
API_TIMEOUT=30000
CACHE_TTL=600

# Debug Settings
DEBUG=false
VERBOSE_LOGGING=false
'''

with open('.env.example', 'w') as f:
    f.write(env_example)

# Create a README for the backend
readme_content = '''
# Digital Clock Pro Backend

A comprehensive backend API for the Digital Clock Pro application, providing real-time clock synchronization, weather integration, Pomodoro timer functionality, and user management.

## Features

- 🔐 **User Authentication** - JWT-based authentication with guest mode
- ⏰ **Real-time Clock Sync** - WebSocket-based real-time synchronization
- 🌍 **World Clock Support** - Timezone conversion and world time display
- 🍅 **Pomodoro Timer** - Complete Pomodoro technique implementation
- 🌤️ **Weather Integration** - Real-time weather data with caching
- 📊 **Analytics** - Productivity tracking and statistics
- 🔄 **Data Synchronization** - Cross-device settings synchronization

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- OpenWeather API key (optional, for weather features)

## Installation

1. **Clone and setup:**
   ```bash
   npm install
   ```

2. **Environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start MongoDB:**
   ```bash
   # Using mongod directly
   mongod --dbpath /path/to/your/db
   
   # Or using MongoDB service
   sudo systemctl start mongodb
   ```

4. **Run the application:**
   ```bash
   # Development mode with hot reload
   npm run dev
   
   # Production mode
   npm start
   ```

## API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "User Name"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Guest Access
```http
POST /api/auth/guest
```

### Clock Endpoints

#### Get Current Time
```http
GET /api/clock/time/America/New_York
```

#### Get World Times
```http
POST /api/clock/world-times
Content-Type: application/json

{
  "timezones": [
    {"city": "New York", "timezone": "America/New_York"},
    {"city": "London", "timezone": "Europe/London"}
  ]
}
```

### Weather Endpoints

#### Get Current Weather
```http
GET /api/weather/current/40.7128/-74.0060?units=metric
```

#### Search Cities
```http
GET /api/weather/search/london?limit=5
```

### Pomodoro Endpoints

#### Start Session
```http
POST /api/pomodoro/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "work",
  "duration": 1500,
  "task": "Complete project documentation"
}
```

#### Get Current Session
```http
GET /api/pomodoro/current
Authorization: Bearer <token>
```

## Database Schema

### User Model
- Personal information and authentication
- Customizable settings (theme, time format, weather units)
- World clock configurations
- Productivity statistics

### Clock Session Model
- Pomodoro and focus session tracking
- Start/end times and duration
- Productivity ratings and notes
- Session analytics

### Weather Cache Model
- Cached weather data with TTL
- Location-based indexing
- Current conditions and forecasts

## WebSocket Events

### Client to Server
- `authenticate` - User authentication
- `time_sync` - Time synchronization request
- `pomodoro_start` - Start Pomodoro session
- `settings_update` - Update user settings

### Server to Client
- `time_sync` - Synchronized time data
- `pomodoro_started` - Session started confirmation
- `settings_updated` - Settings synchronization
- `pomodoro_completed` - Session completion notification

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/digital-clock-pro |
| `JWT_SECRET` | JWT signing secret | required |
| `OPENWEATHER_API_KEY` | OpenWeather API key | optional |
| `CLIENT_URL` | Frontend URL for CORS | * |

## Development

### Project Structure
```
├── server.js              # Main server file
├── models/                # MongoDB models
│   ├── User.js
│   ├── ClockSession.js
│   └── WeatherCache.js
├── routes/                # API routes
│   ├── auth.js
│   ├── user.js
│   ├── clock.js
│   ├── weather.js
│   └── pomodoro.js
├── middleware/            # Custom middleware
│   └── auth.js
└── package.json
```

### Running Tests
```bash
npm test
```

### API Health Check
```bash
curl http://localhost:3000/api/health
```

## Deployment

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### PM2 Production
```bash
pm2 start server.js --name "digital-clock-pro"
```

## Security Features

- JWT token authentication
- Rate limiting
- Helmet.js security headers
- CORS configuration
- Input validation
- Password hashing with bcrypt

## Performance Optimizations

- Weather data caching
- Database indexing
- Connection pooling
- Gzip compression
- Static file serving optimization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API examples
'''

with open('README.md', 'w') as f:
    f.write(readme_content)

print("Created middleware, environment config, and documentation")

# Create a simple CSV export of all the backend files created
import csv

backend_files = [
    {"filename": "package.json", "type": "Configuration", "description": "Node.js project configuration and dependencies"},
    {"filename": "server.js", "type": "Server", "description": "Main Express server with Socket.IO integration"},
    {"filename": "models/User.js", "type": "Model", "description": "User model with settings and preferences"},
    {"filename": "models/ClockSession.js", "type": "Model", "description": "Pomodoro and focus session tracking"},
    {"filename": "models/WeatherCache.js", "type": "Model", "description": "Weather data caching system"},
    {"filename": "routes/auth.js", "type": "API Route", "description": "Authentication endpoints (login, register, guest)"},
    {"filename": "routes/user.js", "type": "API Route", "description": "User management and settings"},
    {"filename": "routes/clock.js", "type": "API Route", "description": "Time synchronization and world clock"},
    {"filename": "routes/weather.js", "type": "API Route", "description": "Weather data and forecasting"},
    {"filename": "routes/pomodoro.js", "type": "API Route", "description": "Pomodoro timer and productivity tracking"},
    {"filename": "middleware/auth.js", "type": "Middleware", "description": "JWT authentication and authorization"},
    {"filename": ".env.example", "type": "Configuration", "description": "Environment variables template"},
    {"filename": "README.md", "type": "Documentation", "description": "Backend API documentation and setup guide"}
]

with open('backend_files.csv', 'w', newline='') as csvfile:
    fieldnames = ['filename', 'type', 'description']
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    
    writer.writeheader()
    for file_info in backend_files:
        writer.writerow(file_info)

print("\nBackend implementation complete!")
print("Created comprehensive backend with:")
print("- Express.js server with Socket.IO")
print("- MongoDB models and schemas")  
print("- Complete API routes")
print("- Authentication middleware")
print("- Environment configuration")
print("- Full documentation")
print("- Real-time WebSocket features")
print("\nExported backend files list to backend_files.csv")