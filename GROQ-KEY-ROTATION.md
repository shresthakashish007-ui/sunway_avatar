# Groq API Key Rotation System

## 🎯 Overview

This system automatically rotates between 8 Groq API keys to avoid rate limiting and ensure continuous service availability. When one key hits its rate limit, the system automatically switches to the next available key.

## ✨ Features

- **Automatic Rotation**: Switches to next key when rate limit is detected
- **Health Tracking**: Monitors each key's status (active, exhausted, error, cooldown)
- **Smart Retry**: Automatically retries failed requests with a different key (up to 3 attempts)
- **Cooldown Management**: Exhausted keys are put on cooldown for 1 hour before reuse
- **Persistent State**: Rotation state survives server restarts
- **Admin Dashboard**: Beautiful web interface to monitor all keys
- **Detailed Statistics**: Track requests, success rate, errors per key
- **Manual Control**: Reset keys or manually select which key to use

## 🔧 Configuration

### Environment Variables (.env)

```env
# Multiple Groq API Keys (comma-separated)
GROQ_API_KEYS=key1,key2,key3,key4,key5,key6,key7,key8

# Model configuration
GROQ_MODEL=openai/gpt-oss-20b

# Admin password for dashboard access
ADMIN_PASSWORD=your_secure_password_here
```

### Rotation Settings

Edit `server/services/groqKeyRotation.js` to customize:

```javascript
const CONFIG = {
  COOLDOWN_PERIOD: 60 * 60 * 1000, // 1 hour (in milliseconds)
  MAX_ERRORS_BEFORE_SKIP: 3,       // Skip key after 3 consecutive errors
  RATE_LIMIT_KEYWORDS: [           // Error messages that trigger rotation
    "rate_limit_exceeded",
    "rate limit",
    "too many requests",
    "quota exceeded",
    "429",
  ],
};
```

## 📊 Admin Dashboard

### Access the Dashboard

1. Start your server:
   ```bash
   npm start
   ```

2. Open in browser:
   ```
   http://localhost:3001/groq-keys-dashboard.html
   ```

3. Login with your admin password (from .env file)

### Dashboard Features

- **Summary Cards**: Overview of key statistics
  - Total Keys
  - Active Keys
  - Exhausted Keys
  - Error Keys
  - Total Requests
  - Success Rate
  - Rate Limit Hits

- **Key Cards**: Detailed info for each key
  - Current status (active/exhausted/error/cooldown)
  - Request statistics
  - Success rate
  - Rate limit hits
  - Consecutive errors
  - Cooldown timer (if applicable)
  - Last error message
  - Last used timestamp

- **Actions**:
  - Reset individual key
  - Set key as current active key
  - Reset all keys
  - Auto-refresh every 10 seconds

## 🔌 API Endpoints

All endpoints require admin authentication via `?token=YOUR_ADMIN_PASSWORD`

### Get Key Statistics

```bash
GET /api/admin/groq-keys?token=your_secure_password_here
```

**Response:**
```json
{
  "success": true,
  "totalKeys": 8,
  "currentKeyIndex": 2,
  "stats": [
    {
      "keyIndex": 0,
      "keyPreview": "gsk_G2XH...9xn",
      "totalRequests": 45,
      "successfulRequests": 42,
      "failedRequests": 3,
      "rateLimitHits": 1,
      "lastUsed": "2026-08-17T12:30:45.123Z",
      "status": "exhausted",
      "cooldownRemaining": 1800000
    }
    // ... more keys
  ],
  "summary": {
    "activeKeys": 6,
    "exhaustedKeys": 1,
    "errorKeys": 1,
    "totalRequests": 320,
    "totalSuccesses": 305,
    "totalFailures": 15,
    "totalRateLimitHits": 5
  }
}
```

### Reset a Specific Key

```bash
POST /api/admin/groq-keys/reset/0?token=your_secure_password_here
```

Removes cooldown and error state from key at index 0.

### Reset All Keys

```bash
POST /api/admin/groq-keys/reset-all?token=your_secure_password_here
```

Resets all keys to active state.

### Set Current Active Key

```bash
POST /api/admin/groq-keys/set-current/3?token=your_secure_password_here
```

Manually sets key at index 3 as the current active key.

## 🔄 How It Works

### 1. Key Selection

When a request comes in:
- System checks if current key is on cooldown
- If yes, rotates to next available key
- Returns the active key to create Groq client

### 2. Request Processing

- Request is made with current key
- On success: Records success statistics
- On failure: Analyzes error type

### 3. Error Handling

