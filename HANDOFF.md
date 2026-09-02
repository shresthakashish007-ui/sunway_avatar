# Sunway AI Avatar — Session Handoff

Paste this into a new chat to continue. It describes the project, everything
changed, what works, and what is still outstanding.

---

## 1. What the project is

A **3D AI admission counsellor kiosk for Sunway College Kathmandu**. A talking,
lip-synced avatar answers prospective students' questions by voice or text, in
**English, Nepali, Hindi, Romanised Nepali and Hinglish**, while a side panel
shows fee tables, programme cards, admission info, etc.

Built by Pranam Software. Started from the `r3f-lipsync-tutorial` starter.

**Working directory:** `D:\Documents\Desktop\sunway_avatar-main (3)\sunway_avatar-main\sunway avatar`

### Run it

```bash
npm run dev
```

Starts **both** the API (`:3001`) and Vite (`:5173`). Do not run `vite` alone —
`/api/*` then proxies to a dead port and you get an opaque `500 {}`.

- App: `http://localhost:5173`
- Admin: `http://localhost:3001/admin.html` (password from `.env` → `ADMIN_PASSWORD`)

---

## 2. Architecture

**Frontend** — React 18 + Vite + React Three Fiber
- `src/App.jsx` — whole UI (top bar, chat, mic, language picker, widget/mobile modes)
- `src/hooks/useChat.js` — orchestrates send → reply → panel → speech
- `src/services/chatService.js` / `ttsService.js` / `voiceService.js`
- `src/store/assistantStore.js` — Zustand state
- `src/components/avatar/AvatarController.jsx` — 3 GLB models (namaste / idle / explaining) + lip-sync
- `src/components/visual/*` — the right-hand panels

**Backend** — Express 5 on `:3001`
- `server/routes/chat.js` — the core: retrieve context → Groq → sanitise
- `server/routes/tts.js` — Microsoft Edge neural voices
- `server/routes/stt.js` — Whisper on Groq
- `server/routes/collegeAdmin.js` — admin API
- `server/services/faqSearch.js` — BM25-style Q&A matcher
- `server/services/collegeStore.js` — per-college content loader
- `server/services/speechText.js` — pronunciation normaliser
- `server/services/gapLog.js` — logs unanswered questions
- `server/services/pdfStore.js` — PDF text extraction + passage search

**Content lives per college** in `server/colleges/<slug>/`:
```
config.json      branding (name, colours, logo, links)
data.json        structured facts (programmes, fees, contacts) → drives panels
faq.json         question → answer pairs → drives spoken replies
documents.json   extracted PDF passages
unanswered.json  questions the bot could not answer
assets/          uploaded logos/images
```

---

## 3. Models in use

| Job | Model | Notes |
|---|---|---|
| Chat | `openai/gpt-oss-20b` via **Groq** | Apache 2.0 open weights. `reasoning_effort: low` |
| Speech→text | `whisper-large-v3` via Groq | 91% with language named + vocab bias |
| Text→speech | **Microsoft Edge neural** (`msedge-tts`) | Free, no key. `ne-NP-HemkalaNeural`, `hi-IN-SwaraNeural`, `en-US-JennyNeural`, `en-IN-NeerjaNeural` |

**8 Groq API keys rotate.** Verified by measurement: they are **8 separate Groq
accounts**, so rotation genuinely multiplies capacity (~64,000 TPM,
~8,000 messages/day). This is load-bearing and not obvious from the code.

**Not locked in:** gpt-oss-20b is Apache 2.0 — self-hostable via
`ollama pull gpt-oss:20b` if Groq's free tier ever changes.

---

## 4. What was done this session

### Bug fixes (all verified by test)
- **`max_tokens: 300` was too small** → ~40% of questions failed with "Could you
  repeat your question?". Now 900/1500. This was the single biggest quality bug.
- **Admin auth bypass** — unset `ADMIN_PASSWORD` let everyone through
  (`undefined === undefined`).
- **Prompt injection** — client-supplied `conversationHistory` was passed
  unfiltered to Groq; now only `user`/`assistant` turns survive.
- **Admin never saw leads** — read from a different store than the form wrote to.
- **Voice messages could send twice** — `onSend` inside a `setState` updater
  (React StrictMode double-invokes).
- **Avatar could get stuck "talking"** if TTS voices never loaded.
- **Groq keys were permanently banned** — `consecutiveErrors` only reset on
  success, but a benched key was never retried. Now unbenches after 5 min.
- **BIT fee question showed the CSAI table** — model omitted `resourceId`;
  server now fills it from the detected programme.
- **Prompt listed only 10 of 25 panels**, so scholarships/comparison/clubs
  returned `NONE`.
- Helmet enabled, prototype-pollution guarded, `/rotation-status` token-gated.
- Deleted 12 dead modules (~1,900 lines).

