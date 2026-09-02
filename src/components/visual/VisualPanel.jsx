/**
 * VisualPanel — deterministic renderer.
 * Receives visualAction from store and renders the correct component.
 */
import React, { useEffect, useRef, useState } from "react";
import { useAssistantStore } from "../../store/assistantStore";
import { getCollegeConfig } from "../../services/collegeConfig";
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

const SUNWAY_RED = "var(--brand)";
const DARK_RED = "var(--brand-dark)";
const BORDER = "#E8E8E8";

export function VisualPanel({ onQuery }) {
  const { visualAction } = useAssistantStore();
  const [displayed, setDisplayed]   = useState(visualAction);
  const [animating, setAnimating]   = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // The first render already shows the right panel — running the crossfade
    // here just blanks it for 180ms on mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayed(visualAction);
      return;
    }
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
      display: "flex", flexDirection: "column",
      background: "transparent",
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
      <div style={{ paddingRight: 4 }}>
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
  // Comes from the active college's config.json (admin panel → Branding),
  // so each college shows its own tour instead of a hard-coded one.
  const TOUR_URL = getCollegeConfig().virtualTourUrl;
  const [fullscreen, setFullscreen] = React.useState(false);

  return (
    <div style={{ padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Globe size={16} color={SUNWAY_RED} />
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
            style={{ background: SUNWAY_RED, color: "#fff", border: "none", borderRadius: 7, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
            <ExternalLink size={11} /> Open
          </a>
        </div>
      </div>

      <div style={{
        width: "100%",
        height: fullscreen ? "70vh" : "400px",
        borderRadius: 12,
        overflow: "hidden",
        border: "1.5px solid rgba(var(--brand-rgb), 0.2)",
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
      <p style={{ fontSize: 11, color: "#888", marginTop: 7, textAlign: "center" }}>
        Drag to rotate · Scroll to zoom · Click hotspots to explore
      </p>
    </div>
  );
}

function ImgView({ title }) {
  return <div style={{ padding: 20, background: "rgba(255,255,255,0.55)", borderRadius: 12, height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontSize: 13 }}>{title || "Image"}</div>;
}
