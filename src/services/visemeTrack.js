/**
 * Viseme track — turns Edge TTS word timings into a timed sequence of mouth
 * shapes, so the avatar's lips follow the actual words rather than loudness.
 *
 * HOW ACCURATE IS THIS, HONESTLY
 * ------------------------------
 * Edge reports the exact millisecond each WORD starts and how long it lasts.
 * It does NOT give per-phoneme viseme events — that requires <mstts:viseme>,
 * and the free endpoint rejects the connection when you ask for it (measured;
 * see scripts/probe-tts-metadata.mjs).
 *
 * So the word timing is exact, and the phonemes inside each word are derived
 * from its spelling and spread across the word's real duration. For a
 * three-syllable word we therefore know precisely when it starts and ends, and
 * step through its mouth shapes evenly in between.
 *
 * That is a large step up from amplitude alone — the mouth now forms "m" on
 * an m and rounds on an "o" — while being honest that it is not a true
 * phonetic alignment.
 *
 * Loudness still comes from the audio (see speechAnalyser), so quiet words
 * stay small and emphasis still shows. Timing from marks, size from signal.
 */

// ─── Letters → mouth shape ────────────────────────────────────────────────
// Latin. Digraphs are checked first so "sh"/"ch"/"th" don't decay to "s"/"t".
const LATIN_DIGRAPHS = {
  sh: "viseme_CH", ch: "viseme_CH", th: "viseme_TH", ph: "viseme_FF",
  wh: "viseme_U",  ng: "viseme_nn", qu: "viseme_U",  ck: "viseme_kk",
  oo: "viseme_U",  ou: "viseme_U",  ee: "viseme_I",  ea: "viseme_I",
  ai: "viseme_E",  ay: "viseme_E",  oa: "viseme_O",  ow: "viseme_O",
};

const LATIN = {
  a: "viseme_aa", e: "viseme_E",  i: "viseme_I",  o: "viseme_O",  u: "viseme_U",
  b: "viseme_PP", p: "viseme_PP", m: "viseme_PP",
  f: "viseme_FF", v: "viseme_FF", w: "viseme_U",
  d: "viseme_DD", t: "viseme_DD", n: "viseme_nn", l: "viseme_nn",
  k: "viseme_kk", g: "viseme_kk", c: "viseme_kk", q: "viseme_kk", x: "viseme_kk",
  s: "viseme_SS", z: "viseme_SS", j: "viseme_CH",
  r: "viseme_RR", y: "viseme_I",  h: "viseme_aa",
};

// Devanagari, by the consonant/vowel the character represents. Nepali and
// Hindi replies are the whole point of this project, so they are mapped
// properly rather than falling back to a generic open mouth.
const DEVANAGARI = {
  // vowels (independent)
  "अ": "viseme_aa", "आ": "viseme_aa", "इ": "viseme_I", "ई": "viseme_I",
  "उ": "viseme_U", "ऊ": "viseme_U", "ए": "viseme_E", "ऐ": "viseme_E",
  "ओ": "viseme_O", "औ": "viseme_O", "ऋ": "viseme_RR",
  // vowel signs (matras)
  "ा": "viseme_aa", "ि": "viseme_I", "ी": "viseme_I", "ु": "viseme_U",
  "ू": "viseme_U", "े": "viseme_E", "ै": "viseme_E", "ो": "viseme_O",
  "ौ": "viseme_O", "ृ": "viseme_RR",
  // consonants
  "क": "viseme_kk", "ख": "viseme_kk", "ग": "viseme_kk", "घ": "viseme_kk", "ङ": "viseme_nn",
  "च": "viseme_CH", "छ": "viseme_CH", "ज": "viseme_CH", "झ": "viseme_CH", "ञ": "viseme_nn",
  "ट": "viseme_DD", "ठ": "viseme_DD", "ड": "viseme_DD", "ढ": "viseme_DD", "ण": "viseme_nn",
  "त": "viseme_TH", "थ": "viseme_TH", "द": "viseme_DD", "ध": "viseme_DD", "न": "viseme_nn",
  "प": "viseme_PP", "फ": "viseme_FF", "ब": "viseme_PP", "भ": "viseme_PP", "म": "viseme_PP",
  "य": "viseme_I",  "र": "viseme_RR", "ल": "viseme_nn", "व": "viseme_FF",
  "श": "viseme_CH", "ष": "viseme_CH", "स": "viseme_SS", "ह": "viseme_aa",
  "ं": "viseme_nn", "ँ": "viseme_nn",
};

