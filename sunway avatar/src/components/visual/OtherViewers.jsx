import React, { useEffect, useState } from "react";
import { getResource, submitLead } from "../../services/chatService";
import {
  Users, Award, Phone, Mail, MapPin, Clock, Map, ClipboardList,
  CheckCircle2, Library, Monitor, Coffee, Dumbbell, Mic2,
  Building2, ChevronRight, Send,
} from "lucide-react";

const MAROON = "#8B1A1A";
const MAROON_LIGHT = "#FDF2F2";

// ─── Faculty Viewer ─────────────────────────────────────────────────────────
export function FacultyViewer({ resourceId, title, onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    getResource("faculty", resourceId).then(r => setData(r.data)).catch(() => {});
  }, [resourceId]);

  const members = Array.isArray(data) ? data : data ? [data] : [];
  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16, display:"flex", alignItems:"center", gap:8 }}>
        <Users size={18} color="#8B1A1A"/> {title || "Faculty"}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
        {members.map(m => (
          <div key={m.id} style={{ background: "rgba(255,255,255,0.55)", borderRadius: 14, border: "1px solid #e2e8f0", padding: 16, textAlign: "center" }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#8B1A1A,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px",
            }}>
              <Users size={28} color="#fff" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>{m.name}</h3>
            <p style={{ fontSize: 12, color: "#8B1A1A", margin: "0 0 4px", fontWeight: 600 }}>{m.designation}</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{m.department}</p>
            {m.bio && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>{m.bio}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scholarship Viewer ─────────────────────────────────────────────────────
export function ScholarshipViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("scholarships").then(r => setData(r.data)).catch(() => {}); }, []);
  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16, display:"flex", alignItems:"center", gap:8 }}>
        <Award size={18} color="#0891b2"/> Scholarships &amp; Financial Aid
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(data || []).map(s => (
          <div key={s.id} style={{ background: "rgba(255,255,255,0.55)", borderRadius: 14, border: "1px solid #e2e8f0", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 }}>{s.name}</h3>
              <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{s.amount}</span>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "8px 0 6px", lineHeight: 1.5 }}>{s.description}</p>
            <p style={{ fontSize: 12, color: "#475569" }}><strong>Eligibility:</strong> {s.eligibility}</p>
            {s.renewable && (
              <span style={{ fontSize: 11, color: "#166534", background: "#FDF2F2", padding: "2px 8px", borderRadius: 20, display:"inline-flex", alignItems:"center", gap:4 }}>
                <CheckCircle2 size={10}/> Renewable
              </span>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => onQuery?.("How can I apply for scholarship?")}
        style={{ marginTop: 16, width: "100%", background: "#8B1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 600, cursor: "pointer", fontSize: 14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        <ClipboardList size={16}/> Apply for Scholarship
      </button>
    </div>
  );
}

// ─── Contact Viewer ─────────────────────────────────────────────────────────
export function ContactViewer({ onQuery }) {
  const [data, setData] = useState(null);
  useEffect(() => { getResource("contact").then(r => setData(r.data)).catch(() => {}); }, []);

  const rows = data ? [
    { Icon: Phone,   label: "Phone",        value: data.phone },
    { Icon: Phone,   label: "Alternate",    value: data.alternatePhone },
    { Icon: Mail,    label: "Email",        value: data.email },
    { Icon: Mail,    label: "Admissions",   value: data.admissionEmail },
    { Icon: MapPin,  label: "Address",      value: data.address },
    { Icon: Clock,   label: "Office Hours", value: data.officeHours },
  ].filter(r => r.value) : [];

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 20, display:"flex", alignItems:"center", gap:8 }}>
        <Phone size={18} color="#8B1A1A"/> Contact Us
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ Icon, label, value }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.55)", borderRadius: 12, border: "1px solid #e2e8f0", padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"#FDF2F2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon size={16} color="#8B1A1A" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
              <div style={{ fontSize: 14, color: "#1e293b", fontWeight: 600 }}>{value}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onQuery?.("I want admission")}
        style={{ marginTop: 20, width: "100%", background: "#8B1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 600, cursor: "pointer", fontSize: 14, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
        <ClipboardList size={16}/> Enquire About Admission
      </button>
    </div>
  );
}

