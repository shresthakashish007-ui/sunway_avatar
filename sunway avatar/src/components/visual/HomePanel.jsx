import React from "react";
import { BookOpen, DollarSign, ClipboardList, Award, Building2, Phone } from "lucide-react";

// Sunway Brand Colors
const SUNWAY_RED = "#B51F24";
const DARK_RED = "#8F171B";
const LIGHT_RED = "#FDE8E8";
const VERY_LIGHT_RED = "#FFF4F4";
const PRIMARY_TEXT = "#252525";
const SECONDARY_TEXT = "#777777";
const BORDER = "#E8E8E8";

const cards = [
  { Icon: BookOpen,      label: "Explore Programs",   query: "Show me available programs",        featured: true },
  { Icon: DollarSign,    label: "Fee Structure",       query: "Show fee structure",                featured: false },
  { Icon: ClipboardList, label: "Admissions",          query: "How to apply for admission?",       featured: false },
  { Icon: Award,         label: "Scholarships",        query: "Tell me about scholarships",        featured: false },
  { Icon: Building2,     label: "Campus & Facilities", query: "Show campus facilities",            featured: false },
  { Icon: Phone,         label: "Contact Us",          query: "Contact Sunway College",            featured: false },
];

export function HomePanel({ onQuery }) {
  return (
    <div style={{
      padding: "28px 28px 24px",
      background: "rgba(255,255,255,0.95)",
      minHeight: "100%",
      borderRadius: 24,
      border: `1px solid rgba(181,31,36,0.08)`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.06)",
      margin: "16px",
    }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <img src="https://media.edusanjal.com/__sized__/logos/sunway_lolo-thumbnail-200x200-70.jpg"
          alt="Sunway" style={{
            width: 64, height: 64, borderRadius: 16, objectFit: "cover",
            marginBottom: 14,
            border: `2px solid ${LIGHT_RED}`,
            boxShadow: `0 4px 12px ${SUNWAY_RED}15`,
          }} />
        <h1 style={{
          fontSize: 24, fontWeight: 900,
          color: SUNWAY_RED,
          margin: 0,
          letterSpacing: "-0.03em",
          textShadow: `0 1px 2px ${SUNWAY_RED}20`,
        }}>
          Welcome to Sunway College
        </h1>
        <p style={{
          fontSize: 13.5, color: SECONDARY_TEXT,
          margin: "8px 0 0",
          fontWeight: 500,
        }}>
          Creating AI Leaders — Kathmandu, Nepal
        </p>
        <div style={{
          width: 50, height: 4,
          background: `linear-gradient(90deg, ${SUNWAY_RED}, ${DARK_RED})`,
          borderRadius: 3,
          margin: "14px auto 0",
        }} />
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {cards.map(({ Icon, label, query, featured }) => (
          <HomeCard key={label} Icon={Icon} label={label} query={query} featured={featured} onQuery={onQuery} />
        ))}
      </div>

      <p style={{
        textAlign: "center",
        fontSize: 11.5,
        color: "#bbb",
        marginTop: 20,
        fontWeight: 500,
      }}>
        Academic partner of Birmingham City University, UK
      </p>
    </div>
  );
}

function HomeCard({ Icon, label, query, featured, onQuery }) {
  const [h, setH] = React.useState(false);
  return (
    <button onClick={() => onQuery?.(query)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: featured && !h
          ? `linear-gradient(135deg, ${VERY_LIGHT_RED}, #FFFFFF)`
          : h ? SUNWAY_RED : "rgba(255,255,255,0.85)",
        border: `1.5px solid ${h ? SUNWAY_RED : featured ? `${SUNWAY_RED}20` : BORDER}`,
        backdropFilter: "blur(8px)",
        borderRadius: 16, padding: "16px 10px",
        cursor: "pointer",
        transition: "all 0.25s ease",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 9,
        boxShadow: h
          ? `0 8px 25px ${SUNWAY_RED}25`
          : featured
            ? `0 4px 15px ${SUNWAY_RED}08`
            : "0 2px 8px rgba(0,0,0,0.04)",
        transform: h ? "translateY(-4px)" : "none",
      }}>
      <div style={{
        width: 44, height: 44,
        borderRadius: 13,
        background: h ? "rgba(255,255,255,0.2)" : VERY_LIGHT_RED,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.25s ease",
        transform: h ? "scale(1.05)" : "scale(1)",
      }}>
        <Icon size={20} color={h ? "#fff" : SUNWAY_RED} strokeWidth={2} />
      </div>
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: h ? "#fff" : PRIMARY_TEXT,
        textAlign: "center",
        lineHeight: 1.3,
      }}>{label}</span>
    </button>
  );
}

