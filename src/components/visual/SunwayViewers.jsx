import React, { useEffect, useState } from "react";
import { getResource, submitLead } from "../../services/chatService";
import { getCollegeConfig } from "../../services/collegeConfig";
import {
  Phone, Mail, MapPin, Clock, CheckCircle2, Users, Star,
  Briefcase, TrendingUp, BookOpen, Lightbulb, Award, Target,
  Building2, ExternalLink, ClipboardList, Globe,
} from "lucide-react";

const R = "var(--brand)"; const RL = "var(--brand-lighter)";

function Btn({ children, onClick, variant = "primary" }) {
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: variant === "primary" ? (h ? "#6b1414" : R) : (h ? RL : "#fff"),
        color: variant === "primary" ? "#fff" : R,
        border: `1.5px solid ${variant === "primary" ? R : `rgba(var(--brand-rgb), 0.27)`}`,
        borderRadius: 8, padding: "9px 14px", fontWeight: 600, cursor: "pointer",
        transition: "all 0.15s", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
      }}>
      {children}
    </button>
  );
}

/* ── Why Sunway ─────────────────────────────────────────────────────────── */
export function WhySunwayViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("why-sunway").then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Load />;
  const icons = { users: Users, briefcase: Briefcase, star: Star, building: Building2 };
  return (
    <div style={{ padding: "18px 20px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 900, color: R, marginBottom: 14, textAlign: "center" }}>Why Choose Sunway?</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {data.stats.map(s => {
          const Icon = icons[s.icon] || Star;
          return (
            <div key={s.label} style={{ background: R, borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
              <Icon size={18} color="#fff" style={{ marginBottom: 4 }} />
              <div style={{ fontWeight: 900, fontSize: 20, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{s.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
        {data.pillars.map(p => (
          <div key={p.title} style={{ background: "rgba(255,255,255,0.55)", border: "1px solid #f0f0f0", borderRadius: 12, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: R, marginBottom: 5 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>{p.description}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Btn onClick={() => onQuery?.("Show available programs")} variant="primary"><BookOpen size={13} />Explore Programs</Btn>
        <Btn onClick={() => onQuery?.("Tell me about BCU partnership")} variant="secondary"><Globe size={13} />University Partner</Btn>
      </div>
    </div>
  );
}

/* ── BCU University Partner ─────────────────────────────────────────────── */
export function BCUViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("bcu").then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Load />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, background: R, borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ width: 52, height: 52, background: "rgba(255,255,255,0.55)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Globe size={28} color={R} />
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>{data.name}</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{data.country}</div>
        </div>
      </div>
      <div style={{ background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 14, lineHeight: 1.6 }}>
        ⚠ <strong>Important:</strong> {data.partnershipNote}
      </div>
      <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 14 }}>{data.aboutBCU}</p>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: R, marginBottom: 8 }}>Partnership Benefits</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {data.partnershipBenefits.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <CheckCircle2 size={14} color={R} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "#333" }}>{b}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, background: "#f8f8f8", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#666" }}>
        {data.rankingNote}
      </div>
    </div>
  );
}

/* ── Modules Viewer ─────────────────────────────────────────────────────── */
export function ModulesViewer({ resourceId, onQuery }) {
  const [data, setData] = useState(null);
  const pid = resourceId?.replace("modules-","")?.replace("careers-","") || "csai";
  useEffect(() => { getResource("modules", pid).then(r => setData(r.data)).catch(() => {}); }, [pid]);
  if (!data) return <Load />;
  const y1 = data.year1;
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <BookOpen size={18} color={R} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>
          {pid.toUpperCase()} — Year 1 Modules
        </h2>
      </div>
      {y1?.verified ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {["semester1","semester2"].map(sem => (
            <div key={sem} style={{ background: "rgba(255,255,255,0.55)", border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ background: R, padding: "8px 14px", color: "#fff", fontWeight: 700, fontSize: 12 }}>
                {sem === "semester1" ? "Semester 1" : "Semester 2"}
              </div>
              <div style={{ padding: "10px 14px" }}>
                {y1[sem].map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderBottom: i < y1[sem].length - 1 ? "1px solid #f5f5f5" : "none" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: R, flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 12.5, color: "#333" }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : <p style={{ color: "#888", fontSize: 13 }}>{y1?.note}</p>}
      <div style={{ marginTop: 12, background: "#f0f4ff", border: "1px solid #c7d2fe", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#4338ca" }}>
        ℹ Year 2 onwards: Verified module data not yet available. Please contact admissions for complete syllabus.
      </div>
      <div style={{ marginTop: 12 }}>
        <Btn onClick={() => onQuery?.("Show admission requirements")} variant="primary"><ClipboardList size={13} />Apply Now</Btn>
      </div>
    </div>
  );
}

/* ── Careers Viewer ─────────────────────────────────────────────────────── */
export function CareersViewer({ resourceId, onQuery }) {
  const [prog, setProg] = useState(null);
  const pid = resourceId?.replace("careers-","")?.replace("modules-","") || "csai";
  useEffect(() => { getResource("programs", pid).then(r => setProg(r.data)).catch(() => {}); }, [pid]);
  if (!prog) return <Load />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Briefcase size={18} color={R} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>Career Opportunities — {prog.abbreviation}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
        {(prog.careers || []).map((c, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.55)", border: `1px solid rgba(var(--brand-rgb), 0.13)`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: R, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#333", fontWeight: 500 }}>{c}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#888", marginTop: 14, lineHeight: 1.5 }}>
        {prog.abbreviation} graduates are well-positioned for both local Nepal IT market and international opportunities.
      </p>
    </div>
  );
}

/* ── Admission Documents Checklist ──────────────────────────────────────── */
export function AdmissionDocsViewer({ onQuery }) {
  const [docs, setDocs] = useState([]);
  useEffect(() => { getResource("admissions/documents").then(r => setDocs(r.data || [])).catch(() => {}); }, []);
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <ClipboardList size={18} color={R} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>Required Documents</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {docs.map((d, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(255,255,255,0.55)", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px" }}>
            <CheckCircle2 size={16} color={R} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{d.item}</div>
              {d.note && <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{d.note}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <Btn onClick={() => onQuery?.("How to apply for admission?")} variant="primary"><ClipboardList size={13} />Apply Now</Btn>
        <Btn onClick={() => onQuery?.("Show fee structure")} variant="secondary"><Award size={13} />View Fees</Btn>
      </div>
    </div>
  );
}

/* ── Scholarships ───────────────────────────────────────────────────────── */
export function ScholarshipViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("scholarships").then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Load />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Award size={18} color={R} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>Scholarships</h2>
      </div>
      <div style={{ background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 14, lineHeight: 1.6 }}>
        ⚠ {data.generalNote}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(data.types || []).map(s => (
          <div key={s.id} style={{ background: "rgba(255,255,255,0.55)", border: "1px solid #f0f0f0", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: R, marginBottom: 6 }}>{s.name}</div>
            <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.5, marginBottom: 6 }}>{s.description}</div>
            <div style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>{s.note}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Btn onClick={() => onQuery?.("Contact admissions about scholarship")} variant="primary">
          <Phone size={13} /> Contact Admissions
        </Btn>
      </div>
    </div>
  );
}

/* ── Contact Viewer ─────────────────────────────────────────────────────── */
export function ContactViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("contact").then(r => setData(r.data)).catch(() => {}); }, []);
  const college = { address: "Behind Maitidevi Temple, Maitidevi, Kathmandu, Nepal" };
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Phone size={18} color={R} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>Contact Sunway College</h2>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data?.phones?.map((p, i) => (
          <ContactRow key={i} Icon={Phone} label={i === 0 ? "Phone" : i === 1 ? "Alternate" : "Mobile"} value={p} href={`tel:${p}`} />
        ))}
        {data?.email && <ContactRow Icon={Mail} label="Email" value={data.email} href={`mailto:${data.email}`} />}
        {data?.admissionEmail && <ContactRow Icon={Mail} label="Admissions Email" value={data.admissionEmail} href={`mailto:${data.admissionEmail}`} />}
        <ContactRow Icon={MapPin} label="Address" value={college.address} />
        {data?.officeHours && <ContactRow Icon={Clock} label="Office Hours" value={data.officeHours} />}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <Btn onClick={() => window.open("https://maps.google.com/?q=Sunway+College+Kathmandu+Maitidevi", "_blank")} variant="primary">
          <MapPin size={13} /> Open Map
        </Btn>
        <Btn onClick={() => onQuery?.("I want admission to Sunway College")} variant="secondary">
          <ClipboardList size={13} /> Apply Now
        </Btn>
      </div>
    </div>
  );
}

function ContactRow({ Icon, label, value, href }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.55)", border: "1px solid #f0f0f0", borderRadius: 10, padding: "11px 14px", display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ width: 34, height: 34, background: RL, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={R} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        {href ? (
          <a href={href} style={{ fontSize: 13, fontWeight: 700, color: R, textDecoration: "none" }}>{value}</a>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 600, color: "#222" }}>{value}</div>
        )}
      </div>
    </div>
  );
}

