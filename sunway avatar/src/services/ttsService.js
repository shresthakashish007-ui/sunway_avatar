/**
 * TTS Service — ElevenLabs via backend proxy
 * Calls POST /api/tts → server streams back audio/mpeg
 * Falls back to browser Web Speech API if backend is unavailable
 */

let isMuted        = false;
let currentAudio   = null; // HTMLAudioElement for ElevenLabs audio
let currentUtter   = null; // SpeechSynthesisUtterance for fallback
let speakGeneration = 0;   // increments on every speak() call — stale calls self-cancel

// ─── Mute control ─────────────────────────────────────────────────────────
export function setMuted(muted) {
  isMuted = muted;
  if (muted) stopSpeaking();
}

// ─── Stop whatever is currently playing ───────────────────────────────────
export function stopSpeaking() {
  // Invalidate any in-flight speak() call
  speakGeneration++;
  // Stop ElevenLabs audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  // Stop browser fallback
  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
  currentUtter = null;
}

export function isSpeaking() {
  if (currentAudio && !currentAudio.paused) return true;
  return window.speechSynthesis?.speaking || false;
}

// ─── Language detection (kept for reference / fallback) ───────────────────
export function detectLang(text) {
  if (!text) return "en-US";
  if (/[\u0900-\u097F]/.test(text)) {
    if (/[ञ्टठडढणतथदधनपफबभमयरलवशषसहक्षज्ञ]/.test(text)) return "ne-NP";
    return "hi-IN";
  }
  return "en-US";
}

// ─── Browser Web Speech fallback ──────────────────────────────────────────
function speakFallback(text, { onStart, onEnd, lang } = {}) {
  if (!window.speechSynthesis) { onEnd?.(); return; }

  stopSpeaking();

  const detectedLang = lang || detectLang(text);
  const utter        = new SpeechSynthesisUtterance(text);
  utter.lang   = detectedLang;
  utter.volume = 1;
  utter.rate   = 0.92;
  utter.pitch  = 0.88;

  utter.onstart = () => onStart?.();
  utter.onend   = () => { currentUtter = null; onEnd?.(); };
  utter.onerror = () => { currentUtter = null; onEnd?.(); };
  currentUtter  = utter;

  const voices = window.speechSynthesis.getVoices();
  const voice  = voices.find(v => v.lang === detectedLang) || voices[0];
  if (voice) utter.voice = voice;

  window.speechSynthesis.speak(utter);
}

// ─── Main speak function — ElevenLabs via backend ─────────────────────────
export async function speak(text, { onStart, onEnd, lang } = {}) {
  if (isMuted || !text?.trim()) { onEnd?.(); return; }

  // Stop anything currently playing and claim this generation
  stopSpeaking();
  const myGeneration = speakGeneration;

  console.log(`[TTS] 🎙️ Speaking text (${text.length} chars) with lang: ${lang || "auto"}`);

  try {
    const response = await fetch("/api/tts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text, lang }),
    });

    // If a newer speak() was called while we were fetching, bail out silently
    if (speakGeneration !== myGeneration) return;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      console.warn(`[TTS] ❌ Backend error (${response.status}):`, errorData);
      console.warn(`[TTS] 🔄 Falling back to browser speech synthesis`);

      if (speakGeneration === myGeneration) speakFallback(text, { onStart, onEnd, lang });
      return;
    }

    const blob = await response.blob();
    console.log(`[TTS] ✅ Audio received (${blob.size} bytes)`);

    // Check again after blob streaming (can take a moment for long text)
    if (speakGeneration !== myGeneration) return;

    const blobUrl = URL.createObjectURL(blob);
    const audio   = new Audio(blobUrl);
    currentAudio  = audio;

    audio.onplay  = () => {
      console.log(`[TTS] ▶️ Playing ElevenLabs audio`);
      if (speakGeneration === myGeneration) onStart?.();
    };
    audio.onended = () => {
      console.log(`[TTS] ⏹️ Audio playback completed`);
      currentAudio = null;
      URL.revokeObjectURL(blobUrl);
      if (speakGeneration === myGeneration) onEnd?.();
    };
    audio.onerror = (e) => {
      console.error(`[TTS] ❌ Audio playback error:`, e);
      console.warn(`[TTS] 🔄 Falling back to browser speech`);
      currentAudio = null;
      URL.revokeObjectURL(blobUrl);
      if (speakGeneration === myGeneration) speakFallback(text, { onStart, onEnd, lang });
    };

    await audio.play();

  } catch (err) {
    console.error(`[TTS] ❌ Fetch failed:`, err.message);
    console.warn(`[TTS] 🔄 Falling back to browser speech synthesis`);
    if (speakGeneration === myGeneration) speakFallback(text, { onStart, onEnd, lang });
  }
}