/**
 * Mouth shapes for one word, in order.
 * Consecutive duplicates are collapsed — the mouth does not re-form a shape
 * it is already holding, and keeping them would make it stutter.
 */
export function visemesForWord(word) {
  const out = [];
  const push = (v) => { if (v && out[out.length - 1] !== v) out.push(v); };

  const w = String(word || "").toLowerCase();
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];

    if (DEVANAGARI[ch]) { push(DEVANAGARI[ch]); continue; }
    if (ch === "्") continue;               // virama: joins consonants, no shape

    const pair = w.slice(i, i + 2);
    if (LATIN_DIGRAPHS[pair]) { push(LATIN_DIGRAPHS[pair]); i++; continue; }
    if (LATIN[ch]) { push(LATIN[ch]); continue; }
    // digits and punctuation produce no shape of their own
  }

  return out.length ? out : ["viseme_aa"];
}

// ─── Track state ──────────────────────────────────────────────────────────
let words = [];       // [{ start, end, visemes[] }] in ms
let audioEl = null;
let offsetMs = 0;     // correction between Edge's clock and playback position

/**
 * Attach timings for the clip now playing.
 * `marks` is [{ word, start, dur }] in milliseconds, straight from the server.
 */
export function setTrack(marks, el) {
  if (!Array.isArray(marks) || !marks.length || !el) return clearTrack();

  words = marks
    .filter(m => m && Number.isFinite(m.start) && Number.isFinite(m.dur))
    .map(m => ({
      start: m.start,
      end: m.start + Math.max(m.dur, 40),
      visemes: visemesForWord(m.word),
    }))
    .sort((a, b) => a.start - b.start);

  audioEl = el;

  // Edge counts from the start of synthesis; the element counts from the start
  // of playback. In practice these line up, but the first word's offset is a
  // small lead-in that would otherwise show as an early mouth movement.
  offsetMs = 0;
  return words.length;
}

export function clearTrack() {
  words = [];
  audioEl = null;
  return 0;
}

export function hasTrack() {
  return words.length > 0 && !!audioEl;
}

/**
 * The mouth shape for this instant, or null when there is no track or the
 * playhead is between words (a genuine pause — the mouth should close).
 *
 * Returns { viseme, next, blend } so the caller can crossfade between the
 * current shape and the one coming, instead of snapping between them.
 */
export function shapeNow() {
  if (!hasTrack()) return null;

  const t = audioEl.currentTime * 1000 - offsetMs;

  // Words are in order and short, so a linear scan from the front is fine and
  // avoids the bookkeeping a cursor would need when the audio is restarted.
  let word = null;
  for (const w of words) {
    if (t >= w.start && t <= w.end) { word = w; break; }
    if (w.start > t) break; // sorted: nothing later can match
  }
  if (!word) return null;   // between words

  const span = word.end - word.start;
  const progress = span > 0 ? (t - word.start) / span : 0;

  const n = word.visemes.length;
  const pos = progress * n;
  const i = Math.min(n - 1, Math.floor(pos));

  return {
    viseme: word.visemes[i],
    next:   word.visemes[Math.min(n - 1, i + 1)],
    blend:  pos - i, // 0..1 through the current phoneme
  };
}

if (import.meta.env?.DEV && typeof window !== "undefined") {
  window.__visemes = { shapeNow, hasTrack, visemesForWord, get words() { return words; } };
}
