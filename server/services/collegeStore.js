/**
 * College Store — loads and saves per-college content.
 *
 * Every college lives in its own folder:
 *
 *   server/colleges/<slug>/
 *     config.json   branding: name, colours, logo, apply URL
 *     data.json     structured facts: programs, fees, contacts  (drives panels)
 *     faq.json      question → answer pairs                     (drives replies)
 *     assets/       uploaded logo and images
 *
 * One deployment can hold many colleges; `_registry.json` records which one is
 * currently being served. Adding a college is a new folder, not a code change.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const COLLEGES_DIR = path.resolve(__dirname, "../colleges");
const REGISTRY = path.join(COLLEGES_DIR, "_registry.json");

// Slugs become folder names, so keep them strictly safe
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

function ensureDirs() {
  if (!fs.existsSync(COLLEGES_DIR)) fs.mkdirSync(COLLEGES_DIR, { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Write to a temp file then rename, so a crash mid-write can't leave a
  // half-written file that stops the server booting.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

// ─── Registry ─────────────────────────────────────────────────────────────
export function listColleges() {
  ensureDirs();
  return fs.readdirSync(COLLEGES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && SLUG_RE.test(d.name))
    .map(d => d.name)
    .sort();
}

export function getActiveSlug() {
  ensureDirs();
  const reg = readJson(REGISTRY, {});
  const all = listColleges();
  if (reg.active && all.includes(reg.active)) return reg.active;
  return all[0] || null;
}

export function setActiveSlug(slug) {
  if (!listColleges().includes(slug)) throw new Error(`Unknown college: ${slug}`);
  writeJson(REGISTRY, { active: slug, updatedAt: new Date().toISOString() });
  invalidate();
  return slug;
}

// ─── Paths ────────────────────────────────────────────────────────────────
export const collegeDir = (slug) => path.join(COLLEGES_DIR, slug);
export const filePath   = (slug, name) => path.join(collegeDir(slug), name);
export const assetsDir  = (slug) => path.join(collegeDir(slug), "assets");

// ─── Cache ────────────────────────────────────────────────────────────────
// Files are read once and held in memory. Saving through this module clears
// the cache, so admin edits take effect without a restart.
const cache = new Map();

export function invalidate(slug = null) {
  if (slug) { cache.delete(`${slug}:config`); cache.delete(`${slug}:data`); cache.delete(`${slug}:faq`); }
  else cache.clear();
  for (const fn of listeners) fn();
}

const listeners = new Set();
/** Register a callback fired whenever college content changes (e.g. to rebuild a search index). */
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function load(slug, kind, fallback) {
  const key = `${slug}:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const value = readJson(filePath(slug, `${kind}.json`), fallback);
  cache.set(key, value);
  return value;
}

// ─── Readers ──────────────────────────────────────────────────────────────
export function getConfig(slug = getActiveSlug()) { return slug ? load(slug, "config", {}) : {}; }
export function getData(slug = getActiveSlug())   { return slug ? load(slug, "data", {})   : {}; }
export function getFaqs(slug = getActiveSlug())   { return slug ? load(slug, "faq", [])    : []; }

// ─── Writers ──────────────────────────────────────────────────────────────
export function saveConfig(slug, value) { writeJson(filePath(slug, "config.json"), value); invalidate(slug); }
export function saveData(slug, value)   { writeJson(filePath(slug, "data.json"),   value); invalidate(slug); }
export function saveFaqs(slug, value)   { writeJson(filePath(slug, "faq.json"),    value); invalidate(slug); }

/**
 * Create an empty college. Seeds the three files so the admin UI and the
 * assistant both have something valid to read immediately.
 */
export function createCollege(slug, name) {
  if (!SLUG_RE.test(slug)) throw new Error("Slug must be lowercase letters, numbers and hyphens (2-41 chars)");
  if (listColleges().includes(slug)) throw new Error(`College "${slug}" already exists`);

  fs.mkdirSync(assetsDir(slug), { recursive: true });
  saveConfig(slug, {
    slug,
    name,
    shortName: name,
    tagline: "",
    assistantName: `${name} Guide`,
    builtBy: "Pranam Software — Nepal-based AI company.",
    brandColor: "#B51F24",
    brandColorDark: "#8F171B",
    logoUrl: "",
    buildingImage: "",
    applyUrl: "",
    virtualTourUrl: "",
    website: "",
  });
  saveData(slug, {
    college: {
      name,
      shortName: name,
      tagline: "",
      description: "",
      established: null,
      location: { address: "", landmark: "", area: "", mapUrl: "" },
      contact: { phones: [], email: "", admissionEmail: "", website: "", officeHours: "" },
    },
    programs: [], modules: {}, fees: {}, feeSchedule: [],
    admissions: { applyUrl: "", process: [], requiredDocuments: [] },
    scholarships: { generalNote: "", types: [] },
    placement: {}, studentLife: { clubs: [] }, leadsStore: [],
  });
  saveFaqs(slug, []);
  return slug;
}
