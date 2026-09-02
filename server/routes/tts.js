/**
 * TTS Route — Microsoft Edge neural voices (free, no API key)
 *
 * Replaces the previous ElevenLabs proxy, which needed a paid key and was
 * never actually called by the frontend.
 *
 * Why these voices: the browser's built-in speechSynthesis has no Nepali voice
 * on Windows (a typical machine exposes only English David/Mark/Zira), so
 * Nepali replies were being read aloud by an English voice. Edge exposes real
 * ne-NP and hi-IN neural voices.
 *
 * Speed: the WebSocket handshake costs ~500ms, so connections are pooled per
 * voice and reused. Measured cold ~650ms to first audio, reused ~145-300ms.
 *
 * POST /api/tts  { text, lang }   → audio/mpeg stream
 */
import express from "express";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { normaliseForSpeech } from "../services/speechText.js";

const router = express.Router();

// lang code (from the model's `language` field) → Edge voice
const VOICES = {
  ne:       "ne-NP-HemkalaNeural",  // Nepali, female
  "ne-np":  "ne-NP-HemkalaNeural",
  hi:       "hi-IN-SwaraNeural",    // Hindi, female
  "hi-in":  "hi-IN-SwaraNeural",
  hinglish: "hi-IN-SwaraNeural",
  en:       "en-US-JennyNeural",    // English, female, warm
  "en-us":  "en-US-JennyNeural",
  "en-in":  "en-IN-NeerjaNeural",
  roman_ne: "en-IN-NeerjaNeural",   // Romanised Nepali reads better with an Indian-English accent
};
const DEFAULT_VOICE = "en-US-JennyNeural";
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

// Voices that read Latin script well. A Devanagari voice given romanised text
// ("CSAI ko fee NPR 1,275,000 cha") mispronounces it badly, and an American
// voice given romanised Nepali sounds equally wrong — Indian English sits
// closest to how these sentences are actually spoken in Nepal.
const LATIN_VOICE_FOR = {
  ne: "en-IN-NeerjaNeural",
  hi: "en-IN-NeerjaNeural",
  en: "en-US-JennyNeural",
  // Romanised Nepali and Hinglish are Latin script by definition, so they
  // always take this path — without them here they fell through to the
  // American default, undoing the whole point of the Indian-English choice.
  roman_ne: "en-IN-NeerjaNeural",
  hinglish: "en-IN-NeerjaNeural",
};

const DEVANAGARI = /[ऀ-ॿ]/g;

/** Share of the letters that are Devanagari (0–1). */
function devanagariRatio(text) {
  const letters = String(text || "").replace(/[^\p{L}]/gu, "");
  if (!letters.length) return 0;
  return (letters.match(DEVANAGARI) || []).length / letters.length;
}

/**
 * Pick a voice from BOTH the declared language and the script actually used.
 * The model may answer a Nepali question in romanised Nepali or plain English,
 * in which case the Nepali voice is the wrong choice even though lang="ne-NP".
 */
export function resolveVoice(lang, text = "") {
  const k = String(lang || "").toLowerCase();
  const base = k.split("-")[0];

  // Mostly Latin text → never use a Devanagari voice
  if (text && devanagariRatio(text) < 0.25) {
    return LATIN_VOICE_FOR[base] || LATIN_VOICE_FOR[k] || DEFAULT_VOICE;
  }
  if (!lang) return DEFAULT_VOICE;
  return VOICES[k] || VOICES[base] || DEFAULT_VOICE;
}

// ─── Connection pool ──────────────────────────────────────────────────────
// One live MsEdgeTTS per voice. setMetadata() opens the socket; keeping it
// open is what removes the ~500ms handshake from every request.
const pool = new Map();

async function getTTS(voice) {
  const existing = pool.get(voice);
  if (existing) {
    try { return await existing; } catch { pool.delete(voice); }
  }
  const created = (async () => {
    const tts = new MsEdgeTTS();
    // wordBoundaryEnabled makes Edge report the exact millisecond each word
    // begins and how long it lasts. That is what drives accurate lip-sync —
    // without it the browser can only guess from loudness.
    //
    // Note: <mstts:viseme> (Microsoft's own phoneme IDs) was tried and this
    // free endpoint REJECTS the connection outright, so word timing plus
    // letter-derived phonemes is the best available here. Measured, not assumed.
    await tts.setMetadata(voice, FORMAT, { wordBoundaryEnabled: true });
    return tts;
  })();
  pool.set(voice, created);
  try { return await created; } catch (err) { pool.delete(voice); throw err; }
}

