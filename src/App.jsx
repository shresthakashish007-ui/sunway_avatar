import React, { useEffect, useState, useCallback, useRef } from "react";
import { AvatarScene } from "./components/avatar/AvatarScene";
import { VisualPanel } from "./components/visual/VisualPanel";
import { useAssistantStore } from "./store/assistantStore";
import { useChat } from "./hooks/useChat";
import { startListening as _startListening, stopListening as _stopListening, finishListening as _finishListening, isSupported } from "./services/voiceService";
import { speak, stopSpeaking, preloadVoices } from "./services/ttsService";
import { loadCollegeConfig, getCollegeConfig } from "./services/collegeConfig";
import {
  Home, RotateCcw, Mic, Send,
  Square, Minus, MessageCircle, Sparkles
} from "lucide-react";
import "./index.css";

// Sunway Brand Colors - Red/White Theme
const SUNWAY_RED = "var(--brand)";
const DARK_RED = "var(--brand-dark)";
const LIGHT_RED = "var(--brand-light)";
const VERY_LIGHT_RED = "var(--brand-lighter)";
const PURE_WHITE = "#FFFFFF";
const PRIMARY_TEXT = "#252525";
const SECONDARY_TEXT = "#777777";
const BORDER = "#E8E8E8";
const SOFT_RED_BORDER = "var(--brand-border)";

