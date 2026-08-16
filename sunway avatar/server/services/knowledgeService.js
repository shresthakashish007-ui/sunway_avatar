/**
 * Knowledge Service
 * Retrieves relevant college data based on detected intent.
 * Reduces hallucination by providing only relevant context to Groq.
 */
import collegeData from "../database/collegeData.js";

// ─── Fuzzy keyword matching ────────────────────────────────────────────────
const intentPatterns = [
  { intent: "fees",        keywords: ["fee", "fees", "cost", "tuition", "charge", "payment", "kitna", "kati", "shulk", "paisa"] },
  { intent: "bca",         keywords: ["bca", "bachelor computer application", "computer application"] },
  { intent: "bbs",         keywords: ["bbs", "business studies", "bachelor business", "business"] },
  { intent: "bsc-csit",    keywords: ["csit", "bsc csit", "computer science", "information technology", "bsc"] },
  { intent: "mbs",         keywords: ["mbs", "master business", "postgraduate", "pg", "masters"] },
  { intent: "admission",   keywords: ["admission", "apply", "join", "enroll", "enroll", "bharthi", "bharna", "form", "how to join", "application"] },
  { intent: "scholarship", keywords: ["scholarship", "discount", "aid", "waiver", "free", "छात्रवृत्ति", "bursary"] },
  { intent: "library",     keywords: ["library", "book", "pustakalaya", "reading", "librari"] },
  { intent: "computer-lab",keywords: ["computer lab", "lab", "laboratory", "computer room"] },
  { intent: "faculty",     keywords: ["faculty", "teacher", "professor", "staff", "sir", "madam", "principal", "hod", "head"] },
  { intent: "principal",   keywords: ["principal", "director", "head of college", "pradhanachary"] },
  { intent: "courses",     keywords: ["course", "program", "programme", "degree", "study", "padhna", "padhai"] },
  { intent: "facilities",  keywords: ["facility", "facilities", "campus", "infrastructure", "hostel", "cafeteria", "sports", "auditorium"] },
  { intent: "contact",     keywords: ["contact", "phone", "number", "address", "location", "where", "email", "kaha"] },
  { intent: "map",         keywords: ["map", "direction", "location", "address", "how to reach", "kaha cha"] },
  { intent: "gallery",     keywords: ["gallery", "photo", "picture", "image", "dekha", "dikhao"] },
  { intent: "panorama",    keywords: ["360", "virtual tour", "panorama", "tour", "view"] },
  { intent: "welcome",     keywords: ["hello", "hi", "namaste", "namaskar", "hey", "start", "help"] },
];

function detect(message) {
  const lower = message.toLowerCase();
  const detected = [];
  for (const p of intentPatterns) {
    if (p.keywords.some(k => lower.includes(k))) {
      detected.push(p.intent);
    }
  }
  return detected;
}

function detectCourse(message) {
  const lower = message.toLowerCase();
  if (lower.includes("bsc") || lower.includes("csit")) return "bsc-csit";
  if (lower.includes("mbs")) return "mbs";
  if (lower.includes("bbs") || lower.includes("business")) return "bbs";
  if (lower.includes("bca")) return "bca";
  return null;
}

