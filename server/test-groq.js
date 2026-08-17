/**
 * Test Groq API Connection
 * Run: node server/test-groq.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function testGroq() {
  console.log("\n🧪 Testing Groq API Connection...\n");
  
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.error("❌ GROQ_API_KEY not found in .env file");
    process.exit(1);
  }
  
  if (apiKey === "your_groq_api_key_here") {
    console.error("❌ GROQ_API_KEY is still set to placeholder value");
    process.exit(1);
  }
  
  console.log(`🔑 API Key found: ${apiKey.substring(0, 10)}...${apiKey.slice(-4)}`);
  console.log(`🤖 Model: ${process.env.GROQ_MODEL || "llama-3.3-70b-versatile"}\n`);
  
  try {
    const client = new Groq({ apiKey });
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    
    console.log("📡 Sending test request...");
    
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are a helpful assistant. Respond in JSON format." },
        { role: "user", content: "Say hello in JSON format with a 'reply' field" },
      ],
      temperature: 0.5,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });
    
    const response = completion.choices[0]?.message?.content;
    console.log("✅ Success! Response received:");
    console.log(response);
    
    const parsed = JSON.parse(response);
    console.log("\n✅ JSON parsing successful!");
    console.log("📝 Parsed data:", parsed);
    
    console.log("\n🎉 All tests passed! Your Groq API is working correctly.\n");
    
  } catch (error) {
    console.error("\n❌ Groq API Error:");
    console.error("Message:", error.message);
    console.error("Status:", error.status || "N/A");
    
    if (error.status === 401) {
      console.error("\n💡 Solution: Your API key is invalid or expired.");
      console.error("   Get a new key from: https://console.groq.com/keys");
    } else if (error.status === 429) {
      console.error("\n💡 Solution: Rate limit exceeded. Wait a moment and try again.");
    } else if (error.message?.includes("model")) {
      console.error("\n💡 Solution: The model might not be available. Try a different model:");
      console.error("   - llama-3.3-70b-versatile");
      console.error("   - llama-3.1-8b-instant");
      console.error("   - mixtral-8x7b-32768");
    } else {
      console.error("\n💡 Check your internet connection and try again.");
    }
    
    process.exit(1);
  }
}

testGroq();
