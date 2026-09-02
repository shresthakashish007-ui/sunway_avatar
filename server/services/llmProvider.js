/**
 * LLM provider — local model first, Groq as the safety net.
 *
 * WHY THIS EXISTS
 * ---------------
 * Groq's free tier is generous but it is not a contract: the limits can change
 * and the account is not ours. `openai/gpt-oss-20b` is Apache 2.0 open weights,
 * so the SAME model can run on the college's own machine with no key, no quota
 * and no internet. That is the only genuinely permanent answer.
 *
 * Rather than swapping one dependency for another, this tries them in order:
 *
 *   1. Local Ollama  — free forever, unlimited, works offline
 *   2. Groq          — used when Ollama isn't running or fails
 *
 * So the kiosk runs free and self-contained, while a laptop with no GPU (or a
 * machine where Ollama was never installed) keeps working exactly as before.
 * Neither one is required for the app to function.
 *
 * To go fully local:
 *   1. Install Ollama       https://ollama.com/download
 *   2. ollama pull gpt-oss:20b
 *   3. Set LOCAL_LLM=on in .env
 * Nothing else changes — same model, same prompts, same JSON contract.
 */
import Groq from "groq-sdk";
import keyRotation from "./groqKeyRotation.js";

// ─── Configuration ────────────────────────────────────────────────────────
const LOCAL_ENABLED = /^(1|true|on|yes)$/i.test(process.env.LOCAL_LLM || "");
const LOCAL_URL     = (process.env.LOCAL_LLM_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const LOCAL_MODEL   = process.env.LOCAL_LLM_MODEL || "gpt-oss:20b";
const GROQ_MODEL    = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

// A local model on a busy GPU can take longer than a hosted one. Still bounded,
// because a student watching a blank screen is worse than a fallback answer.
const LOCAL_TIMEOUT_MS = Number(process.env.LOCAL_LLM_TIMEOUT_MS || 25000);
const GROQ_TIMEOUT_MS  = 20000;

// ─── Local availability ───────────────────────────────────────────────────
// Checked rather than assumed, and cached: probing on every message would add
// a round-trip to each reply, and when Ollama is NOT running an unchecked
// request would burn the full timeout before falling back — turning a healthy
// Groq reply into a 25-second wait.
let localUp    = false;
let localCheck = 0;
const HEALTH_TTL_MS      = 30000;  // re-probe a working local model twice a minute
const HEALTH_TTL_DOWN_MS = 60000;  // back off longer when it is down
const HEALTH_TIMEOUT_MS  = 1500;

async function isLocalAvailable() {
  if (!LOCAL_ENABLED) return false;

  const ttl = localUp ? HEALTH_TTL_MS : HEALTH_TTL_DOWN_MS;
  if (Date.now() - localCheck < ttl) return localUp;
  localCheck = Date.now();

  try {
    const res = await fetch(`${LOCAL_URL}/api/tags`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Being reachable is not enough — the model has to actually be pulled.
    // Ollama reports "gpt-oss:20b"; match on the name before the tag so
    // "gpt-oss:20b-q4" and friends still count.
    const { models = [] } = await res.json();
    const want = LOCAL_MODEL.split(":")[0];
    const has  = models.some(m => String(m?.name || "").split(":")[0] === want);

    if (!has && localUp !== false) {
      console.warn(`[LLM] Ollama is running but "${LOCAL_MODEL}" is not pulled — run: ollama pull ${LOCAL_MODEL}`);
    }
    if (has && !localUp) console.log(`[LLM] ✅ Local model available: ${LOCAL_MODEL}`);

    localUp = has;
  } catch {
    if (localUp) console.warn("[LLM] local model went away — falling back to Groq");
    localUp = false;
  }
  return localUp;
}

// ─── Local call (Ollama) ──────────────────────────────────────────────────
// Uses Ollama's native /api/chat with format:"json" rather than the
// OpenAI-compatible endpoint, because JSON-mode support is consistent there
// across versions and this whole app depends on getting a parseable object.
async function callLocal({ messages, maxTokens }) {
  const res = await fetch(`${LOCAL_URL}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    signal:  AbortSignal.timeout(LOCAL_TIMEOUT_MS),
    body: JSON.stringify({
      model:  LOCAL_MODEL,
      messages,
      format: "json",
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: maxTokens,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }

  const data = await res.json();
  const content = data?.message?.content || "";
  if (!content.trim()) throw new Error("Ollama returned an empty reply");
  return content;
}

// ─── Hosted call (Groq) ───────────────────────────────────────────────────
let groqClient = null;
let groqKey    = null;

function getGroqClient() {
  const apiKey = keyRotation.getCurrentKey();
  if (!groqClient || groqKey !== apiKey) {
    groqClient = new Groq({ apiKey });
    groqKey = apiKey;
    console.log("🔄 Created new Groq client with rotated API key");
  }
  return groqClient;
}

/** Drop the cached client so the next call picks up a freshly rotated key. */
export function resetGroqClient() {
  groqClient = null;
  groqKey = null;
}

// gpt-oss-* burn completion tokens "reasoning" before emitting a single
// character — ~220 by default, which the student hears as dead air. "low" cuts
// that to ~14 with no measurable quality loss on these short, grounded replies.
function reasoningOption(model) {
  return /gpt-oss/i.test(model) ? { reasoning_effort: "low" } : {};
}

async function callGroq({ messages, maxTokens }) {
  const completion = await getGroqClient().chat.completions.create({
    model:           GROQ_MODEL,
    messages,
    temperature:     0.3,
    max_tokens:      maxTokens,
    response_format: { type: "json_object" },
    ...reasoningOption(GROQ_MODEL),
  }, { timeout: GROQ_TIMEOUT_MS, maxRetries: 1 });

  return completion.choices[0]?.message?.content || "";
}

// ─── Public API ───────────────────────────────────────────────────────────
/**
 * Ask the model for a reply.
 *
 * Returns { content, provider } where provider is "local" or "groq" — the
 * caller needs it to know whether key-rotation stats apply.
 *
 * A local failure is never fatal: it logs and falls through to Groq. A Groq
 * failure throws, so the existing retry/rotation logic in chat.js can handle it.
 */
export async function callLLM({ messages, maxTokens }) {
  if (await isLocalAvailable()) {
    const started = Date.now();
    try {
      const content = await callLocal({ messages, maxTokens });
      console.log(`[LLM] 🏠 local ${LOCAL_MODEL} — ${Date.now() - started}ms`);
      return { content, provider: "local" };
    } catch (err) {
      // Force a re-probe rather than waiting out the cache, so a crashed
      // Ollama doesn't cost every request its full timeout.
      localUp = false;
      localCheck = 0;
      console.warn(`[LLM] local failed (${err.message?.slice(0, 120)}) — using Groq`);
    }
  }

  const content = await callGroq({ messages, maxTokens });
  return { content, provider: "groq" };
}

/** Describes the active setup — printed at boot so the mode is never a guess. */
export function providerStatus() {
  return {
    localEnabled: LOCAL_ENABLED,
    localUrl:     LOCAL_URL,
    localModel:   LOCAL_MODEL,
    groqModel:    GROQ_MODEL,
  };
}

/** One-shot probe used at startup for the banner. Does not affect the cache TTL. */
export async function probeLocal() {
  localCheck = 0;
  return isLocalAvailable();
}
