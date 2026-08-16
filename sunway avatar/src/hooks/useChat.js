import { useCallback } from "react";
import { useAssistantStore } from "../store/assistantStore";
import { sendMessage } from "../services/chatService";
import { speak, stopSpeaking, detectLang } from "../services/ttsService";

export function useChat() {
  const {
    isLoading, conversationHistory, sessionContext,
    setIsLoading, setAvatarState, setCurrentAnimation, setCurrentEmotion,
    setVisualAction, setSuggestions, addMessage, addToHistory, setSessionContext,
  } = useAssistantStore();

  const sendChat = useCallback(async (text) => {
    if (!text?.trim() || isLoading) return;
    const message = text.trim();

    addMessage({ role: "user", content: message });
    addToHistory("user", message);

    setIsLoading(true);
    setAvatarState("thinking");
    setCurrentAnimation("Idle");
    addMessage({ role: "assistant", content: "...", loading: true });

    try {
      const data = await sendMessage(message, conversationHistory, sessionContext);

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

    } catch (err) {
      console.error("Chat error:", err);
      const errMsg = err.message?.includes("fetch")
        ? "Server cha connection garna sakina. Backend run bhayeko cha ki? (npm run server)"
        : "Kei problem bhayo. Pheri try garnuhos.";

      useAssistantStore.getState().updateLastAssistantMessage({ content: errMsg, loading: false });
      setAvatarState("idle");
      setCurrentAnimation("Idle");
      speak(errMsg, { onEnd: () => {} });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, conversationHistory, sessionContext]);

  return { sendChat };
}
