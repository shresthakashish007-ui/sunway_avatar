/**
 * TTS Service — Microsoft Edge TTS (Browser Web Speech API)
 * FREE, No API Key Needed - Uses Edge's built-in high-quality voices
 * Supports multiple languages including English, Hindi, and Nepali
 * Best quality when using Microsoft Edge browser
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

// ─── Browser Web Speech with Microsoft Edge Voices ────────────────────────
function speakWithBrowserVoice(text, { onStart, onEnd, lang } = {}) {
  if (!window.speechSynthesis) { 
    console.warn('[TTS] Browser speech synthesis not supported');
    onEnd?.(); 
    return; 
  }

  stopSpeaking();

  const detectedLang = lang || detectLang(text);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = detectedLang;
  utter.volume = 1;
  utter.rate = 1.05; // Slightly faster for natural flow
  utter.pitch = 1.15; // Higher pitch for clear female voice

  utter.onstart = () => {
    console.log('[TTS] 🎙️ Edge TTS started');
    onStart?.();
  };
  utter.onend = () => { 
    console.log('[TTS] ✅ Edge TTS completed');
    currentUtter = null; 
    onEnd?.(); 
  };
  utter.onerror = (e) => { 
    console.error('[TTS] ❌ Edge TTS error:', e.error || e);
    // If error is 'interrupted' or 'cancelled', it's normal (user action)
    if (e.error === 'interrupted' || e.error === 'cancelled') {
      console.log('[TTS] Speech was interrupted (normal)');
    }
    currentUtter = null; 
    onEnd?.(); 
  };
  currentUtter = utter;

  // Wait for voices to load
  const setVoiceAndSpeak = () => {
    const voices = window.speechSynthesis.getVoices();
    console.log(`[TTS] Available voices: ${voices.length}`);
    
    // Try to find best Microsoft Edge voice
    let selectedVoice = null;
    
    // Priority 1: Microsoft Edge voices (Best quality on Windows)
    // English voices
    if (detectedLang.startsWith('en')) {
      // Try Microsoft Zira (US English Female - Natural)
      selectedVoice = voices.find(v => v.name.includes('Microsoft Zira'));
      
      if (!selectedVoice) {
        // Try other Microsoft English female voices
        selectedVoice = voices.find(v => 
          v.name.includes('Microsoft') && 
          (v.name.includes('Zira') || v.name.includes('Jenny') || v.name.includes('Aria')) &&
          v.lang.startsWith('en')
        );
      }
      
      if (!selectedVoice) {
        // Try Google English Female
        selectedVoice = voices.find(v => 
          v.name.includes('Google') && 
          v.name.includes('Female') && 
          v.lang.startsWith('en')
        );
      }
    }
    
    // Hindi voices
    if (detectedLang.startsWith('hi')) {
      // Try Microsoft Hemant or Kalpana (Hindi voices)
      selectedVoice = voices.find(v => 
        v.name.includes('Microsoft') && 
        (v.name.includes('Hemant') || v.name.includes('Kalpana')) &&
        v.lang.startsWith('hi')
      );
      
      if (!selectedVoice) {
        // Try Google Hindi voices
        selectedVoice = voices.find(v => 
          v.name.includes('Google') && 
          v.lang.startsWith('hi')
        );
      }
    }
    
    // Nepali voices (if available)
    if (detectedLang.startsWith('ne')) {
      selectedVoice = voices.find(v => v.lang.startsWith('ne'));
      
      // Fallback to Hindi for Nepali (similar pronunciation)
      if (!selectedVoice) {
        selectedVoice = voices.find(v => 
          v.name.includes('Microsoft') && 
          v.lang.startsWith('hi')
        );
      }
    }
    
    // Priority 4: Any female voice matching language
    if (!selectedVoice) {
      selectedVoice = voices.find(v => 
        v.name.toLowerCase().includes('female') && 
        v.lang.startsWith(detectedLang.substring(0, 2))
      );
    }
    
    // Priority 5: Common female voice names
    if (!selectedVoice) {
      const femaleNames = ['Zira', 'Jenny', 'Aria', 'Samantha', 'Victoria', 'Karen', 'Susan', 'Moira', 'Tessa', 'Fiona'];
      selectedVoice = voices.find(v => 
        femaleNames.some(name => v.name.includes(name))
      );
    }
    
    // Fallback: First voice matching language
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith(detectedLang.substring(0, 2)));
    }
    
    // Last resort: First available voice
    if (!selectedVoice && voices.length > 0) {
      selectedVoice = voices[0];
    }
    
    if (selectedVoice) {
      utter.voice = selectedVoice;
      console.log(`[TTS] 🎤 Using Microsoft Edge voice: ${selectedVoice.name} (${selectedVoice.lang})`);
    } else {
      console.warn('[TTS] ⚠️ No suitable voice found, using default');
    }
    
    window.speechSynthesis.speak(utter);
  };

  // Check if voices are already loaded
  if (window.speechSynthesis.getVoices().length > 0) {
    setVoiceAndSpeak();
  } else {
    // Wait for voices to load
    window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
  }
}

// ─── Main speak function — Use Microsoft Edge TTS ────────────────────────
export async function speak(text, { onStart, onEnd, lang } = {}) {
  if (isMuted || !text?.trim()) { 
    onEnd?.(); 
    return; 
  }

  // Stop anything currently playing and claim this generation
  stopSpeaking();
  const myGeneration = speakGeneration;

  console.log(`[TTS] 🎙️ Speaking with Microsoft Edge TTS (${text.length} chars) - lang: ${lang || "auto"}`);

  // Use browser speech with Microsoft Edge voices (free, high quality)
  if (speakGeneration === myGeneration) {
    speakWithBrowserVoice(text, { onStart, onEnd, lang });
  }
}
