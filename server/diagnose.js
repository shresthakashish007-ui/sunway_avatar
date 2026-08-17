/**
 * Diagnostic Tool - Check all systems
 * Run: node server/diagnose.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

console.log("\n🔍 Sunway Avatar Diagnostics\n");
console.log("=".repeat(60));

// 1. Check Environment Variables
console.log("\n1️⃣  Environment Variables:");
const envVars = {
  "GROQ_API_KEY":          process.env.GROQ_API_KEY,
  "GROQ_MODEL":            process.env.GROQ_MODEL,
  "ELEVENLABS_API_KEY":    process.env.ELEVENLABS_API_KEY,
  "ELEVENLABS_VOICE_ID":   process.env.ELEVENLABS_VOICE_ID,
  "PORT":                   process.env.PORT,
};

for (const [key, value] of Object.entries(envVars)) {
  if (!value) {
    console.log(`   ❌ ${key}: NOT SET`);
  } else if (key.includes("KEY") && value.length > 20) {
    console.log(`   ✅ ${key}: ${value.substring(0, 10)}...${value.slice(-4)}`);
  } else {
    console.log(`   ✅ ${key}: ${value}`);
  }
}

// 2. Test Groq Connection
console.log("\n2️⃣  Groq API Test:");
try {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  
  console.log(`   Testing model: ${model}`);
  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Respond in JSON with a 'reply' field." },
      { role: "user", content: "Say test" },
    ],
    temperature: 0.5,
    max_tokens: 50,
    response_format: { type: "json_object" },
  });
  
  const response = completion.choices[0]?.message?.content;
  console.log(`   ✅ Groq API working`);
  console.log(`   Response: ${response?.slice(0, 60)}...`);
} catch (err) {
  console.log(`   ❌ Groq API failed: ${err.message}`);
}

// 3. Check imports
console.log("\n3️⃣  Checking Server Imports:");
try {
  const { buildContext } = await import("./services/sunwayKnowledge.js");
  const { buildSunwayPrompt } = await import("./prompts/sunwayPrompt.js");
  console.log(`   ✅ sunwayKnowledge.js loaded`);
  console.log(`   ✅ sunwayPrompt.js loaded`);
  
  // Test buildContext
  const ctx = buildContext("Hello", [], {});
  console.log(`   ✅ buildContext() works`);
  
  // Test buildSunwayPrompt
  const prompt = buildSunwayPrompt(ctx);
  console.log(`   ✅ buildSunwayPrompt() works`);
  console.log(`   Prompt length: ${prompt.length} chars`);
  
} catch (err) {
  console.log(`   ❌ Import failed: ${err.message}`);
  console.log(`   Stack: ${err.stack}`);
}

// 4. Test full chat flow
console.log("\n4️⃣  Testing Full Chat Flow:");
try {
  const { buildContext } = await import("./services/sunwayKnowledge.js");
  const { buildSunwayPrompt } = await import("./prompts/sunwayPrompt.js");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  
  const message = "What programs do you offer?";
  const ctx = buildContext(message, [], {});
  const systemPrompt = buildSunwayPrompt(ctx);
  
  console.log(`   Testing with: "${message}"`);
  
  const completion = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    temperature: 0.35,
    max_tokens: 700,
    response_format: { type: "json_object" },
  });
  
  const rawContent = completion.choices[0]?.message?.content || "";
  const parsed = JSON.parse(rawContent);
  
  console.log(`   ✅ Full flow successful`);
  console.log(`   Reply: ${parsed.reply?.slice(0, 80)}...`);
  console.log(`   Language: ${parsed.language}`);
  console.log(`   Emotion: ${parsed.emotion}`);
  console.log(`   Animation: ${parsed.animation}`);
  
} catch (err) {
  console.log(`   ❌ Full flow failed: ${err.message}`);
  console.log(`   Stack: ${err.stack?.split("\n").slice(0, 5).join("\n")}`);
}

// 5. Summary
console.log("\n" + "=".repeat(60));
console.log("📊 Diagnostic Summary:");
console.log("\nIf all tests pass ✅, your backend should work fine.");
console.log("If any test fails ❌, check the error details above.\n");
console.log("To start the server: npm run server");
console.log("To start the frontend: npm run dev\n");
