import { useCallback, useRef } from "react";
import { useAssistantStore } from "../store/assistantStore";
import { sendMessage } from "../services/chatService";
import { speak, stopSpeaking, detectLang } from "../services/ttsService";

export function useChat() {
  const {
    isLoading, conversationHistory, sessionContext,
    setIsLoading, setAvatarState, setCurrentAnimation, setCurrentEmotion,
    setVisualAction, setSuggestions, addMessage, addToHistory, setSessionContext,
  } = useAssistantStore();

  // Track abort controller to cancel previous requests
  const abortControllerRef = useRef(null);

  const sendChat = useCallback(async (text, options = {}) => {
    const { silent = false, hidden = false } = options;
    if (!text?.trim() || isLoading) return;
    const message = text.trim();

    // 🛑 INTERRUPT: Cancel any previous request immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('[CHAT] 🛑 Cancelled previous request');
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // 🛑 INTERRUPT: Stop any current speech immediately when new message is sent
    stopSpeaking();
    console.log('[CHAT] 🛑 Interrupting current response for new message');

    if (!hidden) {
      addMessage({ role: "user", content: message });
    }
    addToHistory("user", message);

    setIsLoading(true);
    if (!silent) {
      setAvatarState("thinking");
      setCurrentAnimation("Idle");
    }
    addMessage({ role: "assistant", content: "...", loading: true });

    try {
      const data = await sendMessage(message, conversationHistory.slice(-4), sessionContext, signal);
      
      // Check if this request was aborted — a newer one is now in flight,
      // so leave isLoading alone (the finally block skips it too)
      if (signal.aborted) {
        console.log('[CHAT] Request was aborted, ignoring response');
        return;
      }

      const reply     = data.reply || "How can I help you?";
      const animation = data.animation || "talking";
      const emotion   = data.emotion || "neutral";
      const visual    = data.visualAction;
      const sugg      = data.suggestions || [];

      // Map animation name to semantic
      const anim = animation.toLowerCase();
      const animName = {
        talking:     "Idle",
        smile:       "Idle",
        namaste:     "Namaste",
        wave:        "Standing Greeting",
        point_right: "Idle",
        nod:         "Idle",
        head_shake:  "Idle",
        thinking:    "Idle",
        idle:        "Idle",
      }[anim] || "Idle";

      // Detect language — use Groq's detected language OR auto-detect from text
      const groqLang = data.language; // "en" | "ne" | "roman_ne" | "hi" | "hinglish"
      const langMap  = {
        ne:       "ne-NP",
        hi:       "hi-IN",
        hinglish: "hi-IN",
        // Passed through as-is so the server can pick the Indian-English
        // voice for it. Rewriting this to "en-US" here meant the American
        // voice read every Romanised Nepali reply, which is exactly what
        // resolveVoice() in tts.js was written to avoid.
        roman_ne: "roman_ne",
        en:       "en-US",
      };
      const lang = langMap[groqLang] || detectLang(reply);

      // ── Queue the speech BEFORE touching the store ────────────────────────
      // Everything below re-renders the chat list, the visual panel and the
      // fee/module viewers (which fetch too). Doing that first left the
      // utterance waiting on a busy main thread — measured ~630ms from
      // response to audio, versus ~330ms when speak() goes first.
      // No stopSpeaking() here either: speak() claims the engine itself, and
      // cancelling in the same tick delays the start and can drop the
      // utterance outright ("interrupted").
      if (!silent) {
        speak(reply, {
          lang,
          onStart: () => {
            setAvatarState("talking");
            // Keep the animation the model asked for instead of resetting
            // it to Idle the moment speech begins
            setCurrentAnimation(animName);
          },
          onEnd: () => {
            setAvatarState("idle");
            setCurrentAnimation("Idle");
            setCurrentEmotion("neutral");
          },
        });
      }

      if (data.sessionContext) setSessionContext(data.sessionContext);

      useAssistantStore.getState().updateLastAssistantMessage({ content: reply, loading: false });
      addToHistory("assistant", reply);

      // Apply visual — skip NONE (keep current visual)
      if (visual?.type && visual.type !== "NONE" && visual.type !== "SHOW_NONE") {
        setVisualAction(visual);
      }

      setCurrentEmotion(emotion);
      setSuggestions(sugg.length ? sugg : ["BSc CSAI Program", "BIT Program", "Fee Structure"]);

      if (!silent) {
        setAvatarState("talking");
        setCurrentAnimation(animName);
      } else {
        // If silent, just ensure we go back to idle
        setAvatarState("idle");
        setCurrentAnimation("Idle");
      }

    } catch (err) {
      // A newer message aborted this one — the newer request owns the UI now,
      // so stay silent instead of showing/speaking the error fallback.
      if (err.name === "AbortError" || signal.aborted) {
        console.log("[CHAT] Request superseded, discarding its result");
        return;
      }

      console.error("Chat error:", err);
      const errMsg =
        "Some problem happens. You can contact Sunway College Management here:\n📞 01-4531725\n📞 01-4523736\n📱 9823047066";

      useAssistantStore.getState().updateLastAssistantMessage({ content: errMsg, loading: false });
      setAvatarState("idle");
      setCurrentAnimation("Idle");
      if (!silent) {
        speak(errMsg, { onEnd: () => {} });
      }
    } finally {
      // Only the request that is still current may clear the loading flag
      if (!signal.aborted) setIsLoading(false);
    }
  }, [isLoading, conversationHistory, sessionContext]);

  return { sendChat };
}
