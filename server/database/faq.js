/**
 * Q&A entries — now loaded from the active college's faq.json.
 *
 * Edit them in the admin panel at  http://localhost:3001/admin.html
 * (or by hand in server/colleges/<slug>/faq.json).
 *
 * Each entry looks like:
 *   {
 *     "q":    "Do you provide hostel facilities?",
 *     "alt":  ["hostel cha?", "is there accommodation"],
 *     "a":    "We do not run a hostel, but we help students find rooms nearby.",
 *     "tags": ["hostel"],
 *     "visual": "SHOW_CONTACT",     // optional: panel to open
 *     "resourceId": ""              // optional: "csai" / "bit" for program panels
 *   }
 */
import { getFaqs } from "../services/collegeStore.js";

/** Current Q&A list for the active college. */
export function loadFaqs() {
  const list = getFaqs();
  return Array.isArray(list) ? list.filter(e => e && typeof e.q === "string" && typeof e.a === "string") : [];
}

export const faqs = loadFaqs();
export default faqs;