**Rate Limit Error:**
- Marks current key as exhausted
- Sets 1-hour cooldown timer
- Rotates to next key
- Retries request (up to 3 times)

**Other Errors:**
- Increments consecutive error counter
- After 3 consecutive errors, rotates to next key
- Retries request

### 4. State Persistence

- All statistics saved to `server/data/keyRotationState.json`
- State restored on server restart
- Updates saved after every state change

## 📝 Key States

| State | Description | Visual |
|-------|-------------|--------|
| **active** | Key is working normally | 🟢 Green |
| **exhausted** | Key hit rate limit, on cooldown | 🔴 Red |
| **error** | Key has consecutive errors | 🟡 Yellow |
| **cooldown** | Key in cooldown period | 🔵 Blue |

## 🚀 Usage Examples

### Starting the Server

```bash
cd "d:\Documents\Desktop\sunway_avatar-main (3)\sunway_avatar-main\sunway avatar"
npm start
```

### Checking Key Status (PowerShell)

```powershell
# Get all keys status
$response = Invoke-RestMethod -Uri "http://localhost:3001/api/admin/groq-keys?token=your_secure_password_here"
$response | ConvertTo-Json -Depth 10

# Reset a specific key
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/groq-keys/reset/0?token=your_secure_password_here" -Method POST

# Reset all keys
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/groq-keys/reset-all?token=your_secure_password_here" -Method POST
```

### Monitoring Logs

The server will log rotation events:

```
✅ Loaded 8 Groq API keys for rotation
🔑 Using Groq key 1/8: gsk_G2XH...9xn
🚫 Rate limit hit on key 1. Rotating to next key...
🔄 Rotated from key 0 to key 1
✅ Key 0 cooldown period ended, marking as active
```

## 🛠️ Troubleshooting

### All Keys Exhausted

If all 8 keys are exhausted:
1. System will warn: "⚠️ All API keys are exhausted or in cooldown!"
2. Will continue using current key (may result in errors)
3. Wait for cooldown period to end (1 hour by default)
4. Or manually reset keys via admin dashboard

### Reset All Keys

If you need to force reset all keys:

```bash
# Via API
curl -X POST "http://localhost:3001/api/admin/groq-keys/reset-all?token=your_secure_password_here"

# Or via dashboard
# Go to http://localhost:3001/groq-keys-dashboard.html
# Click "Reset All Keys"
```

### Check State File

View current rotation state:

```bash
Get-Content "server\data\keyRotationState.json"
```

### Adjust Cooldown Period

Edit `server/services/groqKeyRotation.js`:

```javascript
const CONFIG = {
  COOLDOWN_PERIOD: 30 * 60 * 1000, // 30 minutes instead of 1 hour
  // ...
};
```

## 📦 Files Created/Modified

### New Files
- `server/services/groqKeyRotation.js` - Core rotation logic
- `server/data/keyRotationState.json` - Persistent state storage
- `public/groq-keys-dashboard.html` - Admin dashboard
- `GROQ-KEY-ROTATION.md` - This documentation

### Modified Files
- `.env` - Added GROQ_API_KEYS (replaced GROQ_API_KEY)
- `server/services/groqService.js` - Integrated rotation system
- `server/routes/chat.js` - Integrated rotation with retry logic
- `server/routes/admin.js` - Added key management endpoints

## 🎓 Best Practices

1. **Monitor Regularly**: Check dashboard daily to ensure keys are healthy
2. **Set Alerts**: If all keys get exhausted frequently, consider:
   - Adding more API keys
   - Optimizing request patterns
   - Increasing cooldown period
3. **Backup State**: Periodically backup `keyRotationState.json`
4. **Security**: Change ADMIN_PASSWORD from default
5. **Logging**: Monitor server logs for rotation patterns

## 🔐 Security Notes

- API keys stored in `.env` file (add to .gitignore)
- Admin dashboard requires password authentication
- Keys are masked in logs (only first 8 and last 4 chars shown)
- State file contains no sensitive data

## 📈 Future Enhancements

Potential improvements:
- Email alerts when all keys exhausted
- Per-key rate limit tracking
- Automatic key health testing
- Integration with monitoring services
- Custom rotation strategies (round-robin, least-used, etc.)

## ❓ Support

If you encounter issues:
1. Check server logs for errors
2. Verify all 8 keys are valid in .env file
3. Check dashboard for key status
4. Review troubleshooting section above
5. Test individual keys manually

---

**System Status**: ✅ Active and Working
**Last Updated**: August 17, 2026
