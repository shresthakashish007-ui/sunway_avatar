import express from "express";
import collegeData, { leadsStore } from "../database/collegeData.js";
import keyRotation from "../services/groqKeyRotation.js";

const router = express.Router();

// Simple admin auth middleware
function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (token !== process.env.ADMIN_PASSWORD) {
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
  res.json({ success: true, data: collegeData });
});

// UPDATE college basic info (runtime only — for persistent, write to DB)
router.patch("/college", adminAuth, (req, res) => {
  const allowed = ["name","description","phone","email","address","tagline"];
  allowed.forEach(k => {
    if (req.body[k]) collegeData.college[k] = String(req.body[k]).slice(0, 300);
  });
  res.json({ success: true, message: "College info updated (runtime)" });
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
