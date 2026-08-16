/**
 * VisualPanel — deterministic renderer.
 * Receives visualAction from store and renders the correct component.
 */
import React, { useEffect, useState } from "react";
import { useAssistantStore } from "../../store/assistantStore";
import { ChevronLeft, Globe, FileText, ExternalLink } from "lucide-react";
import { HomePanel } from "./HomePanel";
import { ProgramViewer, ProgramsListViewer } from "./ProgramViewer";
import { FeeViewer, FeeScheduleViewer } from "./FeeViewer";
import {
  WhySunwayViewer, BCUViewer, ModulesViewer, CareersViewer,
  AdmissionDocsViewer, ScholarshipViewer, ContactViewer,
  RainViewer, PlacementViewer, ApplyViewer, CompareProgramsViewer,
  StudentLifeViewer, AdvisoryViewer, InnovationLabViewer,
  AdmissionFormViewer,
} from "./SunwayViewers";

const SUNWAY_RED = "#B51F24";
const DARK_RED = "#8F171B";
const BORDER = "#E8E8E8";

export function VisualPanel({ onQuery }) {
  const { visualAction, previousVisualAction } = useAssistantStore();
  const [displayed, setDisplayed]   = useState(visualAction);
  const [animating, setAnimating]   = useState(false);

  useEffect(() => {
    setAnimating(true);
    const t = setTimeout(() => { setDisplayed(visualAction); setAnimating(false); }, 180);
    return () => clearTimeout(t);
  }, [visualAction.type, visualAction.resourceId]);

  const { type, resourceId, title } = displayed;

  // Show nothing if NONE/WELCOME/empty
  if (!type || type === "NONE" || type === "SHOW_NONE" || type === "WELCOME") return null;

  // Show Back button on any non-home panel
  const canGoBack = type !== "SHOW_HOME" && type !== "SHOW_ABOUT";

  return (
    <div style={{
      background: "rgba(255,255,255,0.95)",
      border: `1px solid rgba(181,31,36,0.08)`,
      borderRadius: 20,
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      overflow: "hidden",
      marginBottom: 14,
      boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
      opacity: animating ? 0 : 1,
      transform: animating ? "translateY(8px)" : "translateY(0)",
      transition: "all 0.25s ease",
    }}>
      {/* Card header (skip for home/welcome) */}
      {canGoBack && (
        <div style={{
          padding: "13px 20px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", gap: 10,
          background: "linear-gradient(90deg,#fff,#fafafa)",
        }}>
          <button
            onClick={() => useAssistantStore.getState().goBack()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: SUNWAY_RED,
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12.5,
              fontWeight: 600,
              padding: 0,
              transition: "color 0.2s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.color = DARK_RED}
            onMouseLeave={e => e.currentTarget.style.color = SUNWAY_RED}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <span style={{ width: 1, height: 16, background: "#e5e7eb" }} />
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: "#111" }}>{title}</h3>
        </div>
      )}

      {/* Content */}
      <div style={{ maxHeight: 520, overflowY: "auto" }}>
        {renderContent(type, resourceId, title, onQuery)}
      </div>
    </div>
  );
}

