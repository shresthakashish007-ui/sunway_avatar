/**
 * Speech text normalisation — makes a written reply sound right when spoken.
 *
 * Neural voices read plain prose well but mangle the things this assistant says
 * most often: currency codes, long digit strings, acronyms, web addresses and
 * bracketed suffixes.
 *
 * Measured by speaking each form and transcribing it back:
 *   "कुल शुल्क NPR 1,275,000 हो।"          -> "न फर एक 275 सुन्ना सुन्ना सुन्ना"  ✗
 *   "कुल शुल्क 12 लाख 75 हजार रुपैयाँ हो।"  -> "12,75,000 रुपया"                  ✓
 *
 * South Asian audiences also think in lakh/crore, so converting to that form is
 * both more intelligible to the voice and more natural to the listener.
 *
 * ORDER MATTERS. Emails and URLs are pulled out first, because the later
 * comma/slash rules would otherwise shred them ("https://sunway.edu.np/apply"
 * became "https:, , sunway.edu.np, apply"). Phone numbers come out next, before
 * any number rewriting can group their digits.
 */
import { SPELL_OUT, EXPANSIONS, DOMAIN_LABELS, spellOut } from "./lexicon.js";

const UNITS = {
  ne: { crore: "करोड", lakh: "लाख", thousand: "हजार", currency: "रुपैयाँ" },
  hi: { crore: "करोड़", lakh: "लाख", thousand: "हज़ार", currency: "रुपये" },
  en: { crore: "crore", lakh: "lakh", thousand: "thousand", currency: "rupees" },
};

// Foreign currencies are NOT grouped Indian-style — "9 thousand 250 pounds" is
// wrong in English. The digits are left for the voice to read naturally and only
// the code becomes a word.
const FOREIGN_CURRENCY = {
  GBP: { en: "pounds",  ne: "पाउन्ड",  hi: "पाउंड" },
  USD: { en: "dollars", ne: "डलर",     hi: "डॉलर" },
  EUR: { en: "euros",   ne: "युरो",    hi: "यूरो" },
  AUD: { en: "Australian dollars", ne: "अस्ट्रेलियन डलर", hi: "ऑस्ट्रेलियन डॉलर" },
};

const SLASH_WORD = { en: "slash", ne: "स्ल्यास", hi: "स्लैश" };
const DOT_WORD   = { en: "dot",   ne: "डट",     hi: "डॉट" };
const AT_WORD    = { en: "at",    ne: "एट",     hi: "एट" };
const LINK_WORD  = {
  en: "the link shown on screen",
  ne: "स्क्रिनमा देखिएको लिङ्क",
  hi: "स्क्रीन पर दिख रहा लिंक",
};

/** 1275000 -> "12 लाख 75 हजार" (or "12 lakh 75 thousand"). */
export function groupIndian(n, lang = "en") {
  const u = UNITS[lang] || UNITS.en;
  n = Math.round(Number(n));
  if (!Number.isFinite(n) || n < 0) return String(n);
  if (n === 0) return "0";

  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000);    n %= 100000;
  const thousand = Math.floor(n / 1000);  n %= 1000;

  if (crore)    parts.push(`${crore} ${u.crore}`);
  if (lakh)     parts.push(`${lakh} ${u.lakh}`);
  if (thousand) parts.push(`${thousand} ${u.thousand}`);
  if (n)        parts.push(String(n));
  return parts.join(" ");
}

// ─── Patterns ─────────────────────────────────────────────────────────────
const EMAIL           = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
// The host must start with a letter and end in a real alphabetic suffix.
// A looser pattern matched decimals — "CGPA 2.6" was being spoken as
// "2 dot 6" because "2.6" looks like a domain.
const URL             = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(?:\/[^\s,;)]*)?/g;
// Nepali landline (01-4531725) and mobile (9823047066), plus generic long runs.
// Read digit by digit — grouping turned 9823047066 into "982 crore 30 lakh
// 47 thousand 66", which is meaningless to someone trying to write it down.
const PHONE           = /\b(?:0\d{1,2}-\d{6,8}|\+?9\d{9}|\d{2,3}-\d{6,8})\b/g;
const RUPEE_AMOUNT    = /(?:NPR|NRs\.?|Rs\.?|INR|रु\.?|रुपैयाँ|रुपये)\s*([\d][\d,]*)/gi;
const FOREIGN_AMOUNT  = /\b(GBP|USD|EUR|AUD)\s*([\d][\d,]*(?:\.\d+)?)/gi;
const BARE_LARGE      = /(?<![\d,.])(\d[\d,]{4,})(?![\d,.])/g;
const TIME            = /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/g;
const PLUS_TWO        = /\b(10\s*\+\s*2|\+\s*2)(?![\d])/g;
const GRADE           = /\b([A-D])([+-])(?![a-zA-Z])/g;

const stripCommas = (s) => s.replace(/,/g, "");

// Placeholders use Unicode private-use characters so no later rule can match
// them. A plain marker like "PHONE0" would be caught by the acronym pass.
const MARK = (i) => `${i}`;
const MARK_RE = /(\d+)/g;

/** "sunway.edu.np" -> "sunway dot e d u dot n p" */
function speakDomain(host, lang) {
  const dot = DOT_WORD[lang] || DOT_WORD.en;
  return host
    .split(".")
    .map(label => DOMAIN_LABELS[label.toLowerCase()] || label)
    .join(` ${dot} `);
}

/**
 * Rewrite a reply so a neural voice pronounces it correctly.
 * `lang` is the base language code: "ne", "hi" or "en".
 */
