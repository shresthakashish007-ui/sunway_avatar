import React, { useEffect, useState } from "react";
import { getResource } from "../../services/chatService";
import { Calendar, Award, Users, ChevronRight, BookOpen, Briefcase } from "lucide-react";

const R = "#8B1A1A"; const RL = "#FDF2F2";

function Tag({ children, color = R }) {
  return <span style={{ background: `${color}18`, color, border: `1px solid ${color}30`, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{children}</span>;
}

function Btn({ children, onClick, variant = "primary", small }) {
  const [h, setH] = React.useState(false);
  const isPrimary = variant === "primary";
  return (
    <button onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? (isPrimary ? "#6b1414" : RL) : (isPrimary ? R : "#fff"),
        color: isPrimary ? "#fff" : R,
        border: `1.5px solid ${isPrimary ? (h ? "#6b1414" : R) : `${R}44`}`,
        borderRadius: 8, padding: small ? "6px 12px" : "9px 14px",
        fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
        fontSize: small ? 11 : 12, display: "flex", alignItems: "center", gap: 5,
      }}>
      {children}
    </button>
  );
}

/* ── Single program card ─────────────────────────────────────────────────── */
function ProgramCard({ p, onQuery }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ background: "rgba(255,255,255,0.55)", borderRadius: 14, border: "1px solid #f0f0f0", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
      {/* Header band */}
      <div style={{ background: R, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Tag color="#fff">{p.abbreviation}</Tag>
          <h3 style={{ color: "#fff", fontSize: 15, fontWeight: 800, margin: "6px 0 2px", lineHeight: 1.3 }}>{p.officialName}</h3>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>{p.awardingBody}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "3px 10px", color: "#fff", fontSize: 12, fontWeight: 700 }}>{p.duration}</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 18px" }}>
        {p.coordinator && (
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>
            <strong>Coordinator:</strong> {p.coordinator}
          </div>
        )}
        <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 12 }}>{p.description}</p>

        {/* Quick careers preview */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {(p.careers || []).slice(0, 5).map(c => (
            <span key={c} style={{ background: "#f8f8f8", border: "1px solid #e8e8e8", borderRadius: 20, padding: "2px 8px", fontSize: 10.5, color: "#555" }}>{c}</span>
          ))}
          {(p.careers || []).length > 5 && (
            <span style={{ background: "#f8f8f8", border: "1px solid #e8e8e8", borderRadius: 20, padding: "2px 8px", fontSize: 10.5, color: "#888" }}>+{p.careers.length - 5} more</span>
          )}
        </div>

        {/* Eligibility snippet */}
        {p.eligibility?.neb && (
          <div style={{ background: RL, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: R, marginBottom: 12 }}>
            <strong>NEB Eligibility:</strong> Min. CGPA {p.eligibility.neb.minCGPA}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn onClick={() => onQuery?.(`Show ${p.abbreviation} fee structure`)} variant="primary">
            <Award size={13} /> Fee Structure
          </Btn>
          <Btn onClick={() => onQuery?.(`Show ${p.abbreviation} modules`)} variant="secondary">
            <BookOpen size={13} /> Modules
          </Btn>
          <Btn onClick={() => onQuery?.(`${p.abbreviation} career opportunities`)} variant="secondary">
            <Briefcase size={13} /> Careers
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ── Programs list ───────────────────────────────────────────────────────── */
export function ProgramsListViewer({ onQuery }) {
  const [programs, setPrograms] = useState([]);
  useEffect(() => { getResource("programs").then(r => setPrograms(r.data || [])).catch(() => {}); }, []);
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <BookOpen size={18} color={R} />
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: 0 }}>Programs at Sunway</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {programs.map(p => <ProgramCard key={p.id} p={p} onQuery={onQuery} />)}
      </div>
      <div style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: "#999" }}>
        All programs awarded by Birmingham City University, UK
      </div>
    </div>
  );
}

/* ── Single program viewer ───────────────────────────────────────────────── */
export function ProgramViewer({ resourceId, onQuery }) {
  const [p, setP] = useState(null);
  useEffect(() => { if (resourceId) getResource("programs", resourceId).then(r => setP(r.data)).catch(() => {}); }, [resourceId]);
  if (!p) return <LoadState />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <ProgramCard p={p} onQuery={onQuery} />
    </div>
  );
}

function LoadState() {
  return <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 13 }}>Loading...</div>;
}

