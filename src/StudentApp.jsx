import { useState, useEffect, useRef, createContext, useContext } from "react";

/* ═══════════════════════════════════════════════════════════
   SUPABASE CONFIG
   ─────────────────────────────────────────────────────────
   Replace these two values with your own from:
   supabase.com → Your Project → Settings → API
═══════════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_KEY = "YOUR_ANON_PUBLIC_KEY";

/* ═══════════════════════════════════════════════════════════
   SUPABASE CLIENT (no npm needed — raw fetch wrapper)
═══════════════════════════════════════════════════════════ */
const sb = {
  // ── AUTH ──────────────────────────────────────────────
  async signUp(email, password, meta = {}) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
      body: JSON.stringify({ email, password, data: meta }),
    });
    return r.json();
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
  },

  async getUser(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
    return r.json();
  },

  async resetPassword(email) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
      body: JSON.stringify({ email }),
    });
    return r.json();
  },

  // ── DATABASE ──────────────────────────────────────────
  async upsertProfile(token, profile) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(profile),
    });
    return r.status < 300 ? { ok: true } : { error: await r.text() };
  },

  async getProfile(token, userId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=*`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
    const data = await r.json();
    return Array.isArray(data) ? data[0] || null : null;
  },

  async upsertProgress(token, userId, careerId, courseId, done) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ user_id: userId, career_id: careerId, course_id: courseId, done }),
    });
    return r.status < 300 ? { ok: true } : { error: await r.text() };
  },

  async getProgress(token, userId, careerId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/progress?user_id=eq.${userId}&career_id=eq.${careerId}&select=*`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
    const rows = await r.json();
    if (!Array.isArray(rows)) return {};
    return rows.reduce((acc, row) => ({ ...acc, [row.course_id]: row.done }), {});
  },

  async getLeaderboard(token, careerId) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/leaderboard?career_id=eq.${careerId}&select=*&order=completed_count.desc&limit=10`,
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` } }
    );
    return r.json();
  },
};

/* ═══════════════════════════════════════════════════════════
   SESSION STORAGE
═══════════════════════════════════════════════════════════ */
const SESSION_KEY = "askyism_session_v1";
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
  catch { return null; }
}
function saveSession(s) {
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        else localStorage.removeItem(SESSION_KEY); }
  catch {}
}