// ─── Build context text to inject into Groq prompt ────────────────────────
export function buildContext(message, conversationHistory = [], sessionContext = {}) {
  const intents    = detect(message);
  const courseId   = detectCourse(message) || sessionContext.activeCourse;
  const college    = collegeData.college;
  const lines      = [];

  lines.push(`College: ${college.name}`);
  lines.push(`Address: ${college.address}`);
  lines.push(`Phone: ${college.phone} | Email: ${college.email}`);
  lines.push(`Established: ${college.established} | Affiliation: Tribhuvan University`);

  // Courses overview always available
  if (intents.includes("courses") || intents.includes("welcome")) {
    lines.push("\nAVAILABLE COURSES:");
    collegeData.courses.forEach(c => {
      lines.push(`- ${c.name} (${c.shortName}): ${c.duration}, Eligibility: ${c.eligibility}`);
    });
  }

  // Specific course detail
  if (courseId && collegeData.courses.find(c => c.id === courseId)) {
    const course = collegeData.courses.find(c => c.id === courseId);
    lines.push(`\nCOURSE DETAIL - ${course.name}:`);
    lines.push(`Duration: ${course.duration}`);
    lines.push(`University: ${course.university}`);
    lines.push(`Description: ${course.description}`);
    lines.push(`Eligibility: ${course.eligibility}`);
    lines.push(`Intake: ${course.intake}`);
    lines.push(`Career Opportunities: ${course.careerOpportunities.join(", ")}`);
  }

  // Fees
  if (intents.includes("fees") && courseId && collegeData.fees[courseId]) {
    const fee = collegeData.fees[courseId];
    lines.push(`\nFEE STRUCTURE - ${courseId.toUpperCase()}:`);
    fee.breakdown.forEach(b => lines.push(`  ${b.item}: NPR ${b.amount.toLocaleString()}`));
    lines.push(`  Estimated First Year Total: NPR ${fee.totalFirstYear.toLocaleString()}`);
    lines.push(`  Note: ${fee.note}`);
  } else if (intents.includes("fees") && !courseId) {
    lines.push("\nFEE SUMMARY (all courses):");
    Object.entries(collegeData.fees).forEach(([id, f]) => {
      const course = collegeData.courses.find(c => c.id === id);
      lines.push(`  ${course?.shortName || id}: ~NPR ${f.totalFirstYear.toLocaleString()}/first year`);
    });
  }

  // Admissions
  if (intents.includes("admission")) {
    const adm = collegeData.admissions;
    lines.push("\nADMISSION PROCESS:");
    adm.process.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`));
    lines.push(`Required Documents: ${adm.requiredDocuments.slice(0, 4).join(", ")}`);
    lines.push(`Deadlines: Fall – ${adm.deadlines.fallSemester}, Spring – ${adm.deadlines.springSemester}`);
    lines.push(`Contact: ${adm.contactPhone} | ${adm.contactEmail}`);
  }

  // Scholarships
  if (intents.includes("scholarship")) {
    lines.push("\nSCHOLARSHIPS:");
    collegeData.scholarships.forEach(s => {
      lines.push(`  ${s.name}: ${s.amount} — ${s.eligibility}`);
    });
  }

  // Faculty / Principal
  if (intents.includes("faculty") || intents.includes("principal")) {
    lines.push("\nFACULTY:");
    collegeData.faculty.forEach(f => {
      lines.push(`  ${f.name} – ${f.designation} (${f.department}): ${f.bio}`);
    });
  }

  // Facilities
  if (intents.includes("facilities") || intents.includes("library") || intents.includes("computer-lab")) {
    lines.push("\nFACILITIES:");
    Object.values(collegeData.facilities).forEach(f => {
      lines.push(`  ${f.title}: ${f.description}`);
    });
  }

  // Contact / Map
  if (intents.includes("contact") || intents.includes("map")) {
    const c = collegeData.contact;
    lines.push(`\nCONTACT: Phone: ${c.phone}, Email: ${c.email}, Address: ${c.address}`);
    lines.push(`Office Hours: ${c.officeHours}`);
  }

  // FAQs always a safety net
  const relevantFaqs = collegeData.faqs.filter(f => {
    const fLower = (f.question + f.answer).toLowerCase();
    return intents.some(i => fLower.includes(i));
  });
  if (relevantFaqs.length) {
    lines.push("\nRELEVANT FAQs:");
    relevantFaqs.forEach(f => lines.push(`  Q: ${f.question}\n  A: ${f.answer}`));
  }

  return {
    collegeName: college.name,
    contextText: lines.join("\n"),
    detectedIntents: intents,
    detectedCourse:  courseId,
  };
}

// ─── Resource lookup by resourceId ────────────────────────────────────────
export function getResource(type, resourceId) {
  switch (type) {
    case "fees":
      return collegeData.fees[resourceId] || null;
    case "course":
      return collegeData.courses.find(c => c.id === resourceId) || null;
    case "faculty": {
      const member = collegeData.faculty.find(f => f.id === resourceId);
      if (!member && resourceId === "all") return collegeData.faculty;
      return member || null;
    }
    case "facility":
      return collegeData.facilities[resourceId] || null;
    case "scholarship":
      return collegeData.scholarships.find(s => s.id === resourceId) || null;
    case "college":
      return collegeData.college;
    case "admissions":
      return collegeData.admissions;
    case "courses":
      return collegeData.courses;
    case "contact":
      return collegeData.contact;
    case "scholarships":
      return collegeData.scholarships;
    default:
      return null;
  }
}

export default { buildContext, getResource };
