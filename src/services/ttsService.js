/**
 * TTS Service — two engines, best first.
 *
 *  1. Server voices (/api/tts) — Microsoft Edge neural voices. Free, no key,
 *     and crucially they include REAL Nepali (ne-NP) and Hindi (hi-IN) voices.
 *  2. Browser speechSynthesis — the previous behaviour, kept as an automatic
 *     fallback for when the server or network is unavailable.
 *
 * The browser's own voice list has no Nepali on a typical Windows machine, so
 * Nepali replies used to be read aloud in an English voice. Engine 1 fixes
 * that; engine 2 means losing the server never makes the avatar go silent.
 *
 * Server audio is also routed through speechAnalyser, which is what lets the
 * avatar's mouth follow the real voice instead of a made-up rhythm.
 */
import { attach as attachAnalyser, detach as detachAnalyser } from "./speechAnalyser";
import { setTrack, clearTrack } from "./visemeTrack";

// Flip to false to force the old browser-only behaviour.
const USE_SERVER_TTS = true;

let isMuted         = false;
let currentAudio    = null; // HTMLAudioElement playing server audio
let currentUtter    = null; // SpeechSynthesisUtterance currently queued/speaking
let speakGeneration = 0;    // increments on every speak()/stop — stale calls self-cancel
let voicesPreloaded = false;
let keepAliveTimer  = null; // works around Chrome pausing long utterances
let watchdogTimer   = null; // guarantees onEnd fires even if speech never starts

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

// Chrome silently pauses synthesis after ~15s; pause/resume restarts the clock
const KEEPALIVE_INTERVAL_MS = 10000;
// If the utterance hasn't started within this window, treat it as failed
const START_TIMEOUT_MS      = 4000;
// Calling speak() in the same tick as cancel() measurably delays the start
// (~100ms) and sometimes drops the utterance with error "interrupted".
// Only pay this gap when we actually had to cancel something.
const POST_CANCEL_GAP_MS    = 60;

// Resolved voice per language — getVoices() + the preference ladder produce
// the same answer every time, so don't redo it on every utterance
const voiceCache = new Map();

// ─── Preload voices on app startup ─────────────────────────────────────────
export function preloadVoices() {
  if (voicesPreloaded || !synth) return;

  const loadVoices = () => {
    const voices = synth.getVoices();
    if (voices.length > 0) {
      voicesPreloaded = true;
      console.log(`[TTS] ✅ Preloaded ${voices.length} system voices`);
      synth.removeEventListener("voiceschanged", loadVoices);
    }
  };

  loadVoices();

  // addEventListener rather than onvoiceschanged= so this never clobbers (or
  // gets clobbered by) another listener waiting on the same event
  if (!voicesPreloaded) synth.addEventListener("voiceschanged", loadVoices);
}

// ─── Mute control ─────────────────────────────────────────────────────────
export function setMuted(muted) {
  isMuted = muted;
  if (muted) stopSpeaking();
}

export function getMuted() {
  return isMuted;
}

// ─── Timer helpers ────────────────────────────────────────────────────────
function clearTimers() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
  if (watchdogTimer)  { clearTimeout(watchdogTimer);   watchdogTimer  = null; }
}

// ─── Stop whatever is currently playing ───────────────────────────────────
function stopServerAudio() {
  if (!currentAudio) return;
  try {
    currentAudio.pause();
    currentAudio.onended = currentAudio.onerror = currentAudio.onplaying = null;
    if (currentAudio.src?.startsWith("blob:")) URL.revokeObjectURL(currentAudio.src);
    currentAudio.removeAttribute("src");
    currentAudio.load();
  } catch { /* already torn down */ }
  currentAudio = null;
}

export function stopSpeaking() {
  // Invalidate any in-flight speak() call
  speakGeneration++;
  clearTimers();
  currentUtter = null;
  detachAnalyser();
  clearTrack();
  stopServerAudio();
  synth?.cancel();
}

// Same invalidation as stopSpeaking(), but skips cancel() when the engine is
// already idle. Returns whether a cancel actually happened so the caller knows
// if it has to wait out POST_CANCEL_GAP_MS before speaking.
function claimEngine() {
  speakGeneration++;
  clearTimers();
  currentUtter = null;
  if (!synth) return false;
  const busy = synth.speaking || synth.pending;
  if (busy) synth.cancel();
  return busy;
}

export function isSpeaking() {
  if (currentAudio && !currentAudio.paused) return true;
  return !!synth?.speaking;
}

