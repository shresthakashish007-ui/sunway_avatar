/**
 * SUNWAY COLLEGE KATHMANDU — Official Knowledge Database
 * Source: Sunway College 2026/27 Prospectus + Official Website
 * Every record contains: source, sourceDate, lastVerified, priority
 *
 * Priority: 1 = highest (admin-entered), 5 = lowest (older docs)
 * NEVER use this data directly in Groq prompt — use retrievalService.js
 */

// ─── COLLEGE PROFILE ──────────────────────────────────────────────────────
export const college = {
  name: "Sunway College Kathmandu",
  shortName: "Sunway",
  tagline: "Creating AI Leaders",
  description: "Sunway College Kathmandu is a leading private college in Nepal offering internationally-partnered undergraduate programs in Computer Science, Business Information Technology and Business Administration.",
  established: 2007,
  location: {
    address: "Behind Maitidevi Temple, Maitidevi, Kathmandu, Nepal",
    mapUrl: "https://maps.google.com/?q=Sunway+College+Kathmandu+Maitidevi",
    landmark: "Behind Maitidevi Temple",
    area: "Maitidevi, Kathmandu",
  },
  contact: {
    phones: ["01-4531725", "01-4523736", "9823047066"],
    email: "info@sunway.edu.np",
    admissionEmail: "admission@sunway.edu.np",
    website: "https://sunway.edu.np",
    officeHours: "Sunday–Friday: 9:00 AM – 5:00 PM",
  },
  socialLinks: {
    facebook: "https://www.facebook.com/SunwayCollegeKathmandu",
    instagram: "https://instagram.com/sunwaycollege",
  },
  logo: "https://media.edusanjal.com/__sized__/logos/sunway_lolo-thumbnail-200x200-70.jpg",
  source: "official-website",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── WHY SUNWAY ───────────────────────────────────────────────────────────
export const whySunway = {
  stats: [
    { label: "Alumni Network", value: "1200+", icon: "users" },
    { label: "Placement Rate", value: "95%", icon: "briefcase" },
    { label: "Years of Excellence", value: "15+", icon: "star" },
    { label: "Industry Partners", value: "60+", icon: "building" },
  ],
  pillars: [
    {
      title: "Strong Industry Connections",
      description: "60+ Nepal IT firms and corporate partners enabling internships, live projects and career placement.",
    },
    {
      title: "Practice-Based Learning",
      description: "Curriculum built around hands-on projects, case studies and industry exposure rather than theory alone.",
    },
    {
      title: "Industry Standard Facilities",
      description: "Innovation Lab, modern computer labs and collaborative learning spaces designed for tech-focused education.",
    },
    {
      title: "Upskilling Certification Courses",
      description: "Additional certification programs to complement your degree and enhance employability.",
    },
    {
      title: "Industry Relevant Curriculum",
      description: "Programs designed in collaboration with Birmingham City University to meet current industry demands.",
    },
    {
      title: "Research & Incubation Support",
      description: "RAIN (Research and Incubation Center) supports student entrepreneurs from ideation to market-ready ventures.",
    },
  ],
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── UNIVERSITY PARTNER: BCU ──────────────────────────────────────────────
export const universityPartner = {
  id: "bcu",
  name: "Birmingham City University",
  shortName: "BCU",
  country: "United Kingdom",
  logo: "/assets/images/bcu-logo.png",
  website: "https://www.bcu.ac.uk",
  partnershipNote: "Sunway College Kathmandu works in academic partnership with Birmingham City University, UK. Sunway is NOT Birmingham City University — it is an academic partner college that delivers BCU-validated programs in Nepal.",
  aboutBCU: "Birmingham City University (BCU) is a large public university located in Birmingham, UK. It is known for its practice-based learning approach and strong industry connections.",
  rankingNote: "For current BCU ranking, please refer to the official QS World University Rankings or BCU's official website as rankings are updated annually.",
  partnershipBenefits: [
    "BCU-validated and awarded degrees",
    "Same curriculum as BCU UK campus",
    "BCU transcripts and certificates",
    "Practice-based learning methodology",
    "Access to BCU's global alumni network",
  ],
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── PROGRAMS ────────────────────────────────────────────────────────────
export const programs = [
  {
    id: "csai",
    officialName: "BSc (Hons) Computer Science with Artificial Intelligence",
    shortName: "BSc CSAI",
    abbreviation: "CSAI",
    duration: "4 Years",
    credits: 480,
    studyMode: "Full-time",
    awardingBody: "Birmingham City University, UK",
    coordinator: "Mr. Rupak Koirala",
    description: "This program combines foundational computer science with artificial intelligence, covering computational thinking, programming, data structures, algorithms and advanced AI concepts including machine learning and data science.",
    eligibility: {
      neb: {
        requirement: "NEB Grade 12 or equivalent",
        minCGPA: 2.6,
        note: "Minimum aggregate CGPA of 2.6",
      },
      aLevel: {
        requirement: "A-Levels",
        minCredits: "3.0 credits with Grade D or above",
        ucasNote: "Applicable UCAS requirements apply — verify with admissions.",
      },
      english: {
        gradeA_above: "Grade A and above in Grade 12 English — No English Proficiency Test required.",
        gradeB_Bplus: "Grade B / B+ — Follow current BCU English Proficiency Test (EPT) requirements. EPT fee approx. NPR 15,000.",
        belowGradeB: "Below Grade B — BCU-recognized English proficiency certificate required. Check current requirements with admissions.",
        note: "English requirements are subject to BCU policy updates. Always confirm with admissions.",
      },
    },
    careers: [
      "Software Developer", "Software Engineer", "Web Developer", "Computer Programmer",
      "Java Developer", "Python Programmer", "Computer Scientist", "Machine Learning Scientist",
      "Artificial Intelligence Engineer", "Artificial Intelligence Developer",
      "Data Scientist", "Data Engineer", "Backend Developer", "Analyst",
      "Machine Learning Operations Engineer",
    ],
    source: "sunway-prospectus-2026",
    sourceDate: "2026",
    lastVerified: "2026-07",
    priority: 1,
  },
  {
    id: "bit",
    officialName: "BSc (Hons) Business Information Technology",
    shortName: "BSc BIT",
    abbreviation: "BIT",
    duration: "3 Years",
    credits: null,
    studyMode: "Full-time",
    awardingBody: "Birmingham City University, UK",
    description: "A 3-year program designed to bridge the gap between business needs and technology solutions. Students learn solution development, business analysis, tools and techniques, entrepreneurship and practical vocational skills using industry-standard tools.",
    keyAreas: [
      "Solution Development",
      "Business Analysis Tools & Techniques",
      "Business and Entrepreneurship",
      "Practical/Vocational Learning",
      "Industry-Standard Tools",
    ],
    microsoftNote: "The program involves exposure to Microsoft ecosystem tools including Office 365, PowerApps, Power Flow, Microsoft Dynamics and Power BI. Certification arrangements should be confirmed with admissions.",
    eligibility: {
      note: "Contact Sunway College admissions for current BIT eligibility requirements.",
    },
    careers: [
      "Business Analyst", "Consultant", "IT Product Owner", "Solution Developer",
    ],
    source: "sunway-prospectus-2026",
    sourceDate: "2026",
    lastVerified: "2026-07",
    priority: 1,
  },
];

// ─── MODULES ─────────────────────────────────────────────────────────────
export const modules = {
  csai: {
    year1: {
      semester1: [
        "Computer Systems",
        "Website Design and Development",
        "Computer Programming",
      ],
      semester2: [
        "Data Structure and Algorithms",
        "Innovation Project",
        "Introduction to Artificial Intelligence",
      ],
      nonCredit: ["Non-Credit Sessions (as per BCU requirement)"],
      verified: true,
    },
    year2: { verified: false, note: "Year 2 modules not yet in verified database. Please contact admissions." },
    year3: { verified: false, note: "Year 3 modules not yet in verified database. Please contact admissions." },
    year4: { verified: false, note: "Year 4 modules not yet in verified database. Please contact admissions." },
  },
  bit: {
    year1: {
      semester1: [
        "Business Information System",
        "Computational Thinking and Professional Development",
        "Computer Systems",
      ],
      semester2: [
        "Business Information Modelling",
        "Introduction to Programming",
        "Innovation Project",
      ],
      verified: true,
    },
    year2: { verified: false, note: "Year 2 modules not yet in verified database. Please contact admissions." },
    year3: { verified: false, note: "Year 3 modules not yet in verified database. Please contact admissions." },
  },
};

// ─── FEE STRUCTURES ───────────────────────────────────────────────────────
export const fees = {
  csai: {
    programId: "csai",
    programName: "BSc (Hons) Computer Science with Artificial Intelligence",
    currency: "NPR",
    gbpRate: 190,
    gbpRateNote: "GBP amounts in fee document calculated at approx. NPR 190/GBP. Actual payment depends on current exchange rate.",
    grandTotal: 1275000,
    grandTotalNote: "Listed grand total is Rs. 12,75,000 subject to exchange rate conditions, bank charges and applicable TDS.",
    years: [
      {
        year: 1,
        items: [
          { item: "Admission Fee", amount: 80000, timing: "One Time — At time of admission", oneTime: true },
          { item: "Security Deposit", amount: 15000, timing: "One Time — At time of admission", oneTime: true },
          { item: "Annual Fee", amount: 40000, timing: "Yearly — Within 5th week of class" },
          { item: "ECA/CCA Fee", amount: 20000, timing: "Yearly — Within 1st week of class" },
          { item: "Semester One Fee", amount: 100000, timing: "Per Semester — Within 3rd week of class" },
          { item: "Semester Two Fee", amount: 100000, timing: "Per Semester — Within 3rd week of class" },
          { item: "University Registration (GBP 1,000 ≈)", amount: 190000, timing: "Yearly — At time of admission", isForeign: true, foreignAmount: "GBP 1,000" },
        ],
        total: 545000,
      },
      {
        year: 2,
        items: [
          { item: "Annual Fee", amount: 40000 },
          { item: "ECA/CCA Fee", amount: 20000 },
          { item: "Semester One Fee", amount: 100000 },
          { item: "Semester Two Fee", amount: 100000 },
          { item: "University Registration (GBP 500 ≈)", amount: 95000, isForeign: true, foreignAmount: "GBP 500" },
        ],
        total: 355000,
      },
      {
        year: 3,
        items: [
          { item: "University Registration (GBP 250 ≈)", amount: 47500, isForeign: true, foreignAmount: "GBP 250" },
        ],
        total: 67500,
        note: "Please confirm full Year 3 line items with the official fee PDF or admissions.",
      },
      {
        year: 4,
        items: [
          { item: "Annual Fee", amount: 40000 },
          { item: "ECA/CCA Fee", amount: 20000 },
          { item: "Semester One Fee", amount: 100000 },
          { item: "Semester Two Fee", amount: 100000 },
          { item: "University Registration (GBP 250 ≈)", amount: 47500, isForeign: true, foreignAmount: "GBP 250" },
        ],
        total: 307500,
      },
    ],
    additionalFees: [
      { item: "BCU EPT Test Fee (if required)", amount: "~NPR 15,000", timing: "One time", note: "Only if English Proficiency Test required" },
      { item: "MoEST Registration Fee", amount: "NPR 1,500/year", timing: "Per year" },
    ],
    scholarshipNote: "Scholarship is applicable to the college fee of the first semester. Continuation may occur according to Sunway's scholarship policy.",
    disclaimer: "Bank charges and applicable TDS are borne by the student. University fee may change according to university policy. Exchange rate varies.",
    source: "sunway-fee-pdf-2026",
    sourceDate: "2026",
    lastVerified: "2026-07",
    priority: 1,
  },

  bit: {
    programId: "bit",
    programName: "BSc (Hons) Business Information Technology",
    currency: "NPR",
    gbpRate: 190,
    gbpRateNote: "GBP amounts calculated at approx. NPR 190/GBP. Actual payment depends on current exchange rate.",
    grandTotal: 1135000,
    grandTotalNote: "Listed grand total Rs. 11,35,000 subject to exchange rate and additional charges.",
    years: [
      {
        year: 1,
        items: [
          { item: "Admission Fee", amount: 80000, timing: "One Time — At time of admission", oneTime: true },
          { item: "Security Deposit", amount: 15000, timing: "One Time — At time of admission", oneTime: true },
          { item: "Annual Fee", amount: 40000 },
          { item: "ECA/CCA Fee", amount: 20000 },
          { item: "Semester One Fee", amount: 80000 },
          { item: "Semester Two Fee", amount: 80000 },
          { item: "University Registration (GBP 1,000 ≈)", amount: 190000, isForeign: true, foreignAmount: "GBP 1,000" },
        ],
        total: 505000,
      },
      {
        year: 2,
        items: [
          { item: "Annual Fee", amount: 40000 },
          { item: "ECA/CCA Fee", amount: 20000 },
          { item: "Semester One Fee", amount: 80000 },
          { item: "Semester Two Fee", amount: 80000 },
          { item: "University Registration (GBP 500 ≈)", amount: 95000, isForeign: true, foreignAmount: "GBP 500" },
        ],
        total: 315000,
      },
      {
        year: 3,
        items: [
          { item: "Annual Fee", amount: 40000 },
          { item: "ECA/CCA Fee", amount: 20000 },
          { item: "Semester One Fee", amount: 80000 },
          { item: "Semester Two Fee", amount: 80000 },
          { item: "University Registration (GBP 500 ≈)", amount: 95000, isForeign: true, foreignAmount: "GBP 500" },
        ],
        total: 315000,
      },
    ],
    additionalFees: [
      { item: "BCU EPT Test Fee (if required)", amount: "~NPR 15,000", timing: "One time" },
      { item: "MoEST Registration Fee", amount: "NPR 1,500/year", timing: "Per year" },
    ],
    scholarshipNote: "Scholarship is applicable to the college fee of the first semester. Continuation may occur according to Sunway's scholarship policy.",
    disclaimer: "Bank charges and applicable TDS are borne by the student. University fee may change according to university policy.",
    source: "sunway-fee-pdf-2026",
    sourceDate: "2026",
    lastVerified: "2026-07",
    priority: 1,
  },
};

// ─── FEE PAYMENT SCHEDULE ────────────────────────────────────────────────
export const feeSchedule = [
  { item: "Admission Fee & BCU EPT (if applicable)", timing: "One Time", when: "At time of admission" },
  { item: "Security Deposit", timing: "One Time", when: "At time of admission" },
  { item: "University Fee", timing: "Yearly", when: "At time of admission each year" },
  { item: "ECA/CCA Fee", timing: "Yearly", when: "Within first week of class start" },
  { item: "Semester Fee", timing: "Per Semester", when: "Within third week of class start" },
  { item: "Annual Fee", timing: "Yearly", when: "Within fifth week of class start" },
];

// ─── ADMISSIONS ───────────────────────────────────────────────────────────
export const admissions = {
  applyUrl: "https://sunway.edu.np/apply",
  process: [
    "Visit Sunway College or fill the online application form.",
    "Submit required documents for verification.",
    "Complete fee payment to confirm your admission.",
    "Receive admission confirmation and class schedule.",
  ],
  requiredDocuments: [
    { item: "Grade 10 Marksheet", note: "" },
    { item: "Grade 10 Completion Certificate", note: "" },
    { item: "Grade 10 Character Certificate", note: "" },
    { item: "Grade 11 Marksheet", note: "" },
    { item: "Grade 12 Marksheet", note: "" },
    { item: "Grade 12 Provisional Certificate", note: "" },
    { item: "Grade 12 Migration Certificate", note: "" },
    { item: "Grade 12 Character Certificate", note: "" },
    { item: "Citizenship Certificate OR Passport", note: "Photocopy" },
    { item: "English Proficiency Test Marksheet", note: "If applicable as per eligibility" },
    { item: "Recommendation Letter from previous school", note: "" },
    { item: "1 Passport Size Photo", note: "" },
  ],
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── SCHOLARSHIPS ─────────────────────────────────────────────────────────
export const scholarships = {
  generalNote: "Scholarship is applicable to the college fee of the first semester. Continuation may occur according to Sunway's scholarship policy. For current scholarship amounts and eligibility, please contact the admissions office — do not rely on third-party or outdated sources.",
  types: [
    {
      id: "merit",
      name: "Merit-Based Scholarship",
      description: "Awarded to academically outstanding students based on Grade 12 results.",
      note: "Exact percentage/amount subject to current scholarship policy. Contact admissions.",
    },
    {
      id: "sports",
      name: "Sports Scholarship",
      description: "For national/provincial level sports achievers.",
      note: "Contact admissions for current eligibility and amount.",
    },
  ],
  source: "sunway-fee-pdf-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── PLACEMENT & CAREERS ──────────────────────────────────────────────────
export const placement = {
  alumniNetwork: "1200+",
  placementRate: "95%",
  industryPartnerCount: "60+",
  disclaimer: "95% placement rate and partner statistics are from Sunway's latest prospectus. These represent placement support outcomes and industry connections — they do not constitute a guarantee of individual employment.",
  services: [
    "Career counseling and CV support",
    "Mock interviews",
    "Internship placements",
    "Industry project collaborations",
    "Job placement support through partner network",
  ],
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── RESEARCH & INCUBATION (RAIN) ─────────────────────────────────────────
export const rain = {
  id: "rain",
  name: "Sunway Research and Incubation Center",
  shortName: "RAIN",
  tagline: "Transform impactful ideas into market-ready ventures",
  description: "RAIN is Sunway College's dedicated research and incubation center that helps students and entrepreneurs turn ideas into real businesses through a structured support framework.",
  stages: [
    "Market Research",
    "Innovation and Design Thinking",
    "Value Proposition Development",
    "Business Model Development",
    "Prototyping",
    "Product Development",
    "MVP Development",
    "Go-to-Market Strategy",
    "Customer Acquisition",
  ],
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── INNOVATION LAB ───────────────────────────────────────────────────────
export const innovationLab = {
  id: "innovation-lab",
  name: "Sunway Innovation Lab",
  description: "Sunway's Innovation Lab is a modern facility for hands-on technology exploration and project development. The prospectus showcases practical technology projects developed by students.",
  note: "Specific equipment details should be confirmed with the college as facilities may be updated.",
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── ACADEMIC ADVISORY ────────────────────────────────────────────────────
export const academicAdvisory = {
  id: "academic-advisory",
  name: "Academic Advisory Unit",
  description: "Personalized academic support helping students navigate their education, align coursework with career goals and address challenges early.",
  benefits: [
    "Personalized Guidance",
    "Resource Connection",
    "Goal Achievement Support",
    "Early Intervention",
    "Inclusivity",
  ],
  process: [
    "Dedicated time with assigned academic advisor",
    "Flexible advising sessions",
    "Structured feedback and planning",
    "Faculty allocate 2 hours weekly for advising",
  ],
  facultyHoursPerWeek: 2,
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── STUDENT LIFE / SSRC ──────────────────────────────────────────────────
export const studentLife = {
  ssrc: {
    name: "Sunway Student Representative Council",
    shortName: "SSRC",
    description: "SSRC represents student interests and organizes events, clubs and student activities.",
    note: "SSRC members change frequently. Contact Sunway College for the current council members.",
    members: [], // Populated by admin — never hardcoded
  },
  clubs: [
    { name: "Multimedia Club", category: "Creative" },
    { name: "Literary Club", category: "Academic" },
    { name: "Sports Club", category: "Sports" },
    { name: "Entrepreneurship & AI Club", category: "Technology" },
    { name: "Creativity Club", category: "Creative" },
    { name: "Social Club", category: "Social" },
  ],
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── INDUSTRY PARTNERS ────────────────────────────────────────────────────
export const industryPartners = {
  count: "60+",
  note: "Sunway's latest prospectus highlights 60+ industry partners. For a current full list, please refer to the official prospectus or Sunway website.",
  featuredPartners: [], // Add partner logos/names here as they are officially provided
  source: "sunway-prospectus-2026",
  sourceDate: "2026",
  lastVerified: "2026-07",
  priority: 1,
};

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────
export const testimonials = []; // Populated from admin — never invented by AI

// ─── LEADS STORE ─────────────────────────────────────────────────────────
export const leadsStore = [];

// ─── DEFAULT EXPORT ───────────────────────────────────────────────────────
export default {
  college, whySunway, universityPartner, programs, modules,
  fees, feeSchedule, admissions, scholarships, placement,
  rain, innovationLab, academicAdvisory, studentLife,
  industryPartners, testimonials, leadsStore,
};