function dropFromPool(voice) { pool.delete(voice); }

/**
 * Open the sockets for the voices we actually use, at boot rather than on the
 * first student question. The handshake costs ~500ms, and without this the
 * first person to speak each language pays it.
 */
export async function warmVoicePool() {
  const voices = [...new Set([DEFAULT_VOICE, VOICES.ne, VOICES.hi, LATIN_VOICE_FOR.ne])];
  const results = await Promise.allSettled(voices.map(v => getTTS(v)));
  const ok = results.filter(r => r.status === "fulfilled").length;
  console.log(`🔊 TTS voices warmed:    ✅ ${ok}/${voices.length} ready`);
}

// ─── Synthesis ────────────────────────────────────────────────────────────
function streamOnce(tts, text, res, onMark) {
  return new Promise((resolve, reject) => {
    let started = false;
    let bytes = 0;
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      err ? reject(err) : resolve({ started, bytes });
    };

    const timer = setTimeout(() => finish(new Error("Edge TTS timed out")), 15000);

    let audioStream, metadataStream;
    try {
      ({ audioStream, metadataStream } = tts.toStream(text));
    } catch (err) { return finish(err); }

    // Word timings arrive alongside the audio. Offsets are in 100-nanosecond
    // ticks (10,000 per millisecond) — converted here so the browser gets
    // plain milliseconds.
    // Edge sends each metadata message as PRETTY-PRINTED JSON, so it spans
    // many lines. Parsing line by line therefore never yields a valid object —
    // the chunk is accumulated and parsed as a whole instead, which also
    // covers a message arriving split across two chunks.
    let metaBuf = "";
    metadataStream?.on("data", (chunk) => {
      metaBuf += chunk.toString();
      let parsed;
      try {
        parsed = JSON.parse(metaBuf);
      } catch {
        // Incomplete — wait for the rest. Cap it so a malformed stream can't
        // grow without bound.
        if (metaBuf.length > 65536) metaBuf = "";
        return;
      }
      metaBuf = "";

      for (const m of parsed.Metadata || []) {
        if (m.Type !== "WordBoundary" || !m.Data) continue;
        onMark?.({
          word:  m.Data.text?.Text || "",
          start: Math.round(m.Data.Offset / 10000),
          dur:   Math.round(m.Data.Duration / 10000),
        });
      }
    });

    audioStream.on("data", (chunk) => {
      if (!started) {
        started = true;
        if (!res.headersSent) {
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Cache-Control", "no-store");
        }
      }
      bytes += chunk.length;
      res.write(chunk);
    });
    audioStream.on("end", () => finish());
    audioStream.on("error", (err) => finish(err));
  });
}

// ─── Word timing store ────────────────────────────────────────────────────
// Marks are produced while the audio is being synthesised, but the browser can
// only ask for them once playback has begun. They are held here, keyed by the
// same id the audio was streamed under, and fetched separately.
//
// Synthesis runs faster than playback, so by the time the first word is heard
// the whole list is usually already complete — a request that arrives early
// simply waits for the `turn.end` rather than returning a partial list.
const marksStore = new Map();
const MARKS_TTL_MS = 120000;

function sweepMarks() {
  const cutoff = Date.now() - MARKS_TTL_MS;
  for (const [id, v] of marksStore) if (v.createdAt < cutoff) marksStore.delete(id);
}

function newMarkEntry(id) {
  const entry = { marks: [], done: false, waiters: [], createdAt: Date.now() };
  marksStore.set(id, entry);
  return entry;
}

function completeMarks(entry) {
  if (!entry || entry.done) return;
  entry.done = true;
  entry.waiters.splice(0).forEach(fn => fn());
}

