import express from "express";
import { buildContext } from "../services/sunwayKnowledge.js";
import { buildSunwayPrompt } from "../prompts/sunwayPrompt.js";
import keyRotation from "../services/groqKeyRotation.js";
import { recordUnanswered } from "../services/gapLog.js";
import { callLLM, resetGroqClient } from "../services/llmProvider.js";

const router = express.Router();

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
  reply: "Let me check that for you. Could you ask again?",
  language: "en", 
  emotion: "neutral", 
  animation: "talking", 
  intent: "",
  entities: { program: null, year: null, topic: null },
  visualAction: { type: "SHOW_HOME", resourceId: "", title: "" },
  suggestions: ["BSc CSAI Program", "BIT Program", "Contact Sunway"],
};

// Keep only the three known entity fields as short strings — the model is
// free to emit anything here and the value is echoed back to the client.
// The reply is spoken aloud, so length is latency: every extra sentence is
// another second of synthesis and several seconds of the avatar talking.
// Trim at a sentence boundary rather than mid-word.
const SPOKEN_MAX = 400;
function capSpoken(text) {
  const t = String(text).trim();
  if (t.length <= SPOKEN_MAX) return t;
  const cut = t.slice(0, SPOKEN_MAX);
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("।"),
                            cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return (lastStop > SPOKEN_MAX * 0.5 ? cut.slice(0, lastStop + 1) : cut).trim();
}

function sanitizeEntities(entities) {
  const clean = { program: null, year: null, topic: null };
  if (!entities || typeof entities !== "object") return clean;
  for (const key of Object.keys(clean)) {
    const v = entities[key];
    if (typeof v === "string" && v.trim()) clean[key] = v.trim().slice(0, 50);
    else if (typeof v === "number") clean[key] = String(v);
  }
  return clean;
}

// Panels that render one specific program. If the model leaves resourceId
// empty the viewer silently falls back to CSAI — so a question about BIT fees
// would answer "BIT" in text while showing the CSAI fee table.
const PROGRAM_SCOPED_VISUALS = new Set([
  "SHOW_PROGRAM", "SHOW_FEE_STRUCTURE", "SHOW_MODULES", "SHOW_CAREERS",
]);

function sanitize(parsed, detectedProgram = null, faqVisual = null) {
  const res = {
    reply:     typeof parsed.reply === "string" ? capSpoken(parsed.reply) : (typeof parsed.message === "string" ? capSpoken(parsed.message) : FALLBACK.reply),
    language:  ["en","ne","roman_ne","hi","hinglish"].includes(parsed.language) ? parsed.language : "en",
    emotion:   VALID_EMOTIONS.has(parsed.emotion)    ? parsed.emotion    : "neutral",
    animation: VALID_ANIMATIONS.has(parsed.animation) ? parsed.animation : "talking",
    intent:    typeof parsed.intent === "string" ? parsed.intent.slice(0,50) : "",
    entities:  sanitizeEntities(parsed.entities),
    visualAction: { type: "NONE", resourceId: "", title: "" },
    suggestions: [],
  };
  
  // Handle visual action - be more forgiving
  if (parsed.visualAction) {
    const vt = String(parsed.visualAction.type || "NONE").toUpperCase().trim();
    res.visualAction = {
      type:       VALID_VISUALS.has(vt) ? vt : "NONE",
      resourceId: typeof parsed.visualAction.resourceId === "string"
        ? parsed.visualAction.resourceId.replace(/[^a-zA-Z0-9_\-]/g,"").slice(0,100) : "",
      title: typeof parsed.visualAction.title === "string"
        ? parsed.visualAction.title.slice(0,200) : "",
    };

    // Fill in the program the question was actually about when the model
    // omits it, so the panel matches the spoken reply
    if (!res.visualAction.resourceId &&
        detectedProgram &&
        PROGRAM_SCOPED_VISUALS.has(res.visualAction.type)) {
      res.visualAction.resourceId = detectedProgram;
    }
  }

  // If the model picked no panel but the matched FAQ names one, use it.
  // Never overrides a panel the model chose deliberately.
  if (res.visualAction.type === "NONE" && faqVisual && VALID_VISUALS.has(faqVisual.type)) {
    res.visualAction = {
      type:       faqVisual.type,
      resourceId: faqVisual.resourceId || (PROGRAM_SCOPED_VISUALS.has(faqVisual.type) ? (detectedProgram || "") : ""),
      title:      res.visualAction.title || "",
    };
  }

  if (Array.isArray(parsed.suggestions)) {
    res.suggestions = parsed.suggestions.filter(s => typeof s === "string" && s.trim().length > 0).map(s => s.slice(0,100)).slice(0,4);
  }
  
  return res;
}

