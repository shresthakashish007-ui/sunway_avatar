import React, { useRef, useEffect, useState } from "react";
import { useAssistantStore } from "../../store/assistantStore";
import { useChat } from "../../hooks/useChat";
import { startListening, stopListening, isSupported } from "../../services/voiceService";
import { setMuted } from "../../services/ttsService";
import { Mic, MicOff, Send, Volume2, VolumeX, Bot, Square } from "lucide-react";

/* ── Typing dots ─────────────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 0" }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: "50%", background: "#94a3b8",
          animation: `blink 1s infinite ${i * 0.2}s`, display: "inline-block",
        }} />
      ))}
    </span>
  );
}

/* ── Message bubble ──────────────────────────────────────────────────────── */
function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start",
      alignItems: "flex-end", gap: 7, marginBottom: 8,
      animation: "slideUp 0.2s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: 9, flexShrink: 0,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
        }}>
          <Bot size={14} color="#fff" strokeWidth={2} />
        </div>
      )}
      <div style={{
        maxWidth: "72%", padding: "9px 14px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
        background: isUser ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "#f8fafc",
        color: isUser ? "#fff" : "#1e293b",
        fontSize: 13, lineHeight: 1.55,
        border: isUser ? "none" : "1.5px solid #e2e8f0",
        boxShadow: isUser ? "0 3px 12px rgba(79,70,229,0.28)" : "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        {msg.loading ? <TypingDots /> : msg.content}
      </div>
    </div>
  );
}

/* ── Suggestion pills ────────────────────────────────────────────────────── */
function SuggPill({ label, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#ede9fe" : "#f8f7ff",
        border: `1.5px solid ${hov ? "#a78bfa" : "#e0e7ff"}`,
        borderRadius: 20, padding: "5px 13px", fontSize: 12, fontWeight: 600,
        color: hov ? "#7c3aed" : "#6366f1", cursor: "pointer", transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

/* ── Icon circle button ──────────────────────────────────────────────────── */
function CircleBtn({ onClick, disabled, title, bg, shadow, pulse: doPulse, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 42, height: 42, borderRadius: "50%", border: "none",
        background: hov && !disabled ? bg + "dd" : bg,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", flexShrink: 0,
        boxShadow: doPulse ? `0 0 0 6px ${bg}33, ${shadow}` : shadow,
        transition: "all 0.15s",
        animation: doPulse ? "pulse 1.4s infinite" : "none",
        transform: hov && !disabled ? "scale(1.07)" : "scale(1)",
        opacity: disabled ? 0.45 : 1,
      }}>
      {children}
    </button>
  );
}

/* ── Main ChatPanel ──────────────────────────────────────────────────────── */
export function ChatPanel() {
  const {
    messages, isLoading, isListening, isMuted, suggestions,
    setIsListening, setIsMuted, setCurrentAnimation, setAvatarState,
  } = useAssistantStore();
  const { sendChat } = useChat();
  const [input, setInput]   = useState("");
  const [transcript, setTr] = useState("");
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const submit = () => {
    const t = input.trim(); if (!t || isLoading) return;
    setInput(""); sendChat(t);
  };
  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };

  const toggleMic = () => {
    if (isListening) {
      stopListening(); setIsListening(false);
      setAvatarState("idle"); setCurrentAnimation("Idle");
      if (transcript.trim()) { sendChat(transcript); setTr(""); }
      return;
    }
    setIsListening(true); setAvatarState("listening");
    startListening({
      onResult: (text, isFinal) => {
        setTr(text);
        if (isFinal) { setIsListening(false); setAvatarState("idle"); setTr(""); sendChat(text); }
      },
      onError: () => { setIsListening(false); setAvatarState("idle"); setTr(""); },
      onEnd:   () => { setIsListening(false); setAvatarState("idle"); },
    });
  };

  const toggleMute = () => { const m = !isMuted; setIsMuted(m); setMuted(m); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(255,255,255,0.55)" }}>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 6px" }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 13, marginTop: 12, fontStyle: "italic" }}>
            Start a conversation below...
          </div>
        ) : (
          messages.map(m => <Bubble key={m.id} msg={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {messages.length > 0 && suggestions?.length > 0 && (
        <div style={{ padding: "0 16px 6px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {suggestions.map((s, i) => (
            <SuggPill key={i} label={s} onClick={() => sendChat(s)} />
          ))}
        </div>
      )}

      {/* Transcript preview */}
      {isListening && transcript && (
        <div style={{
          padding: "5px 16px", fontSize: 12, color: "#059669",
          background: "linear-gradient(90deg,#ecfdf5,#f0fdf4)",
          borderTop: "1px solid #d1fae5", display: "flex", alignItems: "center", gap: 7,
        }}>
          <Mic size={12} color="#059669" style={{ animation: "pulse 1s infinite" }} />
          <em>"{transcript}"</em>
        </div>
      )}

      <div style={{ height: 1, background: "#f1f5f9", flexShrink: 0 }} />

      {/* Input bar */}
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

        {/* Mute */}
        <CircleBtn onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}
          bg={isMuted ? "#fee2e2" : "#f1f5f9"}
          shadow="none">
          {isMuted
            ? <VolumeX size={16} color="#ef4444" />
            : <Volume2 size={16} color="#94a3b8" />
          }
        </CircleBtn>

        {/* Text input */}
        <input
          value={isListening ? (transcript || "") : input}
          onChange={e => { if (!isListening) setInput(e.target.value); }}
          onKeyDown={onKey}
          placeholder={isListening ? "Listening... speak now" : "Ask anything about the college..."}
          disabled={isListening}
          style={{
            flex: 1, padding: "11px 16px", border: "1.5px solid #e2e8f0",
            borderRadius: 24, fontSize: 13.5, color: "#0f172a",
            background: isListening ? "#f0fdf4" : "#f8fafc", outline: "none",
            transition: "all 0.15s",
            borderColor: isListening ? "#6ee7b7" : "#e2e8f0",
          }}
        />

        {/* Mic */}
        {isSupported() && (
          <CircleBtn onClick={toggleMic} disabled={isLoading}
            bg={isListening ? "#ef4444" : "#6366f1"}
            shadow={isListening ? "0 4px 16px rgba(239,68,68,0.4)" : "0 2px 8px rgba(99,102,241,0.3)"}
            pulse={isListening}>
            {isListening ? <Square size={14} color="#fff" fill="#fff" /> : <Mic size={16} color="#fff" />}
          </CircleBtn>
        )}

        {/* Send */}
        <CircleBtn onClick={submit} disabled={!input.trim() || isLoading}
          bg={input.trim() && !isLoading ? "#4f46e5" : "#e2e8f0"}
          shadow={input.trim() && !isLoading ? "0 3px 12px rgba(79,70,229,0.35)" : "none"}>
          <Send size={15} color={input.trim() && !isLoading ? "#fff" : "#94a3b8"} />
        </CircleBtn>
      </div>
    </div>
  );
}