export function normaliseForSpeech(text, lang = "en") {
  const base = String(lang || "en").toLowerCase().split("-")[0];
  const l = UNITS[base] ? base : "en";
  const u = UNITS[l];
  let out = String(text ?? "");

  // ── 0. Pull out anything the later rules would destroy ──────────────────
  const held = [];
  const hold = (spoken) => { held.push(spoken); return MARK(held.length - 1); };

  // Emails first — they contain a domain, so URL matching would half-eat them.
  out = out.replace(EMAIL, (m) => {
    const [user, host] = m.split("@");
    const at = AT_WORD[l] || AT_WORD.en;
    const dot = DOT_WORD[l] || DOT_WORD.en;
    // A dotted username ("first.last") reads as one blur otherwise.
    const spokenUser = user.replace(/[._-]/g, ` ${dot} `);
    return hold(`${spokenUser} ${at} ${speakDomain(host, l)}`);
  });

  out = out.replace(URL, (m) => {
    // A long link is unlistenable — nobody transcribes a query string by ear.
    // Point at the screen instead, where it is already shown as a button.
    if (m.length > 40) return hold(LINK_WORD[l] || LINK_WORD.en);

    const stripped = m.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[.,]$/, "");
    const [host, ...pathParts] = stripped.split("/");
    const slash = SLASH_WORD[l] || SLASH_WORD.en;
    const path = pathParts.filter(Boolean).join(` ${slash} `);
    return hold(path ? `${speakDomain(host, l)} ${slash} ${path}` : speakDomain(host, l));
  });

  out = out.replace(PHONE, (m) =>
    hold(m.replace(/[-+]/g, " ").replace(/(\d)/g, "$1 ").replace(/\s{2,}/g, " ").trim())
  );

  // ── 1. Money ────────────────────────────────────────────────────────────
  out = out.replace(RUPEE_AMOUNT, (m, digits) => {
    const n = Number(stripCommas(digits));
    if (!Number.isFinite(n)) return m;
    return `${groupIndian(n, l)} ${u.currency}`;
  });

  // Held aside, not returned inline: the digit-grouping pass below would
  // otherwise turn "9,250 pounds" into "9 thousand 250 pounds".
  out = out.replace(FOREIGN_AMOUNT, (m, code, digits) => {
    const word = FOREIGN_CURRENCY[code.toUpperCase()]?.[l];
    return word ? hold(`${digits} ${word}`) : m;
  });

  // ── 2. Remaining long digit strings (fees quoted without a currency code) ─
  out = out.replace(BARE_LARGE, (m, digits) => {
    const n = Number(stripCommas(digits));
    return Number.isFinite(n) ? groupIndian(n, l) : m;
  });

  // ── 3. Clock times: "9:00 AM" -> "9 AM", "5:30 PM" -> "5 30 PM" ─────────
  out = out.replace(TIME, (_m, h, mm, meridiem) =>
    `${h}${mm === "00" ? "" : ` ${mm}`}${meridiem ? ` ${meridiem.toUpperCase()}` : ""}`
  );

  // ── 4. Qualification shorthand ──────────────────────────────────────────
  const expansions = EXPANSIONS[l] || EXPANSIONS.en;
  // Longest first, so "A-Levels" is not half-matched by "A-Level".
  for (const key of Object.keys(expansions).sort((a, b) => b.length - a.length)) {
    if (key.startsWith("+") || key.startsWith("10+")) continue; // handled below
    out = out.replace(new RegExp(`\\b${key.replace(/[-+.]/g, "\\$&")}\\b\\.?`, "gi"), expansions[key]);
  }
  out = out.replace(PLUS_TWO, (m) =>
    /10/.test(m) ? (expansions["10+2"] || "ten plus two") : (expansions["+2"] || "plus two")
  );

  // ── 5. Grades: "B+" -> "B plus", "A-" -> "A minus" ──────────────────────
  const gradeWord = { "+": { en: "plus", ne: "प्लस", hi: "प्लस" }, "-": { en: "minus", ne: "माइनस", hi: "माइनस" } };
  out = out.replace(GRADE, (_m, letter, sign) => `${letter} ${gradeWord[sign][l] || gradeWord[sign].en}`);

  // ── 6. Bracketed suffixes are read as words: "(Hons)" came out as "Hans" ─
  out = out.replace(/\(([^)]{1,40})\)/g, " $1 ");

  // ── 7. Acronyms, spelled per language ───────────────────────────────────
  // In Devanagari replies this matters even more: the Nepali voice given bare
  // Latin capitals ("BCU") produces noise, so they become बी सी यू instead.
  // A trailing hyphen is consumed so "BCU-validated" doesn't keep the dash.
  for (const term of SPELL_OUT) {
    out = out.replace(new RegExp(`\\b${term}\\b-?`, "g"), `${spellOut(term, l)} `);
  }

  // ── 8. Symbols a voice either skips or reads aloud awkwardly ────────────
  out = out
    .replace(/[•·▪]/g, ", ")
    .replace(/\s*[/|]\s*/g, ", ")
    .replace(/&/g, l === "en" ? " and " : " ")
    .replace(/[“”‘’"]/g, "")
    .replace(/\s*—\s*/g, ", ")
    .replace(/\.{2,}/g, ".");

  // ── 9. Restore what was held aside ──────────────────────────────────────
  out = out.replace(MARK_RE, (_m, i) => held[Number(i)] ?? "");

  // Tidy up: collapse runs of spaces, and close the gap the substitutions
  // leave before punctuation ("9 8 2 ." -> "9 8 2.").
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.।!?])/g, "$1").trim();
}
