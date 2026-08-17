import React, { useEffect, useState, useCallback, useRef } from "react";
import { AvatarScene } from "./components/avatar/AvatarScene";
import { VisualPanel } from "./components/visual/VisualPanel";
import { useAssistantStore } from "./store/assistantStore";
import { useChat } from "./hooks/useChat";
import { startListening as _startListening, stopListening as _stopListening, isSupported } from "./services/voiceService";
import { setMuted as _setMuted, speak, stopSpeaking } from "./services/ttsService";
import {
  Home, RotateCcw, Mic, Send, Bot,
  Square,
} from "lucide-react";
import "./index.css";

// Sunway Brand Colors - Red/White Theme
const SUNWAY_RED = "#B51F24";
const DARK_RED = "#8F171B";
const DEEP_BURGUNDY = "#781316";
const LIGHT_RED = "#FDE8E8";
const VERY_LIGHT_RED = "#FFF4F4";
const BG_OFF_WHITE = "#F8F8F8";
const PURE_WHITE = "#FFFFFF";
const PRIMARY_TEXT = "#252525";
const SECONDARY_TEXT = "#777777";
const BORDER = "#E8E8E8";
const SOFT_RED_BORDER = "#F0D4D4";

// Legacy aliases for compatibility
const MAROON = SUNWAY_RED;
const MAROON_LIGHT = LIGHT_RED;

