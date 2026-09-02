/**
 * Check the word → mouth-shape mapping used by the lip-sync.
 * Run: node scripts/test-visemes.mjs
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const src = fs
  .readFileSync("src/services/visemeTrack.js", "utf8")
  // strip the DEV-only window hook so it runs outside Vite
  .replace(/if \(import\.meta\.env[\s\S]*$/, "");

const tmp = path.resolve("scripts/.viseme-test.tmp.mjs");
fs.writeFileSync(tmp, src);

const { visemesForWord, setTrack, shapeNow, clearTrack } = await import(pathToFileURL(tmp).href);

const words = [
  "Hello", "total", "rupees", "twelve", "shop", "fee", "bahra", "admission",
  "नमस्ते", "सनवे", "कलेजमा", "स्वागत", "हजुरलाई", "शुल्क",
  "B", "C", "12", "?",
];

let bad = 0;
for (const w of words) {
  const v = visemesForWord(w);
  if (!v.length) { bad++; }
  console.log(`  ${(w + "            ").slice(0, 12)} ${v.map(x => x.replace("viseme_", "")).join(" → ")}`);
}

console.log(`\n${words.length} words, ${bad} produced no shape.`);

// ─── Timing: does the right shape appear at the right millisecond? ────────
// Real marks captured from the ne-NP voice speaking the welcome line.
const marks = [
  { word: "नमस्ते",  start: 163,  dur: 500 },
  { word: "सनवे",    start: 1713, dur: 350 },
  { word: "कलेजमा",  start: 2138, dur: 450 },
  { word: "स्वागत",  start: 2613, dur: 413 },
  { word: "छ",       start: 3050, dur: 188 },
];

// Stand-in for the <audio> element: currentTime is in SECONDS.
const fakeAudio = { currentTime: 0 };
console.log(`\nTrack loaded with ${setTrack(marks, fakeAudio)} words\n`);

const probe = (ms) => {
  fakeAudio.currentTime = ms / 1000;
  const s = shapeNow();
  const label = s ? `${s.viseme.replace("viseme_", "")} → ${s.next.replace("viseme_", "")} (${s.blend.toFixed(2)})` : "— silent —";
  console.log(`  ${String(ms).padStart(5)}ms  ${label}`);
};

console.log("Expected: silent before 163ms, shapes through each word, silent in the gaps");
[0, 100, 163, 300, 500, 660, 900, 1200, 1713, 1800, 2000, 2138, 2400, 3100, 3300].forEach(probe);

// Assertions on the two things that must be exact
fakeAudio.currentTime = 0.100; const before = shapeNow();
fakeAudio.currentTime = 0.200; const during = shapeNow();
fakeAudio.currentTime = 1.200; const gap    = shapeNow();
console.log(`\n  before first word (100ms) silent : ${before === null ? "PASS" : "FAIL"}`);
console.log(`  inside first word (200ms) shaped : ${during ? "PASS (" + during.viseme + ")" : "FAIL"}`);
console.log(`  in gap between words (1200ms)    : ${gap === null ? "PASS (silent)" : "FAIL"}`);

clearTrack();
fs.unlinkSync(tmp);