// ─── Map Viewer ─────────────────────────────────────────────────────────────
export function MapViewer() {
  return (
    <div style={{ padding: 20, height: "100%" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16, display:"flex", alignItems:"center", gap:8 }}>
        <Map size={18} color="#8B1A1A"/> College Location
      </h2>
      <div style={{
        width: "100%", height: "300px", borderRadius: 14, overflow: "hidden",
        border: "1px solid #e2e8f0", background: "#f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14,
      }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,#8B1A1A,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <MapPin size={28} color="#fff" />
        </div>
        <p style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>Kathmandu, Nepal</p>
        <a href="https://maps.google.com/?q=Kathmandu,Nepal" target="_blank" rel="noopener noreferrer"
          style={{ background: "#8B1A1A", color: "#fff", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 13, display:"flex", alignItems:"center", gap:7 }}>
          <Map size={14}/> Open in Google Maps
        </a>
      </div>
      <div style={{ marginTop: 14, background: "rgba(255,255,255,0.55)", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <MapPin size={14} color="#8B1A1A"/>
          <span style={{ fontSize: 13, color: "#475569" }}>Kathmandu, Bagmati Province, Nepal</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Clock size={14} color="#8B1A1A"/>
          <span style={{ fontSize: 13, color: "#475569" }}>Sunday–Friday: 9:00 AM – 5:00 PM</span>
        </div>
      </div>
    </div>
  );
}

// ─── Admission Form ─────────────────────────────────────────────────────────
export function AdmissionForm({ onQuery }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", course: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    getResource("courses").then(r => setCourses(r.data || [])).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setStatus("loading");
    try {
      const res = await submitLead(form);
      if (res.success) setStatus("success");
      else setStatus("error");
    } catch { setStatus("error"); }
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0",
    borderRadius: 10, fontSize: 14, color: "#1e293b", outline: "none",
    background: "rgba(255,255,255,0.55)", boxSizing: "border-box",
  };

  if (status === "success") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, padding: 24 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#22c55e,#16a34a)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <CheckCircle2 size={36} color="#fff" strokeWidth={2.5} />
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: "#166534" }}>Enquiry Submitted!</h3>
        <p style={{ fontSize: 14, color: "#64748b", textAlign: "center" }}>
          Thank you! Our admission team will contact you soon.
        </p>
        <button onClick={() => setStatus("idle")} style={{ background: "#8B1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "10px 24px", fontWeight: 600, cursor: "pointer" }}>
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 4, display:"flex", alignItems:"center", gap:8 }}>
        <ClipboardList size={18} color="#8B1A1A"/> Admission Enquiry
      </h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Fill this form and our team will contact you.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input required placeholder="Full Name *" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
        <input required placeholder="Phone Number *" value={form.phone}
          onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle} />
        <input type="email" placeholder="Email Address" value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
        <select value={form.course}
          onChange={e => setForm(p => ({ ...p, course: e.target.value }))}
          style={{ ...inputStyle, color: form.course ? "#1e293b" : "#94a3b8" }}>
          <option value="">Select Interested Course</option>
          {courses.map(c => <option key={c.id} value={c.shortName}>{c.name}</option>)}
        </select>
        <textarea placeholder="Any specific questions?" value={form.message}
          onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
          rows={3} style={{ ...inputStyle, resize: "vertical" }} />
        {status === "error" && <p style={{ color: "#ef4444", fontSize: 13 }}>⚠️ Submission failed. Please try again.</p>}
        <button type="submit" disabled={status === "loading"}
          style={{ background: status === "loading" ? "#94a3b8" : "#8B1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700, cursor: status === "loading" ? "not-allowed" : "pointer", fontSize: 15 }}>
          {status === "loading" ? "Submitting..." : "Submit Enquiry →"}
        </button>
      </form>
    </div>
  );
}

// ─── Facilities / Image Viewer ───────────────────────────────────────────────
export function FacilitiesViewer({ resourceId, title, onQuery }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    getResource(resourceId ? "facilities" : "facilities", resourceId)
      .then(r => setData(r.data))
      .catch(() => {});
  }, [resourceId]);

  const facilities = data
    ? (typeof data === "object" && !Array.isArray(data) && !data.id
        ? Object.values(data)
        : Array.isArray(data) ? data : [data])
    : [];

  const facilityIcon = (id) => {
    const map = {
      library: Library, computerLab: Monitor, cafeteria: Coffee,
      sports: Dumbbell, auditorium: Mic2,
    };
    const Icon = map[id] || Building2;
    return <Icon size={28} color="#8B1A1A" />;
  };

  const facilityBg = (id) => ({
    library: "#FDF2F2", computerLab: "#dbeafe", cafeteria: "#fef3c7",
    sports: "#d1fae5", auditorium: "#fce7f3",
  }[id] || "#f0f4ff");

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", marginBottom: 16, display:"flex", alignItems:"center", gap:8 }}>
        <Building2 size={18} color="#8B1A1A"/> {title || "Campus Facilities"}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14 }}>
        {facilities.map(f => (
          <div key={f.id} style={{ background: "rgba(255,255,255,0.55)", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{
              height: 90, background: facilityBg(f.id),
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {facilityIcon(f.id)}
            </div>
            <div style={{ padding: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 6px" }}>{f.title}</h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                {f.description?.slice(0, 80)}...
              </p>
              {f.panoramaUrl && (
                <button onClick={() => onQuery?.(`Show 360 view of ${f.title}`)}
                  style={{ marginTop: 10, width: "100%", background: "#8B1A1A", color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                  360° View
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