/* ─────────────────────────────────────────────────────────────────────────
   Welcome greeting (once per session)
   Sequence:
     1. After 800ms  — play Namaste animation
     2. After 1200ms — speak fixed "Namaste, welcome to Sunway College" line
     3. After speech ends — trigger AI welcome message for suggestions/visual
───────────────────────────────────────────────────────────────────────── */
function useWelcomeGreeting() {
  const {
    welcomeShown, setWelcomeShown,
    setCurrentAnimation, setAvatarState, setCurrentEmotion,
  } = useAssistantStore();
  const { sendChat } = useChat();

  useEffect(() => {
    if (welcomeShown) return;

    // Step 1 — play Namaste animation after a short delay (model loads)
    const t1 = setTimeout(() => {
      setWelcomeShown(true);
      setCurrentEmotion("happy");
      setAvatarState("talking");
      setCurrentAnimation("Namaste");

      // Step 2 — speak the fixed greeting line
      speak("Namaste! Welcome to Sunway College Kathmandu. I am your AI admission assistant. How can I help you today?", {
        onStart: () => {
          setAvatarState("talking");
          setCurrentAnimation("Namaste");
        },
        onEnd: () => {
          // Step 3 — after speech ends, go idle then fire AI for suggestions
          setAvatarState("idle");
          setCurrentAnimation("Idle");
          setCurrentEmotion("neutral");
          // Fire AI silently in background to populate suggestions & visual panel
          sendChat("welcome - just show the home panel and give 3-4 helpful suggestion pills, no long reply needed", { silent: true, hidden: true });
        },
      });
    }, 800);

    return () => clearTimeout(t1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ─────────────────────────────────────────────────────────────────────────
   Top Navigation Bar
───────────────────────────────────────────────────────────────────────── */
function TopBar({ onHome, onReset }) {
  return (
    <div style={{
      height: 80,
      background: "rgba(255,255,255,0.55)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid rgba(255,255,255,0.3)",
      display: "flex", alignItems: "center",
      padding: "0 24px", flexShrink: 0,
      boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
    }}>
      {/* Logo + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <img
          src="https://media.edusanjal.com/__sized__/logos/sunway_lolo-thumbnail-200x200-70.jpg"
          alt="Sunway College"
          style={{
            width: 60, height: 60, borderRadius: 10,
            objectFit: "cover",
            border: "1.5px solid #f0f0f0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
        />
        <div>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: "#1a1a1a", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
            Sunway College
          </div>
          <div style={{ fontSize: 11, color: "#999", fontWeight: 400, marginTop: 1 }}>Kathmandu, Nepal</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: "#f0f0f0", margin: "0 20px" }} />

      {/* AI badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        background: VERY_LIGHT_RED,
        border: `1px solid ${SUNWAY_RED}25`,
        borderRadius: 20, padding: "5px 14px",
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: SUNWAY_RED }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: SUNWAY_RED, letterSpacing: "0.02em" }}>
          AI Admission Assistant
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <NavBtn Icon={Home}       label="Home"       onClick={onHome} />
        <NavBtn Icon={RotateCcw}  label="Reset Chat" onClick={onReset} />
      </div>
    </div>
  );
}

function NavBtn({ Icon, label, onClick }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: h ? MAROON_LIGHT : "#fff",
        border: `1.5px solid ${h ? MAROON + "55" : "#e8e8e8"}`,
        borderRadius: 9, padding: "6px 14px",
        fontSize: 12.5, fontWeight: 700,
        color: MAROON,
        cursor: "pointer", transition: "all 0.15s",
      }}>
      <Icon size={13} strokeWidth={2.2} color={MAROON} />
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Left Panel — Avatar only
───────────────────────────────────────────────────────────────────────── */

function LeftPanel({ onQuery }) {
  const { avatarState, isLoading } = useAssistantStore();
  const state = isLoading ? "thinking" : avatarState;
  const statusLabel = {
    thinking: "Thinking...", listening: "Listening...", talking: "Speaking...",
  }[state] || null;

  return (
    <div style={{
      width: 520, flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "transparent",
      borderRight: "1px solid rgba(255,255,255,0.2)",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Avatar fills the entire left panel */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <AvatarScene />
      </div>

      {/* Status badge only — no text, no buttons */}
      {statusLabel && (
        <div style={{
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
          background: `linear-gradient(135deg, ${SUNWAY_RED}, ${DARK_RED})`,
          color: "#fff",
          padding: "5px 16px", borderRadius: 20,
          fontSize: 11.5, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 7,
          backdropFilter: "blur(8px)",
          zIndex: 10,
          boxShadow: `0 4px 12px ${SUNWAY_RED}40`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "pulse 1.2s infinite" }} />
          {statusLabel}
        </div>
      )}
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
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${SUNWAY_RED}, ${DARK_RED})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 3px 10px ${SUNWAY_RED}35`, marginTop: 2,
        }}>
          <Bot size={16} color="#fff" strokeWidth={2.2} />
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
          border: isUser ? `1px solid ${SUNWAY_RED}15` : `1px solid ${BORDER}`,
          boxShadow: isUser
            ? `0 2px 8px ${SUNWAY_RED}08`
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
      {[0,1,2].map(i => (
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
        boxShadow: h ? `0 2px 8px ${SUNWAY_RED}15` : "0 1px 3px rgba(0,0,0,0.03)",
        transform: h ? "translateY(-1px)" : "translateY(0)",
      }}>
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Chat Input
───────────────────────────────────────────────────────────────────────── */
function ChatInput({ onSend, isLoading }) {
  const {
    isListening, isMuted, suggestions,
    setIsListening, setIsMuted, setAvatarState,
  } = useAssistantStore();
  const [input, setInput] = useState("");
  const [transcript, setTr] = useState("");
  const [countdown, setCountdown] = useState(20);
  const countdownRef = useRef(null);

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
      // User clicked stop — submit whatever was heard
      _stopListening();
      setIsListening(false);
      setAvatarState("idle");
      if (transcript.trim()) { onSend(transcript); setTr(""); }
      return;
    }
    setTr("");
    setIsListening(true);
    setAvatarState("listening");
    _startListening({
      onResult: (text) => {
        setTr(text); // just update display; user clicks stop to submit
      },
      onError: () => { setIsListening(false); setAvatarState("idle"); setTr(""); },
      onEnd: () => {
        // Timeout fired (20s) — auto-submit if there's text
        setIsListening(false);
        setAvatarState("idle");
        setTr(prev => { if (prev.trim()) onSend(prev); return ""; });
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
      borderTop: `1px solid ${SOFT_RED_BORDER}30`,
      padding: "14px 20px 16px",
    }}>
      {/* Suggestion pills */}
      {suggestions?.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
          {suggestions.map((s, i) => <SuggPill key={i} label={s} onClick={() => onSend(s)} />)}
        </div>
      )}

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
        display: "flex", alignItems: "center", gap: 8,
        background: PURE_WHITE,
        border: `1.5px solid ${isListening ? "#6ee7b7" : BORDER}`,
        borderRadius: 22, padding: "8px 8px 8px 18px",
        transition: "all 0.2s ease",
        boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
      }}>
        {/* Mic toggle */}
        <button onClick={toggleMic}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 2px", display: "flex", alignItems: "center",
            color: isListening ? SUNWAY_RED : "#bbb",
            transition: "color 0.15s",
          }}>
          {isListening
            ? <Square size={16} color={SUNWAY_RED} fill={SUNWAY_RED} />
            : <Mic size={17} color="#bbb" />}
        </button>

        {/* Text input */}
        <input
          value={isListening ? (transcript || "") : input}
          onChange={e => { if (!isListening) setInput(e.target.value); }}
          onKeyDown={onKey}
          placeholder="Ask anything about the college..."
          disabled={isListening}
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            fontSize: 14, color: PRIMARY_TEXT, padding: "6px 0",
          }}
        />

        {/* Send button - Premium style */}
        <button onClick={submit} disabled={!canSend}
          style={{
            width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
            background: canSend ? `linear-gradient(135deg, ${SUNWAY_RED}, ${DARK_RED})` : "#e5e7eb",
            cursor: canSend ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: canSend ? `0 4px 12px ${SUNWAY_RED}50` : "none",
            transition: "all 0.2s ease",
            transform: canSend ? "scale(1)" : "scale(0.95)",
          }}
          onMouseEnter={e => { if (canSend) e.currentTarget.style.transform = "scale(1.05)"; }}
          onMouseLeave={e => { if (canSend) e.currentTarget.style.transform = "scale(1)"; }}
        >
          <Send size={15} color={canSend ? "#fff" : "#aaa"} />
        </button>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: "center", marginTop: 10, fontSize: 12,
        display: "flex", alignItems: "center",
        justifyContent: "center", gap: 6,
        background: "rgba(255,255,255,0.8)",
        borderRadius: 20, padding: "5px 16px",
        width: "fit-content", margin: "10px auto 0",
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
  const { messages, isLoading } = useAssistantStore();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      minWidth: 0, overflow: "hidden",
      background: `
        radial-gradient(ellipse at top right, ${VERY_LIGHT_RED}40 0%, transparent 50%),
        radial-gradient(ellipse at bottom left, ${VERY_LIGHT_RED}30 0%, transparent 60%),
        ${BG_OFF_WHITE}
      `,
      padding: "0 12px 12px 8px",
    }}>
      {/* Scrollable area */}
      <div style={{
        flex: 1, overflowY: "auto", minHeight: 0,
        padding: "20px 22px 8px",
        background: "transparent",
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: "center", color: "#ccc", fontSize: 13,
            marginTop: 40, fontStyle: "italic",
          }}>
            Use the quick actions on the left or type your question below 👇
          </div>
        )}
        {messages.map(m => <Bubble key={m.id} msg={m} />)}
        <div ref={endRef} />

        {/* Visual cards appear inline below messages */}
        <VisualPanel onQuery={onQuery} />
      </div>

      {/* Fixed chat input at bottom */}
      <ChatInput onSend={onQuery} isLoading={isLoading} />
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
    thinking:  { label: "Thinking", color: DARK_RED },
    listening: { label: "Listening", color: "#059669" },
    talking:   { label: "Speaking",  color: SUNWAY_RED },
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
function MobileMessages({ onQuery }) {
  const { messages } = useAssistantStore();
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <>
      {messages.length === 0 && (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", fontSize: 12, padding: "10px 0", fontStyle: "italic" }}>
          Ask me anything about Sunway College 👇
        </div>
      )}
      {messages.map(m => <Bubble key={m.id} msg={m} />)}
      <div ref={endRef} />
      <VisualPanel onQuery={onQuery} />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Mobile Chat Input — clean, full-width
───────────────────────────────────────────────────────────────────────── */
function MobileChatInput({ onSend }) {
  const { isLoading, isListening, isMuted, suggestions, setIsListening, setIsMuted, setAvatarState } = useAssistantStore();
  const [input, setInput] = useState("");
  const [transcript, setTr] = useState("");
  const [countdown, setCountdown] = useState(20);
  const countdownRef = useRef(null);

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
  const onKey = e => { if (e.key === "Enter") { e.preventDefault(); submit(); } };

  const toggleMic = () => {
    if (!isSupported()) return;
    
    // 🛑 INTERRUPT: Stop any ongoing speech when mic is clicked
    stopSpeaking();
    console.log('[MIC-MOBILE] 🛑 Stopping speech to listen');
    
    if (isListening) {
      // User clicked stop — submit whatever was heard
      _stopListening();
      setIsListening(false);
      setAvatarState("idle");
      if (transcript.trim()) { onSend(transcript); setTr(""); }
      return;
    }
    setTr("");
    setIsListening(true);
    setAvatarState("listening");
    _startListening({
      onResult: (text) => {
        setTr(text); // just update display; user clicks stop to submit
      },
      onError: () => { setIsListening(false); setAvatarState("idle"); setTr(""); },
      onEnd: () => {
        // Timeout fired (20s) — auto-submit if there's text
        setIsListening(false);
        setAvatarState("idle");
        setTr(prev => { if (prev.trim()) onSend(prev); return ""; });
      },
    });
  };

  const canSend = input.trim() && !isLoading;

  return (
    <div style={{
      flexShrink: 0,
      background: "rgba(255,255,255,0.65)",
      backdropFilter: "blur(12px)",
      borderTop: `1px solid ${SOFT_RED_BORDER}30`,
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
          placeholder="Ask anything..."
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
            boxShadow: canSend ? `0 3px 10px ${SUNWAY_RED}40` : "none",
          }}>
          <Send size={15} color={canSend ? "#fff" : "#aaa"} />
        </button>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: "center", marginTop: 7, fontSize: 10.5,
        color: SECONDARY_TEXT,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 5
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
   Root App
───────────────────────────────────────────────────────────────────────── */
function CollegeAssistant() {
  const { setVisualAction } = useAssistantStore();
  const { sendChat } = useChat();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useWelcomeGreeting();

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const handleQuery = useCallback((q) => sendChat(q), [sendChat]);
  const handleHome  = () => setVisualAction({ type: "SHOW_HOME", resourceId: "", title: "" });
  const handleReset = () => useAssistantStore.getState().clearConversation();

  /* ── Mobile ── */
  if (isMobile) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        height: "100dvh", overflow: "hidden",
        backgroundImage: "url('/full-bg.jpg')",
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
          <img src="https://media.edusanjal.com/__sized__/logos/sunway_lolo-thumbnail-200x200-70.jpg"
            alt="Sunway" style={{ width: 30, height: 30, borderRadius: 7, objectFit: "cover" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#111", lineHeight: 1 }}>Sunway College</div>
            <div style={{ fontSize: 10, color: "#888" }}>AI Admission Assistant</div>
          </div>
          <StatusBadgeMobile />
          <button onClick={handleReset} style={{
            background: `${SUNWAY_RED}10`,
            border: `1px solid ${SUNWAY_RED}30`,
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 11.5,
            fontWeight: 700,
            color: SUNWAY_RED,
            cursor: "pointer",
          }}>Reset</button>
        </div>

        {/* Avatar — compact strip */}
        <div style={{ height: 180, flexShrink: 0, position: "relative" }}>
          <AvatarScene />
        </div>

        {/* Visual + Chat — takes remaining space */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Scrollable messages + visual panel */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px 6px", minHeight: 0 }}>
            <MobileMessages onQuery={handleQuery} />
          </div>

          {/* Chat input — pinned to bottom */}
          <MobileChatInput onSend={handleQuery} />
        </div>
      </div>
    );
  }

  /* ── Desktop ── */
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100dvh", overflow: "hidden",
      backgroundImage: "url('/full-bg.jpg')",
      backgroundSize: "cover",
      backgroundPosition: "center center",
      backgroundRepeat: "no-repeat",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <TopBar onHome={handleHome} onReset={handleReset} />

      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        <LeftPanel onQuery={handleQuery} />
        <RightPanel onQuery={handleQuery} />
      </div>
    </div>
  );
}

export default CollegeAssistant;
