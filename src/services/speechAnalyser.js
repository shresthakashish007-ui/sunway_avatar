/**
 * Speech analyser — reads the ACTUAL voice audio so the mouth can match it.
 *
 * WHY THIS EXISTS
 * ---------------
 * The old lip-sync cycled through a fixed list of mouth shapes every 0.18s and
 * drove openness from a sine wave. It was never connected to the audio, so the
 * mouth moved to its own rhythm while the voice said something else — which is
 * exactly what "the lips don't match" looks like.
 *
 * Here the MP3 coming back from /api/tts is routed through a Web Audio
 * AnalyserNode. Every frame the avatar asks for the current loudness and
 * brightness of the sound that is playing RIGHT NOW. The mouth therefore opens
 * when there is sound and closes when there is silence, with no guessing and
 * no drift — the two cannot fall out of step, because they are the same signal.
 *
 * SAFETY: if the browser will not give us a running AudioContext (autoplay
 * policy), we do NOT route the audio through the graph — that would make the
 * avatar silent. We leave playback alone and report "unavailable", and the
 * caller falls back to the old synthetic motion.
 */

let ctx        = null;
let analyser   = null;
let freqData   = null;
let timeData   = null;
let sourceNode = null;
let attached   = false;

// An <audio> element can only ever be connected to one MediaElementSource.
// Connecting the same element twice throws, so remember which ones are done.
const wired = new WeakMap();

/** Smoothed level, so a single quiet frame doesn't snap the jaw shut. */
let smoothLevel = 0;

function getContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }

  // Browsers start the context suspended until the page has been interacted
  // with. Resume on the first gesture so later replies are analysed even if
  // the very first greeting was not.
  const resume = () => { ctx?.resume?.().catch(() => {}); };
  ["pointerdown", "keydown", "touchstart"].forEach(e =>
    window.addEventListener(e, resume, { once: false, passive: true })
  );
  return ctx;
}

/**
 * Route an <audio> element through the analyser.
 * Returns true if analysis is live, false if the caller should fall back.
 */
export async function attach(audioEl) {
  const c = getContext();
  if (!c || !audioEl) return false;

  // Never route through a suspended context — the element would play silently.
  if (c.state !== "running") {
    try { await c.resume(); } catch { /* blocked */ }
    if (c.state !== "running") return false;
  }

  try {
    if (!analyser) {
      analyser = c.createAnalyser();
      // 1024 is a good trade: ~21ms of audio at 48kHz, fine enough to track
      // syllables without the mouth jittering on individual waveform cycles.
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.55;
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
    }

    let node = wired.get(audioEl);
    if (!node) {
      node = c.createMediaElementSource(audioEl);
      wired.set(audioEl, node);
    }
    node.connect(analyser);
    // Must still reach the speakers — the graph now owns this element's output.
    analyser.connect(c.destination);

    sourceNode = node;
    attached = true;
    return true;
  } catch (err) {
    console.warn("[LipSync] audio analysis unavailable:", err.message);
    attached = false;
    return false;
  }
}

/** Stop analysing (the utterance ended or was interrupted). */
export function detach() {
  attached = false;
  smoothLevel = 0;
  try { sourceNode?.disconnect(); } catch { /* already gone */ }
  sourceNode = null;
}

export function isAnalysing() {
  return attached;
}

/**
 * Current state of the voice, or null when nothing is being analysed.
 *
 *   level    0–1  how loud — drives how far the mouth opens
 *   centroid 0–1  how bright — drives WHICH mouth shape:
 *                 low = rounded (O/U), mid = open (aa), high = spread (E/I/S)
 */
export function sample() {
  if (!attached || !analyser) return null;

  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  // RMS of the waveform around the 128 midpoint = perceived loudness.
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / timeData.length);

  // Speech RMS sits well below 1.0; scale so normal talking reaches ~0.8
  // without clipping every loud syllable to fully open.
  const raw = Math.min(1, rms * 3.2);

  // Open fast (consonant release is sharp), close a little slower — matches
  // how a real jaw moves and stops the mouth flickering between syllables.
  const rate = raw > smoothLevel ? 0.55 : 0.25;
  smoothLevel += (raw - smoothLevel) * rate;

  // Spectral centroid, normalised. Weighted mean bin index of the spectrum.
  let weighted = 0, total = 0;
  for (let i = 0; i < freqData.length; i++) {
    weighted += i * freqData[i];
    total += freqData[i];
  }
  const centroid = total > 0 ? (weighted / total) / freqData.length : 0;

  return {
    level: smoothLevel,
    // Speech energy clusters in the low bins, so stretch the useful range.
    centroid: Math.min(1, centroid * 4),
  };
}

// Dev-only handle for checking lip-sync from the browser console:
//   __speech.isAnalysing()   is the real voice being read?
//   __speech.sample()        { level, centroid } right now
// Stripped from production builds.
if (import.meta.env?.DEV && typeof window !== "undefined") {
  window.__speech = { sample, isAnalysing, get ctxState() { return ctx?.state ?? "none"; } };
}
