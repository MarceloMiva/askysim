import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════
   FONTS & GLOBAL STYLES
═══════════════════════════════════════════════════════════ */
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#050714;font-family:'Inter',sans-serif;color:#e2e8f0}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a0d1a}::-webkit-scrollbar-thumb{background:#1a1d2e;border-radius:99px}
    input,textarea,button,select{font-family:'Inter',sans-serif}
    @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    input:focus,select:focus,textarea:focus{outline:2px solid #0DFFE044!important}
  `}</style>
);

/* ═══════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════ */
const T = {
  bg:"#050714", surface:"#0d1022", card:"#111425", border:"#1e2240",
  cyan:"#0DFFE0", violet:"#7B5EA7", red:"#FF4D6D", yellow:"#FFB547",
  green:"#10B981", text:"#e2e8f0", muted:"#64748b", dim:"#94a3b8",
};

/* ═══════════════════════════════════════════════════════════
   SCHOOLS DATA (mirrors main app)
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
      {id:"civil_servant",title:"Civil Servant / Public Administrator",icon:"🏛️"},{id:"govt_policy",title:"Government Policy Analyst",icon:"📜"},
      {id:"ngo_pm",title:"NGO Programme Manager",icon:"🌍"},{id:"govt_relations",title:"Government Relations Specialist",icon:"🤝"},
      {id:"intl_dev",title:"International Development Officer",icon:"✈️"},
    ]},
    "Criminology & Security Studies":{color:"#DC2626",icon:"🔐",degree:"BSc.",careers:[
      {id:"crime_analyst",title:"Crime & Intelligence Analyst",icon:"🔍"},{id:"security_con",title:"Security Consultant",icon:"🛡️"},
      {id:"probation_off",title:"Probation & Corrections Officer",icon:"⚖️"},{id:"law_research",title:"Criminology Researcher",icon:"📚"},
      {id:"counter_intel",title:"Counter-Intelligence Officer",icon:"🕵️"},
    ]},
  }},
  "School of Communications & Media":{icon:"📡",color:"#EC4899",short:"SCM",departments:{
    "Mass Communication & Media Studies":{color:"#EC4899",icon:"📡",degree:"BSc.",careers:[
      {id:"journalist",title:"Journalist / Reporter",icon:"📰"},{id:"pr_specialist",title:"PR & Communications Specialist",icon:"🗣️"},
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
      {id:"outreach_coord",title:"Outreach Programme Coordinator",icon:"📍"},{id:"chew",title:"CHEW",icon:"🏥"},
    ]},
    "Environmental Health Science":{color:"#86EFAC",icon:"🌿",degree:"B.EHS.",careers:[
      {id:"env_health_spec",title:"Environmental Health Specialist",icon:"🌿"},{id:"occ_health",title:"Occupational Health & Safety Specialist",icon:"⛑️"},
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

/* ═══════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════ */
const ADMIN_KEY = "askyism_admin_v1";
const PIN_KEY   = "askyism_admin_pin";

function loadAdmin() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY)) || { courses:{}, careers:{}, departments:{}, activity:[] }; }
  catch { return { courses:{}, careers:{}, departments:{}, activity:[] }; }
}
function saveAdmin(data) {
  try { localStorage.setItem(ADMIN_KEY, JSON.stringify(data)); } catch {}
}
function getPin() { return localStorage.getItem(PIN_KEY) || "2580"; }
function setPin(p) { localStorage.setItem(PIN_KEY, p); }

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function uid() { return Math.random().toString(36).slice(2,9); }
function allDepts() {
  const out = {};
  for (const [school, sd] of Object.entries(SCHOOLS))
    for (const [dept, dd] of Object.entries(sd.departments))
      out[dept] = { ...dd, school };
  return out;
}
const ALL_DEPTS = allDepts();

function totalCounts() {
  let depts = 0, careers = 0;
  for (const sd of Object.values(SCHOOLS)) {
    depts += Object.keys(sd.departments).length;
    for (const dd of Object.values(sd.departments)) careers += dd.careers.length;
  }
  return { schools: Object.keys(SCHOOLS).length, depts, careers };
}

function logActivity(admin, action) {
  const entry = { id: uid(), action, time: Date.now() };
  admin.activity = [entry, ...(admin.activity || [])].slice(0, 50);
  return admin;
}

/* ═══════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════ */
function Badge({ label, color }) {
  return <span style={{ background:`${color}18`, color, border:`1px solid ${color}33`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{label}</span>;
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background:T.card, borderRadius:14, padding:"20px", border:`1px solid ${T.border}`, flex:1, minWidth:120 }}>
      <div style={{ fontSize:24, marginBottom:8 }}>{icon}</div>
      <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:28, fontWeight:800, color: color||T.cyan, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, color:T.muted }}>{label}</div>
    </div>
  );
}

function Confirm({ msg, onYes, onNo }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000aa", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:T.card, borderRadius:16, padding:"28px", maxWidth:360, width:"90%", border:`1px solid ${T.border}`, animation:"slideUp .2s ease" }}>
        <div style={{ fontSize:18, fontWeight:700, color:T.text, marginBottom:12 }}>Are you sure?</div>
        <div style={{ color:T.muted, fontSize:14, marginBottom:24 }}>{msg}</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onNo}  style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${T.border}`, background:"transparent", color:T.muted, fontWeight:700, cursor:"pointer" }}>Cancel</button>
          <button onClick={onYes} style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:T.red, color:"#fff", fontWeight:700, cursor:"pointer" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, type="success" }) {
  return (
    <div style={{ position:"fixed", bottom:24, right:24, background:type==="success"?T.green:T.red, color:"#fff", borderRadius:10, padding:"12px 20px", fontSize:13, fontWeight:700, zIndex:3000, animation:"slideUp .2s ease", boxShadow:"0 4px 24px #00000044" }}>
      {type==="success"?"✓":"✕"} {msg}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   YOUTUBE PREVIEW
═══════════════════════════════════════════════════════════ */
function YtPreview({ ytId }) {
  if (!ytId || ytId.length < 5) return null;
  return (
    <div style={{ marginTop:8, borderRadius:10, overflow:"hidden", border:`1px solid ${T.border}`, maxWidth:240 }}>
      <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} style={{ width:"100%", display:"block" }} alt="YouTube thumbnail" onError={e=>e.target.style.display="none"} />
      <div style={{ padding:"6px 10px", background:T.surface, fontSize:11, color:T.muted }}>
        🎬 youtube.com/watch?v={ytId}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INLINE EDITABLE CELL
═══════════════════════════════════════════════════════════ */
function EditCell({ value, onSave, type="text", options=[] }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef();

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setVal(value); }, [value]);

  function commit() { setEditing(false); if (val !== value) onSave(val); }

  if (!editing) return (
    <span onClick={() => setEditing(true)} title="Click to edit" style={{ cursor:"pointer", borderBottom:`1px dashed ${T.border}`, paddingBottom:1, color:T.text, fontSize:13, display:"inline-block" }}>
      {type==="bool" ? (value ? <Badge label="Yes" color={T.green}/> : <Badge label="No" color={T.muted}/>) : (value||<span style={{color:T.muted,fontStyle:"italic"}}>—</span>)}
    </span>
  );

  if (type === "bool") return (
    <select ref={ref} value={val?"true":"false"} onChange={e=>setVal(e.target.value==="true")} onBlur={commit} style={{ background:T.surface, border:`1px solid ${T.cyan}`, borderRadius:6, padding:"4px 8px", color:T.text, fontSize:12 }}>
      <option value="true">Yes</option><option value="false">No</option>
    </select>
  );

  if (type === "select") return (
    <select ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} style={{ background:T.surface, border:`1px solid ${T.cyan}`, borderRadius:6, padding:"4px 8px", color:T.text, fontSize:12 }}>
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  );

  if (type === "textarea") return (
    <textarea ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} rows={3} style={{ background:T.surface, border:`1px solid ${T.cyan}`, borderRadius:6, padding:"6px 10px", color:T.text, fontSize:12, width:"100%", resize:"vertical" }}/>
  );

  return (
    <input ref={ref} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={e=>e.key==="Enter"&&commit()} style={{ background:T.surface, border:`1px solid ${T.cyan}`, borderRadius:6, padding:"4px 10px", color:T.text, fontSize:12, width: type==="ytid"?"130px":"100%" }}/>
  );
}

