/**
 * Gap log — records questions the assistant could NOT answer.
 *
 * However many Q&A entries you write, students will always ask something you
 * did not anticipate. Rather than guessing what is missing, this records every
 * question that fell through to "I don't have verified info", so the admin can
 * see exactly what to add next, ranked by how often it is asked.
 *
 * Only the question text is stored — no session, IP or personal data.
 */
import fs from "fs";
import path from "path";
import { collegeDir, getActiveSlug } from "./collegeStore.js";

const FILE = "unanswered.json";
const MAX_ENTRIES = 500;

const logPath = (slug) => path.join(collegeDir(slug), FILE);

function read(slug) {
  try {
    const raw = JSON.parse(fs.readFileSync(logPath(slug), "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write(slug, rows) {
  const file = logPath(slug);
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    // Logging must never break a reply
    console.warn("[GapLog] could not save:", err.message);
  }
}

/** Loose key so "what is the wifi password" and "What's the WiFi password?" group together. */
function normaliseKey(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Record a question the assistant could not answer.
 * Repeats increment a counter rather than creating duplicate rows.
 */
export function recordUnanswered(question, { slug = getActiveSlug(), language = "en" } = {}) {
  if (!slug || typeof question !== "string") return;
  const text = question.trim();
  if (text.length < 3 || text.length > 300) return;

  const key = normaliseKey(text);
  if (!key) return;

  const rows = read(slug);
  const existing = rows.find(r => r.key === key);

  if (existing) {
    existing.count += 1;
    existing.lastAsked = new Date().toISOString();
    if (language && !existing.languages.includes(language)) existing.languages.push(language);
  } else {
    rows.push({
      key,
      question: text,
      count: 1,
      languages: [language],
      firstAsked: new Date().toISOString(),
      lastAsked: new Date().toISOString(),
    });
  }

  // Keep the most-asked; drop the long tail so the file cannot grow forever
  rows.sort((a, b) => b.count - a.count || new Date(b.lastAsked) - new Date(a.lastAsked));
  write(slug, rows.slice(0, MAX_ENTRIES));
}

/** Most-asked unanswered questions first. */
export function listUnanswered(slug = getActiveSlug()) {
  return read(slug).sort((a, b) => b.count - a.count || new Date(b.lastAsked) - new Date(a.lastAsked));
}

export function clearUnanswered(slug = getActiveSlug(), key = null) {
  if (!slug) return false;
  if (!key) { write(slug, []); return true; }
  const rows = read(slug);
  const next = rows.filter(r => r.key !== key);
  if (next.length === rows.length) return false;
  write(slug, next);
  return true;
}
