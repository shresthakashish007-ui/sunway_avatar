import React from "react";
import {
  BookOpen, DollarSign, ClipboardList, Award,
  Building2, Phone, Sparkles,
} from "lucide-react";

const quickActions = [
  { Icon: BookOpen,      label: "View Courses",    query: "Show me all available courses",       color: "#6366f1", bg: "#ede9fe" },
  { Icon: DollarSign,    label: "Fee Structure",   query: "Show me the fee structure",            color: "#2563eb", bg: "#dbeafe" },
  { Icon: ClipboardList, label: "Admission",        query: "How can I apply for admission?",      color: "#7c3aed", bg: "#ede9fe" },
  { Icon: Award,         label: "Scholarships",     query: "Tell me about scholarships",          color: "#0891b2", bg: "#cffafe" },
  { Icon: Building2,     label: "Explore Campus",   query: "Show me the campus facilities",       color: "#059669", bg: "#d1fae5" },
  { Icon: Phone,         label: "Contact Us",        query: "How can I contact the college?",     color: "#dc2626", bg: "#fee2e2" },
];

export function WelcomePanel({ onQuery }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "28px 32px", textAlign: "center",
      background: "linear-gradient(160deg,#fff 0%,#f5f3ff 100%)",
    }}>

      {/* Badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        background: "linear-gradient(135deg,#ede9fe,#e0e7ff)",
        border: "1px solid #c4b5fd", borderRadius: 20,
        padding: "5px 16px", marginBottom: 20,
        fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.07em",
      }}>
        <Sparkles size={12} strokeWidth={2.5} />
        AI POWERED COLLEGE GUIDE
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: "clamp(22px,2.8vw,30px)", fontWeight: 900,
        color: "#0f172a", marginBottom: 10, letterSpacing: "-0.03em", lineHeight: 1.2,
      }}>
        Welcome to<br />
        <span style={{ background: `linear-gradient(135deg,${MAROON},#c0392b)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Sunway College
        </span>
      </h1>

      <p style={{ fontSize: 14, color: "#64748b", maxWidth: 360, lineHeight: 1.7, marginBottom: 30 }}>
        Your personal AI admission counsellor. Ask me anything about courses, fees, scholarships, or explore our campus.
      </p>

      {/* Quick action grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, width: "100%", maxWidth: 460 }}>
        {quickActions.map(a => <QuickBtn key={a.label} {...a} onQuery={onQuery} />)}
      </div>

      {/* Mic hint */}
      <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 7, color: "#94a3b8", fontSize: 12 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
        Click the microphone below or type your question
      </div>
    </div>
  );
}

function QuickBtn({ Icon, label, query, color, bg, onQuery }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={() => onQuery?.(query)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? color : "#fff",
        border: `1.5px solid ${hov ? color : "#e2e8f0"}`,
        borderRadius: 14, padding: "14px 8px",
        cursor: "pointer", transition: "all 0.18s",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        boxShadow: hov ? `0 6px 20px ${color}30` : "0 1px 4px rgba(0,0,0,0.05)",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
      }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: hov ? "rgba(255,255,255,0.2)" : bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.18s",
      }}>
        <Icon size={18} color={hov ? "#fff" : color} strokeWidth={2} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: hov ? "#fff" : "#334155", letterSpacing: "-0.01em" }}>
        {label}
      </span>
    </button>
  );
}
