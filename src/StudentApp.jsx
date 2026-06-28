import { useState, useEffect, useRef, createContext, useContext } from "react";

/* ═══════════════════════════════════════════════════════════
   SUPABASE CONFIG
   ─────────────────────────────────────────────────────────
   Replace these two values with your own from:
   supabase.com → Your Project → Settings → API
═══════════════════════════════════════════════════════════ */
const SUPABASE_URL = https://ypuvvnbkaqpblcrabxdd.supabase.co
const SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdXZ2bmJrYXFwYmxjcmFieGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MDg2NDIsImV4cCI6MjA5ODA4NDY0Mn0.23MB2QZERRSkw5bcS6wJ-MsLo5LfovdawA9_CcArgew

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
      {id:"ml_b2",title:"Your First ML Model",duration:"2h 30m",ytId:"i_LwzRVP7bg",lab:true,desc:"Train, evaluate, and improve models."},
    ]},
    {level:"Intermediate",color:"#FFB547",courses:[
      {id:"ml_i1",title:"Deep Learning with PyTorch",duration:"10h 00m",ytId:"c36lUUr864M",lab:true,desc:"CNNs, RNNs, Transformers from first principles."},
    ]},
    {level:"Advanced",color:"#FF4D6D",courses:[
      {id:"ml_a1",title:"MLOps — Production ML Systems",duration:"6h 00m",ytId:"h5wLuVDr0oc",lab:true,desc:"MLflow, Kubeflow, model monitoring, drift detection."},
    ]},
  ]},
};

function defaultRoadmap(careerTitle) {
  return {
    certPath:["Google Career Certificate","LinkedIn Learning","Coursera Professional Cert"],
    stages:[
      {level:"Beginner",color:"#0DFFE0",courses:[
        {id:"def_b1",title:`Introduction to ${careerTitle}`,duration:"2h 00m",ytId:"dQw4w9WgXcQ",lab:false,desc:`Overview of ${careerTitle} — roles, tools, and how to get started.`},
        {id:"def_b2",title:"Professional Communication",duration:"2h 00m",ytId:"videoseries",lab:false,desc:"Business communication, stakeholder management, and professional presence."},
      ]},
      {level:"Intermediate",color:"#FFB547",courses:[
        {id:"def_i1",title:"Microsoft Office Mastery",duration:"4h 00m",ytId:"PSNXoAs2ATE",lab:true,desc:"Excel, Word, PowerPoint — productivity tools every professional uses."},
        {id:"def_i2",title:"Project Management Essentials",duration:"3h 00m",ytId:"videoseries",lab:false,desc:"Plan and deliver projects on time, within budget."},
      ]},
      {level:"Advanced",color:"#FF4D6D",courses:[
        {id:"def_a1",title:"Leadership & Team Management",duration:"3h 00m",ytId:"videoseries",lab:false,desc:"Lead teams, give feedback, manage performance."},
        {id:"def_a2",title:"Career Strategy & Interview Prep",duration:"2h 30m",ytId:"Yn_vgTCl6xM",lab:false,desc:"Portfolio, networking, interviews, salary negotiation."},
      ]},
    ],
  };
}

