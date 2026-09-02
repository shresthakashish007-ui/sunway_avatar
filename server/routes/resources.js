import express from "express";
import { getResource } from "../services/sunwayKnowledge.js";
import db from "../database/sunwayData.js";
import { getConfig, getActiveSlug } from "../services/collegeStore.js";

const router = express.Router();

// Public branding for the active college — read by the frontend on startup so
// the name, colours, logo and links come from config.json instead of being
// hard-coded. Only whitelisted fields are exposed.
const PUBLIC_CONFIG_FIELDS = [
  "slug", "name", "shortName", "tagline", "assistantName", "builtBy",
  "brandColor", "brandColorDark", "logoUrl", "buildingImage",
  "pageBackground", "avatarBackground",
  "applyUrl", "virtualTourUrl", "website",
  // Spoken welcome line + the language it is written in, so each college can
  // greet students in its own words and voice.
  "greetingText", "greetingLang",
];

router.get("/college-config", (_req, res) => {
  const cfg = getConfig() || {};
  const out = {};
  for (const k of PUBLIC_CONFIG_FIELDS) if (cfg[k] !== undefined) out[k] = cfg[k];
  out.slug = out.slug || getActiveSlug();
  res.json({ success: true, data: out });
});

router.get("/programs",            (_, res) => res.json({ success:true, data: db.programs }));
router.get("/programs/:id",        (req, res) => { const d = getResource("program", req.params.id); d ? res.json({success:true,data:d}) : res.status(404).json({success:false,error:"Not found"}); });
router.get("/fees/:programId",     (req, res) => { const d = getResource("fees", req.params.programId); d ? res.json({success:true,data:d}) : res.status(404).json({success:false,error:"Not found"}); });
router.get("/fees",                (_, res) => res.json({ success:true, data: Object.values(db.fees) }));
router.get("/modules/:programId",  (req, res) => { const d = getResource("modules", req.params.programId); d ? res.json({success:true,data:d}) : res.status(404).json({success:false,error:"Not found"}); });
router.get("/college",             (_, res) => res.json({ success:true, data: db.college }));
router.get("/why-sunway",          (_, res) => res.json({ success:true, data: db.whySunway }));
router.get("/bcu",                 (_, res) => res.json({ success:true, data: db.universityPartner }));
router.get("/placement",           (_, res) => res.json({ success:true, data: db.placement }));
router.get("/rain",                (_, res) => res.json({ success:true, data: db.rain }));
router.get("/innovation-lab",      (_, res) => res.json({ success:true, data: db.innovationLab }));
router.get("/admissions",          (_, res) => res.json({ success:true, data: db.admissions }));
router.get("/admissions/documents",(_, res) => res.json({ success:true, data: db.admissions.requiredDocuments }));
router.get("/scholarships",        (_, res) => res.json({ success:true, data: db.scholarships }));
router.get("/fee-schedule",        (_, res) => res.json({ success:true, data: db.feeSchedule }));
router.get("/contact",             (_, res) => res.json({ success:true, data: db.college.contact }));
router.get("/student-life",        (_, res) => res.json({ success:true, data: db.studentLife }));
router.get("/advisory",            (_, res) => res.json({ success:true, data: db.academicAdvisory }));
router.get("/industry-partners",   (_, res) => res.json({ success:true, data: db.industryPartners }));
router.get("/testimonials",        (_, res) => res.json({ success:true, data: db.testimonials }));

// Leads
router.post("/leads", (req, res) => {
  const { name, phone, email, program, message } = req.body;
  if (!name || !phone) return res.status(400).json({success:false,error:"Name and phone required"});
  const lead = {
    id: Date.now().toString(),
    name: String(name).slice(0,100),
    phone: String(phone).slice(0,20),
    email: String(email||"").slice(0,100),
    program: String(program||"").slice(0,100),
    message: String(message||"").slice(0,500),
    source: "sunway-ai-counselor",
    timestamp: new Date().toISOString(),
  };
  db.leadsStore.push(lead);
  console.log("New lead:", lead.name, lead.phone, lead.program);
  res.json({ success:true, message:"Enquiry submitted successfully.", id:lead.id });
});

export default router;
