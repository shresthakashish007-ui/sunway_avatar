/**
 * Voice / STT Service — uses Web Speech API.
 * Auto-stops after detecting silence (1.2 seconds of no speech).
 * Has a 20-second max timeout as fallback.
 */

let recognition = null;
let isRecording = false;
let shouldKeepListening = false;
let listenTimeout = null;
let silenceTimeout = null;
let callbacks = {};

const LISTEN_TIMEOUT_MS = 20000; // 20 seconds hard max
const SILENCE_TIMEOUT_MS = 1200; // 1.2 seconds of silence = auto-stop (fast & responsive)

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

    // Any other error — clean up
    isRecording = false;
    shouldKeepListening = false;
    if (listenTimeout) { clearTimeout(listenTimeout); listenTimeout = null; }
    if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
    callbacks.onError?.(e.error || "Microphone error");
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
        // Call onEnd with the final transcript to trigger auto-submit
        callbacks.onEnd?.();
      }, SILENCE_TIMEOUT_MS);
    }
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
