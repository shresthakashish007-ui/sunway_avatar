import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import chatRouter from "./routes/chat.js";
import resourcesRouter from "./routes/resources.js";
import adminRouter from "./routes/admin.js";
import ttsRouter from "./routes/tts.js";

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────
// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: "50kb" }));

// Serve static files FIRST (before any other middleware)
const publicPath = path.resolve(__dirname, "../public");
console.log(`📁 Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

app.use(cors({ 
  origin: ["http://localhost:5173","http://localhost:5174","http://localhost:5175","http://localhost:3000","http://localhost:3001"],
  credentials: true
}));

// Security - DISABLED for now to test
// app.use(helmet({ 
//   contentSecurityPolicy: false,
//   crossOriginEmbedderPolicy: false
// }));

// Rate limiting for chat endpoint
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      30,
  message:  { success: false, error: "Too many requests. Please slow down." },
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/api/chat",      chatLimiter, chatRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/admin",     adminRouter);
app.use("/api/tts",       ttsRouter);

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Simple rotation status page
app.get("/rotation-status", async (req, res) => {
  try {
    const { default: keyRotation } = await import("./services/groqKeyRotation.js");
    const stats = keyRotation.getStats();
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Groq Key Rotation Status</title>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="5">
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
    .card .value { font-size: 32px; font-weight: bold; color: #333; }
    .active .value { color: #10b981; }
    .exhausted .value { color: #ef4444; }
    table { width: 100%; background: white; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9fafb; font-weight: 600; }
    .status { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
    .status.active { background: #d1fae5; color: #065f46; }
    .status.exhausted { background: #fee2e2; color: #991b1b; }
    .current { background: #eff6ff !important; }
  </style>
</head>
<body>
  <h1>🔑 Groq API Key Rotation Status</h1>
  <p>Auto-refreshes every 5 seconds</p>
  
  <div class="summary">
    <div class="card">
      <h3>Total Keys</h3>
      <div class="value">${stats.totalKeys}</div>
    </div>
    <div class="card active">
      <h3>Active Keys</h3>
      <div class="value">${stats.summary.activeKeys}</div>
    </div>
    <div class="card exhausted">
      <h3>Exhausted Keys</h3>
      <div class="value">${stats.summary.exhaustedKeys}</div>
    </div>
    <div class="card">
      <h3>Total Requests</h3>
      <div class="value">${stats.summary.totalRequests}</div>
    </div>
    <div class="card">
      <h3>Success Rate</h3>
      <div class="value">${stats.summary.totalRequests > 0 ? Math.round((stats.summary.totalSuccesses / stats.summary.totalRequests) * 100) : 0}%</div>
    </div>
    <div class="card">
      <h3>Rate Limit Hits</h3>
      <div class="value">${stats.summary.totalRateLimitHits}</div>
    </div>
  </div>

  <h2>Key Details</h2>
  <table>
    <thead>
      <tr>
        <th>Key</th>
        <th>Preview</th>
        <th>Status</th>
        <th>Requests</th>
        <th>Successes</th>
        <th>Failures</th>
        <th>Rate Limits</th>
        <th>Success Rate</th>
      </tr>
    </thead>
    <tbody>
      ${stats.stats.map(key => {
        const successRate = key.totalRequests > 0 ? Math.round((key.successfulRequests / key.totalRequests) * 100) : 0;
        return `
          <tr class="${key.isCurrent ? 'current' : ''}">
            <td><strong>${key.isCurrent ? '👉 ' : ''}Key ${key.keyIndex + 1}</strong></td>
            <td><code>${key.keyPreview}</code></td>
            <td><span class="status ${key.status}">${key.status.toUpperCase()}</span></td>
            <td>${key.totalRequests}</td>
            <td>${key.successfulRequests}</td>
            <td>${key.failedRequests}</td>
            <td>${key.rateLimitHits}</td>
            <td>${successRate}%</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <p style="margin-top: 20px; color: #666; font-size: 14px;">
    Last updated: ${new Date().toLocaleString()} | 
    Current Key: Key ${stats.currentKeyIndex + 1} | 
    <a href="/rotation-status">Refresh Now</a>
  </p>
</body>
</html>`;
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${err.message}</pre>`);
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌟 Sunway College AI Counselor Backend — http://localhost:${PORT}`);
  
  // Check for API key rotation
  const hasMultipleKeys = process.env.GROQ_API_KEYS;
  const hasSingleKey = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your_groq_api_key_here";
  
  if (hasMultipleKeys) {
    const keyCount = process.env.GROQ_API_KEYS.split(',').filter(k => k.trim().startsWith('gsk_')).length;
    console.log(`🔑 Groq API Keys:       ✅ ${keyCount} keys with automatic rotation`);
    console.log(`📊 Dashboard:           http://localhost:${PORT}/groq-keys-dashboard.html`);
  } else if (hasSingleKey) {
    console.log(`🔑 Groq API Key:        ✅ Single key (no rotation)`);
  } else {
    console.log(`🔑 Groq API Key:        ⚠️  NOT SET — add GROQ_API_KEYS to .env`);
  }
  
  console.log(`🎙️  TTS Provider:        ✅ Microsoft Edge TTS (FREE - Browser-based)`);
  console.log(`🤖 Model:               ${process.env.GROQ_MODEL || "openai/gpt-oss-20b"} (1000 T/sec)`);
  console.log(`📚 Programs:            BSc CSAI (4yr) + BSc BIT (3yr) — BCU Partnership\n`);
});
