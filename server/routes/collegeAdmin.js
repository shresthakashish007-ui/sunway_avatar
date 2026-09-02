/**
 * College admin API — powers /admin.html
 *
 * Everything here is behind the same ADMIN_PASSWORD gate as /api/admin.
 * Writes go through collegeStore, which invalidates its cache so edits take
 * effect on the live assistant immediately, without a restart.
 */
import express from "express";
import fs from "fs";
import path from "path";
import {
  listColleges, getActiveSlug, setActiveSlug, createCollege,
  getConfig, getData, getFaqs, saveConfig, saveData, saveFaqs,
  assetsDir, SLUG_RE,
} from "../services/collegeStore.js";
import { searchFaqs, searchDocuments } from "../services/faqSearch.js";
import { addPdf, removePdf, documentSummaries } from "../services/pdfStore.js";
import { listUnanswered, clearUnanswered } from "../services/gapLog.js";

const router = express.Router();

// Images arrive as base64 in JSON, so this router needs a bigger body limit
// than the 50kb default used for chat.
router.use(express.json({ limit: "40mb" })); // base64 PDFs inflate ~33%

function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return res.status(503).json({ success: false, error: "Admin API disabled — ADMIN_PASSWORD is not set in .env" });
  }
  const token = req.headers["x-admin-token"] || req.query.token;
  if (typeof token !== "string" || token !== expected) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}
router.use(adminAuth);

const bad = (res, msg, code = 400) => res.status(code).json({ success: false, error: msg });

function requireSlug(req, res) {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug) || !listColleges().includes(slug)) {
    bad(res, `Unknown college "${slug}"`, 404);
    return null;
  }
  return slug;
}

// ─── Colleges ─────────────────────────────────────────────────────────────
router.get("/colleges", (_req, res) => {
  const active = getActiveSlug();
  res.json({
    success: true,
    active,
    colleges: listColleges().map(slug => ({
      slug,
      name: getConfig(slug)?.name || slug,
      faqCount: (getFaqs(slug) || []).length,
      isActive: slug === active,
    })),
  });
});

router.post("/colleges", (req, res) => {
  const { slug, name } = req.body || {};
  if (!name || typeof name !== "string") return bad(res, "College name is required");
  try {
    createCollege(String(slug || "").trim().toLowerCase(), name.trim());
    res.json({ success: true, slug, message: `Created "${name}"` });
  } catch (err) {
    bad(res, err.message);
  }
});

router.post("/colleges/:slug/activate", (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  try {
    setActiveSlug(slug);
    res.json({ success: true, active: slug, message: `Now serving ${getConfig(slug)?.name || slug}` });
  } catch (err) { bad(res, err.message); }
});

// ─── config.json / data.json / faq.json ───────────────────────────────────
const READERS = { config: getConfig, data: getData, faq: getFaqs };
const WRITERS = { config: saveConfig, data: saveData, faq: saveFaqs };

// Express 5's router dropped inline regex params (":kind(config|data|faq)"),
// so the whitelist is enforced here instead.
const isKind = (k) => Object.prototype.hasOwnProperty.call(READERS, k);

// next() on a non-matching kind so the /assets routes declared below still get
// their chance — ":kind" would otherwise swallow "/colleges/x/assets".
router.get("/colleges/:slug/:kind", (req, res, next) => {
  const { kind } = req.params;
  if (!isKind(kind)) return next();
  const slug = requireSlug(req, res); if (!slug) return;
  res.json({ success: true, slug, kind, content: READERS[kind](slug) });
});

router.put("/colleges/:slug/:kind", (req, res, next) => {
  const kind = req.params.kind;
  if (!isKind(kind)) return next();
  const slug = requireSlug(req, res); if (!slug) return;
  const content = req.body?.content;

  if (content === undefined) return bad(res, "Missing `content`");
  if (kind === "faq") {
    if (!Array.isArray(content)) return bad(res, "faq.json must be a list of Q&A entries");
    for (const [i, e] of content.entries()) {
      if (!e || typeof e.q !== "string" || !e.q.trim()) return bad(res, `Entry ${i + 1}: question ("q") is required`);
      if (typeof e.a !== "string" || !e.a.trim())       return bad(res, `Entry ${i + 1}: answer ("a") is required`);
    }
  } else if (typeof content !== "object" || Array.isArray(content)) {
    return bad(res, `${kind}.json must be an object`);
  }

  try {
    WRITERS[kind](slug, content);
    res.json({
      success: true,
      message: `Saved ${kind}.json`,
      count: Array.isArray(content) ? content.length : undefined,
    });
  } catch (err) { bad(res, err.message, 500); }
});

// ─── Asset upload (logo / images), base64 in JSON ─────────────────────────
const EXT_BY_MIME = {
  "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
  "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
};
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