// ─── Engine 1: server neural voices ───────────────────────────────────────
// Resolves true once audio is actually playing, false if the server could not
// produce any — in which case the caller falls back to the browser voice.
function speakViaServer(text, { onStart, onEnd, lang, generation }) {
  return new Promise((resolve) => {
    const isStale = () => generation !== speakGeneration;
    const controller = new AbortController();
    let settled = false;
    const give = (ok) => { if (!settled) { settled = true; resolve(ok); } };

    // If the server hasn't produced audio in time, don't leave the user in
    // silence — bail out and let the browser voice take over.
    const bail = setTimeout(() => { controller.abort(); give(false); }, 6000);

    // Two steps on purpose: POST the text for a short id (~5ms), then let the
    // <audio> element GET that id. The element streams the MP3 natively and
    // starts playing on the first frames, instead of us waiting ~1s for the
    // whole file via res.blob().
    fetch("/api/tts/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`server returned ${res.status}`);
        const { url, id } = await res.json();
        if (!url) throw new Error("no audio url");
        if (isStale()) { clearTimeout(bail); return give(true); } // superseded; don't play

        const audio = new Audio();
        audio.preload = "auto";
        audio.src = url;
        audio.volume = 1;
        currentAudio = audio;

        let ended = false;
        const finish = () => {
          if (ended) return;
          ended = true;
          detachAnalyser();
          clearTrack();
          if (currentAudio === audio) stopServerAudio();
          if (!isStale()) onEnd?.();
        };

        audio.onplaying = () => {
          clearTimeout(bail);
          give(true);
          // Route the real voice into the analyser so the mouth can follow it.
          // Done here rather than before play() because the element is
          // definitely producing audio by now.
          attachAnalyser(audio);

          // Fetch the word timings for this clip. Fire-and-forget: the mouth
          // runs on loudness alone until they land (usually within ~30ms),
          // then switches to exact per-word shapes. A failure here costs
          // accuracy, never audio.
          if (id) {
            fetch(`/api/tts/marks/${id}`, { signal: controller.signal })
              .then(r => r.ok ? r.json() : null)
              .then(d => {
                if (!d?.marks?.length || isStale() || currentAudio !== audio) return;
                const n = setTrack(d.marks, audio);
                console.log(`[LipSync] ${n} word timings loaded`);
              })
              .catch(() => { /* stay on the loudness-driven fallback */ });
          }

          if (!isStale()) onStart?.();
        };
        audio.onended   = finish;
        audio.onerror   = () => { clearTimeout(bail); if (!ended) { ended = true; give(false); } };

        audio.play().catch(() => { clearTimeout(bail); give(false); });
      })
      .catch((err) => {
        clearTimeout(bail);
        if (err.name !== "AbortError") console.warn("[TTS] server voice unavailable:", err.message);
        give(false);
      });
  });
}

// ─── Language detection (kept for reference / fallback) ───────────────────
export function detectLang(text) {
  if (!text) return "en-US";
  if (/[ऀ-ॿ]/.test(text)) {
    if (/[ञ्टठडढणतथदधनपफबभमयरलवशषसहक्षज्ञ]/.test(text)) return "ne-NP";
    return "hi-IN";
  }
  return "en-US";
}

// ─── Voice selection ──────────────────────────────────────────────────────
// Prefers Microsoft Edge's natural female voices, then Google, then any
// female-sounding voice for the requested language.
function pickVoice(voices, detectedLang) {
  let selected = null;

  // Priority 1: Microsoft Edge voices (best quality on Windows)
  if (detectedLang.startsWith("en")) {
    selected = voices.find(v => v.name.includes("Microsoft Zira"));

    if (!selected) {
      selected = voices.find(v =>
        v.name.includes("Microsoft") &&
        (v.name.includes("Zira") || v.name.includes("Jenny") || v.name.includes("Aria")) &&
        v.lang.startsWith("en")
      );
    }

    if (!selected) {
      selected = voices.find(v =>
        v.name.includes("Google") && v.name.includes("Female") && v.lang.startsWith("en")
      );
    }
  }

  // Hindi voices
  if (!selected && detectedLang.startsWith("hi")) {
    selected = voices.find(v =>
      v.name.includes("Microsoft") &&
      (v.name.includes("Hemant") || v.name.includes("Kalpana")) &&
      v.lang.startsWith("hi")
    );

    if (!selected) {
      selected = voices.find(v => v.name.includes("Google") && v.lang.startsWith("hi"));
    }
  }

  // Nepali voices (if available), falling back to Hindi — similar pronunciation
  if (!selected && detectedLang.startsWith("ne")) {
    selected = voices.find(v => v.lang.startsWith("ne"));
    if (!selected) {
      selected = voices.find(v => v.name.includes("Microsoft") && v.lang.startsWith("hi"));
    }
  }

  // Any female voice matching the language
  if (!selected) {
    selected = voices.find(v =>
      v.name.toLowerCase().includes("female") &&
      v.lang.startsWith(detectedLang.substring(0, 2))
    );
  }

  // Common female voice names
  if (!selected) {
    const femaleNames = ["Zira", "Jenny", "Aria", "Samantha", "Victoria", "Karen", "Susan", "Moira", "Tessa", "Fiona"];
    selected = voices.find(v => femaleNames.some(name => v.name.includes(name)));
  }

  // Fallback: first voice matching the language, then anything at all
  if (!selected) selected = voices.find(v => v.lang.startsWith(detectedLang.substring(0, 2)));
  if (!selected) selected = voices[0] || null;

  return selected;
}

