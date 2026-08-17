/**
 * List all available ElevenLabs voices
 * Run: node server/list-voices.js
 */
import "dotenv/config";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

async function listVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("❌ ELEVENLABS_API_KEY not set in .env");
    process.exit(1);
  }

  const client = new ElevenLabsClient({ apiKey });

  try {
    const voices = await client.voices.getAll();
    console.log(`\n📢 Available ElevenLabs Voices (${voices.voices.length} total)\n`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    voices.voices.forEach((v, i) => {
      console.log(`${i + 1}. ${v.name}`);
      console.log(`   Voice ID: ${v.voice_id}`);
      console.log(`   Labels: ${v.labels ? Object.entries(v.labels).map(([k, v]) => `${k}:${v}`).join(", ") : "N/A"}`);
      console.log(`   Category: ${v.category || "N/A"}`);
      console.log();
    });

    // Show recommended female voice
    const sarah = voices.voices.find(v => v.name.toLowerCase().includes("sarah"));
    if (sarah) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("💡 Recommended: Use Sarah voice");
      console.log(`   Add to .env: ELEVENLABS_VOICE_ID=${sarah.voice_id}\n`);
    }

  } catch (err) {
    console.error("❌ Failed to fetch voices:", err.message);
    process.exit(1);
  }
}

listVoices();
