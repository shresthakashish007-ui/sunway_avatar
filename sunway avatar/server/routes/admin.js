import express from "express";
import collegeData, { leadsStore } from "../database/collegeData.js";

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

export default router;
