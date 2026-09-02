/**
 * FAQ Search — finds the Q&A entries that best match what the user asked.
 *
 * This is deliberately NOT machine learning. It is a scoring function over the
 * questions written in server/database/faq.js:
 *
 *   1. Normalise both sides (lowercase, strip punctuation/accents).
 *   2. Expand synonyms so "paisa", "kati", "shulk" and "cost" all mean "fee".
 *   3. Score every FAQ with BM25-style term weighting, so rare words like
 *      "scholarship" count far more than common ones like "the" or "college".
 *   4. Give partial credit for shared word-prefixes, which is what makes
 *      Romanised Nepali work ("ghuma" / "ghumna" / "ghumne" all match).
 *
 * The winning entries get pasted into the prompt as verified facts. Editing
 * faq.js and restarting the server is all it takes to teach the assistant
 * something new — there is no training step.
 */
import { loadFaqs } from "../database/faq.js";
import { onChange } from "./collegeStore.js";
import { allPassages as pdfPassages } from "./pdfStore.js";

// ─── Normalisation ────────────────────────────────────────────────────────
// Keep Devanagari (ऀ-ॿ) so Nepali/Hindi questions survive.
function normalise(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // strip accents
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Words that carry no signal — dropped so they can't dilute a match.
const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","am","do","does","did","of","to",
  "have","has","had","having","been","being","provide","provides","providing",
  "in","on","at","for","with","and","or","if","it","its","this","that","there",
  "i","you","we","my","me","your","can","could","should","would","will","shall",
  "what","whats","how","when","where","which","who","whom","why","tell","give",
  "please","about","from","get","got","want","need","know","any","some","much",
  "many","more","also","just","ho","cha","chha","ke","k","hai","ka","ki","ko",
  "kya","mai","me","hu","hun","garne","garna","huncha",
  // generic quantity/question words — meaning comes from the noun beside them
  "kati","kitna","katti","kaiya","milcha","paincha","parcha","lagcha","lagta",
]);

// Domain synonyms → one canonical token. Left side is what people type
// (English, Nepali, Romanised Nepali, Hindi); right side is the concept.
const SYNONYMS = {
  // money
  fees: "fee", cost: "fee", costs: "fee", tuition: "fee", price: "fee",
  charge: "fee", charges: "fee", paisa: "fee", paise: "fee", shulk: "fee",
  kharcha: "fee", rupees: "fee", rs: "fee",
  npr: "fee", nrs: "fee", payment: "fee", pay: "fee",
  // NOTE: "kati" / "kitna" are NOT money words — they mean "how much/how many"
  // and appear in questions like "kati barsa" (how many years). They are stop
  // words below; the accompanying noun (paisa, fee, barsa) carries the meaning.
  // admission
  admissions: "admission", apply: "admission", applying: "admission",
  enroll: "admission", enrol: "admission", enrolment: "admission",
  join: "admission", joining: "admission", bharti: "admission",
  bharna: "admission", bharthi: "admission", registration: "admission",
  register: "admission", form: "admission",
  // programmes
  programs: "program", programme: "program", programmes: "program",
  course: "program", courses: "program", degree: "program", padhai: "program",
  study: "program", studies: "program", subject: "module", subjects: "module",
  modules: "module", syllabus: "module", curriculum: "module",
  // named programmes
  csai: "csai", ai: "csai", artificial: "csai",
  bit: "bit",
  // people / careers
  jobs: "career", job: "career", careers: "career", placement: "career",
  placements: "career", employment: "career", salary: "career",
  internship: "career", hire: "career", hiring: "career",
  // money help
  scholarships: "scholarship", discount: "scholarship", waiver: "scholarship",
  concession: "scholarship", aid: "scholarship",
  // requirements
  eligible: "eligibility", requirement: "eligibility",
  requirements: "eligibility", qualification: "eligibility",
  qualifications: "eligibility", criteria: "eligibility", cgpa: "eligibility",
  gpa: "eligibility", marks: "eligibility", grade: "eligibility",
  // documents
  documents: "document", papers: "document", paperwork: "document",
  certificate: "document", certificates: "document", marksheet: "document",
  // contact / place
  phone: "contact", number: "contact", email: "contact", call: "contact",
  address: "location", located: "location", kaha: "location", where: "location",
  campus: "campus", visit: "campus", ghum: "campus", tour: "campus",
  // university
  bcu: "bcu", birmingham: "bcu", university: "university",
  // duration
  duration: "duration", years: "duration", year: "duration", long: "duration",
  semester: "semester", sem: "semester",
  // hostel/transport style questions people always ask
  hostel: "hostel", accommodation: "hostel", transport: "transport",
  bus: "transport", scholarship_exam: "scholarship",
};

