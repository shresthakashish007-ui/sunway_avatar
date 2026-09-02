/**
 * PDF knowledge store.
 *
 * An admin uploads a PDF (prospectus, fee sheet, policy...) and its text is
 * extracted once, split into passages, and saved to
 *   server/colleges/<slug>/documents.json
 *
 * At chat time those passages are searched with the same scorer used for the
 * Q&A file, and the best ones are pasted into the prompt as source material.
 * The model still answers only from what it is given, so a PDF is simply
 * another shelf of verified facts — not a second brain.
 *
 * Extraction runs at upload time, never per request, so answering stays fast.
 */
import fs from "fs";
import path from "path";
import { collegeDir, getActiveSlug, invalidate } from "./collegeStore.js";

const FILE = "documents.json";
const MAX_CHARS_PER_DOC = 400000;   // ~150 pages of text
const CHUNK_TARGET = 900;           // characters per passage
const CHUNK_OVERLAP = 150;          // keeps sentences that straddle a boundary

function docsPath(slug) { return path.join(collegeDir(slug), FILE); }

export function listDocuments(slug = getActiveSlug()) {
  if (!slug) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(docsPath(slug), "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveDocuments(slug, docs) {
  const file = docsPath(slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(docs, null, 2), "utf8");
  fs.renameSync(tmp, file);
  invalidate(slug); // rebuilds the search index
}

/** Every passage across every stored PDF, flattened for searching. */
export function allPassages(slug = getActiveSlug()) {
  const out = [];
  for (const doc of listDocuments(slug)) {
    for (const [i, text] of (doc.chunks || []).entries()) {
      out.push({ docId: doc.id, title: doc.title, page: doc.pageOf?.[i] ?? null, text });
    }
  }
  return out;
}

// ─── Text extraction ──────────────────────────────────────────────────────
/**
 * Pull the text out of a PDF buffer.
 * Returns { text, pages, pageTexts }.
 */
export async function extractPdfText(buffer) {
  // Imported lazily: pdfjs is heavy and only needed when a PDF is uploaded.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    // The worker adds nothing server-side and complicates bundling
    disableWorker: true,
    isEvalSupported: false,
  }).promise;

  const pageTexts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // pdfjs returns positioned fragments; join them and restore line breaks
    // where the renderer marked the end of a line.
    let line = "";
    const lines = [];
    for (const item of content.items) {
      if (typeof item.str !== "string") continue;
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ""; }
      else if (item.str && !item.str.endsWith(" ")) line += " ";
    }
    if (line.trim()) lines.push(line);

    pageTexts.push(lines.join("\n").replace(/[ \t]+/g, " ").trim());
    if (pageTexts.join("").length > MAX_CHARS_PER_DOC) break;
  }

  await doc.destroy?.();
  return { text: pageTexts.join("\n\n"), pages: doc.numPages, pageTexts };
}

// ─── Chunking ─────────────────────────────────────────────────────────────
/**
 * Split into passages on paragraph then sentence boundaries, so a passage
 * reads as coherent prose rather than being cut mid-sentence.
 * Returns { chunks, pageOf } where pageOf[i] is the source page of chunk i.
 */
export function chunkPages(pageTexts) {
  const chunks = [];
  const pageOf = [];

  for (const [idx, pageText] of pageTexts.entries()) {
    const pageNo = idx + 1;
    const paragraphs = pageText.split(/\n\s*\n|\n(?=[A-Z0-9])/).map(p => p.trim()).filter(Boolean);

    let buf = "";
    const flush = () => {
      const t = buf.trim();
      if (t.length > 40) { chunks.push(t); pageOf.push(pageNo); }
      buf = "";
    };

    for (const para of paragraphs) {
      if ((buf + " " + para).length <= CHUNK_TARGET) {
        buf = buf ? `${buf} ${para}` : para;
        continue;
      }
      if (buf) {
        const tail = buf.slice(-CHUNK_OVERLAP);
        flush();
        buf = tail.trim();
      }
      // A single paragraph longer than the target is split on sentences
      if (para.length > CHUNK_TARGET) {
        for (const sentence of para.match(/[^.!?।]+[.!?।]+|\S+$/g) || [para]) {
          if ((buf + " " + sentence).length > CHUNK_TARGET) flush();
          buf = buf ? `${buf} ${sentence}` : sentence;
        }
      } else {
        buf = buf ? `${buf} ${para}` : para;
      }
    }
    flush();
  }
  return { chunks, pageOf };
}

// ─── Public API ───────────────────────────────────────────────────────────
export async function addPdf(slug, { filename, title, buffer }) {
  const { text, pages, pageTexts } = await extractPdfText(buffer);

  if (!text.trim()) {
    // Scanned PDFs are images with no text layer — say so plainly instead of
    // storing an empty document that silently answers nothing.
    throw new Error(
      "No text could be read from this PDF. It looks like a scanned image — " +
      "please upload a text-based PDF, or run OCR on it first."
    );
  }

  const { chunks, pageOf } = chunkPages(pageTexts);
  const docs = listDocuments(slug);

  const doc = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: (title || filename || "Document").slice(0, 120),
    filename,
    pages,
    chunkCount: chunks.length,
    characters: text.length,
    uploadedAt: new Date().toISOString(),
    chunks,
    pageOf,
  };

  docs.push(doc);
  saveDocuments(slug, docs);

  return { id: doc.id, title: doc.title, pages, chunks: chunks.length, characters: text.length };
}

export function removePdf(slug, id) {
  const docs = listDocuments(slug);
  const next = docs.filter(d => d.id !== id);
  if (next.length === docs.length) return false;
  saveDocuments(slug, next);
  return true;
}

/** Metadata only — the chunk arrays are far too big to send to a browser. */
export function documentSummaries(slug = getActiveSlug()) {
  return listDocuments(slug).map(({ chunks, pageOf, ...meta }) => meta);
}
