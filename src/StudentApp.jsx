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

function Spinner({color=T.cyan}){return <div style={{width:20,height:20,border:`2px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>;}
function Toast({msg,type="success",onDone}){useEffect(()=>{const t=setTimeout(onDone,3000);return()=>clearTimeout(t);},[]);return(<div style={{position:"fixed",bottom:24,right:24,background:type==="success"?T.green:T.red,color:"#fff",borderRadius:10,padding:"12px 20px",fontSize:13,fontWeight:700,zIndex:9999,animation:"slideUp .2s ease",boxShadow:"0 4px 24px #00000055",display:"flex",alignItems:"center",gap:8}}>{type==="success"?"✓":"✕"} {msg}</div>);}
function ProgressBar({value=0,color=T.cyan}){return(<div style={{background:"#1e2235",borderRadius:99,height:6,overflow:"hidden"}}><div style={{width:`${value}%`,background:color,height:"100%",borderRadius:99,transition:"width .5s"}}/></div>);}

const AuthCtx=createContext(null);
function useAuth(){return useContext(AuthCtx);}

function AuthProvider({children}){
  const [session,setSession]=useState(loadSession);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    async function verify(){
      if(!session?.access_token){setLoading(false);return;}
      try{const user=await sb.getUser(session.access_token);if(user?.id){setLoading(false);return;}setSession(null);saveSession(null);}catch{}
      setLoading(false);
    }
    verify();
  },[]);
  async function signUp(email,password,meta){const data=await sb.signUp(email,password,meta);if(data?.error)return{error:data.error.message||data.error};if(data?.id)return signIn(email,password);return{ok:true,message:"Check your email to confirm your account."};}
  async function signIn(email,password){const data=await sb.signIn(email,password);if(data?.error)return{error:data.error_description||data.error};if(data?.access_token){const sess={access_token:data.access_token,user:data.user};setSession(sess);saveSession(sess);return{ok:true};}return{error:"Sign in failed. Check your credentials."};}
  async function signOut(){if(session?.access_token)await sb.signOut(session.access_token).catch(()=>{});setSession(null);saveSession(null);}
  async function resetPassword(email){await sb.resetPassword(email);return{ok:true};}
  return(<AuthCtx.Provider value={{session,loading,signUp,signIn,signOut,resetPassword}}>{children}</AuthCtx.Provider>);
}

function AuthScreen({onBoarded,onAuth}){
  const{signIn,signUp,resetPassword}=useAuth();
  const[mode,setMode]=useState("login");
  const[form,setForm]=useState({name:"",email:"",password:"",confirm:""});
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[success,setSuccess]=useState("");
  function set(k,v){setForm(f=>({...f,[k]:v}));setError("");}
  async function handleLogin(){if(!form.email||!form.password){setError("Fill in all fields.");return;}setLoading(true);const res=await signIn(form.email,form.password);setLoading(false);if(res.error){setError(res.error);return;}onAuth();}
  async function handleRegister(){if(!form.name||!form.email||!form.password){setError("Fill in all fields.");return;}if(form.password.length<8){setError("Password must be at least 8 characters.");return;}if(form.password!==form.confirm){setError("Passwords do not match.");return;}setLoading(true);const res=await signUp(form.email,form.password,{full_name:form.name});setLoading(false);if(res.error){setError(res.error);return;}if(res.message){setSuccess(res.message);return;}onAuth();}
  async function handleReset(){if(!form.email){setError("Enter your email address.");return;}setLoading(true);await resetPassword(form.email);setLoading(false);setSuccess("Password reset link sent! Check your inbox.");}
  const isLogin=mode==="login";const isForgot=mode==="forgot";
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px"}}>
      <div style={{width:"100%",maxWidth:420,animation:"slideUp .3s ease"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:44,fontWeight:800,color:T.text,letterSpacing:"-.02em",lineHeight:1}}>Ask<span style={{color:T.cyan}}>YSIM</span></div>
          <div style={{color:T.muted,fontSize:13,marginTop:6}}>University Career Learning Platform</div>
        </div>
        <div style={{background:T.card,borderRadius:20,padding:"32px",border:`1px solid ${T.border}`}}>
          {!isForgot&&(<div style={{display:"flex",gap:4,background:T.surface,padding:4,borderRadius:12,marginBottom:28}}>{[["login","Sign In"],["register","Create Account"]].map(([key,label])=>(<button key={key} onClick={()=>{setMode(key);setError("");setSuccess("");}} style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:mode===key?T.cyan:"transparent",color:mode===key?T.bg:T.muted,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s"}}>{label}</button>))}</div>)}
          {isForgot&&(<div style={{marginBottom:24}}><button onClick={()=>{setMode("login");setError("");setSuccess("");}} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:13}}>← Back to Sign In</button><div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:800,color:T.text,marginTop:12}}>Reset Password</div></div>)}
          {success&&<div style={{background:`${T.green}18`,border:`1px solid ${T.green}44`,borderRadius:10,padding:"12px 16px",marginBottom:20,color:T.green,fontSize:13}}>✓ {success}</div>}
          {error&&<div style={{background:`${T.red}18`,border:`1px solid ${T.red}44`,borderRadius:10,padding:"12px 16px",marginBottom:20,color:T.red,fontSize:13}}>✕ {error}</div>}
          {mode==="register"&&(<><label style={S.label}>Full Name</label><input style={S.input} placeholder="e.g. Fashipe Marcelo" value={form.name} onChange={e=>set("name",e.target.value)}/></>)}
          <label style={S.label}>Email Address</label>
          <input style={S.input} type="email" placeholder="you@miva.edu.ng" value={form.email} onChange={e=>set("email",e.target.value)}/>
          {!isForgot&&(<><label style={S.label}>Password</label><input style={S.input} type="password" placeholder={isLogin?"••••••••":"Min. 8 characters"} value={form.password} onChange={e=>set("password",e.target.value)}/></>)}
          {mode==="register"&&(<><label style={S.label}>Confirm Password</label><input style={S.input} type="password" placeholder="Repeat your password" value={form.confirm} onChange={e=>set("confirm",e.target.value)}/></>)}
          {isLogin&&(<div style={{textAlign:"right",marginTop:-8,marginBottom:20}}><button onClick={()=>{setMode("forgot");setError("");setSuccess("");}} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:12,textDecoration:"underline"}}>Forgot password?</button></div>)}
          <button onClick={isLogin?handleLogin:isForgot?handleReset:handleRegister} disabled={loading} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:loading?T.border:T.cyan,color:loading?T.muted:T.bg,fontWeight:800,fontSize:15,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:4}}>
            {loading?<><Spinner color={T.bg}/> Please wait…</>:isForgot?"Send Reset Link":isLogin?"Sign In →":"Create Account →"}
          </button>
          {!isForgot&&(<div style={{marginTop:20,textAlign:"center"}}><div style={{color:T.muted,fontSize:12,marginBottom:12}}>— or —</div><button onClick={onBoarded} style={{background:"none",border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 20px",color:T.dim,fontSize:13,cursor:"pointer",fontWeight:600}}>Continue as Guest</button></div>)}
        </div>
      </div>
    </div>
  );
}

function StepBar({n,of,color}){return(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:28}}>{Array.from({length:of},(_,i)=><div key={i} style={{height:4,flex:i+1<=n?2:1,borderRadius:99,background:i+1<=n?(color||T.cyan):T.border,transition:"all .3s"}}/>)}<span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>{n}/{of}</span></div>);}

function Onboarding({userName,onComplete}){
  const{session}=useAuth();
  const[step,setStep]=useState(0);
  const[form,setForm]=useState({level:"100",school:"",dept:"",career:""});
  const[saving,setSaving]=useState(false);
  const[vis,setVis]=useState(true);
  function go(n){setVis(false);setTimeout(()=>{setStep(n);setVis(true);},180);}
  function set(k,v){setForm(f=>({...f,[k]:v}));}
  const schoolData=SCHOOLS[form.school];
  const deptData=schoolData?.departments[form.dept];
  const activeColor=deptData?.color||schoolData?.color||T.cyan;
  async function finish(){
    setSaving(true);
    const profile={user_id:session?.user?.id||"guest",name:userName,level:form.level,school:form.school,dept:form.dept,career:form.career};
    if(session?.access_token)await sb.upsertProfile(session.access_token,profile);
    onComplete({...profile});setSaving(false);
  }
  const steps=[
    <div key="0" style={{textAlign:"center",maxWidth:480,margin:"0 auto"}}>
      <div style={{fontSize:52,marginBottom:16}}>👋</div>
      <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:24,fontWeight:800,color:T.text,marginBottom:8}}>Welcome, {userName?.split(" ")[0]||"Student"}!</div>
      <div style={{color:T.muted,fontSize:14,lineHeight:1.7,marginBottom:32}}>Let's set up your career learning profile. This takes less than a minute.</div>
      <button onClick={()=>go(1)} style={S.btn(T.cyan)}>Set Up Profile →</button>
    </div>,
    <div key="1" style={{maxWidth:420,margin:"0 auto"}}>
      <StepBar n={1} of={3} color={T.cyan}/>
      <h2 style={S.h2}>What level are you?</h2>
      <div style={{display:"flex",gap:10,marginBottom:28}}>{["100","200","300","400"].map(l=>(<button key={l} onClick={()=>set("level",l)} style={{flex:1,padding:"16px 0",borderRadius:12,border:form.level===l?`2px solid ${T.cyan}`:`2px solid ${T.border}`,background:form.level===l?`${T.cyan}18`:T.surface,color:form.level===l?T.cyan:T.muted,fontWeight:800,cursor:"pointer",fontSize:15}}>{l}L</button>))}</div>
      <button onClick={()=>go(2)} style={S.btn(T.cyan)}>Continue →</button>
    </div>,
    <div key="2" style={{maxWidth:640,margin:"0 auto"}}>
      <StepBar n={2} of={3} color={schoolData?.color||T.cyan}/>
      <h2 style={S.h2}>Your school & department</h2>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>{Object.entries(SCHOOLS).map(([name,sd])=>(<button key={name} onClick={()=>{set("school",name);set("dept","");set("career","");}} style={{textAlign:"left",padding:"14px 18px",borderRadius:12,border:form.school===name?`2px solid ${sd.color}`:`2px solid ${T.border}`,background:form.school===name?`${sd.color}18`:T.surface,cursor:"pointer",display:"flex",alignItems:"center",gap:14,transition:"all .2s"}}><span style={{fontSize:24}}>{sd.icon}</span><div><div style={{fontSize:13,fontWeight:700,color:form.school===name?sd.color:T.text}}>{name}</div><div style={{fontSize:11,color:T.muted,marginTop:2}}>{Object.keys(sd.departments).length} departments</div></div></button>))}</div>
      {form.school&&(<><div style={{color:T.dim,fontSize:12,fontWeight:700,letterSpacing:".06em",marginBottom:10}}>CHOOSE YOUR DEPARTMENT</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>{Object.entries(schoolData?.departments||{}).map(([name,d])=>(<button key={name} onClick={()=>{set("dept",name);set("career","");}} style={{textAlign:"left",padding:"12px 14px",borderRadius:11,border:form.dept===name?`2px solid ${d.color}`:`2px solid ${T.border}`,background:form.dept===name?`${d.color}18`:T.card,cursor:"pointer",transition:"all .2s"}}><div style={{fontSize:20,marginBottom:6}}>{d.icon}</div><div style={{fontSize:11,fontWeight:700,color:form.dept===name?d.color:T.dim,lineHeight:1.4}}>{d.degree} {name}</div></button>))}</div></>)}
      <button disabled={!form.dept} onClick={()=>go(3)} style={S.btn(activeColor,!form.dept)}>Continue →</button>
    </div>,
    <div key="3" style={{maxWidth:640,margin:"0 auto"}}>
      <StepBar n={3} of={3} color={activeColor}/>
      <h2 style={S.h2}>Choose your career path</h2>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,maxHeight:380,overflowY:"auto",padding:"2px",marginBottom:24}}>{deptData?.careers.map(c=>(<button key={c.id} onClick={()=>set("career",c.id)} style={{textAlign:"left",padding:"14px 16px",borderRadius:12,border:form.career===c.id?`2px solid ${activeColor}`:`2px solid ${T.border}`,background:form.career===c.id?`${activeColor}18`:T.surface,cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .2s"}}><span style={{fontSize:22,flexShrink:0}}>{c.icon}</span><span style={{fontSize:12,fontWeight:600,color:form.career===c.id?activeColor:T.dim,lineHeight:1.4}}>{c.title}</span></button>))}</div>
      <button disabled={!form.career||saving} onClick={finish} style={S.btn(activeColor,!form.career||saving)}>{saving?<span style={{display:"flex",alignItems:"center",gap:8,justifyContent:"center"}}><Spinner color={T.bg}/>Saving…</span>:"🚀 Start Learning"}</button>
    </div>,
  ];
  return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px"}}><div style={{width:"100%",opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(10px)",transition:"all .2s"}}>{steps[step]}</div></div>);
}

function AiTutor({course,career,onClose}){
  const[messages,setMessages]=useState([{role:"assistant",content:`Hey! I'm your AI tutor for **${course.title}**.\n\nAsk me anything — concepts, examples, practice questions, or how this connects to your path as a **${career}**.`}]);
  const[input,setInput]=useState("");const[loading,setLoading]=useState(false);const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  async function send(){if(!input.trim()||loading)return;const txt=input.trim();setInput("");setMessages(m=>[...m,{role:"user",content:txt}]);setLoading(true);try{const hist=[...messages,{role:"user",content:txt}];const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,system:`You are a friendly expert tutor on AskYSIM. The student is learning "${course.title}" as part of their path to become a ${career}. Give clear, beginner-friendly explanations with practical examples.`,messages:hist.map(m=>({role:m.role,content:m.content}))})});const data=await res.json();const reply=data.content?.find(b=>b.type==="text")?.text||"Something went wrong.";setMessages(m=>[...m,{role:"assistant",content:reply}]);}catch{setMessages(m=>[...m,{role:"assistant",content:"Network error — try again."}]);}setLoading(false);}
  function render(t){return t.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code style="background:#0d1022;padding:2px 6px;border-radius:4px;font-size:12px;color:#0DFFE0">$1</code>').replace(/\n/g,'<br/>');}
  return(<div style={{position:"fixed",inset:0,background:"#00000088",zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:20}}><div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:16,width:"100%",maxWidth:420,height:560,display:"flex",flexDirection:"column",animation:"slideUp .25s ease"}}><div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:10,background:`${T.cyan}22`,border:`1px solid ${T.cyan}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🤖</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:T.text}}>AI Tutor</div><div style={{fontSize:11,color:T.muted}}>Powered by Claude</div></div><button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:18}}>✕</button></div><div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>{messages.map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}><div style={{maxWidth:"85%",padding:"10px 14px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?T.cyan:T.surface,color:m.role==="user"?T.bg:T.text,fontSize:13,lineHeight:1.6}} dangerouslySetInnerHTML={{__html:render(m.content)}}/></div>))}{loading&&<div style={{display:"flex",gap:4,padding:"10px 14px",background:T.surface,borderRadius:"14px 14px 14px 4px",width:"fit-content"}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.cyan,animation:`pulse 1.2s ease ${i*0.2}s infinite`}}/>)}</div>}<div ref={bottomRef}/></div><div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask anything…" style={{flex:1,background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 14px",color:T.text,fontSize:13,outline:"none"}}/><button onClick={send} disabled={!input.trim()||loading} style={{width:40,height:40,borderRadius:10,background:input.trim()&&!loading?T.cyan:T.border,border:"none",cursor:input.trim()&&!loading?"pointer":"default",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button></div></div></div>);
}

function VideoModal({course,color,onClose}){return(<div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:900,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}><div style={{background:T.card,borderRadius:16,overflow:"hidden",width:"100%",maxWidth:780,border:`1px solid ${color}33`,animation:"slideUp .2s ease"}} onClick={e=>e.stopPropagation()}><div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{fontSize:14,fontWeight:700,color:T.text,flex:1,overflow:"hidden",textOverflow:"ell