router.post("/", async (req, res) => {
  // ULTIMATE SAFETY NET: Always return valid JSON response, no matter what
  try {
    const { message, conversationHistory = [], sessionContext = {} } = req.body;
    if (!message || typeof message !== "string") {
      return res.json({ success:true, ...FALLBACK, reply: "Could you please ask a question?" });
    }
    if (message.length > 1000) {
      return res.json({ success:true, ...FALLBACK, reply: "Your question is too long. Please make it shorter." });
    }

    // Build targeted context
    const ctx = buildContext(message, conversationHistory, sessionContext);
    const systemPrompt = buildSunwayPrompt(ctx);

    // History comes from the browser — drop anything that isn't a plain
    // user/assistant turn so a crafted request can't inject a system message
    const recentHistory = (Array.isArray(conversationHistory) ? conversationHistory : [])
      .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }))
      .slice(-6); // Reduced from -10 to -6 for faster processing

    let rawContent = "";
    let provider   = "groq";
    let retryCount = 0;
    const MAX_RETRIES = 2; // Allow one retry for JSON validation errors

    // openai/gpt-oss-20b spends completion tokens reasoning before it emits
    // the JSON body. At 300 it regularly ran out mid-document and Groq
    // rejected the call with "max completion tokens reached before generating
    // a valid document" — which surfaced to users as the "Could you repeat
    // your question?" fallback. The reply itself is still capped at 600 chars
    // by sanitize(), so this only buys room to finish the document.
    const TOKEN_BUDGET = [900, 1500];

    while (retryCount < MAX_RETRIES) {
      // Clear last attempt's body so the recovery path below can never parse
      // a stale response from the previous iteration
      rawContent = "";
      try {
        console.log(`[CHAT] Processing message: "${message.slice(0, 50)}..."`);

        // Local model first, Groq as the fallback — see llmProvider.js.
        ({ content: rawContent, provider } = await callLLM({
          messages: [
            { role: "system", content: systemPrompt },
            ...recentHistory,
            { role: "user", content: message },
          ],
          maxTokens: TOKEN_BUDGET[retryCount] ?? TOKEN_BUDGET[TOKEN_BUDGET.length - 1],
        }));

        console.log(`[CHAT] ${provider} response received: ${rawContent.slice(0, 100)}...`);
        
        let parsed;
        try {
          parsed = JSON.parse(rawContent);
        } catch (jsonErr) {
          console.log("[CHAT] ⚠️ Initial JSON parse failed, attempting recovery...");
          
          // Strategy 1: Extract JSON object from response
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
              console.log("[CHAT] ✅ Recovered JSON from response");
            } catch (_) {
              console.log("[CHAT] Recovery attempt 1 failed");
              parsed = null;
            }
          }
          
          // Strategy 2: Try to fix common JSON issues
          if (!parsed) {
            try {
              let fixed = rawContent
                .replace(/[\n\r]+/g, " ") // Remove line breaks in strings
                .replace(/,\s*}/g, "}") // Remove trailing commas
                .replace(/,\s*]/g, "]");
              
              const fixedMatch = fixed.match(/\{[\s\S]*\}/);
              if (fixedMatch) {
                parsed = JSON.parse(fixedMatch[0]);
                console.log("[CHAT] ✅ Fixed and recovered JSON");
              }
            } catch (_) {
              console.log("[CHAT] Recovery attempt 2 failed");
              parsed = null;
            }
          }
          
          // If all recovery fails, create minimal valid response
          if (!parsed) {
            console.error("[CHAT] ❌ All JSON recovery attempts failed, using fallback");
            parsed = {
              reply: rawContent.slice(0, 500) || "I'm thinking about that...",
              language: "en",
              emotion: "neutral",
              animation: "talking",
              visualAction: { type: "NONE", resourceId: "", title: "" },
              suggestions: []
            };
          }
        }
        
        // Rotation stats describe the Groq keys — a locally-served reply used
        // no key at all, so counting it would make the dashboard misleading.
        if (provider === "groq") keyRotation.recordSuccess();

        const payload = sanitize(parsed, ctx.detectedProgram, ctx.faqVisual);

        // Anything that fell through to the no-information line is a gap in the
        // Q&A. Record it so the admin can see what students actually ask that
        // nobody has written an answer for yet.
        if (/don'?t have verified info/i.test(payload.reply)) {
          recordUnanswered(message, { language: payload.language });
        }

        return res.json({ success: true, ...payload, sessionContext: ctx.newSessionContext });
        
      } catch (groqErr) {
        console.error("❌ [CHAT] Groq error:", groqErr.message?.slice(0,200));
        console.error("Stack:", groqErr.stack?.split("\n").slice(0, 3).join("\n"));
        
        // Record failure and check if we should rotate
        const wasRateLimit = keyRotation.recordFailure(groqErr);
        
        // Check if this is a parameter validation error (timeout, invalid_request_error, etc.)
        const isParamError = groqErr.message?.includes("invalid_request_error") || 
                            groqErr.message?.includes("property") ||
                            groqErr.message?.includes("unsupported") ||
                            groqErr.status === 400;
        
        if (isParamError && retryCount < MAX_RETRIES - 1) {
          retryCount++;
          console.log(`⚠️ Request error, retrying with a larger token budget (${TOKEN_BUDGET[retryCount]})...`);
          continue; // Retry with next iteration
        }

        // Timeouts and dropped connections are transient — one blip used to go
        // straight to "Could you repeat your question?" with no second attempt.
        const isTransient = /timed out|timeout|connection error|socket|ECONNRESET|ETIMEDOUT|fetch failed|network/i
          .test(groqErr.message || "");
        if (isTransient && retryCount < MAX_RETRIES - 1) {
          retryCount++;
          console.log(`⚠️ Transient network error, retrying (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          continue;
        }
        
        if (wasRateLimit && retryCount < MAX_RETRIES - 1) {
          console.log(`🔄 Rate limit hit, retrying with new API key (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          // Reset client to force getting new rotated key
          resetGroqClient();
          retryCount++;
          continue; // Retry with new key
        }
        
        // Try partial JSON recovery from response
        try {
          const m = rawContent.match(/\{[\s\S]*\}/);
          if (m) {
            console.log("[CHAT] Recovered partial JSON from response");
            const recovered = JSON.parse(m[0]);
            return res.json({ success:true, ...sanitize(recovered, ctx.detectedProgram, ctx.faqVisual), sessionContext: ctx.newSessionContext });
          }
        } catch (recoveryErr) {
          console.log("[CHAT] JSON recovery failed:", recoveryErr.message);
        }
        
        if (groqErr.message?.includes("not configured")) {
          return res.json({ success:false, ...FALLBACK, reply:"GROQ_API_KEYS is not configured. Please add it to .env file." });
        }
        
        // Return user-friendly error with fallback
        console.error("[CHAT] Returning fallback response due to error");
        return res.json({ success:true, ...FALLBACK, reply: "I'm processing that now. Could you repeat your question?" });
      }
    }
    
    // All retries exhausted
    console.error("❌ [CHAT] All retry attempts exhausted");
    return res.json({ success:true, ...FALLBACK, reply: "Let me check that. Could you try asking again?" });
    
  } catch (err) {
    // ULTIMATE SAFETY NET: Never throw 500 error, always return valid response
    console.error("💥 Chat route FATAL error:", err.message);
    console.error("Stack trace:", err.stack);
    return res.json({ success:true, ...FALLBACK, reply: "I'm processing your request. Please ask your question again." });
  }
});

export default router;
