import React, { useEffect, useState } from "react";
import { getResource } from "../../services/chatService";
import { Download, ChevronRight, Users, Calendar } from "lucide-react";

const MAROON = "#8B1A1A";
const MAROON_LIGHT = "#FDF2F2";

/* ── Fee Structure — matches screenshot exactly ─────────────────────────── */
export function FeeStructureViewer({ resourceId, title, onQuery }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getResource("fees", resourceId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resourceId]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const allFees = Array.isArray(data) ? data : [data];

  return (
    <div style={{ padding: "18px 20px" }}>
      {allFees.map(fee => {
        const course = fee.courseName || resourceId?.toUpperCase();
        return (
          <div key={fee.courseId}>
            {/* Subtitle */}
            <div style={{ fontSize: 12, color: "#888", marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${MAROON}` }}>
              {course && `Bachelor in ${course === "BCA" ? "Computer Application" : course === "BBS" ? "Business Studies" : course}`}
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              {/* Table */}
              <div style={{ flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: MAROON }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", color: "#fff", fontWeight: 600, borderRadius: "8px 0 0 0" }}>Particulars</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", color: "#fff", fontWeight: 600, borderRadius: "0 8px 0 0" }}>Amount (NPR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fee.breakdown || []).map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "10px 14px", color: "#333", borderBottom: "1px solid #f0f0f0" }}>{row.item}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#333", borderBottom: "1px solid #f0f0f0" }}>
                          {row.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr style={{ background: MAROON_LIGHT }}>
                      <td style={{ padding: "11px 14px", fontWeight: 700, color: MAROON, fontSize: 13.5 }}>Total (Per Semester)</td>
                      <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 700, color: MAROON, fontSize: 13.5 }}>
                        {Math.round((fee.totalFirstYear || 0) / 2).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* College image placeholder */}
              <div style={{ width: 160, flexShrink: 0 }}>
                <div style={{
                  width: "100%", height: 130, borderRadius: 10, overflow: "hidden",
                  background: "linear-gradient(135deg,#e8f4fd,#cce7ff)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #e0e0e0",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ width: 48, height: 48, background: MAROON, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div style={{ fontSize: 10, color: "#666", fontWeight: 600 }}>Sunway College</div>
                  </div>
                </div>
                <button
                  onClick={() => onQuery?.("BCA brochure download")}
                  style={{
                    marginTop: 8, width: "100%", background: MAROON, color: "#fff",
                    border: "none", borderRadius: 8, padding: "9px 10px",
                    fontWeight: 600, cursor: "pointer", fontSize: 12,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                  <Download size={13} /> Download Fee Structure
                </button>
              </div>
            </div>

            {/* Note */}
            {fee.note && (
              <div style={{ marginTop: 12, background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#92400e" }}>
                ⚠ {fee.note}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Course Cards ──────────────────────────────────────────────────────── */
export function CourseViewer({ resourceId, title, onQuery }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getResource("courses", resourceId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [resourceId]);

  if (loading) return <LoadingState />;
  if (!data) return null;

  const courses = Array.isArray(data) ? data : [data];

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
        {courses.map(c => (
          <div key={c.id} style={{
            background: "rgba(255,255,255,0.55)", borderRadius: 12, border: "1px solid #f0f0f0",
            padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div>
                <span style={{ background: MAROON_LIGHT, color: MAROON, padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{c.shortName}</span>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "6px 0 4px" }}>{c.name}</h3>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#666" }}>
                <Calendar size={11} /> {c.duration}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#666" }}>
                <Users size={11} /> {c.intake}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#666", lineHeight: 1.5, marginBottom: 10 }}>{c.description?.slice(0, 90)}...</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onQuery?.(`Show ${c.shortName} fee structure`)}
                style={{ flex: 1, background: MAROON, color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Fee Structure
              </button>
              <button onClick={() => onQuery?.(`Tell me more about ${c.shortName}`)}
                style={{ flex: 1, background: MAROON_LIGHT, color: MAROON, border: `1px solid ${MAROON}22`, borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 13 }}>
      Loading...
    </div>
  );
}

