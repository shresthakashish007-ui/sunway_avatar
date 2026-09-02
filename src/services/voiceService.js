/**
 * Voice / STT Service — two engines working together.
 *
 *  • Web Speech API  — gives live interim text as the user speaks, which is
 *    what makes the "Listening…" box feel responsive. Chrome-only and weak
 *    at Nepali, so it is used for feedback rather than the final answer.
 *  • Whisper (/api/stt) — the audio is recorded in parallel with
 *    MediaRecorder and transcribed properly on submit. Much better at Nepali
 *    and Hindi. If it fails, the Web Speech transcript is used instead.
 *
 * Auto-stops after detecting silence (1.2 seconds of no speech).
 * Has a 20-second max timeout as fallback.
 */

let recognition = null;
let isRecording = false;
let shouldKeepListening = false;
let listenTimeout = null;
let silenceTimeout = null;
let callbacks = {};
// A single listening session can reach its end more than once — the silence
// timer fires, then recognition.onend fires right after it. onEnd/onError must
// still reach the caller exactly once, or the transcript gets submitted twice.
let sessionEnded = true;

// ─── Whisper recording ────────────────────────────────────────────────────
const USE_WHISPER = true;
let recorder = null;
let recordedChunks = [];
let mediaStream = null;
let lastInterim = "";

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find(t => window.MediaRecorder?.isTypeSupported?.(t)) || "";
}

async function startRecording() {
  if (!USE_WHISPER || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    const mimeType = pickMimeType();
    recorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
    recordedChunks = [];
    recorder.ondataavailable = (e) => { if (e.data?.size) recordedChunks.push(e.data); };
    recorder.start();
  } catch (err) {
    // Mic permission is shared with SpeechRecognition, so this rarely fires.
    console.warn("[STT] recording unavailable, using browser transcript only:", err.message);
    recorder = null;
  }
}

function stopRecording() {
  return new Promise((resolve) => {
    const cleanupStream = () => {
      mediaStream?.getTracks().forEach(t => t.stop());
      mediaStream = null;
    };
    if (!recorder || recorder.state === "inactive") { cleanupStream(); return resolve(null); }
    recorder.onstop = () => {
      const type = recorder.mimeType || "audio/webm";
      const blob = recordedChunks.length ? new Blob(recordedChunks, { type }) : null;
      recordedChunks = []; recorder = null;
      cleanupStream();
      resolve(blob);
    };
    try { recorder.stop(); } catch { cleanupStream(); resolve(null); }
  });
}

const blobToDataUrl = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(new Error("could not read audio"));
  r.readAsDataURL(blob);
});

/** Transcribe the recorded clip. Returns null if unavailable — caller falls back. */
async function transcribeRecording(blob, lang) {
  if (!blob || blob.size < 1200) return null;
  try {
    const res = await fetch("/api/stt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: await blobToDataUrl(blob), lang }),
    });
    if (!res.ok) throw new Error(`server ${res.status}`);
    const data = await res.json();
    const text = (data?.text || "").trim();
    if (text) console.log(`[STT] Whisper (${data.ms}ms): "${text}"`);
    return text || null;
  } catch (err) {
    console.warn("[STT] Whisper unavailable, using browser transcript:", err.message);
    return null;
  }
}

const LISTEN_TIMEOUT_MS = 20000; // 20 seconds hard max
const SILENCE_TIMEOUT_MS = 1200; // 1.2 seconds of silence = auto-stop (fast & responsive)

export function isSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Ends the session once and only once, clearing every timer on the way out.
function endSession(errorMessage) {
  if (sessionEnded) return;
  sessionEnded = true;
  shouldKeepListening = false;

  if (listenTimeout)  { clearTimeout(listenTimeout);  listenTimeout  = null; }
  if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }

  if (errorMessage) {
    stopRecording();               // discard audio, nothing to transcribe
    callbacks.onError?.(errorMessage);
    return;
  }

  const cb = callbacks;
  const langAtStart = cb.lang;

  // Hand over the browser transcript immediately if Whisper isn't in play,
  // otherwise wait for the (better) Whisper result and pass that instead.
  stopRecording().then(async (blob) => {
    const whisper = await transcribeRecording(blob, langAtStart);
    if (whisper) {
      cb.onResult?.(whisper, true);   // update the on-screen text first
      cb.onEnd?.(whisper);
    } else {
      cb.onEnd?.();
    }
  }).catch(() => cb.onEnd?.());
}

