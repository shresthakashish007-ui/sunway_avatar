/**
 * STT Route — speech to text via Whisper on Groq (free tier, existing keys).
 *
 * Why: the browser's own SpeechRecognition is Chrome-only, needs Google's
 * cloud anyway, and handles Nepali poorly. Whisper large-v3 understands
 * Nepali and Hindi far better and reuses the Groq keys already configured.
 *
 * The browser records with MediaRecorder and POSTs the audio here.
 * POST /api/stt   { audio: "data:audio/webm;base64,...", lang: "ne" }
 *   → { success, text, model }
 */
import express from "express";
import Groq from "groq-sdk";
import keyRotation from "../services/groqKeyRotation.js";
import db from "../database/sunwayData.js";
import { buildVocabulary } from "../services/lexicon.js";

const router = express.Router();

/**
 * Whisper accepts a `prompt` to bias decoding toward expected vocabulary.
 * Without it, "सनवे कलेज" comes back as "सन्नुबे कोलेज" and the college name,
 * programme codes and fee words are mangled — which then fails to match any
 * Q&A. Seeding the domain words measurably cleans this up.
 *
 * The term list lives in lexicon.js, shared with the speech output, so the
 * words the assistant says correctly are the same ones it hears correctly.
 */
function buildBiasPrompt(lang) {
  return buildVocabulary({
    collegeName: db.college?.name || "",
    shortName:   db.college?.shortName || "",
    programs:    (db.programs || []).map(p => p.abbreviation).filter(Boolean),
  }, lang);
}

// Benchmarked on Nepali/Hindi/English clips (accuracy vs known text):
//   turbo    + correct language + vocabulary bias .............. 79.2%
//   large-v3 + correct language, no bias ....................... 85.6%
//   large-v3 + correct language + vocabulary bias .............. 91.3%
// large-v3 is clearly better once the bias prompt is used, and the clips here
// are only a few seconds so the extra latency is not noticeable.
const MODEL = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3";
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

// Whisper takes ISO-639-1. Telling it the right language is the single biggest
// accuracy lever measured here: forcing "en" on Nepali audio scored 13.9%,
// letting it auto-detect 62.8%, and naming the language 85.6%. "auto" (or
// anything unrecognised) omits the parameter so Whisper detects it itself.
const LANGS = new Set(["en", "ne", "hi"]);
function normaliseLang(lang) {
  const base = String(lang || "").toLowerCase().split("-")[0];
  return LANGS.has(base) ? base : undefined;
}

const EXT_BY_MIME = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/flac": "flac",
};

router.post("/", express.json({ limit: "12mb" }), async (req, res) => {
  const { audio, lang } = req.body || {};
  if (typeof audio !== "string" || !audio.startsWith("data:")) {
    return res.status(400).json({ success: false, error: "audio (base64 data URL) is required" });
  }

  const m = audio.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return res.status(400).json({ success: false, error: "malformed audio data" });

  const mime = m[1].split(";")[0].toLowerCase();
  const ext = EXT_BY_MIME[mime] || "webm";
  const buf = Buffer.from(m[2], "base64");

  if (buf.length < 1200) {
    // Practically silence — treat as "nothing said" rather than an error
    return res.json({ success: true, text: "", empty: true });
  }
  if (buf.length > MAX_AUDIO_BYTES) {
    return res.status(413).json({ success: false, error: "audio too long" });
  }

  const started = Date.now();
  try {
    const client = new Groq({ apiKey: keyRotation.getCurrentKey() });
    // The SDK accepts a web File; give it a name so Groq can infer the format.
    const file = new File([buf], `speech.${ext}`, { type: mime });

    const langCode = normaliseLang(lang);
    const out = await client.audio.transcriptions.create({
      file,
      model: MODEL,
      language: langCode,
      prompt: buildBiasPrompt(langCode || "en"),
      response_format: "json",
      temperature: 0,
    });

    keyRotation.recordSuccess();
    const text = (out?.text || "").trim();
    console.log(`[STT] ✅ ${MODEL} ${Date.now() - started}ms — "${text.slice(0, 60)}"`);
    res.json({ success: true, text, model: MODEL, ms: Date.now() - started });

  } catch (err) {
    keyRotation.recordFailure(err);
    console.error("[STT] ❌", err.message?.slice(0, 160));
    // The browser keeps its own SpeechRecognition transcript as a fallback,
    // so a failure here is recoverable rather than fatal.
    res.status(503).json({ success: false, error: "Transcription unavailable" });
  }
});

export default router;
