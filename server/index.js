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
import collegeAdminRouter from "./routes/collegeAdmin.js";
import ttsRouter, { warmVoicePool } from "./routes/tts.js";
import sttRouter from "./routes/stt.js";
import { COLLEGES_DIR } from "./services/collegeStore.js";

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ────────────────────────────────────────────────────────────
// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: "50kb" }));

// Security headers.
// CSP and COEP stay off: the app loads Google Fonts, remote logos and an
// external 360-tour iframe, all of which a default CSP/COEP would block.
// CORP is off so the Vite dev server (port 5173) can load models/images
// served from this origin.
app.use(helmet({
  contentSecurityPolicy:     false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

app.use(cors({
  origin: ["http://localhost:5173","http://localhost:5174","http://localhost:5175","http://localhost:3000","http://localhost:3001"],
  credentials: true
}));

// Static files are served after CORS/helmet so their responses carry the
// same headers as the API.
const publicPath = path.resolve(__dirname, "../public");
console.log(`📁 Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Rate limiting for chat endpoint
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      30,
  message:  { success: false, error: "Too many requests. Please slow down." },
});

// Leads are written to an in-memory store — throttle to stop form spam
const leadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message:  { success: false, error: "Too many submissions. Please try again shortly." },
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/api/chat",             chatLimiter, chatRouter);
app.use("/api/resources/leads",  leadLimiter);
app.use("/api/resources",        resourcesRouter);
app.use("/api/college-admin",    collegeAdminRouter);
app.use("/api/admin",            adminRouter);
app.use("/api/tts",              ttsRouter);
app.use("/api/stt",              sttRouter);

// Uploaded college logos/images: /college-assets/<slug>/<file>
//   → server/colleges/<slug>/assets/<file>
// Mapped explicitly rather than serving the colleges folder, so config.json /
// data.json / faq.json are never publicly readable.
app.get("/college-assets/:slug/:file", (req, res) => {
  const { slug, file } = req.params;
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug) || !/^[a-zA-Z0-9_.-]+$/.test(file) || file.includes("..")) {
    return res.status(400).end();
  }
  const dir = path.join(COLLEGES_DIR, slug, "assets");
  const target = path.join(dir, file);
  if (!target.startsWith(dir)) return res.status(400).end();
  res.setHeader("Cache-Control", "public, max-age=300");
  res.sendFile(target, (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Simple rotation status page — same token gate as /api/admin
app.get("/rotation-status", async (req, res) => {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (!process.env.ADMIN_PASSWORD || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).send("<h1>401 Unauthorized</h1><p>Append ?token=&lt;ADMIN_PASSWORD&gt; to the URL.</p>");
  }
  const tokenQuery = `?token=${encodeURIComponent(String(token))}`;
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
    <a href="/rotation-status${tokenQuery}">Refresh Now</a>
  </p>
</body>
</html>`;
    
    res.send(html);
  } catch (err) {
    const safe = String(err.message).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    res.status(500).send(`<h1>Error</h1><pre>${safe}</pre>`);
  }
});

// ─── Global Error Handler ──────────────────────────────────────────────────
// Catches any unhandled errors and returns JSON instead of default HTML 500.
// Only the chat contract gets the friendly 200 fallback — every other route
// returns a real error status so failures stay visible in logs/monitoring.
app.use((err, req, res, next) => {
  console.error("💥 Unhandled Express error:", err.message);
  console.error("Stack:", err.stack?.split("\n").slice(0, 3).join("\n"));

  if (res.headersSent) return next(err);

  if (!req.path.startsWith("/api/chat")) {
    return res.status(500).json({ success: false, error: "Internal server error" });
  }

  // Chat: always return a well-formed reply so the frontend never sees
  // "Unexpected end of JSON input"
  res.status(200).json({
    success: true,
    reply: "I'm processing your request. Please ask your question again.",
    language: "en",
    emotion: "neutral",
    animation: "talking",
    intent: "",
    entities: { program: null, year: null, topic: null },
    visualAction: { type: "NONE", resourceId: "", title: "" },
    suggestions: ["BSc CSAI Program", "BIT Program", "Contact Sunway"],
  });
});

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌟 Sunway College AI Counselor Backend — http://localhost:${PORT}`);
  
  // Check for API key rotation
  const keyCount = [process.env.GROQ_API_KEYS, process.env.GROQ_API_KEY]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map(k => k.trim())
    .filter(k => k.startsWith("gsk_"))
    .length;

  if (keyCount > 1) {
    console.log(`🔑 Groq API Keys:       ✅ ${keyCount} keys with automatic rotation`);
    console.log(`📊 Dashboard:           http://localhost:${PORT}/groq-keys-dashboard.html`);
  } else if (keyCount === 1) {
    console.log(`🔑 Groq API Key:        ✅ Single key (no rotation)`);
  } else {
    console.log(`🔑 Groq API Key:        ⚠️  NOT SET — add GROQ_API_KEYS to .env`);
  }

  if (!process.env.ADMIN_PASSWORD) {
    console.log(`🔒 Admin:               ⚠️  ADMIN_PASSWORD not set — /api/admin and /rotation-status are disabled`);
  }

  import("./services/faqSearch.js")
    .then(({ faqCount }) => console.log(`❓ Q&A entries:         ✅ ${faqCount()} loaded from server/database/faq.js`))
    .catch(err => console.log(`❓ Q&A entries:         ⚠️  failed to load faq.js — ${err.message}`));

  console.log(`🎙️  TTS Provider:        ✅ Microsoft Edge TTS (FREE - Browser-based)`);

  // Open the neural-voice sockets now so the first student does not wait
  // for the ~500ms handshake.
  warmVoicePool().catch(err => console.warn("🔊 voice warm-up skipped:", err.message));
  // Which brain is actually answering. Worth printing plainly: "local" means
  // free and unlimited, "Groq" means the free tier with its rate limits.
  import("./services/llmProvider.js")
    .then(async ({ providerStatus, probeLocal }) => {
      const s = providerStatus();
      if (!s.localEnabled) {
        console.log(`🤖 Model:               ${s.groqModel} via Groq (free tier)`);
        console.log(`🏠 Local model:         off — set LOCAL_LLM=on in .env to run offline`);
        return;
      }
      const up = await probeLocal();
      console.log(up
        ? `🤖 Model:               ${s.localModel} running locally ✅ unlimited, offline`
        : `🤖 Model:               ${s.groqModel} via Groq (local model not reachable at ${s.localUrl})`);
      console.log(`🔁 Fallback:            ${up ? `Groq (${s.groqModel}) if the local model stops` : `install Ollama + "ollama pull ${s.localModel}" to go offline`}`);
    })
    .catch(err => console.log(`🤖 Model:               ⚠️  could not read provider status — ${err.message}`));

  console.log(`📚 Programs:            BSc CSAI (4yr) + BSc BIT (3yr) — BCU Partnership\n`);
});
