/**
 * Sunway Knowledge Service
 * Intent detection → targeted context retrieval → Groq context builder
 * Never sends the full database to Groq — only relevant verified facts.
 */
import db from "../database/sunwayData.js";
import { searchFaqs, searchDocuments } from "./faqSearch.js";

// ─── Intent / Entity Patterns ────────────────────────────────────────────
const patterns = [
  // Programs
  { intent: "csai",       kw: ["csai","ai course","bsc ai","computer science with ai","artificial intelligence","computer science ai","ai ko","ai padhna","ai program","bsc computer"] },
  { intent: "bit",        kw: ["bit","business information technology","business it","business information"] },
  { intent: "programs",   kw: ["course","program","programme","degree","padhai","study","kurs","kun course","available","programs","what programs","ke ke course"] },
  { intent: "compare",    kw: ["vs","versus","difference","better","compare","konsa","koon sa","ai vs bit","bit vs ai","which course"] },

  // Fees
  { intent: "fees",       kw: ["fee","fees","cost","tuition","charge","payment","kitna","kati","shulk","paisa","total fee","year fee","semester fee","rupees","rs","nrs","npr"] },
  { intent: "fee_schedule",kw: ["kab","payment schedule","kadin","when to pay","installment","fee schedule"] },

  // Admission
  { intent: "admission",  kw: ["admission","apply","join","enroll","bharthi","bharna","form","how to join","application","register","lena hai"] },
  { intent: "documents",  kw: ["document","documents","paperwork","required","chahiye","lagcha","checklist","kya kya","k k"] },
  { intent: "eligibility",kw: ["eligible","eligibility","qualification","requirement","cgpa","grade","marks","ielts","english","10+2","a level","neb"] },

  // Financial
  { intent: "scholarship",kw: ["scholarship","छात्रवृत्ति","discount","waiver","free","aid","concession","scholarship milcha"] },

  // University
  { intent: "bcu",        kw: ["bcu","birmingham","birmingham city","university","uk university","foreign university","partner university"] },

  // Placement
  { intent: "placement",  kw: ["placement","job","career","hire","salary","employ","internship","paisa kamau","income","95%","alumni"] },

  // Facilities
  { intent: "rain",       kw: ["rain","incubation","startup","entrepreneur","research","idea","business idea","khul","innovate"] },
  { intent: "innovation_lab", kw: ["lab","innovation lab","laboratory","facility","facilities","innovation","kolaba"] },
  { intent: "student_life", kw: ["student life","club","ssrc","activities","events","council","social","extracurricular"] },
  // "ghum" matches ghuma / ghumna / ghumne — the previous "college ghuma"
  // never fired for the common phrasing "campus ghumna milcha?"
  { intent: "virtual_tour", kw: ["360","virtual tour","panorama","campus tour","explore campus","campus dekhna","tour","visit campus","ghum","virtual","explore","campus view","3d tour"] },

  // Info
  { intent: "contact",    kw: ["contact","phone","number","email","address","kaha","location","where","map","reach","admission office"] },
  { intent: "about",      kw: ["about","sunway","college","who","history","established","affiliation","university cha","kun university","kina sunway","why sunway","who built","who made","kisne banaya","kasle banayo","tumhe kisne","pranam","pranam software","build","created you","made this"] },
  { intent: "why_sunway", kw: ["why sunway","kina sunway","sunway choose","choose sunway","sunway kina","sunway best","what is sunway"] },
  { intent: "advisory",   kw: ["advisory","advisor","academic support","mentor","guidance","help student"] },
  { intent: "modules",    kw: ["module","subject","syllabus","curriculum","course content","sem","semester","k padhni","kya padhte"] },
  { intent: "careers",    kw: ["career","job","banna","become","future","work","profession","scope","what job","k banna"] },
  { intent: "welcome",    kw: ["hello","hi","namaste","namaskar","hey","help","suru","start","yo k ho"] },
];

// Program ids that may be used as a lookup key into db.fees / db.modules.
// sessionContext arrives from the browser, so an unvalidated value could
// otherwise reach through to Object.prototype keys like "constructor".
const KNOWN_PROGRAM_IDS = new Set(db.programs.map(p => p.id));

export function detectIntents(message, sessionContext = {}) {
  const lower = message.toLowerCase();
  const intents = new Set();
  for (const p of patterns) {
    if (p.kw.some(k => lower.includes(k))) intents.add(p.intent);
  }
  // Carry session context
  if (KNOWN_PROGRAM_IDS.has(sessionContext?.activeProgram)) intents.add(sessionContext.activeProgram);
  return [...intents];
}