/* ─────────────────────────────────────────────────────────────────────────
   Welcome greeting (once per session)

   Spoken in Nepali by the real ne-NP neural voice, and the bow is started by
   the AUDIO, not by a timer:

     1. Branding loads → we know the college name and its greeting line
     2. speak() is called immediately — no arbitrary wait
     3. The moment sound actually leaves the speakers, onStart fires and the
        namaste animation begins, so the bow lands on "नमस्ते"
     4. onEnd → back to idle, then the AI is asked (silently) for suggestions

   The old version played the animation on an 800ms timer while the audio was
   still loading, so the bow and the word drifted apart by however long the
   network happened to take.
───────────────────────────────────────────────────────────────────────── */
function useWelcomeGreeting(shouldTrigger = true) {
  const {
    welcomeShown, setWelcomeShown,
    setCurrentAnimation, setAvatarState, setCurrentEmotion,
  } = useAssistantStore();
  const { sendChat } = useChat();

  const [configReady, setConfigReady] = useState(false);
  // Survives StrictMode's double-invoke and any re-render, so the greeting
  // speaks exactly once per session.
  const greetedRef = useRef(false);

  // Branding must be loaded before the greeting speaks, otherwise it would
  // announce the placeholder college name.
  useEffect(() => {
    let cancelled = false;
    loadCollegeConfig().then(() => { if (!cancelled) setConfigReady(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Preload system voices on app startup for faster first response
    preloadVoices();

    if (welcomeShown || !shouldTrigger || !configReady) return;

    // Ref guard rather than relying on `welcomeShown` alone: that is store
    // state, so setting it re-runs this effect and React would tear down the
    // in-flight greeting before it ever reached the speakers.
    if (greetedRef.current) return;
    greetedRef.current = true;

    setWelcomeShown(true);
    setCurrentEmotion("happy");

    const cfg = getCollegeConfig();
    // The college's own words if it has set them, otherwise a plain English
    // line so a newly-created college still greets people.
    const line = cfg.greetingText?.trim()
      || `Namaste! Welcome to ${cfg.name}. I am your AI admission assistant. How can I help you today?`;
    const lang = cfg.greetingText?.trim() ? (cfg.greetingLang || "ne") : "en";

    // No settle timer: she is already standing (the controller starts on the
    // idle pose), and speak() spends ~300ms fetching audio anyway. Waiting
    // first only delayed the greeting.
    speak(line, {
      lang,
      onStart: () => {
        // Sound is leaving the speakers RIGHT NOW — bow on this frame.
        setAvatarState("talking");
        setCurrentAnimation("Namaste");
      },
      onEnd: () => {
        setAvatarState("idle");
        setCurrentAnimation("Idle");
        setCurrentEmotion("neutral");
        // Fire AI silently in background to populate suggestions & visual panel
        sendChat("welcome - just show the home panel and give 3-4 helpful suggestion pills, no long reply needed", { silent: true, hidden: true });
      },
    });
  }, [welcomeShown, shouldTrigger, configReady]);
}

/* ─────────────────────────────────────────────────────────────────────────
   Top Navigation Bar
───────────────────────────────────────────────────────────────────────── */
function TopBar({ onHome, onReset, onBackToWidget }) {
  return (
    <div style={{
      height: 72,
      background: "#FFFFFF",
      borderBottom: "1px solid rgba(0,0,0,0.04)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", flexShrink: 0,
      boxShadow: "0 4px 20px rgba(0,0,0,0.02)",
      zIndex: 50, position: "relative"
    }}>
      {/* Left side: Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <img
          src={getCollegeConfig().logoUrl || "/my-logo.png"}
          alt={getCollegeConfig().name}
          style={{ height: 42, width: "auto", objectFit: "contain" }}
        />
      </div>

      {/* Right side: Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <IconBtn Icon={Home} onClick={onHome} tooltip="Home" />
        <IconBtn Icon={RotateCcw} onClick={onReset} tooltip="Reset Chat" />
        {onBackToWidget && (
          <IconBtn Icon={Minus} onClick={onBackToWidget} tooltip="Minimize" />
        )}
      </div>
    </div>
  );
}

function IconBtn({ Icon, onClick, tooltip }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} title={tooltip}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: h ? VERY_LIGHT_RED : "#fff",
        border: `1px solid ${h ? SUNWAY_RED : "#E8E8E8"}`,
        borderRadius: 12, padding: "10px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        width: 40, height: 40,
        boxShadow: h ? `0 4px 12px rgba(var(--brand-rgb), 0.13)` : "none",
        transform: h ? "translateY(-1px)" : "none"
      }}>
      <Icon size={18} strokeWidth={2.5} color={h ? SUNWAY_RED : "#555"} />
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Left Panel — Avatar only
───────────────────────────────────────────────────────────────────────── */

function LeftPanel() {
  return (
    <div style={{
      width: 540, flexShrink: 0,
      display: "flex", flexDirection: "column",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Avatar Scene */}
      <div style={{ flex: 1, position: "relative", zIndex: 0 }}>
        <AvatarScene />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Chat Bubbles
───────────────────────────────────────────────────────────────────────── */
function Bubble({ msg }) {
  const isUser = msg.role === "user";
  const time = (() => {
    try { return new Date(msg.id).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  })();

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      alignItems: "flex-start",
      gap: 10, marginBottom: 16,
      animation: "slideUp 0.25s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 80, height: 80, borderRadius: "8px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: 2, overflow: "hidden",
        }}>
          <img
            src="/img/bot-robot.png"
            alt="Bot"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      )}
      <div style={{ maxWidth: "73%" }}>
        <div style={{
          padding: "12px 16px",
          borderRadius: isUser ? "20px 6px 20px 20px" : "6px 20px 20px 20px",
          background: isUser
            ? `linear-gradient(135deg, ${VERY_LIGHT_RED}, ${LIGHT_RED})`
            : "rgba(255,255,255,0.95)",
          color: PRIMARY_TEXT, fontSize: 14, lineHeight: 1.65,
          border: isUser ? `1px solid rgba(var(--brand-rgb), 0.08)` : `1px solid ${BORDER}`,
          boxShadow: isUser
            ? `0 2px 8px rgba(var(--brand-rgb), 0.03)`
            : "0 2px 10px rgba(0,0,0,0.05)",
        }}>
          {msg.loading ? <TypingDots /> : msg.content}
        </div>
        {time && (
          <div style={{
            fontSize: 10.5, color: "#c0c0c0", marginTop: 5,
            textAlign: isUser ? "right" : "left",
            paddingLeft: isUser ? 0 : 4,
            fontWeight: 500,
          }}>
            {time}{isUser && <span style={{ marginLeft: 5 }}>✓</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#ccc",
          animation: `blink 1s infinite ${i * 0.2}s`, display: "inline-block",
        }} />
      ))}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Suggestion Pills
───────────────────────────────────────────────────────────────────────── */
function SuggPill({ label, onClick }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? VERY_LIGHT_RED : PURE_WHITE,
        border: `1.5px solid ${h ? SUNWAY_RED : SOFT_RED_BORDER}`,
        borderRadius: 18, padding: "6px 15px",
        fontSize: 12.5, fontWeight: 600,
        color: h ? DARK_RED : PRIMARY_TEXT,
        cursor: "pointer",
        transition: "all 0.25s ease",
        whiteSpace: "nowrap",
        boxShadow: h ? `0 2px 8px rgba(var(--brand-rgb), 0.08)` : "0 1px 3px rgba(0,0,0,0.03)",
        transform: h ? "translateY(-1px)" : "translateY(0)",
      }}>
      {label}
    </button>
  );
}


/* ─────────────────────────────────────────────────────────────────────────
   Speech language picker

   Telling Whisper which language is being spoken is the single biggest
   accuracy lever: forcing English on Nepali speech scored 13.9%, auto-detect
   62.8%, naming the language 91.3%. "Auto" stays the default so a wrong
   guess can never be catastrophic.
───────────────────────────────────────────────────────────────────────── */
const STT_LANGS = [
  { id: "auto", label: "Auto",     hint: "Detect the language automatically" },
  { id: "en",   label: "English",  hint: "Speak in English" },
  { id: "ne",   label: "नेपाली",    hint: "नेपालीमा बोल्नुहोस्" },
  { id: "hi",   label: "हिंदी",     hint: "हिंदी में बोलें" },
];

function SpeechLangPicker({ compact }) {
  const { sttLang, setSttLang } = useAssistantStore();
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: compact ? 10 : 10.5, color: SECONDARY_TEXT, fontWeight: 600 }}>
        Mic:
      </span>
      {STT_LANGS.map(l => {
        const on = sttLang === l.id;
        return (
          <button key={l.id} title={l.hint} onClick={() => setSttLang(l.id)}
            style={{
              background: on ? SUNWAY_RED : "transparent",
              color: on ? "#fff" : SECONDARY_TEXT,
              border: `1px solid ${on ? SUNWAY_RED : BORDER}`,
              borderRadius: 14, padding: compact ? "2px 8px" : "3px 10px",
              fontSize: compact ? 10.5 : 11, fontWeight: 700, cursor: "pointer",
              lineHeight: 1.5,
            }}>
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Chat Input
───────────────────────────────────────────────────────────────────────── */
function ChatInput({ onSend, isLoading }) {
  const {
    isListening, suggestions,
    setIsListening, setAvatarState,
  } = useAssistantStore();
  const [input, setInput] = useState("");
  const [transcript, setTr] = useState("");
  const [countdown, setCountdown] = useState(20);
  const countdownRef = useRef(null);
  // Mirrors `transcript` so the speech callbacks can read the latest value
  // without submitting from inside a setState updater (React runs those twice
  // under StrictMode, which sent every voice message twice).
  const transcriptRef = useRef("");
  const setTranscript = useCallback((t) => { transcriptRef.current = t; setTr(t); }, []);

  // Start/stop countdown timer visually
  useEffect(() => {
    if (isListening) {
      setCountdown(20);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setCountdown(20);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [isListening]);

  const submit = () => {
    const t = input.trim();
    if (!t || isLoading) return;
    setInput(""); onSend(t);
  };
  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };

  const toggleMic = () => {
    if (!isSupported()) return;

    // 🛑 INTERRUPT: Stop any ongoing speech when mic is clicked
    stopSpeaking();
    console.log('[MIC-DESKTOP] 🛑 Stopping speech to listen');

    if (isListening) {
      // User clicked stop. finishListening() still sends the recorded audio to
      // Whisper, and the transcript comes back through onEnd below — so don't
      // submit here or the message would be sent twice.
      setIsListening(false);
      setAvatarState("idle");
      _finishListening();
      return;
    }
    setTranscript("");
    setIsListening(true);
    setAvatarState("listening");
    _startListening({
      lang: useAssistantStore.getState().sttLang,
      onResult: (text) => {
        setTranscript(text); // just update display; user clicks stop to submit
      },
      onError: () => { setIsListening(false); setAvatarState("idle"); setTranscript(""); },
      onEnd: (finalText) => {
        // Fires on silence, timeout or the stop button. finalText is Whisper's
        // transcript when it succeeded; otherwise fall back to what the
        // browser heard live.
        setIsListening(false);
        setAvatarState("idle");
        const heard = (finalText || transcriptRef.current || "").trim();
        setTranscript("");
        if (heard) onSend(heard);
      },
    });
  };

  const canSend = input.trim() && !isLoading;

  return (
    <div style={{
      flexShrink: 0,
      background: "rgba(255,255,255,0.65)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderTop: `1px solid rgba(var(--brand-rgb), 0.19)`,
      padding: "14px 20px 16px",
    }}>
      {/* Suggestion pills */}
      {suggestions?.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
          {suggestions.map((s, i) => <SuggPill key={i} label={s} onClick={() => onSend(s)} />)}
        </div>
      )}

      {/* Speech language picker */}
      <div style={{ marginBottom: 8 }}><SpeechLangPicker /></div>

      {/* Listening status bar */}
      {isListening && (
        <div style={{
          marginBottom: 10,
          background: "linear-gradient(135deg, #f0fdf4, #dcfce7)",
          border: "1.5px solid #86efac",
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          {/* Animated mic dot */}
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: "#16a34a",
            flexShrink: 0,
            animation: "pulse 1s infinite",
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginBottom: 2 }}>
              Listening… {countdown}s
            </div>
            {transcript ? (
              <div style={{ fontSize: 12, color: "#166534", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                "{transcript}"
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#4ade80", fontStyle: "italic" }}>
                Speak now — stops automatically when you finish
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input pill - Premium floating style */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "#F8F8F8",
        border: `1.5px solid ${isListening ? "#6ee7b7" : "transparent"}`,
        borderRadius: 30, padding: "8px 8px 8px 20px",
        transition: "all 0.2s ease",
      }}
      onFocus={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.borderColor = SUNWAY_RED; e.currentTarget.style.boxShadow = `0 0 0 4px ${VERY_LIGHT_RED}`; }}
      onBlur={(e) => { e.currentTarget.style.background = "#F8F8F8"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.boxShadow = "none"; }}
      >
        <Sparkles size={18} color={SUNWAY_RED} />
        
        <input
          value={isListening ? (transcript || "") : input}
          onChange={e => { if (!isListening) setInput(e.target.value); }}
          onKeyDown={onKey}
          placeholder="Ask anything about the college..."
          disabled={isListening}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontSize: 15, color: PRIMARY_TEXT, padding: "8px 0",
          }}
        />

        {/* Mic toggle */}
        <button onClick={toggleMic}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "8px", display: "flex", alignItems: "center",
            color: isListening ? SUNWAY_RED : "#888",
            transition: "color 0.15s",
          }}>
          {isListening
            ? <Square size={18} color={SUNWAY_RED} fill={SUNWAY_RED} />
            : <Mic size={18} color="#888" />}
        </button>

        {/* Send button - Premium style */}
        <button onClick={submit} disabled={!canSend}
          style={{
            width: 44, height: 44, borderRadius: "50%", border: "none", flexShrink: 0,
            background: canSend ? `linear-gradient(135deg, ${SUNWAY_RED}, ${DARK_RED})` : "#E5E5E5",
            cursor: canSend ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: canSend ? `0 4px 12px rgba(var(--brand-rgb), 0.25)` : "none",
            transition: "all 0.2s ease",
            transform: canSend ? "scale(1)" : "scale(0.95)",
          }}
          onMouseEnter={e => { if (canSend) e.currentTarget.style.transform = "scale(1.05)"; }}
          onMouseLeave={e => { if (canSend) e.currentTarget.style.transform = "scale(1)"; }}
        >
          <Send size={16} color={canSend ? "#fff" : "#aaa"} />
        </button>
      </div>

      {/* Footer with RGB border effect */}
      <div style={{
        margin: "10px auto 0",
        textAlign: "center", fontSize: 12,
        display: "flex", alignItems: "center",
        justifyContent: "center", gap: 6,
        background: "rgba(255,255,255,0.9)",
        borderRadius: "20px", padding: "5px 16px",
        border: "2px solid #ff0000",
        animation: "rgbBorder 3s linear infinite",
        width: "fit-content",
      }}>
        <span style={{ color: SECONDARY_TEXT, fontWeight: 500 }}>Powered By</span>
        <img
          src="/img/pranam-logo.png"
          alt="Pranam Software"
          style={{ height: 16, width: "auto", objectFit: "contain" }}
        />
        <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0" }}>
          <span style={{ color: "#000000" }}>Pranam</span>
          <span style={{ color: "#FF8C00" }}>Software</span>
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Right Panel — Chat messages + Visual cards
───────────────────────────────────────────────────────────────────────── */
function RightPanel({ onQuery }) {
  const { messages, isLoading, visualAction, avatarState } = useAssistantStore();
  const endRef = useRef(null);

  // Auto-scroll when messages or visual panels change
  useEffect(() => {
    // Small delay to ensure DOM has updated
    const timer = setTimeout(() => {
      if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, visualAction]);

  // Hide visual panel while the bot is processing or speaking, but NOT during the initial greeting (messages.length === 0)
  const isBotActive = messages.length > 0 && (isLoading || avatarState === "thinking" || avatarState === "talking" || avatarState === "listening");

  // Check if there's an active visual panel showing
  const hasVisualPanel = visualAction?.type &&
    visualAction.type !== "NONE" &&
    visualAction.type !== "SHOW_NONE" &&
    visualAction.type !== "WELCOME" &&
    !isBotActive;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      minWidth: 0, padding: "16px 24px 16px 0"
    }}>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        background: "#FFFFFF",
        borderRadius: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
        border: "1px solid rgba(0,0,0,0.04)",
        overflow: "hidden"
      }}>
        {/* Content Area */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
          background: "#FAFAFA"
        }}>
          {/* Messages container */}
          <div
            style={{
              flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0,
              padding: "16px",
              display: hasVisualPanel ? "none" : "flex",
              flexDirection: "column",
            }}>
            
            {messages.length === 0 && !hasVisualPanel && (
              <div style={{ textAlign: "center", color: "#aaa", fontSize: 14, marginTop: 40, fontStyle: "italic" }}>
                Use the quick actions or type your question below 👇
              </div>
            )}

            {messages.length > 0 && (
              <div style={{ marginBottom: 8, minHeight: "fit-content", flex: "0 0 auto" }}>
                {messages.map(m => <Bubble key={m.id} msg={m} />)}
              </div>
            )}
            
            <div ref={endRef} style={{ height: 1, marginTop: 12, flex: "0 0 auto" }} />
          </div>

          {/* Visual Panel container */}
          {hasVisualPanel && (
            <div style={{
              flex: 1, overflowY: "auto", minHeight: 0,
              padding: "16px",
              display: "flex", flexDirection: "column",
            }}>
              <VisualPanel onQuery={onQuery} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <ChatInput onSend={onQuery} isLoading={isLoading} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Mobile Status Badge
───────────────────────────────────────────────────────────────────────── */
function StatusBadgeMobile() {
  const { avatarState, isLoading } = useAssistantStore();
  const state = isLoading ? "thinking" : avatarState;
  if (state === "idle") return null;
  const cfg = {
    thinking: { label: "Thinking", color: DARK_RED },
    listening: { label: "Listening", color: "#059669" },
    talking: { label: "Speaking", color: SUNWAY_RED },
  }[state];
  if (!cfg) return null;
  return (
    <span style={{
      background: `${cfg.color}18`, color: cfg.color,
      border: `1px solid ${cfg.color}33`,
      borderRadius: 20, padding: "4px 10px", fontSize: 10.5, fontWeight: 700,
      display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, display: "inline-block", animation: "pulse 1.2s infinite" }} />
      {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Mobile Messages + Visual
───────────────────────────────────────────────────────────────────────── */
function MobileBubble({ msg }) {
  const isUser = msg.role === "user";
  const time = (() => {
    try { return new Date(msg.id).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  })();

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      alignItems: "flex-start",
      gap: 8, marginBottom: 12,
      animation: "slideUp 0.25s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#f5f5f5",
          overflow: "hidden",
        }}>
          <img
            src="/img/bot-robot.png"
            alt="Bot"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>
      )}
      <div style={{ maxWidth: isUser ? "75%" : "80%", minWidth: 0 }}>
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          background: isUser
            ? `linear-gradient(135deg, ${VERY_LIGHT_RED}, ${LIGHT_RED})`
            : "#fff",
          color: PRIMARY_TEXT, fontSize: 13.5, lineHeight: 1.6,
          border: isUser ? `1px solid rgba(var(--brand-rgb), 0.08)` : "1px solid #e8e8e8",
          boxShadow: isUser
            ? `0 1px 4px rgba(var(--brand-rgb), 0.03)`
            : "0 1px 4px rgba(0,0,0,0.06)",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        }}>
          {msg.loading ? <TypingDots /> : msg.content}
        </div>
        {time && (
          <div style={{
            fontSize: 10, color: "#aaa", marginTop: 3,
            textAlign: isUser ? "right" : "left",
            paddingLeft: isUser ? 0 : 2,
            fontWeight: 500,
          }}>
            {time}{isUser && <span style={{ marginLeft: 4 }}>✓</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileMessages({ onQuery }) {
  const { messages, visualAction, avatarState, isLoading } = useAssistantStore();
  const endRef = useRef(null);

  // Auto-scroll when messages or visual panels change  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, visualAction]);

  // Hide visual panel while the bot is processing or speaking, but NOT during the initial greeting (messages.length === 0)
  const isBotActive = messages.length > 0 && (isLoading || avatarState === "thinking" || avatarState === "talking" || avatarState === "listening");

  // Check if there's an active visual panel showing
  const hasVisualPanel = visualAction?.type &&
    visualAction.type !== "NONE" &&
    visualAction.type !== "SHOW_NONE" &&
    visualAction.type !== "WELCOME" &&
    !isBotActive;

  return (
    <>
      {messages.length === 0 && !hasVisualPanel && (
        <div style={{ textAlign: "center", color: "#999", fontSize: 12, padding: "20px 0", fontStyle: "italic" }}>
          {`Ask me anything about ${getCollegeConfig().shortName} 👇`}
        </div>
      )}

      {/* Chat History - Only show when visual panel is NOT active */}
      {!hasVisualPanel && messages.length > 0 && (
        <div style={{
          marginBottom: 0,
          minHeight: "fit-content"
        }}>
          {/* Render ALL messages */}
          <div style={{ paddingTop: 0 }}>
            {messages.map(m => <MobileBubble key={m.id} msg={m} />)}
          </div>
        </div>
      )}

      {/* Visual Panel with CLEAR separator */}
      {hasVisualPanel && (
        <div style={{
          marginTop: 0,
          paddingTop: 14,
          borderTop: "none",
        }}>
          {messages.length > 0 && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
              paddingBottom: 8,
            }}>
              <div style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${SUNWAY_RED}, ${DARK_RED})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                color: "#fff",
                fontWeight: 800,
                flexShrink: 0,
              }}>
                ✦
              </div>
              <span style={{
                fontSize: 13,
                fontWeight: 800,
                color: SUNWAY_RED,
              }}>
                Form / Details
              </span>
            </div>
          )}
          <VisualPanel onQuery={onQuery} />
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={endRef} style={{ height: 1, marginTop: 12 }} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Mobile Chat Input — clean, full-width
───────────────────────────────────────────────────────────────────────── */
function MobileChatInput({ onSend }) {
  const { isLoading, isListening, suggestions, setIsListening, setAvatarState } = useAssistantStore();
  const [input, setInput] = useState("");
  const [transcript, setTr] = useState("");
  const [countdown, setCountdown] = useState(20);
  const countdownRef = useRef(null);
  // See ChatInput — keeps voice submits out of the setState updater
  const transcriptRef = useRef("");
  const setTranscript = useCallback((t) => { transcriptRef.current = t; setTr(t); }, []);

  useEffect(() => {
    if (isListening) {
      setCountdown(20);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      setCountdown(20);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [isListening]);

  const submit = () => {
    const t = input.trim(); if (!t || isLoading) return;
    setInput(""); onSend(t);
  };
  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };

  const toggleMic = () => {
    if (!isSupported()) return;

    // 🛑 INTERRUPT: Stop any ongoing speech when mic is clicked
    stopSpeaking();
    console.log('[MIC-MOBILE] 🛑 Stopping speech to listen');

    if (isListening) {
      // User clicked stop. finishListening() still sends the recorded audio to
      // Whisper, and the transcript comes back through onEnd below — so don't
      // submit here or the message would be sent twice.
      setIsListening(false);
      setAvatarState("idle");
      _finishListening();
      return;
    }
    setTranscript("");
    setIsListening(true);
    setAvatarState("listening");
    _startListening({
      lang: useAssistantStore.getState().sttLang,
      onResult: (text) => {
        setTranscript(text); // just update display; user clicks stop to submit
      },
      onError: () => { setIsListening(false); setAvatarState("idle"); setTranscript(""); },
      onEnd: (finalText) => {
        // Fires on silence, timeout or the stop button. finalText is Whisper's
        // transcript when it succeeded; otherwise fall back to what the
        // browser heard live.
        setIsListening(false);
        setAvatarState("idle");
        const heard = (finalText || transcriptRef.current || "").trim();
        setTranscript("");
        if (heard) onSend(heard);
      },
    });
  };

  const canSend = input.trim() && !isLoading;

  return (
    <div style={{
      flexShrink: 0,
      background: "rgba(255,255,255,0.65)",
      backdropFilter: "blur(12px)",
      borderTop: `1px solid rgba(var(--brand-rgb), 0.19)`,
      padding: "10px 14px 12px",
    }}>
      {/* Suggestion pills — horizontal scroll */}
      {suggestions?.length > 0 && (
        <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 10, paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => onSend(s)}
              style={{
                background: "rgba(255,255,255,0.85)",
                border: `1px solid ${SOFT_RED_BORDER}`,
                borderRadius: 18, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                color: SUNWAY_RED, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Speech language picker */}
      <div style={{ marginBottom: 7 }}><SpeechLangPicker compact /></div>

      {/* Listening status */}
      {isListening && (
        <div style={{
          marginBottom: 8,
          background: "linear-gradient(135deg, rgba(240,253,244,0.95), rgba(220,252,231,0.95))",
          border: "1.5px solid #86efac",
          borderRadius: 12,
          padding: "8px 12px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", flexShrink: 0, animation: "pulse 1s infinite" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#16a34a" }}>Listening… {countdown}s</div>
            {transcript ? (
              <div style={{ fontSize: 11.5, color: "#166534", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{transcript}"</div>
            ) : (
              <div style={{ fontSize: 11, color: "#4ade80", fontStyle: "italic" }}>Speak now — stops automatically</div>
            )}
          </div>
        </div>
      )}

      {/* Input row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: PURE_WHITE,
        border: `1.5px solid ${isListening ? "#6ee7b7" : BORDER}`,
        borderRadius: 24, padding: "8px 8px 8px 16px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}>
        {/* Mic */}
        <button onClick={toggleMic} style={{
          background: "none", border: "none", cursor: "pointer",
          color: isListening ? SUNWAY_RED : "#aaa", padding: 0, display: "flex", alignItems: "center",
        }}>
          {isListening
            ? <Square size={17} color={SUNWAY_RED} fill={SUNWAY_RED} />
            : <Mic size={18} color="#aaa" />}
        </button>

        <input
          value={isListening ? (transcript || "") : input}
          onChange={e => { if (!isListening) setInput(e.target.value); }}
          onKeyDown={onKey}
          placeholder="Type your question..."
          disabled={isListening}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontSize: 14, color: PRIMARY_TEXT, padding: "5px 0",
          }}
        />

        <button onClick={submit} disabled={!canSend}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
            background: canSend ? `linear-gradient(135deg, ${SUNWAY_RED}, ${DARK_RED})` : "rgba(0,0,0,0.15)",
            cursor: canSend ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: canSend ? `0 3px 10px rgba(var(--brand-rgb), 0.25)` : "none",
          }}>
          <Send size={15} color={canSend ? "#fff" : "#aaa"} />
        </button>
      </div>

      {/* Footer with RGB border effect */}
      <div style={{
        margin: "7px auto 0",
        textAlign: "center", fontSize: 10.5,
        color: SECONDARY_TEXT,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        background: "rgba(255,255,255,0.9)",
        borderRadius: "14px", padding: "4px 12px",
        border: "2px solid #ff0000",
        animation: "rgbBorder 3s linear infinite",
        width: "fit-content",
      }}>
        Powered By
        <img
          src="/img/pranam-logo.png"
          alt="Pranam Software"
          style={{ height: 14, width: "auto", objectFit: "contain" }}
        />
        <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0" }}>
          <span style={{ color: "#000000" }}>Pranam</span>
          <span style={{ color: "#FF8C00" }}>Software</span>
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Widget Mode Components
───────────────────────────────────────────────────────────────────────── */
function MinimizedButton({ onClick }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
      <div style={{
        background: "#fff", padding: "8px 16px", borderRadius: 20,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 13, fontWeight: 700, color: "#333",
        animation: "slideUp 0.3s ease",
      }}>
        Hi! 👋 Chat with me
      </div>
      <button onClick={onClick} style={{
        width: 60, height: 60, borderRadius: "50%",
        background: SUNWAY_RED, border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 6px 16px rgba(181,31,36,0.3)",
        animation: "pulse 2s infinite"
      }}>
        <MessageCircle size={28} color="#fff" />
      </button>
    </div>
  );
}

function WidgetTopBar({ onMinimize, onMaximize }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", background: "#fff", borderBottom: "1px solid #f0f0f0",
      flexShrink: 0
    }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>{getCollegeConfig().assistantName}</div>
        <div style={{ fontSize: 12, color: "#10b981", display: "flex", alignItems: "center", gap: 5, marginTop: 2, fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} /> Online
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onMinimize} style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f5f5", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Minus size={16} color="#555" />
        </button>
        <button onClick={onMaximize} style={{ width: 32, height: 32, borderRadius: 8, background: "#f5f5f5", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Square size={14} color="#555" />
        </button>
      </div>
    </div>
  );
}

function WidgetView({ onMinimize, onMaximize, onQuery }) {
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20,
      width: 380, height: 720, maxHeight: "calc(100vh - 40px)",
      background: "#fff", borderRadius: 16,
      boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
      display: "flex", flexDirection: "column",
      overflow: "hidden", zIndex: 10000,
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <WidgetTopBar onMinimize={onMinimize} onMaximize={onMaximize} />

      {/* Avatar Section */}
      <div style={{ position: "relative", height: 260, backgroundImage: `url('${getCollegeConfig().pageBackground || "/full-bg.jpg"}')`, backgroundSize: "cover", backgroundPosition: "top center", flexShrink: 0 }}>
        <AvatarScene portrait={true} />
      </div>

      {/* Chat Section */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px", minHeight: 0 }}>
          <MobileMessages onQuery={onQuery} />
        </div>
        <MobileChatInput onSend={onQuery} />
      </div>
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────
   Root App
───────────────────────────────────────────────────────────────────────── */
function CollegeAssistant() {
  const { setVisualAction } = useAssistantStore();
  const { sendChat } = useChat();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [displayMode, setDisplayMode] = useState("minimized"); // "minimized", "widget", "fullscreen"

  // Only trigger the welcome greeting when the assistant is actually on screen.
  // Mobile skips the minimized/widget modes entirely and renders the full UI,
  // so the greeting must fire there regardless of displayMode.
  useWelcomeGreeting(isMobile || displayMode !== "minimized");

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const handleQuery = useCallback((q) => sendChat(q), [sendChat]);
  const handleHome = () => setVisualAction({ type: "SHOW_HOME", resourceId: "", title: "" });
  const handleReset = () => useAssistantStore.getState().clearConversation();

  const basePageBackground = (
    <div style={{
      position: "fixed", inset: 0,
      backgroundImage: `url('${getCollegeConfig().pageBackground || "/full-bg.jpg"}')`,
      backgroundSize: "cover",
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",
      fontFamily: "'Inter', system-ui, sans-serif",
      zIndex: 0
    }} />
  );

  /* ── Mobile ── */
  if (isMobile) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        height: "100dvh", overflow: "hidden",
        backgroundImage: `url('${getCollegeConfig().pageBackground || "/full-bg.jpg"}')`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Mobile TopBar — compact */}
        <div style={{
          height: 52, flexShrink: 0,
          background: "rgba(255,255,255,0.6)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.3)",
          display: "flex", alignItems: "center",
          padding: "0 14px", gap: 10,
        }}>
          <img
            src={getCollegeConfig().logoUrl || "/my-logo.png"}
            alt={getCollegeConfig().shortName}
            style={{ width: 30, height: 30, objectFit: "contain", background: "transparent" }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#111", lineHeight: 1 }}>{getCollegeConfig().shortName}</div>
            <div style={{ fontSize: 10, color: "#888" }}>{getCollegeConfig().assistantName}</div>
          </div>
          <StatusBadgeMobile />
          <button onClick={handleReset} style={{
            background: `rgba(var(--brand-rgb), 0.06)`,
            border: `1px solid rgba(var(--brand-rgb), 0.19)`,
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 11.5,
            fontWeight: 700,
            color: SUNWAY_RED,
            cursor: "pointer",
          }}>Reset</button>
        </div>

        <div style={{ height: 180, flexShrink: 0, position: "relative" }}>
          <AvatarScene portrait={true} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 6px", minHeight: 0 }}>
            <MobileMessages onQuery={handleQuery} />
          </div>
          <MobileChatInput onSend={handleQuery} />
        </div>
      </div>
    );
  }

  /* ── Desktop - Minimized ── */
  if (displayMode === "minimized") {
    return (
      <>
        {basePageBackground}
        <MinimizedButton onClick={() => setDisplayMode("widget")} />
      </>
    );
  }

  /* ── Desktop - Widget ── */
  if (displayMode === "widget") {
    return (
      <>
        {basePageBackground}
        <WidgetView
          onMinimize={() => setDisplayMode("minimized")}
          onMaximize={() => setDisplayMode("fullscreen")}
          onQuery={handleQuery}
        />
      </>
    );
  }

  /* ── Desktop - Fullscreen ── */
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", overflow: "hidden",
      background: "linear-gradient(135deg, #FAFAFA 0%, #FFFFFF 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
      position: "relative"
    }}>
      {/* Background decorative elements */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 800, height: 800, background: `radial-gradient(circle, ${VERY_LIGHT_RED} 0%, transparent 70%)`, opacity: 0.8, zIndex: 0 }} />

      <TopBar onHome={handleHome} onReset={handleReset} onBackToWidget={() => setDisplayMode("widget")} />

      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", zIndex: 10 }}>
        <LeftPanel />
        <RightPanel onQuery={handleQuery} />
      </div>
    </div>
  );
}

export default CollegeAssistant;
