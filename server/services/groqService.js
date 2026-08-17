/**
 * Groq Service
 * Handles all communication with the Groq LLM API.
 * Now with automatic API key rotation support
 */
import Groq from "groq-sdk";
import { buildSystemPrompt } from "../prompts/collegeAssistantPrompt.js";
import keyRotation from "./groqKeyRotation.js";

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
  const model  = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

  const systemPrompt = buildSystemPrompt(collegeContext);

  // Keep last 10 turns to avoid token limit
  const recentHistory = conversationHistory.slice(-10);

  const messages = [
    { role: "system", content: systemPrompt },
    ...recentHistory,
    { role: "user", content: message },
  ];

  let rawContent = "";
  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (retryCount < MAX_RETRIES) {
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
      
      // Record success
      keyRotation.recordSuccess();
      
      return { success: true, ...validateAndSanitize(parsed) };

    } catch (err) {
      console.error("Groq error:", err.message);

      // Record failure and check if we should rotate
      const wasRateLimit = keyRotation.recordFailure(err);
      
      if (wasRateLimit && retryCount < MAX_RETRIES - 1) {
        console.log(`🔄 Retrying with new API key (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        // Get new client with rotated key
        groqClient = null;
        currentApiKey = null;
        const newClient = getClient();
        retryCount++;
        continue; // Retry with new key
      }

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
          reply: "The AI service is not configured yet. Please add your GROQ_API_KEYS to the .env file.",
        };
      }

      return { success: false, ...SAFE_FALLBACK };
    }
  }

  // All retries exhausted
  console.error("❌ All retry attempts exhausted");
  return { success: false, ...SAFE_FALLBACK };
}
