/**
 * Voice / STT Service — uses Web Speech API.
 * Keeps mic active for up to 20 seconds with auto-restart on silence.
 */

let recognition = null;
let isRecording = false;
let shouldKeepListening = false;
let listenTimeout = null;
let callbacks = {};

const LISTEN_TIMEOUT_MS = 20000; // 20 seconds max

export function isSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function createAndStart() {
  if (!isSupported()) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = callbacks.lang || "en-US";
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
    callbacks.onEnd?.();
  };

  recognition.onerror = (e) => {
    // "no-speech" is non-fatal — just restart so the mic stays open
    if (e.error === "no-speech" && shouldKeepListening) {
      isRecording = false;
      try { recognition.start(); } catch (_) {}
      return;
    }

    // Any other error — clean up
    isRecording = false;
    shouldKeepListening = false;
    if (listenTimeout) { clearTimeout(listenTimeout); listenTimeout = null; }
    callbacks.onError?.(e.error || "Microphone error");
  };

  recognition.onresult = (e) => {
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
    callbacks.onResult?.(combined, false); // always pass as non-final — user clicks to submit
  };

  try {
    recognition.start();
  } catch (err) {
    callbacks.onError?.(err.message);
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

  // 20-second hard stop
  listenTimeout = setTimeout(() => {
    shouldKeepListening = false;
    if (recognition && isRecording) {
      recognition.stop();
    }
    callbacks.onEnd?.();
    listenTimeout = null;
  }, LISTEN_TIMEOUT_MS);

  createAndStart();
}

export function stopListening() {
  shouldKeepListening = false;
  if (listenTimeout) { clearTimeout(listenTimeout); listenTimeout = null; }
  if (recognition) {
    try { recognition.stop(); } catch (_) {}
    recognition = null;
  }
  isRecording = false;
}

export function getIsRecording() {
  return isRecording;
}