export function detectProgram(message, sessionContext = {}) {
  const lower = message.toLowerCase();
  if (lower.includes("csai") || lower.includes("ai course") || lower.includes("bsc ai") ||
      lower.includes("computer science with ai") || lower.includes("artificial intelligence") ||
      lower.includes("bsc computer") || lower.includes("ai ko") || lower.includes("ai program")) return "csai";
  if (lower.includes("bit") || lower.includes("business information technology") ||
      lower.includes("business it")) return "bit";
  // Fall back to session
  const fromSession = sessionContext?.activeProgram;
  return KNOWN_PROGRAM_IDS.has(fromSession) ? fromSession : null;
}

/**
 * Work out which script and language the user actually wrote in.
 *
 * Asking the model to "match the user's language" was not reliable — it
 * answered romanised questions in Devanagari and tagged Hindi as Nepali. This
 * is decided in code and stated as a hard instruction instead.
 */
const HINDI_MARKERS  = ["है", "हैं", "कैसे", "कितनी", "कितना", "क्या", "मिलता", "कीजिए", "करें", "आपका", "हूँ", "नहीं"];
const NEPALI_MARKERS = ["छ", "छैन", "कसरी", "कति", "गर्नुहोस्", "हो", "पाइन्छ", "तपाईं", "हुन्छ", "लाग्छ"];
// Latin-script cues. Nepali romanisation vs Hindi romanisation.
// These are matched as WHOLE WORDS — as substrings, "ho" matches inside "who"
// and "cha" inside "teacher", which mis-detected plain English questions.
const ROMAN_NE_MARKERS = [
  // verbs and verb endings — these are what actually appear in real questions
  "cha", "chha", "chaina", "chhaina", "paincha", "painchha", "lagcha", "lagchha",
  "parcha", "parchha", "milcha", "milchha", "huncha", "hunchha", "sakincha",
  "dinu", "garnu", "hunu", "linu", "aaunu", "janu", "herna", "padhna",
  "garne", "garna", "chahincha", "chahiyo", "bhaye", "bhanda", "bhanne",
  // question words and particles
  "kasari", "kati", "kaile", "kina", "kasto", "kun", "kata", "keho",
  "ho", "hos", "hola", "ni", "lagi", "ko", "ma", "bata", "sanga",
  // common nouns that only appear in Nepali phrasing
  "ghumna", "ghumne", "paisa", "kagajat", "bharna", "padhai",
];
const HINGLISH_MARKERS = ["hai", "hain", "kaise", "kaisa", "kitna", "kitni", "kya", "karna", "karein", "sakte", "sakta", "milta", "milti", "chahiye", "bhai", "mein", "aap"];

// Short particles that also occur inside ordinary English sentences, so a
// single one of them is not evidence of Nepali on its own.
const WEAK_ROMAN_NE = new Set(["ko", "ho", "cha", "ma", "ni", "kun"]);

function countWordMarkers(text, markers) {
  const words = new Set(text.toLowerCase().split(/[^a-z]+/).filter(Boolean));
  let strong = 0, weak = 0;
  for (const m of markers) {
    if (words.has(m)) (WEAK_ROMAN_NE.has(m) ? weak++ : strong++);
  }
  return { strong, weak };
}

export function detectUserLanguage(message) {
  const text = String(message || "");
  const letters = (text.match(/\p{L}/gu) || []).length || 1;
  const devanagari = (text.match(/[ऀ-ॿ]/g) || []).length;
  const isDevanagari = devanagari / letters > 0.25;
  const lower = text.toLowerCase();

  if (isDevanagari) {
    const hi = HINDI_MARKERS.filter(w => text.includes(w)).length;
    const ne = NEPALI_MARKERS.filter(w => text.includes(w)).length;
    return { script: "Devanagari", language: hi > ne ? "hi" : "ne" };
  }

  const ne = countWordMarkers(lower, ROMAN_NE_MARKERS);
  const hi = countWordMarkers(lower, HINGLISH_MARKERS);

  // A lone weak particle ("ko", "ho") is not evidence of Nepali — plain
  // English questions contain them by accident.
  const neScore = ne.strong + (ne.strong > 0 ? ne.weak : ne.weak >= 2 ? 1 : 0);
  const hiScore = hi.strong;

  if (neScore === 0 && hiScore === 0) return { script: "Latin", language: "en" };
  return { script: "Latin", language: neScore >= hiScore ? "roman_ne" : "hinglish" };
}