// Very light stemmer for the handful of English endings that matter here.
function stem(token) {
  if (token.length > 4 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.length > 3 && token.endsWith("es"))  return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s"))   return token.slice(0, -1);
  return token;
}

function tokenise(text) {
  const out = [];
  for (const raw of normalise(text).split(" ")) {
    if (!raw || STOP_WORDS.has(raw)) continue;
    const mapped = SYNONYMS[raw] || SYNONYMS[stem(raw)] || stem(raw);
    if (mapped && !STOP_WORDS.has(mapped)) out.push(mapped);
  }
  return out;
}

// ─── Index (built once at startup) ────────────────────────────────────────
// K1 is deliberately low. Term frequency here is an artefact of how many
// alternate phrasings an entry happens to list, not evidence of relevance —
// with the usual 1.2–2.0 a generic word repeated across several `alt` lines
// ("facilities") outranks a rare, specific one ("hostel"). Saturating early
// lets IDF — i.e. how distinctive the word is — decide the ranking.
const BM25_K1 = 0.4;   // term-frequency saturation
const BM25_B  = 0.5;   // length normalisation

// Two separate surfaces per entry:
//   question surface — q + alt + tags. This is what an entry is *about*.
//   answer surface   — the answer body, used only as a weak tiebreaker.
// They are kept apart because a word appearing incidentally in an answer
// ("...or write to admissions...") must never be enough to match a question
// on its own, or "write me a poem" starts matching the contact entry.
// Partial credit when no exact token matches — catches Romanised spelling
// drift such as ghuma/ghumna/ghumne or scholarship/scholarships.
function prefixScore(queryTerm, docTerms) {
  if (queryTerm.length < 4) return 0;
  let best = 0;
  for (const t of docTerms) {
    if (t.length < 4) continue;
    let n = 0;
    while (n < t.length && n < queryTerm.length && t[n] === queryTerm[n]) n++;
    if (n >= 4) best = Math.max(best, n / Math.max(t.length, queryTerm.length));
  }
  return best;
}

/**
 * Build a searchable index over a list of FAQ entries.
 *
 * Exported as a factory so a single server can hold one index per college
 * (see the multi-tenant note in faq.js) and so the matching can be tested
 * against generated data without touching the real content file.
 */
