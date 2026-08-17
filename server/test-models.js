/**
 * Test available Groq models
 * Run: node server/test-models.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const MODELS_TO_TEST = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

async function testModel(client, modelName) {
  try {
    console.log(`\n🧪 Testing model: ${modelName}`);
    const start = Date.now();
    
    const completion = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: "Respond in JSON with a 'reply' field." },
        { role: "user", content: "Say hello" },
      ],
      temperature: 0.5,
      max_tokens: 50,
      response_format: { type: "json_object" },
    });
    
    const duration = Date.now() - start;
    const response = completion.choices[0]?.message?.content;
    
    console.log(`✅ Success (${duration}ms)`);
    console.log(`   Response: ${response?.slice(0, 80)}...`);
    return true;
    
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("\n🔍 Testing Groq Models...\n");
  console.log(`Current .env model: ${process.env.GROQ_MODEL || "not set"}\n`);
  
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    console.error("❌ GROQ_API_KEY not configured");
    process.exit(1);
  }
  
  const client = new Groq({ apiKey });
  const results = {};
  
  for (const model of MODELS_TO_TEST) {
    results[model] = await testModel(client, model);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit delay
  }
  
  console.log("\n\n📊 Results Summary:");
  console.log("─".repeat(60));
  
  Object.entries(results).forEach(([model, success]) => {
    console.log(`${success ? "✅" : "❌"} ${model}`);
  });
  
  const workingModels = Object.entries(results)
    .filter(([_, success]) => success)
    .map(([model]) => model);
  
  if (workingModels.length > 0) {
    console.log("\n💡 Recommended models for your .env file:");
    workingModels.forEach(model => console.log(`   GROQ_MODEL=${model}`));
  }
  
  console.log("\n");
}

main();