// ─── Build targeted context for Groq ────────────────────────────────────
export function buildContext(message, conversationHistory = [], sessionContext = {}) {
  const intents = detectIntents(message, sessionContext);
  const program = detectProgram(message, sessionContext);
  const lines   = [];

  // Always include basic college identity
  lines.push(`COLLEGE: ${db.college.name}`);
  lines.push(`Location: ${db.college.location.address}`);
  lines.push(`Phones: ${db.college.contact.phones.join(", ")}`);
  lines.push(`Email: ${db.college.contact.email} | Admission: ${db.college.contact.admissionEmail}`);

  // Welcome / About
  if (intents.includes("welcome") || intents.includes("about")) {
    lines.push(`\nABOUT: ${db.college.description}`);
    lines.push(`Established: ${db.college.established} | Tagline: "${db.college.tagline}"`);
    lines.push(`University Partner: Birmingham City University, UK`);
    lines.push(`This AI counselor was built by Pranam Software (Nepal-based AI & software company).`);
  }

  // Why Sunway
  if (intents.includes("why_sunway") || intents.includes("about")) {
    lines.push(`\nWHY SUNWAY:`);
    db.whySunway.stats.forEach(s => lines.push(`  ${s.value} ${s.label}`));
    db.whySunway.pillars.forEach(p => lines.push(`  • ${p.title}: ${p.description}`));
  }

  // Programs overview
  if (intents.includes("programs") || intents.includes("welcome")) {
    lines.push(`\nPROGRAMS OFFERED:`);
    db.programs.forEach(p => lines.push(`  - ${p.officialName} (${p.duration}) — ${p.awardingBody}`));
  }

  // CSAI detail
  if (intents.includes("csai") || program === "csai") {
    const p = db.programs.find(x => x.id === "csai");
    lines.push(`\nCSAI PROGRAM: ${p.officialName}`);
    lines.push(`Duration: ${p.duration} | Credits: ${p.credits} | Mode: ${p.studyMode}`);
    lines.push(`Awarded by: ${p.awardingBody}`);
    lines.push(`Coordinator: ${p.coordinator}`);
    lines.push(`Description: ${p.description}`);
    lines.push(`NEB Eligibility: ${p.eligibility.neb.requirement}, min CGPA ${p.eligibility.neb.minCGPA}`);
    lines.push(`English — Grade A+: No EPT required. Grade B/B+: BCU EPT required (~NPR 15,000). Below B: BCU-recognized proficiency required.`);
    lines.push(`Careers: ${p.careers.slice(0, 8).join(", ")} and more.`);
  }

  // BIT detail
  if (intents.includes("bit") || program === "bit") {
    const p = db.programs.find(x => x.id === "bit");
    lines.push(`\nBIT PROGRAM: ${p.officialName}`);
    lines.push(`Duration: ${p.duration} | Mode: ${p.studyMode}`);
    lines.push(`Awarded by: ${p.awardingBody}`);
    lines.push(`Description: ${p.description}`);
    lines.push(`Key areas: ${p.keyAreas.join(", ")}`);
    lines.push(`Careers: ${p.careers.join(", ")}`);
  }

  // Compare
  if (intents.includes("compare")) {
    const csai = db.programs.find(x => x.id === "csai");
    const bit  = db.programs.find(x => x.id === "bit");
    lines.push(`\nCOMPARISON:`);
    lines.push(`CSAI — ${csai.officialName}: ${csai.duration}, focus: CS + AI, best for software/AI/ML/data science careers.`);
    lines.push(`BIT  — ${bit.officialName}: ${bit.duration}, focus: Business + Tech, best for business analysis, consulting, IT product roles.`);
  }

  // Fees
  if (intents.includes("fees") || intents.includes("fee_schedule")) {
    const pid = program || "csai"; // default show CSAI if no program context
    const fee = db.fees[pid];
    if (fee) {
      lines.push(`\nFEE STRUCTURE — ${fee.programName}:`);
      lines.push(`Grand Total (listed): NPR ${fee.grandTotal.toLocaleString()}`);
      lines.push(`Note: ${fee.grandTotalNote}`);
      fee.years.forEach(y => {
        lines.push(`  Year ${y.year} Total: NPR ${y.total.toLocaleString()}`);
        y.items.forEach(i => lines.push(`    ${i.item}: NPR ${i.amount.toLocaleString()}${i.foreignAmount ? ` (${i.foreignAmount})` : ""}`));
      });
      lines.push(`Scholarship: ${fee.scholarshipNote}`);
      lines.push(`Disclaimer: ${fee.disclaimer}`);
    }
    if (intents.includes("fee_schedule")) {
      lines.push(`\nFEE PAYMENT SCHEDULE:`);
      db.feeSchedule.forEach(f => lines.push(`  ${f.item}: ${f.timing} — ${f.when}`));
      lines.push(`IMPORTANT: NOT all fees are due at admission. Semester fees due within 3rd week of class, annual fee within 5th week.`);
    }
  }

  // Modules
  if (intents.includes("modules")) {
    const pid = program || "csai";
    const m = db.modules[pid];
    if (m?.year1?.verified) {
      lines.push(`\nMODULES — ${pid.toUpperCase()} Year 1:`);
      lines.push(`  Semester 1: ${m.year1.semester1.join(", ")}`);
      lines.push(`  Semester 2: ${m.year1.semester2.join(", ")}`);
      if (m.year1.nonCredit) lines.push(`  Non-Credit: ${m.year1.nonCredit.join(", ")}`);
      lines.push(`  Year 2+: ${m.year2?.note || "Contact admissions for details."}`);
    }
  }

  // Careers
  if (intents.includes("careers")) {
    const pid = program || "csai";
    const p = db.programs.find(x => x.id === pid);
    if (p) lines.push(`\nCAREERS — ${p.abbreviation}: ${p.careers.join(", ")}`);
  }

  // Admission
  if (intents.includes("admission")) {
    lines.push(`\nADMISSION PROCESS:`);
    db.admissions.process.forEach((s, i) => lines.push(`  ${i+1}. ${s}`));
    lines.push(`Apply: ${db.admissions.applyUrl}`);
  }

  // Documents
  if (intents.includes("documents")) {
    lines.push(`\nREQUIRED DOCUMENTS:`);
    db.admissions.requiredDocuments.forEach(d => lines.push(`  ✓ ${d.item}${d.note ? " — " + d.note : ""}`));
  }

  // Eligibility
  if (intents.includes("eligibility") || intents.includes("csai") || intents.includes("bit")) {
    const pid = program || "csai";
    const p = db.programs.find(x => x.id === pid);
    if (p?.eligibility?.neb) {
      lines.push(`\nELIGIBILITY — ${p.abbreviation}:`);
      lines.push(`  NEB: min CGPA ${p.eligibility.neb.minCGPA}`);
      if (p.eligibility.english) {
        lines.push(`  English Grade A+: ${p.eligibility.english.gradeA_above}`);
        lines.push(`  English Grade B/B+: ${p.eligibility.english.gradeB_Bplus}`);
        lines.push(`  English Below B: ${p.eligibility.english.belowGradeB}`);
      }
    }
  }

  // Scholarship
  if (intents.includes("scholarship")) {
    lines.push(`\nSCHOLARSHIP:`);
    lines.push(db.scholarships.generalNote);
    db.scholarships.types.forEach(s => lines.push(`  ${s.name}: ${s.description}. ${s.note}`));
  }

  // BCU
  if (intents.includes("bcu")) {
    lines.push(`\nUNIVERSITY PARTNER:`);
    lines.push(db.universityPartner.partnershipNote);
    lines.push(`About BCU: ${db.universityPartner.aboutBCU}`);
    lines.push(db.universityPartner.rankingNote);
    lines.push(`Benefits: ${db.universityPartner.partnershipBenefits.join("; ")}`);
  }

  // Placement
  if (intents.includes("placement")) {
    lines.push(`\nPLACEMENT & CAREERS:`);
    lines.push(`Alumni: ${db.placement.alumniNetwork} | Placement Rate: ${db.placement.placementRate} | Partners: ${db.placement.industryPartnerCount}`);
    lines.push(`Disclaimer: ${db.placement.disclaimer}`);
    lines.push(`Services: ${db.placement.services.join("; ")}`);
  }

  // RAIN
  if (intents.includes("rain")) {
    lines.push(`\nRAIN — ${db.rain.name}: ${db.rain.description}`);
    lines.push(`Stages: ${db.rain.stages.join(", ")}`);
  }

  // Innovation Lab
  if (intents.includes("innovation_lab")) {
    lines.push(`\nINNOVATION LAB: ${db.innovationLab.description}`);
    lines.push(db.innovationLab.note);
  }

  // Academic Advisory
  if (intents.includes("advisory")) {
    lines.push(`\nACADEMIC ADVISORY: ${db.academicAdvisory.description}`);
    lines.push(`Benefits: ${db.academicAdvisory.benefits.join(", ")}`);
    lines.push(`Faculty hours: ${db.academicAdvisory.facultyHoursPerWeek} hrs/week for advising`);
  }

  // Student Life / SSRC
  if (intents.includes("student_life")) {
    lines.push(`\nSTUDENT LIFE & CLUBS:`);
    db.studentLife.clubs.forEach(c => lines.push(`  ${c.name} (${c.category})`));
    lines.push(`SSRC: ${db.studentLife.ssrc.description} ${db.studentLife.ssrc.note}`);
  }

  // Virtual Tour
  if (intents.includes("virtual_tour")) {
    lines.push(`\nVIRTUAL CAMPUS TOUR: Sunway College has a 360° virtual campus tour available online.`);
    lines.push(`Tour URL: https://virtualtour.thebritishcollege.edu.np`);
    lines.push(`When user asks to explore, take tour, visit campus, or see 360 view — show SHOW_360 visual action.`);
  }

  // Contact
  if (intents.includes("contact")) {
    const c = db.college.contact;
    lines.push(`\nCONTACT:`);
    lines.push(`  Phones: ${c.phones.join(", ")}`);
    lines.push(`  Email: ${c.email} | Admission: ${c.admissionEmail}`);
    lines.push(`  Address: ${db.college.location.address}`);
    lines.push(`  Hours: ${c.officeHours}`);
  }

  // ─── Matched Q&A from faq.js ──────────────────────────────────────────
  // Added last so it sits closest to the user's question in the prompt.
  // This is what makes arbitrary phrasings answerable: the keyword intents
  // above only fire on exact substrings, whereas the FAQ search scores every
  // written question and tolerates rewording, synonyms and Romanised Nepali.
  // 3 rather than 4, and each answer trimmed: prompt size drives prefill
  // latency, and the 4th match is almost never the one used.
  const faqHits = searchFaqs(message, { limit: 3 });
  if (faqHits.length) {
    lines.push(`\nVERIFIED Q&A — prefer these answers when they fit the question:`);
    faqHits.forEach(({ entry }) => {
      lines.push(`  Q: ${entry.q}`);
      lines.push(`  A: ${entry.a.length > 400 ? entry.a.slice(0, 400) + "..." : entry.a}`);
    });
  }

  // Determine active program for session context.
  // Only the fields we own are echoed back — sessionContext is client-supplied.
  const newSessionContext = {};
  if (program) newSessionContext.activeProgram = program;

  // Panel suggested by the best-matching FAQ, used only as a fallback when
  // the model doesn't pick one itself.
  const topFaq = faqHits[0]?.entry;

  // ─── Passages from uploaded PDFs ──────────────────────────────────────
  // Added after the Q&A so a hand-written answer always takes precedence;
  // the PDF is the fallback for things nobody has written a Q&A for yet.
  const docHits = searchDocuments(message, { limit: 2 });
  if (docHits.length) {
    lines.push(`\nFROM UPLOADED COLLEGE DOCUMENTS — quote only what is written here:`);
    docHits.forEach(h => {
      const where = h.page ? `${h.title}, page ${h.page}` : h.title;
      lines.push(`  [${where}] ${h.text}`);
    });
  }

  const userLang = detectUserLanguage(message);

  return {
    collegeName:     db.college.name,
    contextText:     lines.join("\n"),
    userLanguage:    userLang,
    detectedIntents: intents,
    detectedProgram: program,
    faqMatches:      faqHits.map(h => ({ q: h.entry.q, score: Number(h.score.toFixed(2)) })),
    documentMatches: docHits.map(h => ({ title: h.title, page: h.page, score: Number(h.score.toFixed(2)) })),
    faqVisual:       topFaq?.visual ? { type: topFaq.visual, resourceId: topFaq.resourceId || "" } : null,
    newSessionContext,
  };
}

// ─── Resource lookup by type + resourceId ───────────────────────────────
// resourceId comes straight from the URL, so map lookups go through
// hasOwnProperty — otherwise "constructor" or "__proto__" resolve to
// prototype members instead of returning a 404.
const own = (obj, key) => (typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null);

export function getResource(type, resourceId) {
  switch (type) {
    case "fees":        return own(db.fees, resourceId);
    case "program":     return db.programs.find(p => p.id === resourceId) || null;
    case "programs":    return db.programs;
    case "modules":     return own(db.modules, resourceId);
    case "college":     return db.college;
    case "whySunway":   return db.whySunway;
    case "bcu":         return db.universityPartner;
    case "placement":   return db.placement;
    case "rain":        return db.rain;
    case "innovationLab": return db.innovationLab;
    case "admissions":  return db.admissions;
    case "documents":   return db.admissions.requiredDocuments;
    case "scholarships":return db.scholarships;
    case "feeSchedule": return db.feeSchedule;
    case "contact":     return db.college.contact;
    case "studentLife": return db.studentLife;
    case "advisory":    return db.academicAdvisory;
    case "industryPartners": return db.industryPartners;
    case "testimonials": return db.testimonials;
    case "leads":       return db.leadsStore;
    default:            return null;
  }
}