/* ═══════════════════════════════════════════════════════════
   AUTH CONTEXT
═══════════════════════════════════════════════════════════ */
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [loading, setLoading] = useState(true);

  // Verify stored token on mount
  useEffect(() => {
    async function verify() {
      if (!session?.access_token) { setLoading(false); return; }
      try {
        const user = await sb.getUser(session.access_token);
        if (user?.id) { setLoading(false); return; }
        // Token expired
        setSession(null); saveSession(null);
      } catch { /* network error — keep session */ }
      setLoading(false);
    }
    verify();
  }, []);

  async function signUp(email, password, meta) {
    const data = await sb.signUp(email, password, meta);
    if (data?.error) return { error: data.error.message || data.error };
    if (data?.id) {
      // Auto sign-in after signup
      return signIn(email, password);
    }
    return { ok: true, message: "Check your email to confirm your account." };
  }

  async function signIn(email, password) {
    const data = await sb.signIn(email, password);
    if (data?.error) return { error: data.error_description || data.error };
    if (data?.access_token) {
      const sess = { access_token: data.access_token, user: data.user };
      setSession(sess); saveSession(sess);
      return { ok: true };
    }
    return { error: "Sign in failed. Check your credentials." };
  }

  async function signOut() {
    if (session?.access_token) await sb.signOut(session.access_token).catch(() => {});
    setSession(null); saveSession(null);
  }

  async function resetPassword(email) {
    await sb.resetPassword(email);
    return { ok: true };
  }

  return (
    <AuthCtx.Provider value={{ session, loading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthCtx.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════
   FONTS & THEME
═══════════════════════════════════════════════════════════ */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#050714;font-family:'Inter',sans-serif;color:#e2e8f0}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a0d1a}::-webkit-scrollbar-thumb{background:#1a1d2e;border-radius:99px}
    input,textarea,button,select{font-family:'Inter',sans-serif}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  `}</style>
);

const T = {
  bg:"#050714", surface:"#0d1022", card:"#111425", border:"#1e2240",
  cyan:"#0DFFE0", violet:"#7B5EA7", red:"#FF4D6D", yellow:"#FFB547",
  green:"#10B981", text:"#e2e8f0", muted:"#64748b", dim:"#94a3b8",
};

/* ═══════════════════════════════════════════════════════════
   SCHOOLS DATA
═══════════════════════════════════════════════════════════ */
const SCHOOLS = {
  "School of Computing & IT":{icon:"💻",color:"#6C63FF",short:"SCIT",departments:{
    "Computer Science":{color:"#6C63FF",icon:"💻",degree:"BSc.",careers:[
      {id:"fullstack_cs",title:"Full-Stack Web Developer",icon:"🌐"},{id:"mobile_dev",title:"Mobile App Developer",icon:"📱"},
      {id:"devops",title:"DevOps / Cloud Engineer",icon:"☁️"},{id:"game_dev",title:"Game Developer",icon:"🎮"},
      {id:"blockchain",title:"Blockchain Developer",icon:"⛓️"},{id:"sysarch",title:"Systems Architect",icon:"🏗️"},
    ]},
    "Cybersecurity":{color:"#0DFFE0",icon:"🔐",degree:"BSc.",careers:[
      {id:"pentest",title:"Penetration Tester",icon:"🕵️"},{id:"soc_analyst",title:"SOC Analyst",icon:"🖥️"},
      {id:"dfir",title:"DFIR Specialist",icon:"🧪"},{id:"malware_an",title:"Malware Analyst",icon:"🦠"},
      {id:"cloud_sec",title:"Cloud Security Architect",icon:"☁️"},{id:"red_team",title:"Red Team Operator",icon:"🔴"},
      {id:"grc",title:"GRC Analyst",icon:"📋"},{id:"threat_intel",title:"Threat Intelligence Analyst",icon:"🔍"},
    ]},
    "Data Science":{color:"#FF6B6B",icon:"📊",degree:"BSc.",careers:[
      {id:"data_analyst",title:"Data Analyst",icon:"📈"},{id:"data_sci",title:"Data Scientist",icon:"🔬"},
      {id:"data_eng",title:"Data Engineer",icon:"🏭"},{id:"bi_analyst",title:"BI Analyst",icon:"💡"},
      {id:"ml_eng",title:"Machine Learning Engineer",icon:"🤖"},{id:"data_viz",title:"Data Visualization Engineer",icon:"🎨"},
    ]},
    "Software Engineering":{color:"#FFB547",icon:"⚙️",degree:"BSc.",careers:[
      {id:"backend_eng",title:"Backend Engineer",icon:"🖧"},{id:"frontend_eng",title:"Frontend Engineer",icon:"🎨"},
      {id:"qa_eng",title:"QA / Test Engineer",icon:"✅"},{id:"sre",title:"Site Reliability Engineer",icon:"📡"},
      {id:"embedded",title:"Embedded Systems Engineer",icon:"🔧"},{id:"tech_pm",title:"Technical Product Manager",icon:"📝"},
    ]},
    "Information Technology":{color:"#4ECDC4",icon:"🖧",degree:"BSc.",careers:[
      {id:"sysadmin",title:"Systems Administrator",icon:"🖥️"},{id:"net_eng",title:"Network Engineer",icon:"📡"},
      {id:"cloud_admin",title:"Cloud Administrator",icon:"☁️"},{id:"dba",title:"Database Administrator",icon:"🗄️"},
      {id:"it_sec",title:"IT Security Analyst",icon:"🔒"},{id:"it_pm",title:"IT Project Manager",icon:"📋"},
    ]},
    "Artificial Intelligence":{color:"#A855F7",icon:"🧠",degree:"BSc.",careers:[
      {id:"ai_eng",title:"AI Engineer",icon:"🤖"},{id:"nlp_eng",title:"NLP Engineer",icon:"💬"},
      {id:"cv_eng",title:"Computer Vision Engineer",icon:"👁️"},{id:"llm_eng",title:"LLM / GenAI Engineer",icon:"✨"},
      {id:"mlops",title:"MLOps Engineer",icon:"🔄"},{id:"ai_res",title:"AI Research Scientist",icon:"🔬"},
      {id:"robotics",title:"Robotics Engineer",icon:"🦾"},
    ]},
  }},
  "School of Management & Social Sciences":{icon:"🏛️",color:"#F59E0B",short:"SMSS",departments:{
    "Business Management":{color:"#F59E0B",icon:"📊",degree:"BSc.",careers:[
      {id:"brand_mgr",title:"Brand Manager",icon:"🏷️"},{id:"ops_mgr",title:"Operations Manager",icon:"⚙️"},
      {id:"hr_mgr",title:"HR Manager",icon:"👥"},{id:"strategy_con",title:"Strategy Consultant",icon:"♟️"},
      {id:"mktg_mgr",title:"Marketing Manager",icon:"📣"},{id:"supply_chain",title:"Supply Chain Manager",icon:"🔗"},
      {id:"biz_analyst",title:"Business Analyst",icon:"📋"},
    ]},
    "Economics":{color:"#10B981",icon:"📉",degree:"BSc.",careers:[
      {id:"economist",title:"Economist",icon:"📊"},{id:"policy_analyst",title:"Policy Analyst",icon:"📜"},
      {id:"fin_economist",title:"Financial Economist",icon:"💰"},{id:"dev_economist",title:"Development Economist",icon:"🌍"},
      {id:"research_analyst",title:"Research Analyst",icon:"🔬"},
    ]},
    "Accounting":{color:"#3B82F6",icon:"🧾",degree:"BSc.",careers:[
      {id:"auditor",title:"Auditor",icon:"🔍"},{id:"tax_consultant",title:"Tax Consultant",icon:"📋"},
      {id:"fin_accountant",title:"Financial Accountant",icon:"📊"},{id:"mgmt_accountant",title:"Management Accountant",icon:"📈"},
      {id:"forensic_acc",title:"Forensic Accountant",icon:"🕵️"},{id:"cfo_track",title:"CFO / Finance Director",icon:"👔"},
    ]},
    "Entrepreneurship":{color:"#EF4444",icon:"🚀",degree:"BSc.",careers:[
      {id:"startup_founder",title:"Startup Founder / CEO",icon:"🚀"},{id:"vc_analyst",title:"VC / Startup Analyst",icon:"💼"},
      {id:"biz_dev",title:"Business Development Manager",icon:"🤝"},{id:"social_ent",title:"Social Entrepreneur",icon:"🌱"},
      {id:"product_mgr",title:"Product Manager",icon:"📱"},
    ]},
    "Public Policy & Administration":{color:"#8B5CF6",icon:"🏛️",degree:"BSc.",careers:[
      {id:"civil_servant",title:"Civil Servant",icon:"🏛️"},{id:"govt_policy",title:"Government Policy Analyst",icon:"📜"},
      {id:"ngo_pm",title:"NGO Programme Manager",icon:"🌍"},{id:"govt_relations",title:"Government Relations Specialist",icon:"🤝"},
      {id:"intl_dev",title:"International Development Officer",icon:"✈️"},
    ]},
    "Criminology & Security Studies":{color:"#DC2626",icon:"🔐",degree:"BSc.",careers:[
      {id:"crime_analyst",title:"Crime & Intelligence Analyst",icon:"🔍"},{id:"security_con",title:"Security Consultant",icon:"🛡️"},
      {id:"probation_off",title:"Probation Officer",icon:"⚖️"},{id:"law_research",title:"Criminology Researcher",icon:"📚"},
      {id:"counter_intel",title:"Counter-Intelligence Officer",icon:"🕵️"},
    ]},
  }},
  "School of Communications & Media":{icon:"📡",color:"#EC4899",short:"SCM",departments:{
    "Mass Communication & Media Studies":{color:"#EC4899",icon:"📡",degree:"BSc.",careers:[
      {id:"journalist",title:"Journalist / Reporter",icon:"📰"},{id:"pr_specialist",title:"PR Specialist",icon:"🗣️"},
      {id:"content_creator",title:"Digital Content Creator",icon:"🎬"},{id:"broadcast_prod",title:"Broadcast Producer",icon:"📺"},
      {id:"media_researcher",title:"Media Researcher",icon:"🔬"},{id:"advert_strat",title:"Advertising Strategist",icon:"📣"},
      {id:"social_media_mgr",title:"Social Media Manager",icon:"📱"},
    ]},
  }},
  "School of Allied Health Sciences":{icon:"🏥",color:"#06B6D4",short:"SAHS",departments:{
    "Public Health":{color:"#06B6D4",icon:"🏥",degree:"BSc.",careers:[
      {id:"epidemiologist",title:"Epidemiologist",icon:"🔬"},{id:"health_promo",title:"Health Promotion Officer",icon:"💪"},
      {id:"pub_health_analyst",title:"Public Health Analyst",icon:"📊"},{id:"global_health",title:"Global Health Consultant",icon:"🌍"},
      {id:"env_health_off",title:"Environmental Health Officer",icon:"🌿"},
    ]},
    "Nursing Science":{color:"#F472B6",icon:"🩺",degree:"BSc.",careers:[
      {id:"clinical_nurse",title:"Clinical Nurse (RN)",icon:"🩺"},{id:"nurse_educator",title:"Nurse Educator",icon:"📚"},
      {id:"comm_nurse",title:"Community Health Nurse",icon:"🏘️"},{id:"icu_nurse",title:"Critical Care / ICU Nurse",icon:"❤️"},
      {id:"nurse_mgr",title:"Nurse Manager / CNO",icon:"👔"},
    ]},
    "Community Health Science":{color:"#34D399",icon:"🤝",degree:"B.CHS.",careers:[
      {id:"comm_health_wkr",title:"Community Health Worker",icon:"🤝"},{id:"health_educator",title:"Health Educator",icon:"📋"},
      {id:"outreach_coord",title:"Outreach Coordinator",icon:"📍"},{id:"chew",title:"CHEW",icon:"🏥"},
    ]},
    "Environmental Health Science":{color:"#86EFAC",icon:"🌿",degree:"B.EHS.",careers:[
      {id:"env_health_spec",title:"Environmental Health Specialist",icon:"🌿"},{id:"occ_health",title:"Occupational Health Specialist",icon:"⛑️"},
      {id:"food_safety",title:"Food Safety Inspector",icon:"🍽️"},{id:"waste_mgmt",title:"Waste Management Officer",icon:"♻️"},
    ]},
  }},
  "School of Education":{icon:"🎓",color:"#F97316",short:"SOE",departments:{
    "Primary Education":{color:"#F97316",icon:"📖",degree:"B.Ed.",careers:[
      {id:"primary_teacher",title:"Primary School Teacher",icon:"✏️"},{id:"edu_coordinator",title:"Education Coordinator",icon:"📋"},
      {id:"curriculum_dev",title:"Curriculum Developer",icon:"📚"},{id:"school_admin",title:"School Administrator",icon:"🏫"},
      {id:"edu_consultant",title:"Education Consultant",icon:"💡"},
    ]},
    "Early Childhood Education":{color:"#FCD34D",icon:"🧒",degree:"B.Ed.",careers:[
      {id:"nursery_teacher",title:"Nursery / Pre-School Teacher",icon:"🧸"},{id:"child_dev_spec",title:"Child Development Specialist",icon:"🌱"},
      {id:"family_support",title:"Family Support Worker",icon:"👨‍👩‍👧"},{id:"ece_admin",title:"Early Years Centre Administrator",icon:"🏫"},
    ]},
  }},
};

function getAllDepts() {
  const map = {};
  for (const [school, sd] of Object.entries(SCHOOLS))
    for (const [dept, dd] of Object.entries(sd.departments))
      map[dept] = { ...dd, school };
  return map;
}
const ALL_DEPTS = getAllDepts();

/* ═══════════════════════════════════════════════════════════
   ROADMAPS (sample — same pattern as full app)
═══════════════════════════════════════════════════════════ */
const ROADMAPS = {
  pentest:{certPath:["CompTIA Security+","eJPT","OSCP","CRTO"],stages:[
    {level:"Beginner",color:"#0DFFE0",courses:[
      {id:"pt_b1",title:"Linux for Hackers",duration:"5h 20m",ytId:"U1w4T03B98I",lab:true,desc:"Master the Linux terminal, permissions, and Bash scripting."},
      {id:"pt_b2",title:"Networking Fundamentals (TCP/IP)",duration:"3h 10m",ytId:"qiQR5rTSshw",lab:true,desc:"Subnets, routing, protocols, and packet analysis."},
      {id:"pt_b3",title:"Introduction to Ethical Hacking",duration:"2h 45m",ytId:"3Kq1MIfTWCE",lab:false,desc:"Methodology, legal framework, and phases of a pentest."},
    ]},
    {level:"Intermediate",color:"#FFB547",courses:[
      {id:"pt_i1",title:"Web App Hacking — OWASP Top 10",duration:"8h 00m",ytId:"F5KJVuii0Yw",lab:true,desc:"SQLi, XSS, IDOR, SSRF — exploit every OWASP vulnerability."},
      {id:"pt_i2",title:"Active Directory Attacks",duration:"5h 00m",ytId:"jUc1J31DNdw",lab:true,desc:"BloodHound, Kerberoasting, pass-the-hash, DCSync."},
    ]},
    {level:"Advanced",color:"#FF4D6D",courses:[
      {id:"pt_a1",title:"Buffer Overflow & Exploit Development",duration:"4h 30m",ytId:"1S0aBV-Waeo",lab:true,desc:"Write custom exploits. Stack overflows, ASLR/DEP bypass."},
      {id:"pt_a2",title:"Red Team C2 Frameworks",duration:"5h 00m",ytId:"jUc1J31DNdw",lab:true,desc:"Cobalt Strike concepts, Havoc C2, and evasion techniques."},
    ]},
  ]},
  fullstack_cs:{certPath:["Meta Front-End Cert","Meta Back-End Cert","AWS Developer Associate"],stages:[
    {level:"Beginner",color:"#0DFFE0",courses:[
      {id:"fs_b1",title:"HTML & CSS — Zero to Hero",duration:"6h 00m",ytId:"G3e-cpL7ofc",lab:true,desc:"Layouts, Flexbox, Grid, responsive design."},
      {id:"fs_b2",title:"JavaScript for Beginners",duration:"8h 00m",ytId:"PkZNo7MFNFg",lab:true,desc:"Variables, DOM, events, fetch API — the language of the web."},
      {id:"fs_b3",title:"Git & GitHub",duration:"3h 00m",ytId:"RGOj5yH7evk",lab:true,desc:"Version control, branching, pull requests."},
    ]},
    {level:"Intermediate",color:"#FFB547",courses:[
      {id:"fs_i1",title:"React.js Full Course",duration:"12h 00m",ytId:"bMknfKXIFA8",lab:true,desc:"Components, hooks, state, routing, APIs."},
      {id:"fs_i2",title:"Node.js & Express",duration:"8h 00m",ytId:"Oe421EPjeBE",lab:true,desc:"REST APIs, middleware, authentication, MongoDB."},
    ]},
    {level:"Advanced",color:"#FF4D6D",courses:[
      {id:"fs_a1",title:"Next.js Full-Stack",duration:"8h 00m",ytId:"mTz0GXj8NN0",lab:true,desc:"SSR, SSG, API routes, Vercel deployment."},
      {id:"fs_a2",title:"System Design for Engineers",duration:"4h 00m",ytId:"i7twT3x5yv8",lab:false,desc:"Load balancing, caching, microservices at scale."},
    ]},
  ]},
  ml_eng:{certPath:["Google TF Developer","AWS ML Specialty","Deep Learning Specialization"],stages:[
    {level:"Beginner",color:"#0DFFE0",courses:[
      {id:"ml_b1",title:"Python for Machine Learning",duration:"6h 00m",ytId:"rfscVS0vtbw",lab:true,desc:"NumPy, Pandas, Matplotlib, scikit-learn from scratch."},
      {i
