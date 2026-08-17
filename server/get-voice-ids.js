/**
 * Get proper voice IDs from ElevenLabs API
 */
import "dotenv/config";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

async function getVoiceIds() {
  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

  try {
    const voices = await client.voices.getAll();

    console.log("\n📋 Full Voice Object Structure:\n");
    console.log(JSON.stringify(voices.voices[0], null, 2));

    console.log("\n\n📢 All Voice IDs:\n");
    voices.voices.forEach((v) => {
      // Try different possible properties for voice_id
      const id = v.voice_id || v.voiceId || v.id || v.publicOwnerId;
      console.log(`${v.name}: ${id}`);
    });

  } catch (err) {
    console.error("Error:", err.message);
  }
}

getVoiceIds();
