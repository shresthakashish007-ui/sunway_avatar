/**
 * College branding — loaded once at startup from /api/resources/college-config.
 *
 * Everything that differs between colleges (name, colours, logo, apply link,
 * tour link) comes from the active college's config.json, which is edited in
 * the admin panel. Nothing about a specific college should be hard-coded in
 * components any more.
 *
 * Colours are published as CSS variables so they can be used from inline
 * styles as `var(--brand)` and change with the college.
 */

// Sensible defaults so the UI still renders if the API is unreachable.
export const DEFAULT_CONFIG = {
  slug: "",
  name: "College",
  shortName: "College",
  tagline: "",
  assistantName: "AI Assistant",
  builtBy: "Pranam Software — Nepal-based AI company.",
  brandColor: "#B51F24",
  brandColorDark: "#8F171B",
  logoUrl: "",
  buildingImage: "",
  pageBackground: "",
  avatarBackground: "",
  applyUrl: "",
  virtualTourUrl: "",
  website: "",
  // Spoken on arrival. Empty falls back to an English line built from the
  // college name (see useWelcomeGreeting in App.jsx).
  greetingText: "",
  greetingLang: "",
};

let config = { ...DEFAULT_CONFIG };
let loaded = false;
const listeners = new Set();

/** Current branding. Safe to call before load() resolves — returns defaults. */
export function getCollegeConfig() {
  return config;
}

export function onConfigChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Lighten a hex colour toward white — used for the soft tinted backgrounds
// that were previously hard-coded alongside each brand colour.
function tint(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

// "#B51F24" -> "181, 31, 36" so styles can build rgba() at any opacity.
function toRgbTriplet(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "181, 31, 36";
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function applyCssVariables(cfg) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--brand", cfg.brandColor);
  root.setProperty("--brand-dark", cfg.brandColorDark);
  root.setProperty("--brand-light", tint(cfg.brandColor, 0.88));
  root.setProperty("--brand-lighter", tint(cfg.brandColor, 0.95));
  root.setProperty("--brand-border", tint(cfg.brandColor, 0.78));
  // Needed because the UI builds translucent shades at call sites. The old
  // code appended hex alpha (`${SUNWAY_RED}15`), which cannot work once the
  // colour is a CSS variable — those are rgba(var(--brand-rgb), …) now.
  root.setProperty("--brand-rgb", toRgbTriplet(cfg.brandColor));
}

/** Fetch branding once. Resolves to the config either way. */
export async function loadCollegeConfig() {
  if (loaded) return config;
  try {
    const res = await fetch("/api/resources/college-config");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data } = await res.json();
    if (data && typeof data === "object") {
      config = { ...DEFAULT_CONFIG, ...data };
    }
    console.log(`[Config] Loaded branding for "${config.name}"`);
  } catch (err) {
    console.warn("[Config] Using default branding —", err.message);
  }
  loaded = true;
  applyCssVariables(config);
  listeners.forEach(fn => fn(config));
  return config;
}

// Paint the defaults immediately so there's no unstyled flash before the
// fetch resolves.
applyCssVariables(config);
