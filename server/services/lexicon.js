/**
 * Domain lexicon — the college words that machines get wrong.
 *
 * ONE list, used at BOTH ends of the conversation:
 *
 *   • LISTENING  (stt.js)      seeds Whisper so it writes "BCU", not "bee see you"
 *   • SPEAKING   (speechText)  spells them out so the voice says them correctly
 *
 * They are kept together because they are the same problem: these tokens are
 * not ordinary words, so a model trained on ordinary language mangles them in
 * both directions. Fixing one end without the other just moves the error.
 *
 * Every term here was found by scanning the real content in
 * server/colleges/<slug>/faq.json and data.json — not guessed.
 */

// ─── Letter names, so acronyms can be spelled per language ────────────────
// Generated rather than hand-listed: writing "BCU → बी सी यू" by hand for
// every term is where typos live, and a new acronym would silently miss out.
const LETTER = {
  en: null, // English voices read bare capitals correctly: "B C U"
  ne: {
    A: "ए", B: "बी", C: "सी", D: "डी", E: "ई", F: "एफ", G: "जी", H: "एच",
    I: "आई", J: "जे", K: "के", L: "एल", M: "एम", N: "एन", O: "ओ", P: "पी",
    Q: "क्यू", R: "आर", S: "एस", T: "टी", U: "यू", V: "भी", W: "डब्ल्यू",
    X: "एक्स", Y: "वाई", Z: "जेड",
  },
};
LETTER.hi = LETTER.ne; // same Devanagari letter names

/**
 * Acronyms that must be read letter by letter.
 *
 * NOT included on purpose:
 *   RAIN, IELTS, TOEFL, PTE — said as words, spelling them would be wrong
 *   NOT, OR, AM, PM         — ordinary words that happen to appear capitalised
 *   NPR, GBP, Rs            — handled as currency, which reads better
 */
export const SPELL_OUT = [
  // college + qualifications
  "BCU", "CSAI", "BIT", "BSc", "MSc", "BBA", "MBA", "BA", "BE",
  // admissions
  "NEB", "CGPA", "GPA", "EPT", "SEE", "TU", "HSEB",
  // student life / finance
  "SSRC", "ECA", "CCA", "TDS", "VAT",
  // general tech + misc that appear in answers
  "AI", "ML", "IT", "BI", "CV", "MVP", "PDF", "QS", "UCAS", "HOD", "UK", "USA",
];

/** Multi-word expansions where letters would be worse than words. */
export const EXPANSIONS = {
  en: {
    MoEST: "Ministry of Education, Science and Technology",
    "10+2": "ten plus two",
    "+2": "plus two",
    "A-Level": "A Level",
    "A-Levels": "A Levels",
    Hons: "Honours",
  },
  ne: {
    MoEST: "शिक्षा मन्त्रालय",
    "10+2": "प्लस टु",
    "+2": "प्लस टु",
    "A-Level": "ए लेभल",
    "A-Levels": "ए लेभल",
    Hons: "अनर्स",
  },
};
EXPANSIONS.hi = { ...EXPANSIONS.ne, MoEST: "शिक्षा मंत्रालय" };

/** Domain-name labels a voice reads badly. Anything absent is read as written. */
export const DOMAIN_LABELS = {
  edu: "e d u", np: "n p", ac: "a c", uk: "u k", co: "c o",
  org: "org", com: "com", net: "net", io: "i o", info: "info",
};

/**
 * Spell one token for a language. "BCU" → "B C U" / "बी सी यू".
 * Unknown letters (digits, punctuation) pass through unchanged.
 */
export function spellOut(token, lang = "en") {
  const table = LETTER[lang];
  const chars = String(token).toUpperCase().split("");
  if (!table) return chars.join(" ");
  return chars.map(c => table[c] || c).join(" ");
}

/**
 * Vocabulary hint for Whisper.
 *
 * Whisper accepts a `prompt` that biases decoding toward expected words.
 * Without it "सनवे कलेज" comes back as "सन्नुबे कोलेज" and the college name,
 * programme codes and fee words are mangled — which then matches no Q&A at all.
 *
 * Terms are drawn from the live college data so this stays correct for any
 * college, not just Sunway.
 */
export function buildVocabulary({ collegeName, shortName, programs = [], extra = [] } = {}, lang = "en") {
  const common = {
    ne: "शुल्क, भर्ना, छात्रवृत्ति, कलेज, कार्यक्रम, प्रवेश, योग्यता, छात्रावास, विषय, सेमेस्टर, प्रमाणपत्र, अंकपत्र, समयसीमा, सुविधा",
    hi: "शुल्क, प्रवेश, छात्रवृत्ति, कॉलेज, कार्यक्रम, पाठ्यक्रम, योग्यता, छात्रावास, सेमेस्टर, प्रमाणपत्र, अंकपत्र, सुविधा",
    en: "fee, admission, scholarship, eligibility, semester, prospectus, module, deadline, hostel, transcript, facilities",
  }[lang] || "";

  return [
    collegeName,
    shortName,
    programs.join(", "),
    // The acronyms are the highest-value part: these are exactly the tokens
    // Whisper invents spellings for when it has no hint.
    SPELL_OUT.join(", "),
    "Birmingham City University, IELTS, TOEFL, Kathmandu, Maitidevi, RAIN",
    common,
  ].filter(Boolean).join(". ").slice(0, 880); // Whisper caps the prompt at ~224 tokens
}