/* ═══════════════════════════════════════════════════════════
   COURSES TAB
═══════════════════════════════════════════════════════════ */
function CoursesTab({ admin, onUpdate, onToast }) {
  const [school, setSchool] = useState(Object.keys(SCHOOLS)[0]);
  const [dept,   setDept]   = useState("");
  const [career, setCareer] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const schoolData = SCHOOLS[school];
  const deptList   = Object.keys(schoolData?.departments || {});
  const activeDept = schoolData?.departments[dept];
  const careerList = activeDept?.careers || [];
  const activeColor = activeDept?.color || T.cyan;

  // Get courses: admin override > base empty
  function getCourses() {
    if (!career) return [];
    return admin.courses[career] || [];
  }

  function updateCourses(newCourses) {
    const updated = { ...admin, courses: { ...admin.courses, [career]: newCourses } };
    logActivity(updated, `Updated courses for "${career}"`);
    onUpdate(updated);
    onToast("Courses saved!");
  }

  function updateField(idx, field, val) {
    const list = [...getCourses()];
    list[idx] = { ...list[idx], [field]: val };
    updateCourses(list);
  }

  function addCourse() {
    const list = getCourses();
    const newCourse = { id: uid(), title:"New Course", duration:"1h 00m", ytId:"", lab:false, desc:"Course description.", level:"Beginner" };
    updateCourses([...list, newCourse]);
    onToast("Course added!");
  }

  function deleteCourse(idx) {
    setConfirm({ msg:"Delete this course permanently?", onYes:()=>{ const l=[...getCourses()]; l.splice(idx,1); updateCourses(l); setConfirm(null); onToast("Course deleted.","error"); }});
  }

  function moveUp(idx) {
    if (idx===0) return;
    const l=[...getCourses()]; [l[idx-1],l[idx]]=[l[idx],l[idx-1]]; updateCourses(l);
  }
  function moveDown(idx) {
    const l=getCourses(); if(idx>=l.length-1) return;
    const a=[...l]; [a[idx],a[idx+1]]=[a[idx+1],a[idx]]; updateCourses(a);
  }

  const courses = getCourses();

  return (
    <div style={{ animation:"slideUp .2s ease" }}>
      {confirm && <Confirm {...confirm} onNo={()=>setConfirm(null)}/>}
      {preview && <YtPreview ytId={preview}/>}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <h2 style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:20, fontWeight:800, color:T.text }}>Course Manager</h2>
          <p style={{ color:T.muted, fontSize:13, marginTop:4 }}>Add, edit, and reorder courses for any career path</p>
        </div>
        {career && <button onClick={addCourse} style={{ padding:"10px 20px", borderRadius:10, border:"none", background:T.cyan, color:T.bg, fontWeight:800, fontSize:13, cursor:"pointer" }}>+ Add Course</button>}
      </div>

      {/* Drill-down selectors */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:24 }}>
        <di