function renderContent(type, resourceId, title, onQuery) {
  switch (type) {
    case "SHOW_HOME":                return <HomePanel onQuery={onQuery} />;
    case "SHOW_ABOUT":               return <HomePanel onQuery={onQuery} />;
    case "SHOW_WHY_SUNWAY":          return <WhySunwayViewer onQuery={onQuery} />;
    case "SHOW_PROGRAMS_LIST":       return <ProgramsListViewer onQuery={onQuery} />;
    case "SHOW_PROGRAM":             return <ProgramViewer resourceId={resourceId} onQuery={onQuery} />;
    case "COMPARE_PROGRAMS":         return <CompareProgramsViewer onQuery={onQuery} />;
    case "SHOW_FEE_STRUCTURE":       return <FeeViewer resourceId={resourceId} title={title} onQuery={onQuery} />;
    case "SHOW_FEE_SCHEDULE":        return <FeeScheduleViewer onQuery={onQuery} />;
    case "SHOW_MODULES":             return <ModulesViewer resourceId={resourceId} onQuery={onQuery} />;
    case "SHOW_CAREERS":             return <CareersViewer resourceId={resourceId} onQuery={onQuery} />;
    case "SHOW_ADMISSION":           return <AdmissionFormViewer onQuery={onQuery} />;
    case "SHOW_ADMISSION_DOCUMENTS": return <AdmissionDocsViewer onQuery={onQuery} />;
    case "SHOW_APPLY":               return <ApplyViewer onQuery={onQuery} />;
    case "SHOW_SCHOLARSHIP":         return <ScholarshipViewer onQuery={onQuery} />;
    case "SHOW_UNIVERSITY_PARTNER":  return <BCUViewer onQuery={onQuery} />;
    case "SHOW_PLACEMENT":           return <PlacementViewer onQuery={onQuery} />;
    case "SHOW_INDUSTRY_PARTNERS":   return <PlacementViewer onQuery={onQuery} />;
    case "SHOW_RAIN":                return <RainViewer onQuery={onQuery} />;
    case "SHOW_INNOVATION_LAB":      return <InnovationLabViewer onQuery={onQuery} />;
    case "SHOW_ACADEMIC_ADVISORY":   return <AdvisoryViewer />;
    case "SHOW_STUDENT_LIFE":
    case "SHOW_SSRC":                return <StudentLifeViewer onQuery={onQuery} />;
    case "SHOW_CONTACT":             return <ContactViewer onQuery={onQuery} />;
    case "SHOW_PDF":                 return <PDFView resourceId={resourceId} title={title} />;
    case "SHOW_IMAGE":               return <ImgView title={title} />;
    case "SHOW_360":                 return <VirtualTourViewer resourceId={resourceId} title={title} />;
    default:                         return null;
  }
}

function PDFView({ resourceId, title }) {
  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <div style={{ height: 180, background: "#fef2f2", border: "1px dashed #fca5a5", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <FileText size={36} color="#ef4444" strokeWidth={1.5} />
        <a href={`/assets/pdfs/${resourceId}.pdf`} target="_blank" rel="noopener noreferrer"
          style={{ background: "#ef4444", color: "#fff", padding: "8px 18px", borderRadius: 8, textDecoration: "none", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <ExternalLink size={13} /> Open PDF
        </a>
      </div>
    </div>
  );
}
// 360 Virtual Tour — embeds the actual tour URL in an iframe
function VirtualTourViewer({ resourceId, title }) {
  const TOUR_URL = "https://virtualtour.thebritishcollege.edu.np/?_gl=1*1rmnuzr*_gcl_aw*R0NMLjE3ODY0MjY1MzUuQ2owS0NRanc3ZVhUQmhEQkFSSXNBS0YtdzQ0TUY3S24zTDJ4YUlNSVFGVWNyaC1LT3QwY0NEbkZtWmxkMllRZlhLSVIzZFduQlRlRnl1b2FBanBjRUFMd193Y0I.*_gcl_au*MTY0MzA4MDI2Ni4xNzg2NDI2NTI2";
  const [fullscreen, setFullscreen] = React.useState(false);

  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Globe size={16} color="#8B1A1A" />
          <span style={{ fontWeight: 700, fontSize: 14, color: "#111" }}>
            {title || "360° Virtual Campus Tour"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setFullscreen(!fullscreen)}
            style={{ background: "rgba(255,255,255,0.7)", border: "1px solid #ddd", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#555" }}>
            {fullscreen ? "⊡ Minimize" : "⛶ Fullscreen"}
          </button>
          <a href={TOUR_URL} target="_blank" rel="noopener noreferrer"
            style={{ background: "#8B1A1A", color: "#fff", border: "none", borderRadius: 7, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
            <ExternalLink size={11} /> Open
          </a>
        </div>
      </div>

      <div style={{
        width: "100%",
        height: fullscreen ? "70vh" : "400px",
        borderRadius: 12,
        overflow: "hidden",
        border: "1.5px solid rgba(139,26,26,0.2)",
        background: "#000",
        transition: "height 0.3s ease",
      }}>
        <iframe
          src={TOUR_URL}
          title="Sunway College 360° Virtual Tour"
          width="100%"
          height="100%"
          style={{ border: "none", display: "block" }}
          allow="fullscreen; gyroscope; accelerometer"
          allowFullScreen
        />
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 7, textAlign: "center" }}>
        Drag to rotate · Scroll to zoom · Click hotspots to explore
      </p>
    </div>
  );
}

function ImgView({ title }) {
  return <div style={{ padding: 20, background: "rgba(255,255,255,0.55)", borderRadius: 12, height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>{title || "Image"}</div>;
}