### Q&A system (the "how do I train it" answer)
Fine-tuning was **deliberately rejected** — models don't reliably memorise facts,
Groq doesn't offer it, and a hallucinated fee is harmful. Instead:
- `faq.json` — plain questions and answers you edit
- `faqSearch.js` — BM25 + synonyms + prefix matching, so any phrasing finds the
  right entry (26/26 in tests, 0 false positives)
- Answers are written **once in English** and translated at reply time

### Multi-college + admin panel
`public/admin.html`, six tabs: **Colleges · Branding & Files · Questions &
Answers · PDF Documents · College Data · Test the Bot**.
Edits go live immediately — no restart.

### Speech quality
- **STT was forcing English on every language** (13.9% accuracy — Nepali came
  back as Italian). Added a mic language picker (Auto/English/नेपाली/हिंदी),
  switched to `whisper-large-v3` + college vocabulary bias → **91.3%**.
- **TTS spoke fee amounts as gibberish**: `NPR 1,275,000` → "एक 275 सुन्ना
  सुन्ना सुन्ना". `speechText.js` now rewrites currency to lakh/crore, protects
  phone numbers as digits, expands `Hons`/`BIT`/`BSc`.
- Replies shortened 271 → 181 chars avg; voices pre-warmed at boot.
- Send → avatar speaks: **1129–1392 ms**.

### Three-tier knowledge policy
- **Tier 1 — Sunway facts:** only from `faq.json`/`data.json`/PDFs. Never guesses.
- **Tier 2 — general knowledge** (what is ML, career advice): answers freely.
- **Tier 3 — unrelated** (weather, jokes): declines.

Unanswered Tier-1 questions are logged to `unanswered.json` and shown in the
admin panel, ranked by frequency, with a "Write answer" button.

---

## 5. Current state

✅ Working and verified: chat in 5 languages, TTS/STT, admin panel, multi-college
content separation, gap logging, PDF upload pipeline.

⚠️ Servers are **not running** right now — start with `npm run dev`.

📊 `faq.json` has **36 entries**; `unanswered.json` has 12 logged;
**0 PDFs uploaded** (pipeline built but never exercised with a real PDF).

---

## 6. Outstanding work

### A. The Q&A review document — **main blocker**
`Sunway_QA_Review.docx` (in the parent folder) holds **162 questions** extracted
from handwritten notebook photos, each with:
`Q# · Also asked as (8–9 multilingual phrasings) · Answer · Source · Your correction`

- **41 marked `NEEDS VERIFICATION`** (shaded pink) — I could not verify these
- **The user has filled in 16 so far** — 25 left
- **2 source conflicts**, one still open:
  - Q7 founding year: 2007 vs 2010 → user answered **2010** ✅
  - **Q48 minimum CGPA: programme page says 2.6, official FAQ says 3.0 — UNRESOLVED**

**Next step:** when the user returns the completed docx, read every "Your
correction" cell, let it override the draft answer, keep "Also asked as" as
matching keys, and write into `server/colleges/sunway/faq.json`.

### B. Multi-college branding (partly done)
Content is fully separated per college. `src/services/collegeConfig.js` exists
and publishes brand colours as CSS variables, but **some components may still
hard-code Sunway colours/logos** — worth auditing `App.jsx`, `HomePanel.jsx`,
`VisualPanel.jsx`, `SunwayViewers.jsx`.

### C. Test the PDF upload with a real document
The pipeline is built and wired but no PDF has been uploaded yet.

---

## 7. Known limitations (do not present as solved)

- **Nepali speech recognition ~85–91%**, and only if the user taps नेपाली first.
  Nepali is low-resource; no free model does it perfectly. Hindi/English are solid.
- **~1.2s to first speech** is near the floor: ~600ms Groq + ~500ms voice
  synthesis, both network-bound.
- **Groq free tier**, not a contract. ~8,000 messages/day across the 8 keys.
- **The 360° virtual tour iframe points at `virtualtour.thebritishcollege.edu.np`**
  — a *different college*. Flagged repeatedly, still unchanged; the correct
  Sunway URL is unknown.
- Groq **buffers JSON-mode responses**, so streaming the chat reply gives no
  latency benefit (measured: 1 chunk in JSON mode vs 97 in plain mode).

---

## 8. Working agreements

- **Never invent college facts.** Every answer must trace to `faq.json`,
  `data.json`, an uploaded PDF, or an official source. Unverified → say so.
- **Measure before claiming.** Most fixes here came from benchmarks, and several
  first attempts were wrong (e.g. whisper turbo vs large-v3 — they looked equal
  until the vocabulary bias was added, then large-v3 clearly won).
- Start servers with `npm run dev`, never `vite` alone.
- The user is not a programmer — explain in plain language, avoid jargon.
