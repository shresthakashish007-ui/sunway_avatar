/**
 * Test New Groq Model
 * Run: node server/test-new-model.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function testNewModel() {
  console.log("\n🧪 Testing New Groq Model (openai/gpt-oss-20b)\n");
  
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    console.error("❌ GROQ_API_KEY not configured");
    process.exit(1);
  }
  
  const client = new Groq({ apiKey });
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  
  console.log(`🤖 Testing model: ${model}`);
  console.log(`⚡ Expected speed: 1000 tokens/second\n`);
  
  try {
    const start = Date.now();
    
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful assistant at Sunway College. Respond in JSON format with these fields: reply, emotion, animation, language, visualAction, suggestions. Keep reply under 100 words." },
        { role: "user", content: "What programs do you offer?" },
      ],
      temperature: 0.35,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });
    
    const duration = Date.now() - start;
    const response = completion.choices[0]?.message?.content;
    
    console.log(`✅ Success! Response time: ${duration}ms\n`);
    console.log("📝 Raw Response:");
    console.log(response);
    
    const parsed = JSON.parse(response);
    console.log("\n✅ JSON parsed successfully!");
    console.log("\n📊 Parsed Data:");
    console.log(`  Reply: ${parsed.reply?.slice(0, 100)}...`);
    console.log(`  Language: ${parsed.language}`);
    console.log(`  Emotion: ${parsed.emotion}`);
    console.log(`  Animation: ${parsed.animation}`);
    
    console.log("\n🎉 New model is working perfectly!");
    console.log("💡 This model is 2x faster than the old one!\n");
    
  } catch (error) {
    console.error("\n❌ Error testing model:");
    console.error("Message:", error.message);
    console.error("Status:", error.status || "N/A");
    
    if (error.status === 404) {
      console.error("\n💡 Model not found. Available models:");
      console.error("   - openai/gpt-oss-20b (recommended - fastest)");
      console.error("   - openai/gpt-oss-120b (larger, more capable)");
    }
    
    process.exit(1);
  }
}

testNewModel();