/* ═══════════════════════════════════════════════════════════
   SMALL UI COMPONENTS
═══════════════════════════════════════════════════════════ */
function Spinner({ color = T.cyan }) {
  return <div style={{ width:20, height:20, border:`2px solid ${color}33`, borderTop:`2px solid ${color}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>;
}

function Toast({ msg, type = "success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:"fixed", bottom:24, right:24, background:type==="success"?T.green:T.red, color:"#fff", borderRadius:10, padding:"12px 20px", fontSize:13, fontWeight:700, zIndex:9999, animation:"slideUp .2s ease", boxShadow:"0 4px 24px #00000055", display:"flex", alignItems:"center", gap:8 }}>
      {type==="success"?"✓":"✕"} {msg}
    </div>
  );
}

function ProgressBar({ value = 0, color = T.cyan }) {
  return (
    <div style={{ background:"#1e2235", borderRadius:99, height:6, overflow:"hidden" }}>
      <div style={{ width:`${value}%`, background:color, height:"100%", borderRadius:99, transition:"width .5s" }}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AUTH SCREENS
═══════════════════════════════════════════════════════════ */
function AuthScreen({ onBoarded, onAuth }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [form, setForm] = useState({ name:"", email:"", password:"", confirm:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(""); }

  async function handleLogin() {
    if (!form.email || !form.password) { setError("Fill in all fields."); return; }
    setLoading(true);
    const res = await signIn(form.email, form.password);
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    onAuth();
  }

  async function handleRegister() {
    if (!form.name || !form.email || !form.password) { setError("Fill in all fields."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    const res = await signUp(form.email, form.password, { full_name: form.name });
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    if (res.message) { setSuccess(res.message); return; }
    onAuth();
  }

  async function handleReset() {
    if (!form.email) { setError("Enter your email address."); return; }
    setLoading(true);
    await resetPassword(form.email);
    setLoading(false);
    setSuccess("Password reset link sent! Check your inbox.");
  }

  const isLogin = mode === "login";
  const isForgot = mode === "forgot";

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <div style={{ width:"100%", maxWidth:420, animation:"slideUp .3s ease" }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:44, fontWeight:800, color:T.text, letterSpacing:"-.02em", lineHeight:1 }}>
            Ask<span style={{ color:T.cyan }}>YSIM</span>
          </div>
          <div style={{ color:T.muted, fontSize:13, marginTop:6 }}>University Career Learning Platform</div>
        </div>

        {/* Card */}
        <div style={{ background:T.card, borderRadius:20, padding:"32px", border:`1px solid ${T.border}` }}>

          {/* Tab switcher */}
          {!isForgot && (
            <div style={{ display:"flex", gap:4, background:T.surface, padding:4, borderRadius:12, marginBottom:28 }}>
              {[["login","Sign In"],["register","Create Account"]].map(([key,label])=>(
                <button key={key} onClick={()=>{ setMode(key); setError(""); setSuccess(""); }} style={{ flex:1, padding:"9px", borderRadius:9, border:"none", background:mode===key?T.cyan:"transparent", color:mode===key?T.bg:T.muted, fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .2s" }}>{label}</button>
              ))}
            </div>
          )}

          {isForgot && (
            <div style={{ marginBottom:24 }}>
              <button onClick={()=>{ setMode("login"); setError(""); setSuccess(""); }} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>← Back to Sign In</button>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:18, fontWeight:800, color:T.text, marginTop:12 }}>Reset Password</div>
            </div>
          )}

          {success && (
            <div style={{ background:`${T.green}18`, border:`1px solid ${T.green}44`, borderRadius:10, padding:"12px 16px", marginBottom:20, color:T.green, fontSize:13 }}>✓ {success}</div>
          )}

          {error && (
            <div style={{ background:`${T.red}18`, border:`1px solid ${T.red}44`, borderRadius:10, padding:"12px 16px", marginBottom:20, color:T.red, fontSize:13 }}>✕ {error}</div>
          )}

          {/* Fields */}
          {mode === "register" && (
            <>
              <label style={S.label}>Full Name</label>
              <input style={S.input} placeholder="e.g. Fashipe Marcelo" value={form.name} onChange={e=>set("name",e.target.value)}/>
            </>
          )}

          <label style={S.label}>Email Address</label>
          <input style={S.input} type="email" placeholder="you@miva.edu.ng" value={form.email} onChange={e=>set("email",e.target.value)}/>

          {!isForgot && (
            <>
              <label style={S.label}>Password</label>
              <input style={S.input} type="password" placeholder={isLogin?"••••••••":"Min. 8 characters"} value={form.password} onChange={e=>set("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&(isLogin?handleLogin():null)}/>
            </>
          )}

          {mode === "register" && (
            <>
              <label style={S.label}>Confirm Password</label>
              <input style={S.input} type="password" placeholder="Repeat your password" value={form.confirm} onChange={e=>set("confirm",e.target.value)}/>
            </>
          )}

          {isLogin && (
            <div style={{ textAlign:"right", marginTop:-8, marginBottom:20 }}>
              <button onClick={()=>{ setMode("forgot"); setError(""); setSuccess(""); }} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:12, textDecoration:"underline" }}>Forgot password?</button>
            </div>
          )}

          <button
            onClick={isLogin ? handleLogin : isForgot ? handleReset : handleRegister}
            disabled={loading}
            style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background:loading?T.border:T.cyan, color:loading?T.muted:T.bg, fontWeight:800, fontSize:15, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginTop:4 }}
          >
            {loading ? <><Spinner color={T.bg}/> Please wait…</> : isForgot ? "Send Reset Link" : isLogin ? "Sign In →" : "Create Account →"}
          </button>

          {/* Divider + guest option */}
          {!isForgot && (
            <div style={{ marginTop:20, textAlign:"center" }}>
              <div style={{ color:T.muted, fontSize:12, marginBottom:12 }}>— or —</div>
              <button onClick={onBoarded} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 20px", color:T.dim, fontSize:13, cursor:"pointer", fontWeight:600 }}>
                Continue as Guest (progress not saved)
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign:"center", marginTop:20, color:T.muted, fontSize:12 }}>
          By signing up you agree to AskYSIM's terms of use
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ONBOARDING (profile setup after first sign-in)
═══════════════════════════════════════════════════════════ */
function StepBar({ n, of, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:28 }}>
      {Array.from({ length:of }, (_,i) => <div key={i} style={{ height:4, flex:i+1<=n?2:1, borderRadius:99, background:i+1<=n?(color||T.cyan):T.border, transition:"all .3s" }}/>)}
      <span style={{ fontSize:11, color:T.muted, whiteSpace:"nowrap" }}>{n}/{of}</span>
    </div>
  );
}

function Onboarding({ userName, onComplete }) {
  const { session } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ level:"100", school:"", dept:"", career:"" });
  const [saving, setSaving] = useState(false);
  const [vis, setVis] = useState(true);

  function go(n) { setVis(false); setTimeout(()=>{ setStep(n); setVis(true); }, 180); }
  function set(k,v) { setForm(f => ({ ...f, [k]:v })); }

  const schoolData = SCHOOLS[form.school];
  const deptData   = schoolData?.departments[form.dept];
  const activeColor = deptData?.color || schoolData?.color || T.cyan;

  async function finish() {
    setSaving(true);
    const profile = {
      user_id: session?.user?.id || "guest",
      name: userName,
      level: form.level,
      school: form.school,
      dept: form.dept,
      career: form.career,
    };
    if (session?.access_token) {
      await sb.upsertProfile(session.access_token, profile);
    }
    onComplete({ ...profile });
    setSaving(false);
  }

  const steps = [
    /* 0 — Welcome */
    <div key="0" style={{ textAlign:"center", maxWidth:480, margin:"0 auto" }}>
      <div style={{ fontSize:52, marginBottom:16 }}>👋</div>
      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:24, fontWeight:800, color:T.text, marginBottom:8 }}>
        Welcome, {userName?.split(" ")[0] || "Student"}!
      </div>
      <div style={{ color:T.muted, fontSize:14, lineHeight:1.7, marginBottom:32 }}>
        Let's set up your career learning profile. This takes less than a minute and personalises everything for you.
      </div>
      <button onClick={()=>go(1)} style={S.btn(T.cyan)}>Set Up Profile →</button>
    </div>,

    /* 1 — Level */
    <div key="1" style={{ maxWidth:420, margin:"0 auto" }}>
      <StepBar n={1} of={3} color={T.cyan}/>
      <h2 style={S.h2}>What level are you?</h2>
      <div style={{ display:"flex", gap:10, marginBottom:28 }}>
        {["100","200","300","400"].map(l=>(
          <button key={l} onClick={()=>set("level",l)} style={{ flex:1, padding:"16px 0", borderRadius:12, border:form.level===l?`2px solid ${T.cyan}`:`2px solid ${T.border}`, background:form.level===l?`${T.cyan}18`:T.surface, color:form.level===l?T.cyan:T.muted, fontWeight:800, cursor:"pointer", fontSize:15 }}>{l}L</button>
        ))}
      </div>
      <button onClick={()=>go(2)} style={S.btn(T.cyan)}>Continue →</button>
    </div>,

    /* 2 — School + Dept */
    <div key="2" style={{ maxWidth:640, margin:"0 auto" }}>
      <StepBar n={2} of={3} color={schoolData?.color||T.cyan}/>
      <h2 style={S.h2}>Your school & department</h2>
      {/* School */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
        {Object.entries(SCHOOLS).map(([name,sd])=>(
          <button key={name} onClick={()=>{ set("school",name); set("dept",""); set("career",""); }} style={{ textAlign:"left", padding:"14px 18px", borderRadius:12, border:form.school===name?`2px solid ${sd.color}`:`2px solid ${T.border}`, background:form.school===name?`${sd.color}18`:T.surface, cursor:"pointer", display:"flex", alignItems:"center", gap:14, transition:"all .2s" }}>
            <span style={{ fontSize:24 }}>{sd.icon}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:form.school===name?sd.color:T.text }}>{name}</div>
              <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{Object.keys(sd.departments).length} departments</div>
            </div>
          </button>
        ))}
      </div>
      {form.school && (
        <>
          <div style={{ color:T.dim, fontSize:12, fontWeight:700, letterSpacing:".06em", marginBottom:10 }}>CHOOSE YOUR DEPARTMENT</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
            {Object.entries(schoolData?.departments||{}).map(([name,d])=>(
              <button key={name} onClick={()=>{ set("dept",name); set("career",""); }} style={{ textAlign:"left", padding:"12px 14px", borderRadius:11, border:form.dept===name?`2px solid ${d.color}`:`2px solid ${T.border}`, background:form.dept===name?`${d.color}18`:T.card, cursor:"pointer", transition:"all .2s" }}>
                <div style={{ fontSize:20, marginBottom:6 }}>{d.icon}</div>
                <div style={{ fontSize:11, fontWeight:700, color:form.dept===name?d.color:T.dim, lineHeight:1.4 }}>{d.degree} {name}</div>
              </button>
            ))}
          </div>
        </>
      )}
      <button disabled={!form.dept} onClick={()=>go(3)} style={S.btn(activeColor,!form.dept)}>Continue →</button>
    </div>,

    /* 3 — Career */
    <div key="3" style={{ maxWidth:640, margin:"0 auto" }}>
      <StepBar n={3} of={3} color={activeColor}/>
      <h2 style={S.h2}>Choose your career path</h2>
      <p style={{ color:T.muted, fontSize:13, marginBottom:20 }}>Your roadmap, certifications, and AI tutor are built around this</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, maxHeight:380, overflowY:"auto", padding:"2px", marginBottom:24 }}>
        {deptData?.careers.map(c=>(
          <button key={c.id} onClick={()=>set("career",c.id)} style={{ textAlign:"left", padding:"14px 16px", borderRadius:12, border:form.career===c.id?`2px solid ${activeColor}`:`2px solid ${T.border}`, background:form.career===c.id?`${activeColor}18`:T.surface, cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"all .2s" }}>
            <span style={{ fontSize:22, flexShrink:0 }}>{c.icon}</span>
            <span style={{ fontSize:12, fontWeight:600, color:form.career===c.id?activeColor:T.dim, lineHeight:1.4 }}>{c.title}</span>
          </button>
        ))}
      </div>
      <button disabled={!form.career||saving} onClick={finish} style={S.btn(activeColor,!form.career||saving)}>
        {saving?<span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}><Spinner color={T.bg}/>Saving…</span>:"🚀 Start Learning"}
      </button>
    </div>,
  ];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <div style={{ width:"100%", opacity:vis?1:0, transform:vis?"translateY(0)":"translateY(10px)", transition:"all .2s" }}>
        {steps[step]}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   AI TUTOR
═══════════════════════════════════════════════════════════ */
function AiTutor({ course, career, onClose }) {
  const [messages, setMessages] = useState([{ role:"assistant", content:`Hey! I'm your AI tutor for **${course.title}**.\n\nAsk me anything — concepts, examples, practice questions, or how this connects to your path as a **${career}**.` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const txt = input.trim(); setInput("");
    setMessages(m=>[...m,{ role:"user", content:txt }]); setLoading(true);
    try {
      const hist = [...messages, { role:"user", content:txt }];
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000,
          system:`You are a friendly expert tutor on AskYSIM. The student is learning "${course.title}" as part of their path to become a ${career}. Give clear, beginner-friendly explanations with practical examples. Use **bold** and \`code\` formatting where helpful.`,
          messages:hist.map(m=>({ role:m.role, content:m.content })) }),
      });
      const data = await res.json();
      const reply = data.content?.find(b=>b.type==="text")?.text || "Something went wrong. Try again!";
      setMessages(m=>[...m,{ role:"assistant", content:reply }]);
    } catch { setMessages(m=>[...m,{ role:"assistant", content:"Network error — try again." }]); }
    setLoading(false);
  }

  function render(t) {
    return t.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
            .replace(/`([^`]+)`/g,'<code style="background:#0d1022;padding:2px 6px;border-radius:4px;font-size:12px;color:#0DFFE0">$1</code>')
            .replace(/\n/g,'<br/>');
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", zIndex:1000, display:"flex", alignItems:"flex-end", justifyContent:"flex-end", padding:20 }}>
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:16, width:"100%", maxWidth:420, height:560, display:"flex", flexDirection:"column", animation:"slideUp .25s ease" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`${T.cyan}22`, border:`1px solid ${T.cyan}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🤖</div>
          <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:700, color:T.text }}>AI Tutor</div><div style={{ fontSize:11, color:T.muted }}>Powered by Claude</div></div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
          {messages.map((m,i)=>(
            <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"85%", padding:"10px 14px", borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px", background:m.role==="user"?T.cyan:T.surface, color:m.role==="user"?T.bg:T.text, fontSize:13, lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html:render(m.content) }}/>
            </div>
          ))}
          {loading && <div style={{ display:"flex", gap:4, padding:"10px 14px", background:T.surface, borderRadius:"14px 14px 14px 4px", width:"fit-content" }}>{[0,1,2].map(i=><div key={i} style={{ width:6, height:6, borderRadius:"50%", background:T.cyan, animation:`pulse 1.2s ease ${i*0.2}s infinite` }}/>)}</div>}
          <div ref={bottomRef}/>
        </div>
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${T.border}`, display:"flex", gap:8 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask anything…" style={{ flex:1, background:T.surface, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 14px", color:T.text, fontSize:13, outline:"none" }}/>
          <button onClick={send} disabled={!input.trim()||loading} style={{ width:40, height:40, borderRadius:10, background:input.trim()&&!loading?T.cyan:T.border, border:"none", cursor:input.trim()&&!loading?"pointer":"default", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>→</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   VIDEO MODAL
═══════════════════════════════════════════════════════════ */
function VideoModal({ course, color, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:900, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:T.card, borderRadius:16, overflow:"hidden", width:"100%", maxWidth:780, border:`1px solid ${color}33`, animation:"slideUp .2s ease" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{course.title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:18, marginLeft:12 }}>✕</button>
        </div>
        <div style={{ position:"relative", paddingBottom:"56.25%", background:"#000" }}>
          <iframe src={`https://www.youtube.com/embed/${course.ytId}?autoplay=1&rel=0`} style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={course.title}/>
        </div>
        <div style={{ padding:"14px 20px", display:"flex", alignItems:"center", gap:12 }}>
          <p style={{ color:T.dim, fontSize:13, lineHeight:1.5, flex:1 }}>{course.desc}</p>
          {course.lab && <span style={{ background:`${T.violet}22`, color:T.violet, border:`1px solid ${T.violet}44`, borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>🧪 Lab</span>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROADMAP VIEW
═══════════════════════════════════════════════════════════ */
function RoadmapView({ profile, completed, onToggle }) {
  const { session } = useAuth();
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeTutor, setActiveTutor] = useState(null);
  const [browseMode, setBrowseMode] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const deptData  = ALL_DEPTS[profile.dept];
  const career    = deptData?.careers.find(c => c.id === profile.career);
  const roadmap   = ROADMAPS[profile.career] || defaultRoadmap(career?.title || profile.career);
  const deptColor = deptData?.color || T.cyan;
  const allCourses = roadmap.stages.flatMap(s => s.courses);
  const pct = allCourses.length ? Math.round((allCourses.filter(c=>completed[c.id]).length / allCourses.length)*100) : 0;

  async function handleToggle(courseId) {
    const newVal = !completed[courseId];
    onToggle(courseId, newVal);
    if (session?.access_token && session?.user?.id) {
      setSyncing(true);
      await sb.upsertProgress(session.access_token, session.user.id, profile.career, courseId, newVal);
      setSyncing(false);
    }
  }

  return (
    <div style={{ animation:"slideUp .25s ease" }}>
      {activeVideo && <VideoModal course={activeVideo} color={deptColor} onClose={()=>setActiveVideo(null)}/>}
      {activeTutor && <AiTutor course={activeTutor} career={career?.title} onClose={()=>setActiveTutor(null)}/>}

      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg,${deptColor}18 0%,${T.card} 100%)`, border:`1px solid ${deptColor}33`, borderRadius:16, padding:"24px", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:11, color:deptColor, fontWeight:700, letterSpacing:".1em", marginBottom:6 }}>{deptData?.degree} {profile.dept}</div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:800, color:T.text, marginBottom:4 }}>{career?.icon} {career?.title}</div>
            <div style={{ color:T.muted, fontSize:13 }}>{allCourses.length} lessons · {roadmap.stages.length} stages · Beginner to Advanced</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:36, fontWeight:800, color:deptColor }}>{pct}%</div>
            {syncing && <div style={{ fontSize:11, color:T.muted, display:"flex", alignItems:"center", gap:4, justifyContent:"flex-end" }}><Spinner color={T.muted}/> syncing</div>}
            {!syncing && session && <div style={{ fontSize:11, color:T.green }}>✓ synced</div>}
            {!session && <div style={{ fontSize:11, color:T.muted }}>guest mode</div>}
          </div>
        </div>
        <div style={{ margin:"14px 0 0", background:T.bg, borderRadius:99, height:6, overflow:"hidden" }}>
          <div style={{ width:`${pct}%`, background:deptColor, height:"100%", borderRadius:99, transition:"width .5s" }}/>
        </div>
        <div style={{ marginTop:14, display:"flex", flexWrap:"wrap", gap:6 }}>
          {roadmap.certPath.map((c,i)=>(
            <span key={c} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ background:`${deptColor}18`, color:deptColor, border:`1px solid ${deptColor}33`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>🏅 {c}</span>
              {i < roadmap.certPath.length-1 && <span style={{ color:T.border, fontSize:10 }}>→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display:"flex", gap:4, background:T.card, padding:4, borderRadius:12, marginBottom:24, border:`1px solid ${T.border}`, width:"fit-content" }}>
        {[{ key:false, label:"🗺️ Roadmap" },{ key:true, label:"📚 Browse All" }].map(m=>(
          <button key={String(m.key)} onClick={()=>setBrowseMode(m.key)} style={{ padding:"8px 18px", borderRadius:9, border:"none", background:browseMode===m.key?deptColor:"transparent", color:browseMode===m.key?T.bg:T.muted, fontWeight:700, fontSize:13, cursor:"pointer", transition:"all .2s" }}>{m.label}</button>
        ))}
      </div>

      {/* Roadmap skill tree */}
      {!browseMode && roadmap.stages.map((stage,si)=>(
        <div key={stage.level} style={{ marginBottom:40 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:`${stage.color}22`, border:`2px solid ${stage.color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:stage.color, flexShrink:0 }}>{si+1}</div>
            <div style={{ height:2, flex:1, background:`linear-gradient(90deg,${stage.color}44,transparent)` }}/>
            <span style={{ background:`${stage.color}18`, color:stage.color, border:`1px solid ${stage.color}33`, borderRadius:8, padding:"4px 14px", fontSize:12, fontWeight:700 }}>{stage.level}</span>
          </div>
          <div style={{ marginLeft:16, borderLeft:`2px solid ${stage.color}33`, paddingLeft:28, display:"flex", flexDirection:"column", gap:14 }}>
            {stage.courses.map((course)=>{
              const done = !!completed[course.id];
              const locked = si > 0 && !roadmap.stages[si-1].courses.every(c=>completed[c.id]);
              return (
                <div key={course.id} style={{ position:"relative" }}>
                  <div style={{ position:"absolute", left:-37, top:18, width:10, height:10, borderRadius:"50%", background:done?stage.color:T.border, boxShadow:done?`0 0 10px ${stage.color}80`:"none", transition:"all .3s" }}/>
                  <div style={{ background:T.surface, borderRadius:14, border:`1.5px solid ${done?stage.color+"55":T.border}`, padding:"16px 18px", opacity:locked?.45:1 }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:done?stage.color:T.text, marginBottom:6, lineHeight:1.4 }}>{course.title}</div>
                        <div style={{ color:T.muted, fontSize:12, lineHeight:1.5, marginBottom:10 }}>{course.desc}</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          <span style={{ background:`${stage.color}18`, color:stage.color, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>⏱ {course.duration}</span>
                          {course.lab && <span style={{ background:`${T.violet}18`, color:T.violet, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>🧪 Lab</span>}
                          {done && <span style={{ background:"#00C89722", color:"#00C897", borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>✓ Done</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
                        <button onClick={()=>!locked&&setActiveVideo(course)} disabled={locked} style={{ padding:"8px 14px", borderRadius:9, border:"none", background:locked?T.border:stage.color, color:locked?T.muted:T.bg, fontWeight:700, fontSize:12, cursor:locked?"not-allowed":"pointer", whiteSpace:"nowrap" }}>▶ Watch</button>
                        <button onClick={()=>!locked&&setActiveTutor(course)} disabled={locked} style={{ padding:"8px 14px", borderRadius:9, border:`1px solid ${locked?T.border:T.cyan+"66"}`, background:"transparent", color:locked?T.muted:T.cyan, fontWeight:700, fontSize:12, cursor:locked?"not-allowed":"pointer", whiteSpace:"nowrap" }}>🤖 Tutor</button>
                        <button onClick={()=>!locked&&handleToggle(course.id)} disabled={locked} style={{ padding:"8px 14px", borderRadius:9, border:`1px solid ${done?stage.color+"66":T.border}`, background:done?`${stage.color}18`:"transparent", color:done?stage.color:T.muted, fontWeight:700, fontSize:12, cursor:locked?"not-allowed":"pointer", whiteSpace:"nowrap" }}>{done?"✓ Done":"Mark Done"}</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Browse mode */}
      {browseMode && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {roadmap.stages.flatMap(stage => stage.courses.map(course=>{
            const done = !!completed[course.id];
            return (
              <div key={course.id} style={{ background:T.surface, borderRadius:14, border:`1.5px solid ${done?stage.color+"44":T.border}`, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:`${stage.color}18`, border:`1px solid ${stage.color}33`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:9, fontWeight:800, color:stage.color }}>{stage.level.slice(0,3).toUpperCase()}</span>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:4 }}>{course.title}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <span style={{ background:`${stage.color}18`, color:stage.color, borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:600 }}>{stage.level}</span>
                    <span style={{ color:T.dim, fontSize:11 }}>⏱ {course.duration}</span>
                    {course.lab && <span style={{ background:`${T.violet}18`, color:T.violet, borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:600 }}>🧪</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>setActiveVideo(course)} style={{ padding:"7px 12px", borderRadius:8, border:"none", background:stage.color, color:T.bg, fontWeight:700, fontSize:11, cursor:"pointer" }}>▶</button>
                  <button onClick={()=>setActiveTutor(course)} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${T.cyan}44`, background:"transparent", color:T.cyan, fontWeight:700, fontSize:11, cursor:"pointer" }}>🤖</button>
                  <button onClick={()=>handleToggle(course.id)} style={{ padding:"7px 12px", borderRadius:8, border:`1px solid ${done?stage.color+"66":T.border}`, background:done?`${stage.color}18`:"transparent", color:done?stage.color:T.muted, fontWeight:700, fontSize:11, cursor:"pointer" }}>{done?"✓":"○"}</button>
                </div>
              </div>
            );
          }))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   APP SHELL
═══════════════════════════════════════════════════════════ */
function AppShell({ profile, onSignOut }) {
  const { session } = useAuth();
  const [view, setView] = useState("roadmap");
  const [completed, setCompleted] = useState({});
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [toast, setToast] = useState(null);

  const deptData  = ALL_DEPTS[profile.dept];
  const deptColor = deptData?.color || T.cyan;
  const career    = deptData?.careers.find(c=>c.id===profile.career);
  const roadmap   = ROADMAPS[profile.career] || defaultRoadmap(career?.title || profile.career);
  const allCourses = roadmap.stages.flatMap(s=>s.courses);
  const pct = allCourses.length ? Math.round((allCourses.filter(c=>completed[c.id]).length/allCourses.length)*100) : 0;

  // Load progress from Supabase on mount
  useEffect(()=>{
    async function load() {
      if (session?.access_token && session?.user?.id) {
        const data = await sb.getProgress(session.access_token, session.user.id, profile.career);
        setCompleted(data || {});
      }
      setLoadingProgress(false);
    }
    load();
  }, [profile.career]);

  function toggle(courseId, val) {
    setCompleted(p => ({ ...p, [courseId]: val }));
  }

  async function handleSignOut() {
    await onSignOut();
    setToast({ msg:"Signed out successfully.", type:"success" });
  }

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column" }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Topbar */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:800, color:T.text }}>Ask<span style={{ color:T.cyan }}>YSIM</span></div>
          <div style={{ width:1, height:20, background:T.border }}/>
          <div style={{ fontSize:11, color:T.muted }}>{SCHOOLS[profile.school]?.icon} {profile.school}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ background:`${deptColor}18`, border:`1px solid ${deptColor}33`, borderRadius:99, padding:"4px 12px", display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:deptColor }}/>
            <span style={{ fontSize:12, fontWeight:700, color:deptColor }}>{pct}%</span>
          </div>
          {session ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:`${T.cyan}22`, border:`1px solid ${T.cyan}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:T.cyan }}>
                {profile.name?.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize:12, color:T.dim }}>{profile.name?.split(" ")[0]}</span>
            </div>
          ) : (
            <span style={{ fontSize:11, background:`${T.yellow}18`, color:T.yellow, border:`1px solid ${T.yellow}33`, borderRadius:6, padding:"3px 8px", fontWeight:700 }}>Guest</span>
          )}
          <button onClick={handleSignOut} style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:8, color:T.muted, padding:"5px 10px", fontSize:11, cursor:"pointer" }}>
            {session?"Sign out":"Exit"}
          </button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"0 24px", display:"flex" }}>
        {[{ key:"roadmap", label:"Learning Path" },{ key:"explore", label:"Explore" },{ key:"profile", label:"My Profile" }].map(t=>(
          <button key={t.key} onClick={()=>setView(t.key)} style={{ padding:"14px 20px", border:"none", borderBottom:view===t.key?`2px solid ${deptColor}`:"2px solid transparent", background:"transparent", color:view===t.key?T.text:T.muted, fontWeight:view===t.key?700:500, fontSize:13, cursor:"pointer", marginBottom:-1 }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", width:"100%", padding:"28px 20px 60px" }}>
        {loadingProgress && (
          <div style={{ display:"flex", alignItems:"center", gap:10, color:T.muted, fontSize:13, padding:"20px 0" }}>
            <Spinner/> Loading your progress…
          </div>
        )}
        {!loadingProgress && view==="roadmap"  && <RoadmapView profile={profile} completed={completed} onToggle={toggle}/>}
        {!loadingProgress && view==="explore"  && <ExploreView/>}
        {!loadingProgress && view==="profile"  && <ProfileView profile={profile} completed={completed} allCourses={allCourses} pct={pct} deptColor={deptColor}/>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PROFILE VIEW
═══════════════════════════════════════════════════════════ */
function ProfileView({ profile, completed, allCourses, pct, deptColor }) {
  const { session } = useAuth();
  const deptData = ALL_DEPTS[profile.dept];
  const career   = deptData?.careers.find(c=>c.id===profile.career);
  const done     = allCourses.filter(c=>completed[c.id]).length;

  return (
    <div style={{ animation:"slideUp .25s ease" }}>
      <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:800, color:T.text, marginBottom:20 }}>My Profile</h2>

      {/* Avatar card */}
      <div style={{ background:T.card, borderRadius:16, padding:"28px", border:`1px solid ${T.border}`, marginBottom:16, display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:`${deptColor}22`, border:`2px solid ${deptColor}44`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Space Grotesk',sans-serif", fontSize:26, fontWeight:800, color:deptColor, flexShrink:0 }}>
          {profile.name?.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:800, color:T.text, marginBottom:4 }}>{profile.name}</div>
          <div style={{ color:T.muted, fontSize:13 }}>{session?.user?.email || "Guest account"}</div>
          <div style={{ marginTop:6, display:"flex", gap:8, flexWrap:"wrap" }}>
            <span style={{ background:`${deptColor}18`, color:deptColor, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{deptData?.degree} {profile.dept}</span>
            <span style={{ background:`${T.violet}18`, color:T.violet, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{profile.level}L</span>
            {session && <span style={{ background:`${T.green}18`, color:T.green, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>✓ Authenticated</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
        {[
          { label:"Career Path",  value:career?.title||"—",        color:deptColor, icon:career?.icon||"🎯" },
          { label:"Courses Done", value:`${done} / ${allCourses.length}`, color:T.yellow,   icon:"✅" },
          { label:"Progress",     value:`${pct}%`,                 color:T.green,    icon:"📈" },
        ].map(s=>(
          <div key={s.label} style={{ background:T.card, borderRadius:14, padding:"18px", border:`1px solid ${T.border}`, textAlign:"center" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>{s.icon}</div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:s.value.length>8?14:22, fontWeight:800, color:s.color, marginBottom:4, wordBreak:"break-word" }}>{s.value}</div>
            <div style={{ fontSize:11, color:T.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background:T.card, borderRadius:14, padding:"20px", border:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:T.text }}>Overall Progress</span>
          <span style={{ fontSize:13, fontWeight:700, color:deptColor }}>{pct}%</span>
        </div>
        <ProgressBar value={pct} color={deptColor}/>
        <div style={{ marginTop:12, color:T.muted, fontSize:12 }}>
          {pct === 0 && "Start your first course to begin your journey 🚀"}
          {pct > 0 && pct < 33 && "You've started — keep the momentum going! 💪"}
          {pct >= 33 && pct < 66 && "Great progress! You're building real skills 🔥"}
          {pct >= 66 && pct < 100 && "Almost there — finish strong! ⚡"}
          {pct === 100 && "🎉 Roadmap complete! You're ready for the industry."}
        </div>
        {!session && (
          <div style={{ marginTop:14, background:`${T.yellow}18`, border:`1px solid ${T.yellow}33`, borderRadius:10, padding:"10px 14px", fontSize:12, color:T.yellow }}>
            ⚠️ You're in guest mode. <strong>Create an account</strong> to save your progress across devices.
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EXPLORE VIEW
═══════════════════════════════════════════════════════════ */
function ExploreView() {
  const [selSchool, setSelSchool] = useState(Object.keys(SCHOOLS)[0]);
  const school = SCHOOLS[selSchool];
  return (
    <div style={{ animation:"slideUp .25s ease" }}>
      <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:800, color:T.text, marginBottom:6 }}>Explore All Careers</h2>
      <p style={{ color:T.muted, fontSize:13, marginBottom:20 }}>Browse every career path across all schools</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:24 }}>
        {Object.entries(SCHOOLS).map(([name,sd])=>(
          <button key={name} onClick={()=>setSelSchool(name)} style={{ padding:"7px 14px", borderRadius:99, border:selSchool===name?`1.5px solid ${sd.color}`:`1.5px solid ${T.border}`, background:selSchool===name?`${sd.color}18`:T.surface, color:selSchool===name?sd.color:T.muted, fontWeight:600, fontSize:12, cursor:"pointer" }}>
            {sd.icon} {sd.short}
          </button>
        ))}
      </div>
      {Object.entries(school.departments).map(([deptName,dept])=>(
        <div key={deptName} style={{ marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:`${dept.color}22`, border:`1px solid ${dept.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{dept.icon}</div>
            <div><div style={{ fontSize:13, fontWeight:700, color:T.text }}>{dept.degree} {deptName}</div><div style={{ fontSize:11, color:T.muted }}>{dept.careers.length} career paths</div></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginLeft:42 }}>
            {dept.careers.map(c=>(
              <div key={c.id} style={{ background:T.card, borderRadius:10, padding:"10px 14px", border:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, lineHeight:1.4 }}>{c.title}</div>
                  {ROADMAPS[c.id] && <div style={{ fontSize:10, color:dept.color, fontWeight:600, marginTop:2 }}>✓ Full roadmap</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const S = {
  h2:{ fontFamily:"'Space Grotesk',sans-serif", fontSize:22, fontWeight:800, color:T.text, marginBottom:24 },
  label:{ display:"block", fontSize:11, fontWeight:700, color:T.muted, marginBottom:6, letterSpacing:".06em" },
  input:{ width:"100%", background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"12px 14px", color:T.text, fontSize:14, marginBottom:16, outline:"none", boxSizing:"border-box" },
  btn:(color, disabled=false) => ({ width:"100%", padding:"14px", borderRadius:12, border:"none", background:disabled?T.border:color, color:disabled?T.muted:(color===T.cyan?T.bg:"#fff"), fontWeight:800, fontSize:15, cursor:disabled?"not-allowed":"pointer", transition:"all .2s", fontFamily:"'Inter',sans-serif" }),
};

/* ═══════════════════════════════════════════════════════════
   PROFILE LOCAL CACHE (backup when no Supabase)
═══════════════════════════════════════════════════════════ */
const PROFILE_KEY = "askyism_profile_v2";
function loadProfile() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch { return null; } }
function saveProfile(p) { try { if(p) localStorage.setItem(PROFILE_KEY,JSON.stringify(p)); else localStorage.removeItem(PROFILE_KEY); } catch {} }

/* ═══════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════ */
function Root() {
  const { session, loading, signOut } = useAuth();
  const [profile,   setProfile]   = useState(loadProfile);
  const [guestMode, setGuestMode] = useState(false);
  const [toast,     setToast]     = useState(null);

  // When session arrives, try to load saved profile from Supabase
  useEffect(()=>{
    if (!session?.access_token || !session?.user?.id) return;
    sb.getProfile(session.access_token, session.user.id).then(p=>{
      if (p) { setProfile(p); saveProfile(p); }
    });
  }, [session?.user?.id]);

  function handleAuth() {
    // Profile will load via useEffect above
  }

  function handleProfileComplete(p) {
    setProfile(p);
    saveProfile(p);
    setGuestMode(false);
  }

  async function handleSignOut() {
    await signOut();
    setProfile(null);
    saveProfile(null);
    setGuestMode(false);
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", gap:12, color:T.muted, fontSize:14 }}>
      <Spinner/> Loading AskYSIM…
    </div>
  );

  // Not authenticated and not in guest mode → Auth screen
  if (!session && !guestMode) return (
    <AuthScreen onAuth={handleAuth} onBoarded={()=>setGuestMode(true)}/>
  );

  // Authenticated or guest but no profile → Onboarding
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "Student";
  if (!profile) return (
    <Onboarding userName={userName} onComplete={handleProfileComplete}/>
  );

  // Fully set up → Main app
  return <AppShell profile={profile} onSignOut={handleSignOut}/>;
}

export default function App() {
  return (
    <AuthProvider>
      <FontLoader/>
      <Root/>
    </AuthProvider>
  );
}