async function handleTTS(req, res) {
  const text = (req.body?.text ?? req.query?.text ?? "").toString();
  const lang = (req.body?.lang ?? req.query?.lang ?? "").toString();

  if (!text.trim()) return res.status(400).json({ error: "text is required" });
  if (text.length > 5000) return res.status(400).json({ error: "text too long (max 5000 chars)" });

  // Rewrite currency, long numbers, phone numbers and brackets so the voice
  // pronounces them correctly (see speechText.js for the measurements).
  const spoken = normaliseForSpeech(text, lang);
  const speak = spoken.slice(0, 1200);
  const voice = resolveVoice(lang, speak);

  // Only stream requests carry an id, so only they can collect marks.
  const markEntry = req._ttsId ? newMarkEntry(req._ttsId) : null;
  const onMark = markEntry ? (m) => markEntry.marks.push(m) : null;

  try {
    let result;
    try {
      result = await streamOnce(await getTTS(voice), speak, res, onMark);
    } catch (err) {
      // A pooled socket can be closed by the server at any time. Rebuild it
      // once before giving up — but only if we hadn't started sending audio.
      if (res.headersSent) throw err;
      console.warn(`[TTS] ${voice} failed (${err.message}) — reconnecting`);
      dropFromPool(voice);
      if (markEntry) markEntry.marks.length = 0; // discard the failed attempt's marks
      result = await streamOnce(await getTTS(voice), speak, res, onMark);
    }
    completeMarks(markEntry);

    if (!result.started) throw new Error("no audio produced");
    console.log(`[TTS] ✅ ${voice} — ${(result.bytes / 1024).toFixed(1)} KB`);
    res.end();

  } catch (err) {
    console.error(`[TTS] ❌ ${voice}: ${err.message}`);
    dropFromPool(voice);
    // Release anyone waiting on marks, or their request hangs until timeout.
    completeMarks(markEntry);
    if (!res.headersSent) {
      // The browser falls back to its built-in speechSynthesis on failure
      res.status(503).json({ error: "TTS unavailable", detail: err.message.slice(0, 200) });
    } else {
      res.end();
    }
  }
}

// ─── Prepare + stream ─────────────────────────────────────────────────────
// An <audio> element streams a URL natively and starts playing on the first
// buffered frames, but it can only issue a GET — and a long Devanagari reply
// URL-encodes past what a query string can safely hold. So the text is POSTed
// once for a short id, and the audio element then GETs that id.
const pending = new Map();
const PENDING_TTL_MS = 120000;

function sweepPending() {
  const cutoff = Date.now() - PENDING_TTL_MS;
  for (const [id, v] of pending) if (v.createdAt < cutoff) pending.delete(id);
}

router.post("/prepare", express.json({ limit: "16kb" }), (req, res) => {
  const text = (req.body?.text ?? "").toString();
  const lang = (req.body?.lang ?? "").toString();
  if (!text.trim()) return res.status(400).json({ error: "text is required" });

  sweepPending();
  if (pending.size > 500) pending.clear(); // hard ceiling; ids are short-lived

  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  pending.set(id, { text: text.slice(0, 5000), lang, createdAt: Date.now() });
  res.json({ success: true, id, url: `/api/tts/stream/${id}` });
});

router.get("/stream/:id", (req, res) => {
  const job = pending.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Expired or unknown audio id" });
  pending.delete(req.params.id); // single use
  req.body = { text: job.text, lang: job.lang };
  req._ttsId = req.params.id;    // lets handleTTS collect word timings under this id
  return handleTTS(req, res);
});

/**
 * Word timings for a previously streamed clip.
 *
 * The browser calls this the moment playback starts. If synthesis is still
 * running the request waits for it rather than returning half a sentence —
 * which is safe, because synthesis finishes well before the audio does.
 */
router.get("/marks/:id", async (req, res) => {
  sweepMarks();
  const entry = marksStore.get(req.params.id);
  if (!entry) return res.json({ success: true, marks: [] }); // nothing recorded

  if (!entry.done) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000); // never hang a request
      entry.waiters.push(() => { clearTimeout(timer); resolve(); });
    });
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({ success: true, marks: entry.marks });
});

router.post("/", express.json({ limit: "16kb" }), handleTTS);
router.get("/", handleTTS);

// Which voice would be used for a language — handy for debugging.
router.get("/voices", (_req, res) => {
  res.json({ success: true, voices: VOICES, default: DEFAULT_VOICE });
});

export default router;
