/**
 * TTS Diagnostic Test Script
 * Run: node server/test-tts.js
 * Tests ElevenLabs API connection and voice synthesis
 */
import "dotenv/config";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "fs";

const TEST_TEXT = "Hello! This is a test of the text-to-speech system.";
const OUTPUT_FILE = "test-output.mp3";

async function testTTS() {
  console.log("\n🔍 TTS Diagnostic Test\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Step 1: Check environment variables
  console.log("1️⃣  Checking environment variables...");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";

  if (!apiKey) {
    console.error("   ❌ ELEVENLABS_API_KEY not found in .env");
    console.log("   💡 Add it to your .env file:");
    console.log("      ELEVENLABS_API_KEY=sk_your_key_here\n");
    process.exit(1);
  }

  if (!apiKey.startsWith("sk_")) {
    console.warn("   ⚠️  API key doesn't start with 'sk_' — might be invalid");
  } else {
    console.log(`   ✅ API Key found: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
  }

  console.log(`   ✅ Voice ID: ${voiceId}`);
  console.log();

  // Step 2: Initialize client
  console.log("2️⃣  Initializing ElevenLabs client...");
  let client;
  try {
    client = new ElevenLabsClient({ apiKey });
    console.log("   ✅ Client initialized\n");
  } catch (err) {
    console.error("   ❌ Failed to initialize client:", err.message);
    process.exit(1);
  }

  // Step 3: Test API connection by fetching voices
  console.log("3️⃣  Testing API connection (fetching voices)...");
  try {
    const voices = await client.voices.getAll();
    console.log(`   ✅ API connected — ${voices.voices.length} voices available`);

    const targetVoice = voices.voices.find(v => v.voice_id === voiceId);
    if (targetVoice) {
      console.log(`   ✅ Target voice found: "${targetVoice.name}" (${targetVoice.voice_id})`);
    } else {
      console.warn(`   ⚠️  Voice ID ${voiceId} not found in account`);
      console.log(`   📋 Available voices:`);
      voices.voices.slice(0, 5).forEach(v => {
        console.log(`      - ${v.name} (${v.voice_id})`);
      });
    }
    console.log();
  } catch (err) {
    console.error("   ❌ API connection failed");
    console.error("      Status:", err.statusCode || err.status || "N/A");
    console.error("      Message:", err.message);
    if (err.body) {
      console.error("      Body:", JSON.stringify(err.body, null, 2));
    }
    console.log("\n   💡 Possible issues:");
    console.log("      - Invalid API key");
    console.log("      - API key expired");
    console.log("      - Network connection problem");
    console.log("      - ElevenLabs service outage\n");
    process.exit(1);
  }

  // Step 4: Test text-to-speech synthesis
  console.log("4️⃣  Testing TTS synthesis...");
  console.log(`   📝 Text: "${TEST_TEXT}"`);
  try {
    const audioStream = await client.textToSpeech.stream(voiceId, {
      text: TEST_TEXT,
      modelId: "eleven_turbo_v2_5",
      voiceSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.0,
        useSpeakerBoost: true,
      },
      outputFormat: "mp3_44100_128",
    });

    console.log("   ✅ Audio stream received");
    console.log(`   💾 Saving to ${OUTPUT_FILE}...`);

    // Write stream to file
    const fileStream = fs.createWriteStream(OUTPUT_FILE);
    const reader = audioStream.getReader();
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(Buffer.from(value));
      totalBytes += value.length;
    }

    fileStream.end();

    await new Promise((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    console.log(`   ✅ Audio saved successfully (${totalBytes} bytes)`);
    console.log(`   🎵 Play it: start ${OUTPUT_FILE}\n`);

  } catch (err) {
    console.error("   ❌ TTS synthesis failed");
    console.error("      Status:", err.statusCode || err.status || "N/A");
    console.error("      Message:", err.message);
    if (err.body) {
      console.error("      Body:", JSON.stringify(err.body, null, 2));
    }
    console.log("\n   💡 Possible issues:");
    console.log("      - Voice ID not found");
    console.log("      - Quota exceeded");
    console.log("      - Invalid voice settings\n");
    process.exit(1);
  }

  // Success
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ All tests passed! TTS is working correctly.\n");
}

testTTS().catch(err => {
  console.error("\n💥 Unexpected error:", err);
  process.exit(1);
});