export function buildFaqIndex(entries) {
  // Two separate surfaces per entry:
  //   question surface — q + alt + tags. This is what an entry is *about*.
  //   answer surface   — the answer body, used only as a weak tiebreaker.
  // They are kept apart because a word appearing incidentally in an answer
  // ("...or write to admissions...") must never be enough to match a question
  // on its own, or "write me a poem" starts matching the contact entry.
  const index = entries.map((entry, i) => {
    const questionText = [entry.q, ...(entry.alt || [])].join(" ");
    const tagText      = (entry.tags || []).join(" ");
    const qTokens = [...tokenise(questionText), ...tokenise(tagText)];
    const aTokens = tokenise(entry.a).slice(0, 40);

    const tf = new Map();
    for (const t of qTokens) tf.set(t, (tf.get(t) || 0) + 1);
    const atf = new Map();
    for (const t of aTokens) atf.set(t, (atf.get(t) || 0) + 1);

    // Cache the key list — recomputing it per query was the main cost at scale
    return { i, entry, tf, atf, terms: [...tf.keys()], length: qTokens.length };
  });

  const avgLength = index.reduce((s, d) => s + d.length, 0) / (index.length || 1);

  const docFreq = new Map();
  for (const d of index) {
    for (const term of d.terms) docFreq.set(term, (docFreq.get(term) || 0) + 1);
  }

  // Pre-compute IDF per term instead of recalculating inside the scoring loop
  const idfCache = new Map();
  for (const [term, df] of docFreq) {
    idfCache.set(term, Math.log(1 + (index.length - df + 0.5) / (df + 0.5)));
  }
  const maxIdf = Math.log(1 + (index.length + 0.5) / 0.5); // unseen term
  const idf = (term) => idfCache.get(term) ?? maxIdf;

  // Term → documents containing it. Lets a query touch only the handful of
  // entries that share a word with it, instead of scanning every entry.
  const postings = new Map();
  for (const d of index) {
    for (const term of d.terms) {
      let list = postings.get(term);
      if (!list) postings.set(term, (list = []));
      list.push(d);
    }
  }

  function search(message, { limit = 4, minScore = 1.2, minCoverage = 0 } = {}) {
    const queryTerms = tokenise(message);
    if (queryTerms.length === 0 || index.length === 0) return [];

    // Candidates = entries sharing at least one query term. Anything else
    // could only score via a prefix near-miss, so also pull in entries whose
    // terms share a 4-char prefix with a query term.
    const candidates = new Set();
    for (const term of queryTerms) {
      const exact = postings.get(term);
      if (exact) for (const d of exact) candidates.add(d);
      if (term.length >= 4) {
        const pre = term.slice(0, 4);
        for (const [t, list] of postings) {
          if (t.length >= 4 && t.startsWith(pre)) for (const d of list) candidates.add(d);
        }
      }
    }

    const scored = [];
    for (const doc of candidates) {
      let score = 0;
      let questionHits = 0;

      for (const term of queryTerms) {
        const f = doc.tf.get(term) || 0;
        if (f > 0) {
          const norm = 1 - BM25_B + BM25_B * (doc.length / (avgLength || 1));
          score += idf(term) * ((f * (BM25_K1 + 1)) / (f + BM25_K1 * norm));
          questionHits++;
        } else {
          const p = prefixScore(term, doc.terms);
          if (p > 0) {
            score += idf(term) * p * 0.5; // half credit for near-misses
            questionHits++;
          } else if (doc.atf.has(term)) {
            score += idf(term) * 0.15;    // faint credit; cannot qualify alone
          }
        }
      }

      // An entry only qualifies if the question itself matched — answer-body
      // coincidences are tiebreakers, never the reason a match happens.
      if (questionHits > 0 && score >= minScore) {
        // Share of the user's meaningful words this entry actually matched.
        // Unlike the raw BM25 score this does not shrink as the corpus shrinks,
        // which matters when a college has uploaded only one small PDF.
        scored.push({ entry: doc.entry, score, coverage: questionHits / queryTerms.length });
      }
    }

    if (minCoverage > 0) {
      const kept = scored.filter(s => s.coverage >= minCoverage);
      return kept.sort((a, b) => b.score - a.score).slice(0, limit);
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  return { search, size: index.length };
}

// Index over the active college's Q&A, rebuilt whenever that content changes
// so admin-panel edits take effect immediately (a rebuild is ~36ms even at
// 2,000 entries, so doing it eagerly costs nothing).
let activeIndex = buildFaqIndex(loadFaqs());

// Passages extracted from uploaded PDFs. Indexed with the same scorer by
// mapping each passage onto the {q, a} shape: the passage text is both what
// we match against and what we quote back.
let pdfIndex = buildFaqIndex([]);

function rebuildAll() {
  activeIndex = buildFaqIndex(loadFaqs());
  try {
    const passages = pdfPassages();
    pdfIndex = buildFaqIndex(passages.map(p => ({
      q: p.text,
      a: p.text,
      alt: [],
      tags: [],
      _source: { title: p.title, page: p.page, docId: p.docId },
    })));
  } catch (err) {
    console.warn("[PDF] could not rebuild document index:", err.message);
    pdfIndex = buildFaqIndex([]);
  }
}
onChange(rebuildAll);
rebuildAll(); // initial build, including any already-uploaded PDFs

/**
 * Best matching passages from uploaded PDFs.
 *
 * The threshold is LOWER than the Q&A search, not higher, which is
 * counter-intuitive. BM25 normalises by document length, and a PDF passage is
 * a whole paragraph while a Q&A entry is one short question — so the same
 * degree of relevance scores far lower here. Measured on a real upload:
 * relevant questions scored 0.96-2.09, unrelated ones 0.00-0.52, so 0.8 sits
 * in the gap. Re-check this if the chunk size ever changes.
 */
export function searchDocuments(message, { limit = 3, minCoverage = 0.5 } = {}) {
  // Filter on coverage, not raw score. BM25 scores depend on how many
  // documents exist, so an absolute threshold silently stops matching when a
  // college has uploaded only one or two PDFs — measured at 0.58 for a
  // perfect single-passage match, below any sensible fixed cut-off.
  return pdfIndex.search(message, { limit, minScore: 0, minCoverage }).map(hit => ({
    text: hit.entry.a,
    score: hit.score,
    title: hit.entry._source?.title || "Document",
    page: hit.entry._source?.page ?? null,
  }));
}

export function documentPassageCount() {
  return pdfIndex.size;
}

/**
 * Find the FAQ entries that best answer `message`.
 * Returns [{ entry, score }] sorted best-first, empty when nothing is close.
 */
export function searchFaqs(message, options) {
  return activeIndex.search(message, options);
}

export function faqCount() {
  return activeIndex.size;
}