function createAndStart() {
  if (!isSupported()) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  // SpeechRecognition needs a BCP-47 tag and has no "auto" mode, so the
  // picker's short code is mapped here. This only drives the live on-screen
  // text — the final transcript comes from Whisper.
  const SR_LANG = { ne: "ne-NP", hi: "hi-IN", en: "en-US", auto: "en-US" };
  const chosen = String(callbacks.lang || "auto").toLowerCase().split("-")[0];
  recognition.lang = SR_LANG[chosen] || callbacks.lang || "en-US";
  recognition.continuous = true;       // keep open as long as possible
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    callbacks.onStart?.();
  };

  recognition.onend = () => {
    isRecording = false;

    // If we still want to be listening (timeout hasn't fired, user hasn't stopped),
    // restart recognition immediately to bridge the gap Chrome forces.
    if (shouldKeepListening) {
      try {
        recognition.start();
        return; // don't call onEnd yet — still listening
      } catch (_) {
        // Can't restart (e.g. already started) — fall through
      }
    }

    // Truly done
    endSession();
  };

  recognition.onerror = (e) => {
    // Clear silence timeout on error
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }

    // "no-speech" is non-fatal — just restart so the mic stays open
    if (e.error === "no-speech" && shouldKeepListening) {
      isRecording = false;
      try { recognition.start(); } catch (_) {}
      return;
    }

    // "aborted" arrives when we stop the mic ourselves — not a real failure
    isRecording = false;
    if (e.error === "aborted") { endSession(); return; }

    endSession(e.error || "Microphone error");
  };

  recognition.onresult = (e) => {
    // Clear silence timeout whenever we get new speech
    if (silenceTimeout) {
      clearTimeout(silenceTimeout);
      silenceTimeout = null;
    }

    // Build full transcript from all results so far
    let interim = "";
    let finalText = "";
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        finalText += e.results[i][0].transcript + " ";
      } else {
        interim += e.results[i][0].transcript;
      }
    }

    const combined = (finalText + interim).trim();
    callbacks.onResult?.(combined, false);

    // Start silence detection timer
    // If no new speech comes in 1.2 seconds, auto-stop
    if (combined && shouldKeepListening) {
      silenceTimeout = setTimeout(() => {
        console.log("🔇 Silence detected, auto-stopping...");
        shouldKeepListening = false;
        if (recognition && isRecording) {
          recognition.stop();
        }
        // Auto-submit. recognition.onend will fire moments later; endSession
        // makes sure that second path doesn't submit the transcript again.
        endSession();
      }, SILENCE_TIMEOUT_MS);
    }
  };

  try {
    recognition.start();
  } catch (err) {
    endSession(err.message);
  }
}

export function startListening({ onResult, onError, onStart, onEnd, lang = "en-US" }) {
  if (!isSupported()) {
    onError?.("Speech recognition is not supported in this browser.");
    return;
  }

  // Clean up any previous session
  stopListening();

  callbacks = { onResult, onError, onStart, onEnd, lang };
  shouldKeepListening = true;
  sessionEnded = false;
  lastInterim = "";

  // Record in parallel so Whisper can produce the final, accurate transcript
  startRecording();

  // 20-second hard stop
  listenTimeout = setTimeout(() => {
    listenTimeout = null;
    shouldKeepListening = false;
    if (recognition && isRecording) {
      recognition.stop();
    }
    endSession();
  }, LISTEN_TIMEOUT_MS);

  createAndStart();
}

/**
 * User pressed stop. Ends the session *through* endSession so the recorded
 * audio still goes to Whisper — the final transcript arrives via onEnd(text).
 * Use this rather than stopListening() when you want the result.
 */
export function finishListening() {
  shouldKeepListening = false;
  if (listenTimeout)  { clearTimeout(listenTimeout);  listenTimeout  = null; }
  if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
  if (recognition && isRecording) { try { recognition.stop(); } catch { /* already stopping */ } }
  endSession();
}

/** Abandon the session without delivering any result. */
export function stopListening() {
  // The caller is tearing the session down itself, so suppress the callbacks
  // that recognition.onend would otherwise deliver on the way out.
  sessionEnded = true;
  shouldKeepListening = false;
  stopRecording();


  // Clear all timers
  if (listenTimeout) { 
    clearTimeout(listenTimeout); 
    listenTimeout = null; 
  }
  if (silenceTimeout) { 
    clearTimeout(silenceTimeout); 
    silenceTimeout = null; 
  }
  
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    recognition = null;
  }
  isRecording = false;
}

export function getIsRecording() {
  return isRecording;
}
