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
      const data = await sendMessage(message, conversationHistory, sessionContext, signal);
      
      // Check if this request was aborted
      if (signal.aborted) {
        console.log('[CHAT] Request was aborted, ignoring response');
        setIsLoading(false);
        return;
      }

      if (data.sessionContext) setSessionContext(data.sessionContext);

      const reply     = data.reply || "How can I help you?";
      const animation = data.animation || "talking";
      const emotion   = data.emotion || "neutral";
      const visual    = data.visualAction;
      const sugg      = data.suggestions || [];

      useAssistantStore.getState().updateLastAssistantMessage({ content: reply, loading: false });
      addToHistory("assistant", reply);

      // Apply visual — skip NONE (keep current visual)
      if (visual?.type && visual.type !== "NONE" && visual.type !== "SHOW_NONE") {
        setVisualAction(visual);
      }

      setCurrentEmotion(emotion);

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

      setSuggestions(sugg.length ? sugg : ["BSc CSAI Program", "BIT Program", "Fee Structure"]);

      // 🛑 Stop any previous speech before starting new one
      stopSpeaking();
      setAvatarState("talking");
      setCurrentAnimation(animName);

      // Detect language — use Groq's detected language OR auto-detect from text
      const groqLang = data.language; // "en" | "ne" | "roman_ne" | "hi" | "hinglish"
      const langMap  = {
        ne:       "ne-NP",
        hi:       "hi-IN",
        hinglish: "hi-IN",
        roman_ne: "en-US", // Roman Nepali spoken in English voice
        en:       "en-US",
      };
      const lang = langMap[groqLang] || detectLang(reply);

      if (!silent) {
        speak(reply, {
          lang,
          onStart: () => {
            setAvatarState("talking");
            setCurrentAnimation("Idle");
          },
          onEnd: () => {
            setAvatarState("idle");
            setCurrentAnimation("Idle");
            setCurrentEmotion("neutral");
          },
        });
      } else {
        // If silent, just ensure we go back to idle
        setAvatarState("idle");
        setCurrentAnimation("Idle");
      }

    } catch (err) {
      console.error("Chat error:", err);
      const errMsg = err.message?.includes("fetch")
        ? "Server cha connection garna sakina. Backend run bhayeko cha ki? (npm run server)"
        : "Kei problem bhayo. Pheri try garnuhos.";

      useAssistantStore.getState().updateLastAssistantMessage({ content: errMsg, loading: false });
      setAvatarState("idle");
      setCurrentAnimation("Idle");
      if (!silent) {
        speak(errMsg, { onEnd: () => {} });
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationHistory, sessionContext]);

  return { sendChat };
}
