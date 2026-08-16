import express from "express";
import Groq from "groq-sdk";
import { buildContext } from "../services/sunwayKnowledge.js";
import { buildSunwayPrompt } from "../prompts/sunwayPrompt.js";
import db, { leadsStore } from "../database/sunwayData.js";

const router = express.Router();

let groqClient = null;
function getClient() {
  if (!groqClient) {
    const key = process.env.GROQ_API_KEY;
    if (!key || key === "your_groq_api_key_here") throw new Error("GROQ_API_KEY not configured");
    groqClient = new Groq({ apiKey: key });
  }
  return groqClient;
}

const VALID_EMOTIONS   = new Set(["neutral","happy","concerned","excited"]);
const VALID_ANIMATIONS = new Set(["idle","talking","smile","namaste","wave","point_right","nod","head_shake","thinking"]);
const VALID_VISUALS    = new Set([
  "NONE","SHOW_HOME","SHOW_ABOUT","SHOW_WHY_SUNWAY","SHOW_PROGRAM","SHOW_PROGRAMS_LIST",
  "COMPARE_PROGRAMS","SHOW_MODULES","SHOW_FEE_STRUCTURE","SHOW_FEE_SCHEDULE",
  "SHOW_ADMISSION","SHOW_ADMISSION_DOCUMENTS","SHOW_SCHOLARSHIP","SHOW_CAREERS",
  "SHOW_PLACEMENT","SHOW_INDUSTRY_PARTNERS","SHOW_UNIVERSITY_PARTNER",
  "SHOW_RAIN","SHOW_INNOVATION_LAB","SHOW_ACADEMIC_ADVISORY",
  "SHOW_STUDENT_LIFE","SHOW_SSRC","SHOW_CONTACT","SHOW_APPLY",
  "SHOW_IMAGE","SHOW_PDF","SHOW_360","SHOW_GALLERY","SHOW_NONE",
]);

const FALLBACK = {
  reply: "I'm having trouble connecting right now. Please try again.",
  language: "en", emotion: "concerned", animation: "idle", intent: "",
  entities: { program: null, year: null, topic: null },
  visualAction: { type: "SHOW_CONTACT", resourceId: "contact", title: "Contact Sunway" },
  suggestions: ["BSc CSAI Program", "BIT Program", "Contact Us"],
};

function sanitize(parsed) {
  const res = {
    reply:     typeof parsed.reply === "string" ? parsed.reply.slice(0, 600) : FALLBACK.reply,
    language:  ["en","ne","roman_ne","hi","hinglish"].includes(parsed.language) ? parsed.language : "en",
    emotion:   VALID_EMOTIONS.has(parsed.emotion)    ? parsed.emotion    : "neutral",
    animation: VALID_ANIMATIONS.has(parsed.animation) ? parsed.animation : "talking",
    intent:    typeof parsed.intent === "string" ? parsed.intent.slice(0,50) : "",
    entities:  parsed.entities || {},
    visualAction: { type: "NONE", resourceId: "", title: "" },
    suggestions: [],
  };
  if (parsed.visualAction?.type) {
    const vt = String(parsed.visualAction.type).toUpperCase();
    res.visualAction = {
      type:       VALID_VISUALS.has(vt) ? vt : "NONE",
      resourceId: typeof parsed.visualAction.resourceId === "string"
        ? parsed.visualAction.resourceId.replace(/[^a-zA-Z0-9_\-]/g,"").slice(0,100) : "",
      title: typeof parsed.visualAction.title === "string"
        ? parsed.visualAction.title.slice(0,200) : "",
    };
  }
  if (Array.isArray(parsed.suggestions)) {
    res.suggestions = parsed.suggestions.filter(s => typeof s === "string").map(s => s.slice(0,100)).slice(0,4);
  }
  return res;
}

router.post("/", async (req, res) => {
  try {
    const { message, conversationHistory = [], sessionContext = {} } = req.body;
    if (!message || typeof message !== "string") return res.status(400).json({ success:false, error:"Message required" });
    if (message.length > 1000) return res.status(400).json({ success:false, error:"Message too long" });

    // Build targeted context
    const ctx = buildContext(message, conversationHistory, sessionContext);
    const systemPrompt = buildSunwayPrompt(ctx);
    const recentHistory = conversationHistory.slice(-10);

    let rawContent = "";
    try {
      const client = getClient();
      const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...recentHistory,
          { role: "user", content: message },
        ],
        temperature: 0.35,
        max_tokens:  700,
        response_format: { type: "json_object" },
      });
      rawContent = completion.choices[0]?.message?.content || "";
      const parsed = JSON.parse(rawContent);
      return res.json({ success: true, ...sanitize(parsed), sessionContext: ctx.newSessionContext });
    } catch (groqErr) {
      console.error("Groq error:", groqErr.message?.slice(0,200));
      // Try partial JSON recovery
      try {
        const m = rawContent.match(/\{[\s\S]*\}/);
        if (m) return res.json({ success:true, ...sanitize(JSON.parse(m[0])), sessionContext: ctx.newSessionContext });
      } catch (_) {}
      if (groqErr.message?.includes("not configured")) {
        return res.json({ success:false, ...FALLBACK, reply:"GROQ_API_KEY is not configured. Please add it to .env file." });
      }
      return res.json({ success:false, ...FALLBACK });
    }
  } catch (err) {
    console.error("Chat route error:", err.message);
    return res.status(500).json({ success:false, ...FALLBACK });
  }
});

export default router;
