import express from "express";
import Groq from "groq-sdk";
import { buildContext } from "../services/sunwayKnowledge.js";
import { buildSunwayPrompt } from "../prompts/sunwayPrompt.js";
import db, { leadsStore } from "../database/sunwayData.js";
import keyRotation from "../services/groqKeyRotation.js";

const router = express.Router();

let groqClient = null;
let currentApiKey = null;

function getClient() {
  // Get current API key from rotation service
  const apiKey = keyRotation.getCurrentKey();
  
  // Create new client if key changed or client doesn't exist
  if (!groqClient || currentApiKey !== apiKey) {
    groqClient = new Groq({ apiKey });
    currentApiKey = apiKey;
    console.log("🔄 Created new Groq client with rotated API key");
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
    let retryCount = 0;
    const MAX_RETRIES = 3;

    while (retryCount < MAX_RETRIES) {
      try {
        const client = getClient();
        const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
        
        console.log(`[CHAT] Processing message: "${message.slice(0, 50)}..." with model: ${model}`);
        
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            ...recentHistory,
            { role: "user", content: message },
          ],
          temperature: 0.30, // Slightly lower for faster, more deterministic responses
          max_tokens:  500, // Reduced from 700 for faster generation
          response_format: { type: "json_object" },
          timeout: 30000, // 30 second timeout
        });
        
        rawContent = completion.choices[0]?.message?.content || "";
        console.log(`[CHAT] Groq response received: ${rawContent.slice(0, 100)}...`);
        
        const parsed = JSON.parse(rawContent);
        
        // Record success
        keyRotation.recordSuccess();
        
        return res.json({ success: true, ...sanitize(parsed), sessionContext: ctx.newSessionContext });
        
      } catch (groqErr) {
        console.error("❌ [CHAT] Groq error:", groqErr.message?.slice(0,200));
        console.error("Stack:", groqErr.stack?.split("\n").slice(0, 3).join("\n"));
        
        // Record failure and check if we should rotate
        const wasRateLimit = keyRotation.recordFailure(groqErr);
        
        if (wasRateLimit && retryCount < MAX_RETRIES - 1) {
          console.log(`🔄 Rate limit hit, retrying with new API key (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          // Reset client to force getting new rotated key
          groqClient = null;
          currentApiKey = null;
          retryCount++;
          continue; // Retry with new key
        }
        
        // Try partial JSON recovery
        try {
          const m = rawContent.match(/\{[\s\S]*\}/);
          if (m) {
            console.log("[CHAT] Recovered partial JSON");
            return res.json({ success:true, ...sanitize(JSON.parse(m[0])), sessionContext: ctx.newSessionContext });
          }
        } catch (_) {}
        
        if (groqErr.message?.includes("not configured")) {
          return res.json({ success:false, ...FALLBACK, reply:"GROQ_API_KEYS is not configured. Please add it to .env file." });
        }
        
        // If not a rate limit and no more retries, return error
        if (!wasRateLimit || retryCount >= MAX_RETRIES - 1) {
          return res.json({ success:false, ...FALLBACK, reply: `Error: ${groqErr.message?.slice(0, 100)}` });
        }
      }
    }
    
    // All retries exhausted
    console.error("❌ [CHAT] All retry attempts exhausted");
    return res.json({ success:false, ...FALLBACK, reply: "Service temporarily unavailable. Please try again." });
    
  } catch (err) {
    console.error("Chat route error:", err.message);
    console.error("Stack trace:", err.stack);
    return res.status(500).json({ success:false, ...FALLBACK, error: err.message });
  }
});

export default router;
