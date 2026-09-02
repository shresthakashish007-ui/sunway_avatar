import React, { useEffect, useState } from "react";
import { getResource } from "../../services/chatService";
import { AlertTriangle, Download, ChevronRight, Clock } from "lucide-react";

const R = "var(--brand)"; const RL = "var(--brand-lighter)";

/* ── Fee Structure ───────────────────────────────────────────────────────── */
export function FeeViewer({ resourceId, title, onQuery }) {
  const [data, setData]     = useState(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);
  const [activeYear, setActiveYear] = useState(1);

  const pid = (() => {
    if (!resourceId) return "csai";
    // Strip suffixes: csai-fee-current → csai, bit-fee → bit, csai → csai
    const clean = resourceId
      .replace(/-fee-current$/i, "")
      .replace(/-fee$/i, "")
      .replace(/-current$/i, "");
    // Map known IDs
    if (clean.includes("bit")) return "bit";
    if (clean.includes("csai") || clean.includes("ai")) return "csai";
    return clean;
  })();

  useEffect(() => {
    console.log('[FeeViewer] Loading fees for:', pid);
    setLoad(true);
    setError(null);
    getResource("fees", pid)
      .then(r => { 
        console.log('[FeeViewer] Received data:', r);
        if (r && r.data) {
          setData(r.data);
        } else {
          console.error('[FeeViewer] No data in response:', r);
          setError("No fee data received from server");
        }
        setLoad(false);
      })
      .catch(err => {
        console.error('[FeeViewer] Error loading fees:', err);
        setError(err.message || "Failed to load fee information");
        setLoad(false);
      });
  }, [pid]);

  if (loading) return <Load />;
  if (error) return <Err msg={error} />;
  if (!data) return <Err msg="Fee information not found." />;

  const year = data.years?.find(y => y.year === activeYear) || data.years?.[0];

  return (
    <div style={{ padding: "18px 20px" }}>
      {/* Program badge */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{data.programName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ background: R, color: "#fff", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
            Grand Total: NPR {data.grandTotal?.toLocaleString()}
          </span>
          <span style={{ fontSize: 11, color: "#888" }}>{data.duration || ""}</span>
        </div>
      </div>

      {/* Year tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {data.years?.map(y => (
          <button key={y.year} onClick={() => setActiveYear(y.year)}
            style={{
              padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${activeYear === y.year ? R : "#e8e8e8"}`,
              background: activeYear === y.year ? R : "#fff",
              color: activeYear === y.year ? "#fff" : "#555",
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}>
            Year {y.year}
          </button>
        ))}
        <button onClick={() => onQuery?.("Show fee payment schedule")}
          style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid #e8e8e8", background: "rgba(255,255,255,0.55)", color: "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={11} /> Schedule
        </button>
      </div>

      {/* Fee table */}
      {year && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: R }}>
                <th style={{ padding: "10px 14px", textAlign: "left", color: "#fff", fontWeight: 600, borderRadius: "8px 0 0 0", fontSize: 12 }}>Particulars</th>
                <th style={{ padding: "10px 14px", textAlign: "right", color: "#fff", fontWeight: 600, borderRadius: "0 8px 0 0", fontSize: 12 }}>Amount (NPR)</th>
              </tr>
            </thead>
            <tbody>
              {year.items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "9px 14px", color: "#333", borderBottom: "1px solid #f0f0f0", fontSize: 12.5 }}>
                    {item.item}
                    {item.oneTime && <span style={{ marginLeft: 6, background: "#fef3c7", color: "#92400e", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>One-time</span>}
                    {item.isForeign && <span style={{ marginLeft: 6, background: "#dbeafe", color: "#1d4ed8", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{item.foreignAmount}</span>}
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: "#222", fontWeight: 600, borderBottom: "1px solid #f0f0f0", fontSize: 12.5 }}>
                    {item.amount?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: RL }}>
                <td style={{ padding: "11px 14px", fontWeight: 800, color: R, fontSize: 13 }}>Year {year.year} Total</td>
                <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 800, color: R, fontSize: 13 }}>NPR {year.total?.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          {year.note && (
            <div style={{ marginTop: 8, background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#92400e", display: "flex", gap: 6 }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {year.note}
            </div>
          )}
        </>
      )}

      {/* Grand total callout */}
      <div style={{ marginTop: 12, background: R, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Listed Grand Total</span>
        <span style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>NPR {data.grandTotal?.toLocaleString()}</span>
      </div>

      {/* Disclaimer */}
      <div style={{ marginTop: 10, background: "#f8f8f8", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#666", display: "flex", gap: 6 }}>
        <AlertTriangle size={12} color="#e67e22" style={{ flexShrink: 0, marginTop: 1 }} />
        {data.grandTotalNote || data.disclaimer}
      </div>

      {/* Scholarship note */}
      {data.scholarshipNote && (
        <div style={{ marginTop: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "7px 12px", fontSize: 11, color: "#166534" }}>
          🎓 {data.scholarshipNote}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={() => onQuery?.("Show admission requirements")}
          style={{ flex: 1, background: R, color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
          Admission Requirements
        </button>
        <button onClick={() => onQuery?.("Tell me about scholarships")}
          style={{ flex: 1, background: RL, color: R, border: `1px solid rgba(var(--brand-rgb), 0.2)`, borderRadius: 8, padding: "9px", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
          Scholarships
        </button>
      </div>
    </div>
  );
}

/* ── Fee Payment Schedule ─────────────────────────────────────────────────── */
export function FeeScheduleViewer({ onQuery }) {
  const [data, setData] = useState([]);
  useEffect(() => { getResource("fee-schedule").then(r => setData(r.data || [])).catch(() => {}); }, []);
  return (
    <div style={{ padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Clock size={18} color={R} />
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111", margin: 0 }}>Fee Payment Schedule</h2>
      </div>
      <p style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Not all fees are due at admission — here is when each fee is payable.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((f, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.55)", border: "1px solid #f0f0f0", borderRadius: 10, padding: "11px 14px", display: "flex", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: RL, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontWeight: 800, color: R, fontSize: 12 }}>{i + 1}</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#222" }}>{f.item}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{f.timing} &mdash; {f.when}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, background: "#fffbf0", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#92400e", display: "flex", gap: 6 }}>
        <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        Semester fees are due within the 3rd week of class. NOT all fees are required at admission time.
      </div>
    </div>
  );
}

function Load() { return <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 13 }}>Loading...</div>; }
function Err({ msg }) { return <div style={{ padding: 24, textAlign: "center", color: "#ef4444", fontSize: 13 }}>⚠ {msg}</div>; }

