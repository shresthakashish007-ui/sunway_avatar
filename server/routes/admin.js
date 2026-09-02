import express from "express";
import db, { leadsStore } from "../database/sunwayData.js";
import keyRotation from "../services/groqKeyRotation.js";

const router = express.Router();

// Simple admin auth middleware
function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD;

  // Without a configured password every request would otherwise match
  // `undefined === undefined` and sail straight through.
  if (!expected) {
    console.warn("🔒 /api/admin blocked: ADMIN_PASSWORD is not set in .env");
    return res.status(503).json({ success: false, error: "Admin API is disabled (ADMIN_PASSWORD not configured)" });
  }

  const token = req.headers["x-admin-token"] || req.query.token;
  if (typeof token !== "string" || token !== expected) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

// GET leads
router.get("/leads", adminAuth, (req, res) => {
  res.json({ success: true, data: leadsStore, count: leadsStore.length });
});

// GET college info
router.get("/college", adminAuth, (req, res) => {
  res.json({ success: true, data: db });
});

// UPDATE college basic info (runtime only — for persistent, write to DB)
router.patch("/college", adminAuth, (req, res) => {
  // Maps each editable field onto its actual location in the college record.
  // Previously every key was written to college[k], so phone/email/address
  // landed on the top level where nothing reads them.
  const targets = {
    name:        () => db.college,
    description: () => db.college,
    tagline:     () => db.college,
    email:       () => db.college.contact,
    address:     () => db.college.location,
  };

  const updated = [];
  Object.entries(targets).forEach(([k, resolve]) => {
    if (typeof req.body[k] === "string" && req.body[k].trim()) {
      resolve()[k] = req.body[k].trim().slice(0, 300);
      updated.push(k);
    }
  });

  // Phones are an array on the contact record
  if (typeof req.body.phone === "string" && req.body.phone.trim()) {
    db.college.contact.phones = req.body.phone
      .split(",").map(p => p.trim().slice(0, 20)).filter(Boolean).slice(0, 5);
    updated.push("phone");
  }

  res.json({ success: true, message: "College info updated (runtime)", updated });
});

// DELETE lead
router.delete("/leads/:id", adminAuth, (req, res) => {
  const idx = leadsStore.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: "Lead not found" });
  leadsStore.splice(idx, 1);
  res.json({ success: true, message: "Lead deleted" });
});

// ========== GROQ API KEY ROTATION MANAGEMENT ==========

// Get Groq API key rotation statistics
router.get("/groq-keys", adminAuth, (req, res) => {
  try {
    const stats = keyRotation.getStats();
    res.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error getting key stats:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset a specific key (remove from cooldown/error state)
router.post("/groq-keys/reset/:keyIndex", adminAuth, (req, res) => {
  try {
    const keyIndex = parseInt(req.params.keyIndex);
    if (isNaN(keyIndex)) {
      return res.status(400).json({ success: false, error: "Invalid key index" });
    }
    
    const result = keyRotation.resetKey(keyIndex);
    if (result) {
      res.json({ success: true, message: `Key ${keyIndex + 1} has been reset to active state` });
    } else {
      res.status(404).json({ success: false, error: "Key not found" });
    }
  } catch (err) {
    console.error("Error resetting key:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset all keys
router.post("/groq-keys/reset-all", adminAuth, (req, res) => {
  try {
    keyRotation.resetAllKeys();
    res.json({ success: true, message: "All keys have been reset to active state" });
  } catch (err) {
    console.error("Error resetting all keys:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manually set current active key
router.post("/groq-keys/set-current/:keyIndex", adminAuth, (req, res) => {
  try {
    const keyIndex = parseInt(req.params.keyIndex);
    if (isNaN(keyIndex)) {
      return res.status(400).json({ success: false, error: "Invalid key index" });
    }
    
    const result = keyRotation.setCurrentKey(keyIndex);
    if (result) {
      res.json({ success: true, message: `Current active key set to ${keyIndex + 1}` });
    } else {
      res.status(400).json({ success: false, error: "Invalid key index" });
    }
  } catch (err) {
    console.error("Error setting current key:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
