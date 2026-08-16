/**
 * Groq Service
 * Handles all communication with the Groq LLM API.
 */
import Groq from "groq-sdk";
import { buildSystemPrompt } from "../prompts/collegeAssistantPrompt.js";

let groqClient = null;

function getClient() {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === "your_groq_api_key_here") {
      throw new Error("GROQ_API_KEY is not configured in .env file");
    }
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

const SAFE_FALLBACK = {
  reply: "I'm having a little trouble connecting right now. Please try again in a moment.",
  emotion: "concerned",
  animation: "idle",
  visualAction: { type: "NONE", resourceId: "", title: "" },
  suggestions: ["View Courses", "Fee Structure", "Contact Us"],
};

// Valid values for validation
const VALID_EMOTIONS   = new Set(["neutral", "happy", "concerned", "excited"]);
const VALID_ANIMATIONS = new Set(["idle","talking","smile","namaste","wave","point_right","nod","head_shake","thinking"]);
const VALID_VISUAL_TYPES = new Set([
  "NONE","SHOW_IMAGE","SHOW_PDF","SHOW_COURSE","SHOW_FEES","SHOW_FACULTY",
  "SHOW_GALLERY","SHOW_360","SHOW_MAP","SHOW_ADMISSION_FORM","SHOW_SCHOLARSHIP",
  "SHOW_CONTACT","SHOW_COURSES_LIST","SHOW_FACILITIES",
]);

function validateAndSanitize(parsed) {
  const result = {
    reply:        typeof parsed.reply === "string" ? parsed.reply.slice(0, 500) : SAFE_FALLBACK.reply,
    emotion:      VALID_EMOTIONS.has(parsed.emotion)   ? parsed.emotion   : "neutral",
    animation:    VALID_ANIMATIONS.has(parsed.animation) ? parsed.animation : "talking",
    visualAction: { type: "NONE", resourceId: "", title: "" },
    suggestions:  [],
  };

  if (parsed.visualAction && typeof parsed.visualAction === "object") {
    const vt = String(parsed.visualAction.type || "NONE").toUpperCase();
    result.visualAction = {
      type:       VALID_VISUAL_TYPES.has(vt) ? vt : "NONE",
      resourceId: typeof parsed.visualAction.resourceId === "string"
        ? parsed.visualAction.resourceId.replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 100)
        : "",
      title: typeof parsed.visualAction.title === "string"
        ? parsed.visualAction.title.slice(0, 200)
        : "",
    };
  }

  if (Array.isArray(parsed.suggestions)) {
    result.suggestions = parsed.suggestions
      .filter(s => typeof s === "string")
      .map(s => s.slice(0, 100))
      .slice(0, 4);
  }

  return result;
}

export async function chat(message, conversationHistory = [], collegeContext) {
  const client = getClient();
  const model  = process.env.GROQ_MODEL || "llama3-8b-8192";

  const systemPrompt = buildSystemPrompt(collegeContext);

  // Keep last 10 turns to avoid token limit
  const recentHistory = conversationHistory.slice(-10);

  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory,
    { role: "user", content: message },
  ];

  let rawContent = "";
  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature:   0.4,
      max_tokens:    600,
      response_format: { type: "json_object" },
    });

    rawContent = completion.choices[0]?.message?.content || "";

    // Try to parse JSON
    const parsed = JSON.parse(rawContent);
    return { success: true, ...validateAndSanitize(parsed) };

  } catch (err) {
    console.error("Groq error:", err.message);

    // Try to extract partial JSON
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { success: true, ...validateAndSanitize(parsed) };
      }
    } catch (_) {}

    // If it's an API key error, give a specific message
    if (err.message?.includes("API_KEY") || err.message?.includes("not configured")) {
      return {
        success: false,
        ...SAFE_FALLBACK,
        reply: "The AI service is not configured yet. Please add your GROQ_API_KEY to the .env file.",
      };
    }

    return { success: false, ...SAFE_FALLBACK };
  }
}