/* ── RAIN ───────────────────────────────────────────────────────────────── */
export function RainViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("rain").then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Load />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ background: R, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>{data.name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4, fontStyle: "italic" }}>{data.tagline}</div>
      </div>
      <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 14 }}>{data.description}</p>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: R, marginBottom: 10 }}>Our Process</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {data.stages.map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.55)", border: `1px solid rgba(var(--brand-rgb), 0.13)`, borderRadius: 10, padding: "10px 10px", textAlign: "center" }}>
            <div style={{ width: 22, height: 22, background: R, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontSize: 10, fontWeight: 700, color: "#fff" }}>{i + 1}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#333", lineHeight: 1.3 }}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Placement Viewer ───────────────────────────────────────────────────── */
export function PlacementViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("placement").then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Load />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp size={18} color={R} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>Placement & Career Support</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {[{ v: data.alumniNetwork, l: "Alumni" }, { v: data.placementRate, l: "Placement Rate" }, { v: data.industryPartnerCount, l: "Partners" }].map(s => (
          <div key={s.l} style={{ background: R, borderRadius: 12, padding: 14, textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#fff" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 3 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {data.services.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <CheckCircle2 size={14} color={R} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 13, color: "#333" }}>{s}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, background: "#f0f4ff", border: "1px solid #c7d2fe", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#4338ca" }}>
        ℹ {data.disclaimer}
      </div>
    </div>
  );
}

/* ── Apply Panel ────────────────────────────────────────────────────────── */
export function ApplyViewer({ onQuery }) {
  return (
    <div style={{ padding: "24px 20px", textAlign: "center" }}>
      <div style={{ width: 60, height: 60, background: R, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <ClipboardList size={28} color="#fff" />
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 900, color: R, marginBottom: 8 }}>Apply to Sunway College</h2>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 20, lineHeight: 1.6 }}>
        Take the first step towards your future at Sunway College Kathmandu, in academic partnership with Birmingham City University, UK.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <a href={getCollegeConfig().applyUrl || "#"} target="_blank" rel="noopener noreferrer"
          style={{ background: R, color: "#fff", borderRadius: 10, padding: "12px", fontWeight: 700, textDecoration: "none", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <ExternalLink size={16} /> Apply Online
        </a>
        <button onClick={() => onQuery?.("Show required admission documents")}
          style={{ background: "rgba(255,255,255,0.55)", color: R, border: `1.5px solid rgba(var(--brand-rgb), 0.27)`, borderRadius: 10, padding: "11px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
          View Required Documents
        </button>
        <button onClick={() => onQuery?.("Contact admission office")}
          style={{ background: "rgba(255,255,255,0.55)", color: "#555", border: "1.5px solid #e8e8e8", borderRadius: 10, padding: "11px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
          Contact Admission Team
        </button>
      </div>
    </div>
  );
}

/* ── Programme Comparison ───────────────────────────────────────────────── */
export function CompareProgramsViewer({ onQuery }) {
  return (
    <div style={{ padding: "18px 20px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 14, textAlign: "center" }}>CSAI vs BIT — Which is right for you?</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            <th style={{ padding: "10px 12px", background: "#f8f8f8", borderBottom: "2px solid #f0f0f0", textAlign: "left", color: "#555", fontWeight: 700 }}>Feature</th>
            <th style={{ padding: "10px 12px", background: R, color: "#fff", fontWeight: 700, textAlign: "center", borderRadius: "0 8px 0 0" }}>BSc CSAI</th>
            <th style={{ padding: "10px 12px", background: "#1d4ed8", color: "#fff", fontWeight: 700, textAlign: "center", borderRadius: "8px 0 0 0" }}>BSc BIT</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Duration", "4 Years", "3 Years"],
            ["Focus", "Computer Science + AI", "Business + Technology"],
            ["Best For", "Programming, AI, ML, Data Science", "Business Analysis, IT Products"],
            ["Grand Total", "NPR 12,75,000", "NPR 11,35,000"],
            ["Awarded By", "BCU, UK", "BCU, UK"],
            ["Example Careers", "AI Engineer, Data Scientist", "Business Analyst, IT Consultant"],
          ].map(([f, a, b], i) => (
            <tr key={f} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
              <td style={{ padding: "10px 12px", fontWeight: 600, color: "#555", borderBottom: "1px solid #f0f0f0" }}>{f}</td>
              <td style={{ padding: "10px 12px", textAlign: "center", color: R, fontWeight: 500, borderBottom: "1px solid #f0f0f0" }}>{a}</td>
              <td style={{ padding: "10px 12px", textAlign: "center", color: "#1d4ed8", fontWeight: 500, borderBottom: "1px solid #f0f0f0" }}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => onQuery?.("Show BSc CSAI fee structure")} style={{ flex: 1, background: R, color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>CSAI Fees</button>
        <button onClick={() => onQuery?.("Show BSc BIT fee structure")} style={{ flex: 1, background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>BIT Fees</button>
      </div>
    </div>
  );
}

/* ── Student Life ───────────────────────────────────────────────────────── */
export function StudentLifeViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("student-life").then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Load />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 14 }}>Student Life at Sunway</h2>
      <div style={{ background: RL, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: R, marginBottom: 4 }}>Sunway Student Representative Council (SSRC)</div>
        <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>{data.ssrc?.description}</div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 4, fontStyle: "italic" }}>{data.ssrc?.note}</div>
      </div>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: "#333", marginBottom: 10 }}>Student Clubs</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8 }}>
        {(data.clubs || []).map(c => (
          <div key={c.name} style={{ background: "rgba(255,255,255,0.55)", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: R, flexShrink: 0, marginTop: 4 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#222" }}>{c.name}</div>
              <div style={{ fontSize: 10.5, color: "#888" }}>{c.category}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Advisory ───────────────────────────────────────────────────────────── */
export function AdvisoryViewer() {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("advisory").then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Load />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ background: R, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>{data.name}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>Faculty allocate {data.facultyHoursPerWeek} hours/week for student advising</div>
      </div>
      <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 14 }}>{data.description}</p>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: R, marginBottom: 8 }}>Benefits</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.benefits.map((b, i) => (
          <div key={i} style={{ display: "flex", gap: 9 }}>
            <CheckCircle2 size={14} color={R} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 13, color: "#333" }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Innovation Lab ─────────────────────────────────────────────────────── */
export function InnovationLabViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("innovation-lab").then(r => setData(r.data)).catch(() => {}); }, []);
  if (!data) return <Load />;
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ background: R, borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", gap: 14, alignItems: "center" }}>
        <Lightbulb size={32} color="#fff" />
        <div>
          <div style={{ fontWeight: 900, fontSize: 16, color: "#fff" }}>{data.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 3 }}>Sunway College, Kathmandu</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, marginBottom: 10 }}>{data.description}</p>
      <div style={{ background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#92400e" }}>{data.note}</div>
      <div style={{ marginTop: 14 }}>
        <Btn onClick={() => onQuery?.("Tell me about RAIN incubation center")} variant="primary">
          <Target size={13} /> Learn About RAIN
        </Btn>
      </div>
    </div>
  );
}

/* ── Admission Enquiry Form ─────────────────────────────────────────────── */
export function AdmissionFormViewer({ onQuery }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", program: "", message: "" });
  const [status, setStatus] = useState("idle");
  const programs = [
    { id: "csai", label: "BSc (Hons) Computer Science with AI" },
    { id: "bit",  label: "BSc (Hons) Business Information Technology" },
  ];
  const input = { width: "100%", padding: "9px 13px", border: "1.5px solid #e8e8e8", borderRadius: 9, fontSize: 13, color: "#222", outline: "none", background: "rgba(255,255,255,0.55)", boxSizing: "border-box" };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setStatus("loading");
    try {
      const r = await submitLead(form);
      setStatus(r.success ? "success" : "error");
    } catch { setStatus("error"); }
  };
  if (status === "success") return (
    <div style={{ padding: 28, textAlign: "center" }}>
      <div style={{ width: 64, height: 64, background: "#22c55e", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
        <CheckCircle2 size={32} color="#fff" />
      </div>
      <h3 style={{ color: "#166534", fontWeight: 800 }}>Enquiry Submitted!</h3>
      <p style={{ fontSize: 13, color: "#555", marginTop: 8 }}>Thank you! Our admission team will contact you shortly.</p>
      <button onClick={() => setStatus("idle")} style={{ marginTop: 14, background: R, color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 600, cursor: "pointer" }}>Submit Another</button>
    </div>
  );
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <ClipboardList size={18} color={R} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>Admission Enquiry</h2>
      </div>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>Fill this form and our team will contact you.</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input required placeholder="Full Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={input} />
        <input required placeholder="Phone Number *" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={input} />
        <input type="email" placeholder="Email Address" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={input} />
        <select value={form.program} onChange={e => setForm(p => ({ ...p, program: e.target.value }))} style={{ ...input, color: form.program ? "#222" : "#aaa" }}>
          <option value="">Select Program</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <textarea placeholder="Any questions?" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={3} style={{ ...input, resize: "vertical" }} />
        {status === "error" && <p style={{ color: "#ef4444", fontSize: 12 }}>Submission failed. Please try again.</p>}
        <button type="submit" disabled={status === "loading"}
          style={{ background: status === "loading" ? "#aaa" : R, color: "#fff", border: "none", borderRadius: 9, padding: "12px", fontWeight: 700, cursor: status === "loading" ? "not-allowed" : "pointer", fontSize: 14 }}>
          {status === "loading" ? "Submitting..." : "Submit Enquiry →"}
        </button>
      </form>
    </div>
  );
}

/* ── Shared loading ─────────────────────────────────────────────────────── */
function Load() { return <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 13 }}>Loading...</div>; }

