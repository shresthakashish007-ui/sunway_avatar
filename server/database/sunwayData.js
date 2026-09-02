/**
 * College data — now loaded from the active college's data.json.
 *
 * The content that used to be hard-coded here lives in
 * server/colleges/<slug>/data.json and is edited through the admin panel
 * (/admin.html). This module keeps the original export shape so every
 * existing importer keeps working unchanged.
 *
 * Note the getters: they read through the store on each access, so admin
 * edits take effect without restarting the server.
 */
import { getData, getActiveSlug } from "../services/collegeStore.js";

const pick = (key, fallback) => {
  const v = getData()?.[key];
  return v === undefined ? fallback : v;
};

export const db = {
  get college()          { return pick("college", {}); },
  get whySunway()        { return pick("whySunway", { stats: [], pillars: [] }); },
  get universityPartner(){ return pick("universityPartner", {}); },
  get programs()         { return pick("programs", []); },
  get modules()          { return pick("modules", {}); },
  get fees()             { return pick("fees", {}); },
  get feeSchedule()      { return pick("feeSchedule", []); },
  get admissions()       { return pick("admissions", { process: [], requiredDocuments: [] }); },
  get scholarships()     { return pick("scholarships", { types: [] }); },
  get placement()        { return pick("placement", {}); },
  get rain()             { return pick("rain", {}); },
  get innovationLab()    { return pick("innovationLab", {}); },
  get academicAdvisory() { return pick("academicAdvisory", {}); },
  get studentLife()      { return pick("studentLife", { clubs: [] }); },
  get industryPartners() { return pick("industryPartners", {}); },
  get testimonials()     { return pick("testimonials", []); },
  get leadsStore()       { return leadsStore; },
  get activeCollege()    { return getActiveSlug(); },
};

// Leads are runtime-only (never persisted to data.json) and must stay the
// same array instance across reloads, since routes push into it directly.
export const leadsStore = [];

export default db;
