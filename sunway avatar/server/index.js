import "dotenv/config";
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

// ─── Security ──────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ["http://localhost:5173","http://localhost:5174","http://localhost:5175","http://localhost:3000"] }));
app.use(express.json({ limit: "50kb" }));

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

// ─── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌟 Sunway College AI Counselor Backend — http://localhost:${PORT}`);
  const hasGroq = process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your_groq_api_key_here";
  const hasEleven = process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.startsWith("sk_");
  console.log(`🔑 Groq API Key:        ${hasGroq   ? "✅ Configured" : "⚠️  NOT SET — add to .env"}`);
  console.log(`🎙️  ElevenLabs API Key:  ${hasEleven ? "✅ Configured" : "⚠️  NOT SET — add to .env"}`);
  console.log(`🔊 Voice ID:            ${process.env.ELEVENLABS_VOICE_ID || "f1abxvIEijusskcPWE5x"}`);
  console.log(`🤖 Model: ${process.env.GROQ_MODEL || "llama-3.3-70b-versatile"}`);
  console.log(`📚 Programs: BSc CSAI (4yr) + BSc BIT (3yr) — BCU Partnership\n`);
});