// ─── Browser Web Speech with Microsoft Edge Voices ────────────────────────
function speakWithBrowserVoice(text, { onStart, onEnd, lang, startDelayMs = 0 } = {}) {
  if (!synth) {
    console.warn("[TTS] Browser speech synthesis not supported");
    onEnd?.();
    return;
  }

  const myGeneration = speakGeneration;
  const isStale = () => myGeneration !== speakGeneration;

  // onEnd must fire exactly once — error and end can both arrive, and the
  // watchdog may fire if speech never starts at all
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    // A newer speak() already owns the timers and the avatar state. Firing
    // this utterance's onEnd here would reset the avatar out from under it
    // (synth.cancel() delivers "interrupted" after the new one has started).
    if (isStale()) return;
    clearTimers();
    if (currentUtter === utter) currentUtter = null;
    onEnd?.();
  };

  const detectedLang = lang || detectLang(text);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = detectedLang;
  utter.volume = 1;
  utter.rate   = 1.05; // Slightly faster for natural flow
  utter.pitch  = 1.15; // Higher pitch for clear female voice

  utter.onstart = () => {
    if (isStale()) return;
    console.log("[TTS] 🎙️ Edge TTS started");
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }
    onStart?.();
  };

  utter.onend = () => {
    console.log("[TTS] ✅ Edge TTS completed");
    finish();
  };

  utter.onerror = (e) => {
    // "interrupted"/"canceled" are expected whenever the user speaks over us
    if (e.error === "interrupted" || e.error === "canceled" || e.error === "cancelled") {
      console.log("[TTS] Speech was interrupted (normal)");
    } else {
      console.error("[TTS] ❌ Edge TTS error:", e.error || e);
    }
    finish();
  };

  currentUtter = utter;

  let spoken = false;
  const setVoiceAndSpeak = () => {
    if (isStale() || spoken || finished) return;
    spoken = true;

    // The pre-speak watchdog (below) has done its job
    if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null; }

    const voices = synth.getVoices();

    let selectedVoice = voiceCache.get(detectedLang);
    if (selectedVoice === undefined) {
      selectedVoice = pickVoice(voices, detectedLang);
      voiceCache.set(detectedLang, selectedVoice);
      console.log(selectedVoice
        ? `[TTS] 🎤 Using voice: ${selectedVoice.name} (${selectedVoice.lang}) — ${voices.length} available`
        : "[TTS] ⚠️ No suitable voice found, using default");
    }
    if (selectedVoice) utter.voice = selectedVoice;

    if (startDelayMs > 0) setTimeout(() => { if (!finished && !isStale()) synth.speak(utter); }, startDelayMs);
    else synth.speak(utter);

    // Chrome stops speaking after ~15s unless nudged
    const tick = setInterval(() => {
      if (finished || isStale() || !synth.speaking) {
        clearInterval(tick);
        if (keepAliveTimer === tick) keepAliveTimer = null;
        return;
      }
      synth.pause();
      synth.resume();
    }, KEEPALIVE_INTERVAL_MS);
    keepAliveTimer = tick;

    // If nothing starts speaking, release the avatar instead of leaving it
    // stuck in the "talking" state forever
    watchdogTimer = setTimeout(() => {
      if (finished || synth.speaking) return;
      console.warn("[TTS] ⚠️ Speech never started — releasing");
      finish();
    }, START_TIMEOUT_MS);
  };

  if (synth.getVoices().length > 0) {
    setVoiceAndSpeak();
  } else {
    // Voices load asynchronously on first use in Chrome/Edge
    const onVoices = () => {
      synth.removeEventListener("voiceschanged", onVoices);
      setVoiceAndSpeak();
    };
    synth.addEventListener("voiceschanged", onVoices);

    // ...and speak anyway if that event never arrives
    watchdogTimer = setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoices);
      if (!finished && !isStale()) setVoiceAndSpeak();
    }, 1200);
  }
}

// ─── Main speak function — Use Microsoft Edge TTS ────────────────────────
export async function speak(text, { onStart, onEnd, lang } = {}) {
  if (isMuted || !text?.trim()) {
    onEnd?.();
    return;
  }

  // Claim the engine; this bumps speakGeneration so any earlier utterance's
  // callbacks see themselves as stale. In the normal flow (reply arrives after
  // the ~600ms model wait) nothing is speaking, so this costs nothing and we
  // go straight to synth.speak().
  const hadToCancel = claimEngine();
  const generation = speakGeneration;

  console.log(`[TTS] 🎙️ Speaking (${text.length} chars) - lang: ${lang || "auto"}${hadToCancel ? " [after cancel]" : ""}`);

  const useBrowserVoice = () => {
    if (generation !== speakGeneration) return; // superseded while we waited
    speakWithBrowserVoice(text, {
      onStart, onEnd, lang,
      startDelayMs: hadToCancel ? POST_CANCEL_GAP_MS : 0,
    });
  };

  if (!USE_SERVER_TTS) return useBrowserVoice();

  // Try the neural voice first; fall back to the browser if it can't deliver.
  const played = await speakViaServer(text, { onStart, onEnd, lang, generation });
  if (!played) {
    console.log("[TTS] falling back to browser voice");
    useBrowserVoice();
  }
}
