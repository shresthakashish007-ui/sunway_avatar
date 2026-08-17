/**
 * TTS Route — ElevenLabs streaming TTS (backend proxy)
 * API key stays on server — never exposed to browser
 * POST /api/tts  { text: "...", lang: "en-US" }
 * Returns: audio/mpeg stream
 */
import express from "express";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const router = express.Router();
let elevenClient = null;

function getClient() {
  if (!elevenClient) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) throw new Error("ELEVENLABS_API_KEY not set in .env");
    elevenClient = new ElevenLabsClient({ apiKey: key });
  }
  return elevenClient;
}

async function handleTTS(req, res) {
  const text = req.body?.text || req.query?.text;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: "text too long (max 5000 chars)" });
  }

  const ttsText = text.slice(0, 800);
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

  console.log(`[TTS] Request received — text length: ${text.length}, voice: ${voiceId.slice(0, 8)}...`);

  try {
    const client = getClient();

    // stream() returns HttpResponsePromise<ReadableStream<Uint8Array>>
    // awaiting it directly resolves to the ReadableStream
    const audioStream = await client.textToSpeech.stream(voiceId, {
      text:    ttsText,
      modelId: "eleven_turbo_v2_5",   // better multilingual & Hindi support
      voiceSettings: {
        stability:       0.5,
        similarityBoost: 0.75,
        style:           0.0,
        useSpeakerBoost: true,
      },
      outputFormat: "mp3_44100_128",
    });

    res.setHeader("Content-Type",      "audio/mpeg");
    res.setHeader("Cache-Control",     "no-store");
    res.setHeader("Transfer-Encoding", "chunked");

    // audioStream is a ReadableStream<Uint8Array> — pipe chunks to response
    const reader = audioStream.getReader();
    let bytesStreamed = 0;
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`[TTS] ✅ Stream completed — ${bytesStreamed} bytes sent`);
          res.end();
          return;
        }
        bytesStreamed += value.length;
        res.write(Buffer.from(value));
      }
    };

    await pump();

  } catch (err) {
    console.error("❌ [TTS] ElevenLabs error:");
    console.error("  Message:", err.message);
    console.error("  Status:", err.statusCode || err.status || "N/A");
    console.error("  Body:", err.body ? JSON.stringify(err.body).slice(0, 300) : "N/A");
    console.error("  Stack:", err.stack?.split("\n").slice(0, 3).join("\n"));

    if (!res.headersSent) {
      const statusCode = err.statusCode || err.status || 500;
      const errorDetail = err.body?.detail || err.message || "Unknown error";

      res.status(statusCode).json({
        error: "TTS service unavailable",
        detail: errorDetail.slice(0, 200),
        hint: statusCode === 401 ? "API key invalid or expired" :
              statusCode === 429 ? "Rate limit exceeded or quota depleted" :
              "Check server logs for details"
      });
    }
  }
}

router.post("/", handleTTS);
router.get("/", handleTTS);

export default router;
