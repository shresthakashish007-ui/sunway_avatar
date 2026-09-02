import React from "react";
import { getCollegeConfig } from "../../services/collegeConfig";
import { BookOpen, DollarSign, ClipboardList, Award, Building2, Phone, ArrowRight, Sparkles } from "lucide-react";

// Sunway Brand Colors
const SUNWAY_RED = "var(--brand)";
const LIGHT_RED = "var(--brand-light)";
const VERY_LIGHT_RED = "var(--brand-lighter)";
const PRIMARY_TEXT = "#252525";
const BORDER = "#E8E8E8";

const cards = [
  { Icon: BookOpen,      label: "Explore Programs",   desc: "Discover our undergraduate and postgraduate programs.", query: "Show me available programs" },
  { Icon: DollarSign,    label: "Fee Structure",      desc: "Learn about tuition fees, payment options.", query: "Show fee structure" },
  { Icon: ClipboardList, label: "Admissions",          desc: "Admission process, requirements, dates.", query: "How to apply for admission?" },
  { Icon: Award,         label: "Scholarships",        desc: "Find scholarships and financial aid.", query: "Tell me about scholarships" },
  { Icon: Building2,     label: "Campus Facilities",  desc: "Explore our world-class facilities.", query: "Show campus facilities" },
  { Icon: Phone,         label: "Contact Us",          desc: "Get in touch with our admissions team.", query: "Contact Sunway College" },
];

const popularQuestions = [
  "What programs do you offer?",
  "How can I apply for admission?",
  "Can I visit the campus?",
  "How much is the tuition fee?"
];

export function HomePanel({ onQuery }) {
  return (
    <div style={{
      background: "transparent",
      display: "flex", flexDirection: "column", gap: 20,
      padding: "16px 20px"
    }}>

      {/* Premium Banner Header */}
      <div style={{
        position: "relative",
        width: "100%",
        minHeight: 180,
        borderRadius: 16,
        background: "#fff",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        boxShadow: "0 6px 20px rgba(181,31,36,0.12)",
        marginBottom: 8,
      }}>
        {/* Left Side: Text Content */}
        <div style={{ position: "relative", zIndex: 2, padding: "28px 28px", flex: 1, minWidth: 0 }}>
          <h2 style={{ 
            fontSize: 26, 
            fontWeight: 900, 
            color: PRIMARY_TEXT, 
            margin: "0 0 6px 0", 
            letterSpacing: "-0.5px" 
          }}>
            How can I help you today?
          </h2>
          <p style={{ 
            fontSize: 14, 
            color: "#666", 
            margin: 0, 
            fontWeight: 500,
          }}>
            Choose a topic or ask anything below
          </p>
        </div>

        {/* Right Side: Image occupying 65% of the width */}
        <div style={{ 
          position: "absolute", 
          right: 0, 
          top: 0, 
          bottom: 0, 
          width: "65%", 
          zIndex: 0 
        }}>
          {/* Seamless fade gradient from white to transparent */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.8) 25%, rgba(255,255,255,0) 65%)`,
            zIndex: 1
          }} />
          <img 
            src={getCollegeConfig().buildingImage || "/sunway-building.png"} 
            alt={`${getCollegeConfig().shortName} Campus`} 
            style={{ 
              width: "100%", 
              height: "100%", 
              objectFit: "cover",
              objectPosition: "center 35%"
            }} 
          />
        </div>
      </div>

      {/* Grid of cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(3, 1fr)", 
        gap: 12, 
      }}>
        {cards.map((card) => (
          <HomeCard key={card.label} {...card} onQuery={onQuery} />
        ))}
      </div>

      {/* Popular Questions */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Sparkles size={14} color={SUNWAY_RED} />
          <h3 style={{ fontSize: 13, fontWeight: 800, color: "#333", margin: 0 }}>Popular Questions</h3>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {popularQuestions.map(q => (
            <button key={q} onClick={() => onQuery(q)} style={{
              background: "#F9F9F9", border: "1px solid #E8E8E8", borderRadius: 24,
              padding: "8px 14px", fontSize: 12, fontWeight: 600, color: "#444", cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => { e.currentTarget.style.background = VERY_LIGHT_RED; e.currentTarget.style.borderColor = SUNWAY_RED; e.currentTarget.style.color = SUNWAY_RED; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#F9F9F9"; e.currentTarget.style.borderColor = "#E8E8E8"; e.currentTarget.style.color = "#444"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

function HomeCard({ Icon, label, desc, query, onQuery }) {
  const [h, setH] = React.useState(false);
  return (
    <button onClick={() => onQuery?.(query)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? VERY_LIGHT_RED : "#fff",
        border: `1px solid ${h ? SUNWAY_RED : BORDER}`,
        borderRadius: 16, padding: "16px 20px",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14,
        transform: h ? "translateY(-4px)" : "none",
        boxShadow: h ? `0 12px 24px rgba(var(--brand-rgb), 0.08)` : "0 2px 8px rgba(0,0,0,0.02)",
        textAlign: "left",
        height: "100%"
      }}>
      <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: h ? SUNWAY_RED : VERY_LIGHT_RED,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s"
        }}>
          <Icon size={16} color={h ? "#fff" : SUNWAY_RED} strokeWidth={2} />
        </div>
        <div style={{
          width: 20, height: 20, borderRadius: "50%", background: h ? SUNWAY_RED : "#F5F5F5",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          transform: h ? "rotate(-45deg)" : "none"
        }}>
          <ArrowRight size={10} color={h ? "#fff" : "#888"} />
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          fontSize: 13,
          fontWeight: 800,
          color: PRIMARY_TEXT,
          marginBottom: 4
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 11,
          color: "#666",
          lineHeight: 1.3,
          fontWeight: 500,
          flex: 1
        }}>
          {desc}
        </div>
      </div>
    </button>
  );
}

