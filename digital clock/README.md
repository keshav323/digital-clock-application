
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
