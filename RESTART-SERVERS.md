# How to Restart Your Servers

## ⚠️ Stop Current Processes

First, stop any running node processes:

```powershell
# Find and kill node processes
Get-Process node | Stop-Process -Force
```

## 🚀 Start Backend Server (Terminal 1)

```powershell
cd "d:\Documents\Desktop\sunway_avatar-main (3)\sunway_avatar-main\sunway avatar"
npm run server
```

Wait for the message:
```
🌟 Sunway College AI Counselor Backend — http://localhost:3001
```

## 🎨 Start Frontend Dev Server (Terminal 2)

Open a NEW terminal and run:

```powershell
cd "d:\Documents\Desktop\sunway_avatar-main (3)\sunway_avatar-main\sunway avatar"
npm run dev
```

Wait for the message showing the local URL (usually `http://localhost:5173`)

## ✅ Verify Everything Works

1. Open your browser to `http://localhost:5173`
2. Try sending a message to the avatar
3. Check the backend terminal for detailed logs like:
   ```
   [CHAT] ━━━ New Request ━━━
   [CHAT] Message: "Hello"
   [CHAT] ✅ Groq response received...
   ```

## 🐛 Still Seeing Errors?

If you still see 500 errors, check the backend terminal logs. You should now see detailed error messages that will help identify the exact problem.

### Common Issues:

1. **Port 3001 already in use**: Kill all node processes and restart
2. **Network error**: Check your internet connection (Groq API requires internet)
3. **Browser speech error**: This is normal when speech is interrupted by user actions

## 📊 Run Diagnostics

If issues persist, run:

```powershell
node server/diagnose.js
```

This will test all systems and show you exactly what's failing.
