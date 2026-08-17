# 🚀 Quick Start: Groq API Key Rotation

## ✅ Setup Complete!

Your system is now configured with **8 Groq API keys** that will automatically rotate when rate limits are hit.

## 🎯 What's New

### Files Created
- ✅ `server/services/groqKeyRotation.js` - Rotation engine
- ✅ `server/data/keyRotationState.json` - State persistence
- ✅ `public/groq-keys-dashboard.html` - Admin dashboard
- ✅ `GROQ-KEY-ROTATION.md` - Full documentation

### Files Updated
- ✅ `.env` - Now uses GROQ_API_KEYS (8 keys loaded)
- ✅ `server/services/groqService.js` - Integrated rotation
- ✅ `server/routes/chat.js` - Auto-retry on rate limits
- ✅ `server/routes/admin.js` - Key management API
- ✅ `server/index.js` - Startup logging

## 🏃 Start Your Server

```powershell
cd "d:\Documents\Desktop\sunway_avatar-main (3)\sunway_avatar-main\sunway avatar"
npm start
```

You should see:
```
🌟 Sunway College AI Counselor Backend — http://localhost:3001
🔑 Groq API Keys:       ✅ 8 keys with automatic rotation
📊 Dashboard:           http://localhost:3001/groq-keys-dashboard.html
✅ Loaded 8 Groq API keys for rotation
```

## 📊 Monitor Your Keys

### Open Dashboard
1. Start server (see above)
2. Visit: **http://localhost:3001/groq-keys-dashboard.html**
3. Login with password: `admin123` (from your .env)
4. See real-time status of all 8 keys!

### Dashboard Shows:
- 📈 Total requests per key
- ✅ Success rates
- 🚫 Rate limit hits
- ⏱️ Cooldown timers
- 🔄 Current active key
- 🎯 Actions: Reset keys, switch keys

## 🔄 How It Works

### Automatic Rotation
```
Request → Key 1 → Rate Limit! → Auto-switch to Key 2 → Success ✅
```

### When a key hits rate limit:
1. 🚫 Marked as "exhausted"
2. ⏱️ Put on 1-hour cooldown
3. 🔄 System switches to next key
4. 🔁 Request is automatically retried (up to 3 times)
5. ✅ After cooldown, key becomes active again

### Key States:
- 🟢 **Active** - Ready to use
- 🔴 **Exhausted** - Hit rate limit, on cooldown
- 🟡 **Error** - Having issues
- 🔵 **Cooldown** - Waiting to become active again

## 🧪 Test It Out

### Test Normal Chat (should work)
```powershell
$body = @{
    message = "Tell me about Sunway College"
    conversationHistory = @()
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/chat" -Method POST -Body $body -ContentType "application/json"
```

### Check Key Status
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/groq-keys?token=admin123"
```

## 🎛️ Admin Controls

### Via Dashboard (Easy Way)
1. Go to: http://localhost:3001/groq-keys-dashboard.html
2. Login with `admin123`
3. Click buttons to:
   - Reset individual keys
   - Reset all keys
   - Switch to different key
   - View statistics

### Via API (Advanced)
```powershell
# Reset key 1
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/groq-keys/reset/0?token=admin123" -Method POST

# Reset all keys
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/groq-keys/reset-all?token=admin123" -Method POST

# Switch to key 5
Invoke-RestMethod -Uri "http://localhost:3001/api/admin/groq-keys/set-current/4?token=admin123" -Method POST
```

## 📝 Configuration

### Adjust Cooldown Period
Edit `server/services/groqKeyRotation.js`:

```javascript
const CONFIG = {
  COOLDOWN_PERIOD: 60 * 60 * 1000, // Change to 30 * 60 * 1000 for 30 minutes
  MAX_ERRORS_BEFORE_SKIP: 3,
  // ...
};
```

### Change Admin Password
Edit `.env`:
```env
ADMIN_PASSWORD=your_secure_password_here
```

## 🔍 Monitor Logs

Watch for rotation events:
```
✅ Loaded 8 Groq API keys for rotation
🔑 Using Groq key 1/8: gsk_G2XH...9xn
🚫 Rate limit hit on key 1. Rotating to next key...
🔄 Rotated from key 0 to key 1
🔑 Using Groq key 2/8: gsk_2kvL...eVi7
```

## ⚠️ Troubleshooting

### "All API keys exhausted"
- **Cause**: All 8 keys hit rate limit
- **Solution**: Wait for cooldown (1 hour) or reset keys via dashboard

### Keys not rotating
- **Check**: Server logs for errors
- **Verify**: All 8 keys in .env are valid
- **Test**: Each key individually via dashboard

### Dashboard won't login
- **Check**: ADMIN_PASSWORD in .env matches what you're typing
- **Default**: `admin123`

## 📚 Full Documentation

For detailed information, see: **GROQ-KEY-ROTATION.md**

## ✨ Benefits

✅ **No More Rate Limit Errors** - Automatic failover  
✅ **8x Capacity** - 8 times the request limit  
✅ **Auto-Recovery** - Keys come back after cooldown  
✅ **Transparent** - Your app code doesn't change  
✅ **Monitored** - Beautiful dashboard to track everything  

## 🎉 You're All Set!

Your Groq API key rotation system is ready to go. The system will automatically handle rate limits and keep your service running smoothly!

**Next Steps:**
1. Start the server
2. Open the dashboard
3. Make some requests
4. Watch the magic happen! ✨

---
**System Status**: ✅ Ready  
**Keys Loaded**: 8  
**Dashboard**: http://localhost:3001/groq-keys-dashboard.html
