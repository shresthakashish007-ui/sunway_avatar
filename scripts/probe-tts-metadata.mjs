/**
 * Probe what timing metadata Edge TTS actually returns.
 *
 * Run:  node scripts/probe-tts-metadata.mjs
 *
 * Kept in the repo because the answer decides how lip-sync works: if Edge
 * sends Viseme events we can drive the mouth phoneme-by-phoneme; if it only
 * sends WordBoundary we distribute shapes across each word instead.
 */
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;

function probe(voice, text, locale, withViseme) {
  return new Promise(async (resolve) => {
    const tts = new MsEdgeTTS();
    const events = [];
    let bytes = 0;
    let done = false;

    const finish = (note) => {
      if (done) return;
      done = true;
      const types = {};
      events.forEach(e => { types[e.Type] = (types[e.Type] || 0) + 1; });
      console.log(`${voice}  viseme=${withViseme}  ${note}`);
      console.log(`   audio: ${(bytes / 1024).toFixed(1)} KB`);
      console.log(`   event types: ${JSON.stringify(types)}`);
      for (const e of events.slice(0, 5)) {
        console.log(`     ${JSON.stringify(e)}`.slice(0, 200));
      }
      console.log();
      try { tts.close(); } catch {}
      resolve(events);
    };

    const timer = setTimeout(() => finish("(timed out)"), 15000);

    try {
      await tts.setMetadata(voice, FORMAT, {
        wordBoundaryEnabled: true,
        sentenceBoundaryEnabled: false,
      });

      const viseme = withViseme ? '<mstts:viseme type="redlips_front"/>' : "";
      const ssml =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
        `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">` +
        `<voice name="${voice}">${viseme}${text}</voice></speak>`;

      const { audioStream, metadataStream } = tts.rawToStream(ssml);

      audioStream.on("data", (c) => { bytes += c.length; });
      audioStream.on("end", () => { clearTimeout(timer); finish("(ok)"); });
      audioStream.on("error", (e) => { clearTimeout(timer); finish(`(audio error: ${e.message})`); });

      if (!metadataStream) {
        console.log(`${voice}: NO metadata stream returned`);
      } else {
        metadataStream.on("data", (c) => {
          for (const line of c.toString().split("\n")) {
            if (!line.trim()) continue;
            try {
              const j = JSON.parse(line);
              for (const m of j.Metadata || []) events.push(m);
            } catch { /* partial chunk */ }
          }
        });
      }
    } catch (err) {
      clearTimeout(timer);
      finish(`(setup failed: ${err.message})`);
    }
  });
}

await probe("en-US-JennyNeural", "Hello, the total fee is twelve lakh rupees.", "en-US", true);
await probe("en-US-JennyNeural", "Hello, the total fee is twelve lakh rupees.", "en-US", false);
await probe("ne-NP-HemkalaNeural", "नमस्ते! सनवे कलेजमा स्वागत छ।", "ne-NP", true);
await probe("en-IN-NeerjaNeural", "CSAI ko fee bah'ra lakh ho.", "en-IN", true);
process.exit(0);