router.post("/colleges/:slug/assets", (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  const { filename, dataUrl } = req.body || {};
  if (typeof dataUrl !== "string") return bad(res, "Missing file data");

  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return bad(res, "File must be a base64 data URL");

  const ext = EXT_BY_MIME[m[1].toLowerCase()];
  if (!ext) return bad(res, `Unsupported image type "${m[1]}". Use PNG, JPG, WEBP, GIF or SVG.`);

  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_ASSET_BYTES) return bad(res, `File is ${(buf.length / 1024 / 1024).toFixed(1)} MB — max is 5 MB`);

  // Never trust the supplied name for path building
  const safe = String(filename || "asset")
    .replace(/\.[^.]*$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 40) || "asset";
  const finalName = `${safe}-${Date.now()}.${ext}`;

  const dir = assetsDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, finalName), buf);

  res.json({
    success: true,
    filename: finalName,
    url: `/college-assets/${slug}/${finalName}`,
    sizeKb: Math.round(buf.length / 1024),
  });
});

router.get("/colleges/:slug/assets", (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  const dir = assetsDir(slug);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => !f.startsWith(".")) : [];
  res.json({
    success: true,
    assets: files.map(f => ({ filename: f, url: `/college-assets/${slug}/${f}` })),
  });
});

router.delete("/colleges/:slug/assets/:filename", (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  const name = req.params.filename;
  if (!/^[a-zA-Z0-9_.-]+$/.test(name)) return bad(res, "Bad filename");
  const target = path.join(assetsDir(slug), name);
  // Confirm the resolved path is still inside the college's assets folder
  if (!target.startsWith(assetsDir(slug))) return bad(res, "Bad filename");
  if (!fs.existsSync(target)) return bad(res, "Not found", 404);
  fs.unlinkSync(target);
  res.json({ success: true, message: `Deleted ${name}` });
});

// ─── PDF knowledge documents ──────────────────────────────────────────────
// Upload a PDF once; its text is extracted, split into passages and stored.
// Those passages are then searched at chat time alongside the Q&A file.
const MAX_PDF_BYTES = 25 * 1024 * 1024;

router.get("/colleges/:slug/documents", (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  res.json({ success: true, documents: documentSummaries(slug) });
});

router.post("/colleges/:slug/documents", async (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  const { filename, title, dataUrl } = req.body || {};

  if (typeof dataUrl !== "string") return bad(res, "Missing file data");
  const m = dataUrl.match(/^data:([^;]*);base64,(.+)$/);
  if (!m) return bad(res, "File must be a base64 data URL");

  const mime = m[1].toLowerCase();
  if (mime && !mime.includes("pdf")) return bad(res, `Expected a PDF, received "${mime}"`);

  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length > MAX_PDF_BYTES) {
    return bad(res, `PDF is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — the limit is 25 MB`);
  }
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return bad(res, "That file is not a valid PDF");
  }

  try {
    const info = await addPdf(slug, { filename, title, buffer });
    console.log(`[PDF] ✅ "${info.title}" — ${info.pages} pages, ${info.chunks} passages`);
    res.json({ success: true, ...info, message: `Added "${info.title}" (${info.pages} pages, ${info.chunks} searchable passages)` });
  } catch (err) {
    console.error("[PDF] ❌", err.message);
    bad(res, err.message);
  }
});

router.delete("/colleges/:slug/documents/:id", (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  if (!removePdf(slug, req.params.id)) return bad(res, "Document not found", 404);
  res.json({ success: true, message: "Document removed" });
});

// What the assistant would pull out of the PDFs for a given question
router.post("/documents/test", (req, res) => {
  const question = req.body?.question;
  if (typeof question !== "string" || !question.trim()) return bad(res, "Type a question to test");
  res.json({
    success: true,
    passages: searchDocuments(question, { limit: 5 }).map(p => ({
      title: p.title, page: p.page, score: Number(p.score.toFixed(2)), text: p.text,
    })),
  });
});

// ─── Unanswered questions ─────────────────────────────────────────────────
// Real student questions the assistant could not answer, most-asked first.
router.get("/colleges/:slug/unanswered", (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  res.json({ success: true, questions: listUnanswered(slug) });
});

router.delete("/colleges/:slug/unanswered", (req, res) => {
  const slug = requireSlug(req, res); if (!slug) return;
  clearUnanswered(slug, req.query.key || null);
  res.json({ success: true, message: req.query.key ? "Question dismissed" : "List cleared" });
});

// ─── Live matcher test ────────────────────────────────────────────────────
// Lets the admin type a student question and see which Q&A would be used,
// before students ever hit it.
router.post("/faq/test", (req, res) => {
  const question = req.body?.question;
  if (typeof question !== "string" || !question.trim()) return bad(res, "Type a question to test");
  const hits = searchFaqs(question, { limit: 5 });
  res.json({
    success: true,
    question,
    matches: hits.map(h => ({ q: h.entry.q, a: h.entry.a, score: Number(h.score.toFixed(2)) })),
  });
});

// Anything unmatched in this router is an API mistake — answer in JSON rather
// than falling through to the app's HTML error page.
router.use((req, res) => bad(res, `No such admin endpoint: ${req.method} ${req.originalUrl}`, 404));

export default router;
