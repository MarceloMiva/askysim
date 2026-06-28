import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════ */
const T = {
  bg:"#050714", surface:"#0d1022", card:"#111425", border:"#1e2240",
  cyan:"#0DFFE0", violet:"#7B5EA7", red:"#FF4D6D", yellow:"#FFB547",
  green:"#10B981", text:"#e2e8f0", muted:"#64748b", dim:"#94a3b8",
  gold:"#FFD700", silver:"#C0C0C0", bronze:"#CD7F32",
};

/* ═══════════════════════════════════════════════════════════
   SCHOOLS DATA (mirrors main app)
═══════════════════════════════════════════════════════════ */
const SCHOOLS = {
  "School of Computing & IT":{icon:"💻",color:"#6C63FF",short:"SCIT",departments:{
    "Computer Science":{color:"#6C63FF",icon:"💻",degree:"BSc.",careers:[
      {id:"fullstack_cs",title:"Full-Stack Web Developer"},{id:"mobile_dev",title:"Mobile App Developer"},
      {id:"devops",title:"DevOps / Cloud Engineer"},{id:"game_dev",title:"Game Developer"},
      {id:"blockchain",title:"Blockchain Developer"},{id:"sysarch",title:"Systems Architect"},
    ]},
    "Cybersecurity":{color:"#0DFFE0",icon:"🔐",degree:"BSc.",careers:[
      {id:"pentest",title:"Penetration Tester"},{id:"soc_analyst",title:"SOC Analyst"},
      {id:"dfir",title:"DFIR Specialist"},{id:"malware_an",title:"Malware Analyst"},
      {id:"cloud_sec",title:"Cloud Security Architect"},{id:"red_team",title:"Red Team Operator"},
      {id:"grc",title:"GRC Analyst"},{id:"threat_intel",title:"Threat Intelligence Analyst"},
    ]},
    "Data Science":{color:"#FF6B6B",icon:"📊",degree:"BSc.",careers:[
      {id:"data_analyst",title:"Data Analyst"},{id:"data_sci",title:"Data Scientist"},
      {id:"data_eng",title:"Data Engineer"},{id:"bi_analyst",title:"BI Analyst"},
      {id:"ml_eng",title:"Machine Learning Engineer"},{id:"data_viz",title:"Data Viz Engineer"},
    ]},
    "Software Engineering":{color:"#FFB547",icon:"⚙️",degree:"BSc.",careers:[
      {id:"backend_eng",title:"Backend Engineer"},{id:"frontend_eng",title:"Frontend Engineer"},
      {id:"qa_eng",title:"QA / Test Engineer"},{id:"sre",title:"Site Reliability Engineer"},
      {id:"embedded",title:"Embedded Systems Engineer"},{id:"tech_pm",title:"Technical Product Manager"},
    ]},
    "Information Technology":{color:"#4ECDC4",icon:"🖧",degree:"BSc.",careers:[
      {id:"sysadmin",title:"Systems Administrator"},{id:"net_eng",title:"Network Engineer"},
      {id:"cloud_admin",title:"Cloud Administrator"},{id:"dba",title:"Database Administrator"},
      {id:"it_sec",title:"IT Security Analyst"},{id:"it_pm",title:"IT Project Manager"},
    ]},
    "Artificial Intelligence":{color:"#A855F7",icon:"🧠",degree:"BSc.",careers:[
      {id:"ai_eng",title:"AI Engineer"},{id:"nlp_eng",title:"NLP Engineer"},
      {id:"cv_eng",title:"Computer Vision Engineer"},{id:"llm_eng",title:"LLM / GenAI Engineer"},
      {id:"mlops",title:"MLOps Engineer"},{id:"ai_res",title:"AI Research Scientist"},
      {id:"robotics",title:"Robotics Engineer"},
    ]},
  }},
  "School of Management & Social Sciences":{icon:"🏛️",color:"#F59E0B",short:"SMSS",departments:{
    "Business Management":{color:"#F59E0B",icon:"📊",degree:"BSc.",careers:[
      {id:"brand_mgr",title:"Brand Manager"},{id:"ops_mgr",title:"Operations Manager"},
      {id:"hr_mgr",title:"HR Manager"},{id:"strategy_con",title:"Strategy Consultant"},
      {id:"mktg_mgr",title:"Marketing Manager"},{id:"supply_chain",title:"Supply Chain Manager"},
      {id:"biz_analyst",title:"Business Analyst"},
    ]},
    "Economics":{color:"#10B981",icon:"📉",degree:"BSc.",careers:[
      {id:"economist",title:"Economist"},{id:"policy_analyst",title:"Policy Analyst"},
      {id:"fin_economist",title:"Financial Economist"},{id:"dev_economist",title:"Development Economist"},
      {id:"research_analyst",title:"Research Analyst"},
    ]},
    "Accounting":{color:"#3B82F6",icon:"🧾",degree:"BSc.",careers:[
      {id:"auditor",title:"Auditor"},{id:"tax_consultant",title:"Tax Consultant"},
      {id:"fin_accountant",title:"Financial Accountant"},{id:"forensic_acc",title:"Forensic Accountant"},
    ]},
    "Entrepreneurship":{color:"#EF4444",icon:"🚀",degree:"BSc.",careers:[
      {id:"startup_founder",title:"Startup Founder"},{id:"vc_analyst",title:"VC Analyst"},
      {id:"biz_dev",title:"Business Development Manager"},{id:"product_mgr",title:"Product Manager"},
    ]},
    "Public Policy & Administration":{color:"#8B5CF6",icon:"🏛️",degree:"BSc.",careers:[
      {id:"civil_servant",title:"Civil Servant"},{id:"govt_policy",title:"Policy Analyst"},
      {id:"ngo_pm",title:"NGO Programme Manager"},{id:"intl_dev",title:"International Development Officer"},
    ]},
    "Criminology & Security Studies":{color:"#DC2626",icon:"🔐",degree:"BSc.",careers:[
      {id:"crime_analyst",title:"Crime Analyst"},{id:"security_con",title:"Security Consultant"},
      {id:"counter_intel",title:"Counter-Intelligence Officer"},
    ]},
  }},
  "School of Communications & Media":{icon:"📡",color:"#EC4899",short:"SCM",departments:{
    "Mass Communication & Media Studies":{color:"#EC4899",icon:"📡",degree:"BSc.",careers:[
      {id:"journalist",title:"Journalist"},{id:"pr_specialist",title:"PR Specialist"},
      {id:"content_creator",title:"Content Creator"},{id:"broadcast_prod",title:"Broadcast Producer"},
      {id:"social_media_mgr",title:"Social Media Manager"},{id:"advert_strat",title:"Advertising Strategist"},
    ]},
  }},
  "School of Allied Health Sciences":{icon:"🏥",color:"#06B6D4",short:"SAHS",departments:{
    "Public Health":{color:"#06B6D4",icon:"🏥",degree:"BSc.",careers:[
      {id:"epidemiologist",title:"Epidemiologist"},{id:"health_promo",title:"Health Promotion Officer"},
      {id:"pub_health_analyst",title:"Public Health Analyst"},{id:"global_health",title:"Global Health Consultant"},
    ]},
    "Nursing Science":{color:"#F472B6",icon:"🩺",degree:"BSc.",careers:[
      {id:"clinical_nurse",title:"Clinical Nurse"},{id:"nurse_educator",title:"Nurse Educator"},
      {id:"icu_nurse",title:"ICU Nurse"},{id:"nurse_mgr",title:"Nurse Manager"},
    ]},
    "Community Health Science":{color:"#34D399",icon:"🤝",degree:"B.CHS.",careers:[
      {id:"comm_health_wkr",title:"Community Health Worker"},{id:"health_educator",title:"Health Educator"},
      {id:"outreach_coord",title:"Outreach Coordinator"},
    ]},
    "Environmental Health Science":{color:"#86EFAC",icon:"🌿",degree:"B.EHS.",careers:[
      {id:"env_health_spec",title:"Environmental Health Specialist"},{id:"occ_health",title:"Occupational Health Specialist"},
      {id:"food_safety",title:"Food Safety Inspector"},
    ]},
  }},
  "School of Education":{icon:"🎓",color:"#F97316",short:"SOE",departments:{
    "Primary Education":{color:"#F97316",icon:"📖",degree:"B.Ed.",careers:[
      {id:"primary_teacher",title:"Primary School Teacher"},{id:"curriculum_dev",title:"Curriculum Developer"},
      {id:"school_admin",title:"School Administrator"},{id:"edu_consultant",title:"Education Consultant"},
    ]},
    "Early Childhood Education":{color:"#FCD34D",icon:"🧒",degree:"B.Ed.",careers:[
      {id:"nursery_teacher",title:"Nursery Teacher"},{id:"child_dev_spec",title:"Child Development Specialist"},
      {id:"family_support",title:"Family Support Worker"},
    ]},
  }},
};

/* flat career lookup */
function buildCareerMap() {
  const map = {};
  for (const sd of Object.values(SCHOOLS))
    for (const [deptName, dd] of Object.entries(sd.departments))
      for (const c of dd.careers)
        map[c.id] = { ...c, dept:deptName, deptColor:dd.color, deptIcon:dd.icon, school:Object.keys(SCHOOLS).find(s=>SCHOOLS[s].departments[deptName]) };
  return map;
}
const CAREER_MAP = buildCareerMap();

/* ═══════════════════════════════════════════════════════════
   STREAK LOGIC
   streak = consecutive days with at least 1 course done
   We store activity dates in localStorage per user
═══════════════════════════════════════════════════════════ */
const STREAK_KEY = "askyism_streaks_v1";

function loadStreaks() {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || {}; }
  catch { return {}; }
}
function saveStreaks(s) {
  try { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); } catch {}
}

function today() { return new Date().toISOString().slice(0,10); }
function yesterday() {
  const d = new Date(); d.setDate(d.getDate()-1);
  return d.toISOString().slice(0,10);
}

export function recordActivity(userId) {
  const streaks = loadStreaks();
  const user = streaks[userId] || { streak:0, lastDate:"", best:0, totalDays:0, log:[] };
  const td = today();
  if (user.lastDate === td) return user; // already logged today
  const newStreak = user.lastDate === yesterday() ? user.streak + 1 : 1;
  const updated = {
    streak: newStreak,
    lastDate: td,
    best: Math.max(user.best||0, newStreak),
    totalDays: (user.totalDays||0) + 1,
    log: [...(user.log||[]).slice(-60), td],
  };
  streaks[userId] = updated;
  saveStreaks(streaks);
  return updated;
}

export function getStreak(userId) {
  const streaks = loadStreaks();
  const user = streaks[userId];
  if (!user) return { streak:0, best:0, totalDays:0, log:[], lastDate:"" };
  // If last activity wasn't today or yesterday, streak is broken
  const active = user.lastDate === today() || user.lastDate === yesterday();
  return { ...user, streak: active ? user.streak : 0 };
}

/* ═══════════════════════════════════════════════════════════
   MOCK LEADERBOARD DATA
   In production this comes from Supabase's leaderboard view.
   Here we generate realistic-looking seeded data so the UI
   renders meaningfully even before real students sign up.
═══════════════════════════════════════════════════════════ */
const NIGERIAN_NAMES = [
  "Adebayo Okafor","Chidinma Eze","Emeka Nwachukwu","Fatima Abdullahi",
  "Gbenga Adeleke","Halima Musa","Ibrahim Yusuf","Joke Adeyemi",
  "Kemi Balogun","Lanre Omotosho","Maryam Sule","Nnamdi Obi",
  "Oluwaseun Akinwale","Precious Enwere","Quintus Okorie","Rashida Garba",
  "Sola Fashola","Tunde Bakare","Uche Obiora","Vivian Okonkwo",
  "Wasiu Afolabi","Xena Iyke","Yemi Oduola","Zainab Lawal",
  "Adeola Coker","Biodun Awosika","Chukwuemeka Igwe","Damilola Adesanya",
  "Esther Nwosu","Funmi Oyewole",
];

function seededRand(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function generateLeaderboard(careerId, count = 20) {
  const rand = seededRand(careerId.split("").reduce((a,c)=>a+c.charCodeAt(0),0));
  const totalCourses = 7 + Math.floor(rand() * 5);
  return NIGERIAN_NAMES.slice(0, count).map((name, i) => {
    const completed = Math.max(1, Math.round((1 - i * 0.04) * totalCourses * (0.7 + rand() * 0.3)));
    const streak    = Math.max(0, Math.round((1 - i * 0.05) * (3 + rand() * 14)));
    const days      = Math.round(2 + rand() * 28);
    const pct       = Math.round((completed / totalCourses) * 100);
    const levels    = ["100L","200L","300L","400L"];
    return {
      rank: i + 1,
      name,
      initials: name.split(" ").map(w=>w[0]).join(""),
      completed,
      total: totalCourses,
      pct,
      streak,
      days,
      level: levels[Math.floor(rand() * 4)],
      badge: pct === 100 ? "🏆" : pct >= 75 ? "🥇" : pct >= 50 ? "🥈" : pct >= 25 ? "🥉" : "📚",
    };
  }).sort((a,b) => b.completed - a.completed || b.streak - a.streak);
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTS
═══════════════════════════════════════════════════════════ */
function Spinner({ color = T.cyan }) {
  return <div style={{ width:18,height:18,border:`2px solid ${color}33`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.8s linear infinite" }}/>;
}

function RankBadge({ rank }) {
  if (rank === 1) return <div style={{ fontSize:22 }}>🥇</div>;
  if (rank === 2) return <div style={{ fontSize:22 }}>🥈</div>;
  if (rank === 3) return <div style={{ fontSize:22 }}>🥉</div>;
  return <div style={{ width:28,height:28,borderRadius:"50%",background:T.surface,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.muted }}>#{rank}</div>;
}

function Avatar({ initials, color, size = 36 }) {
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",background:`${color}22`,border:`1.5px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Grotesk',sans-serif",fontSize:size*0.35,fontWeight:800,color,flexShrink:0 }}>
      {initials}
    </div>
  );
}

function MiniBar({ value, color }) {
  return (
    <div style={{ background:T.border,borderRadius:99,height:4,width:64,overflow:"hidden" }}>
      <div style={{ width:`${value}%`,background:color,height:"100%",borderRadius:99 }}/>
    </div>
  );
}

function StreakFlame({ streak }) {
  const color = streak >= 7 ? T.red : streak >= 3 ? T.yellow : T.muted;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:4 }}>
      <span style={{ fontSize:14 }}>{streak >= 7 ? "🔥" : streak >= 3 ? "⚡" : "💧"}</span>
      <span style={{ fontSize:12,fontWeight:700,color }}>{streak}d</span>
    </div>
  );
}

function HeatMap({ log = [] }) {
  const days = 35;
  const today_str = today();
  const cells = Array.from({ length:days }, (_,i) => {
    const d = new Date(); d.setDate(d.getDate() - (days-1-i));
    const key = d.toISOString().slice(0,10);
    return { key, active: log.includes(key), isToday: key === today_str };
  });
  return (
    <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
      {cells.map(c=>(
        <div key={c.key} title={c.key} style={{ width:10,height:10,borderRadius:2,background:c.active?T.cyan:T.border,opacity:c.isToday?1:c.active?0.8:0.3,border:c.isToday?`1px solid ${T.cyan}`:undefined }}/>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MY STATS CARD (personal section at top)
═══════════════════════════════════════════════════════════ */
function MyStatsCard({ profile, completed, total, color, streakData }) {
  const pct = total ? Math.round((completed/total)*100) : 0;
  const career = CAREER_MAP[profile?.career];
  return (
    <div style={{ background:`linear-gradient(135deg,${color}18 0%,${T.card} 100%)`,border:`1px solid ${color}33`,borderRadius:16,padding:"20px",marginBottom:24 }}>
      <div style={{ fontSize:11,color:color,fontWeight:700,letterSpacing:".1em",marginBottom:10 }}>YOUR STANDING</div>
      <div style={{ display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" }}>
        <Avatar initials={(profile?.name||"?").split(" ").map(w=>w[0]).join("")} color={color} size={52}/>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:18,fontWeight:800,color:T.text,marginBottom:2 }}>{profile?.name||"You"}</div>
          <div style={{ fontSize:12,color:T.muted,marginBottom:8 }}>{career?.title||"—"} · {profile?.level}L</div>
          <div style={{ display:"flex",gap:16,flexWrap:"wrap" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:800,color:color }}>{pct}%</div>
              <div style={{ fontSize:10,color:T.muted }}>Progress</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:800,color:T.yellow }}>{streakData.streak}</div>
              <div style={{ fontSize:10,color:T.muted }}>Day streak</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:800,color:T.green }}>{streakData.best}</div>
              <div style={{ fontSize:10,color:T.muted }}>Best streak</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:22,fontWeight:800,color:T.violet }}>{streakData.totalDays}</div>
              <div style={{ fontSize:10,color:T.muted }}>Active days</div>
            </div>
          </div>
        </div>
      </div>
      {/* Heatmap */}
      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:11,color:T.muted,marginBottom:8 }}>Activity — last 35 days</div>
        <HeatMap log={streakData.log||[]}/>
      </div>
      {/* Progress bar */}
      <div style={{ marginTop:14 }}>
        <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
          <span style={{ fontSize:11,color:T.muted }}>Course completion</span>
          <span style={{ fontSize:11,fontWeight:700,color:color }}>{completed}/{total} courses</span>
        </div>
        <div style={{ background:T.bg,borderRadius:99,height:6,overflow:"hidden" }}>
          <div style={{ width:`${pct}%`,background:color,height:"100%",borderRadius:99,transition:"width .5s" }}/>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   LEADERBOARD TABLE
═══════════════════════════════════════════════════════════ */
function LeaderboardTable({ entries, color, myName }) {
  const [sort, setSort] = useState("completed"); // completed | streak | days

  const sorted = [...entries].sort((a,b) => {
    if (sort === "streak") return b.streak - a.streak || b.completed - a.completed;
    if (sort === "days")   return b.days    - a.days   || b.completed - a.completed;
    return b.completed - a.completed || b.streak - a.streak;
  }).map((e,i)=>({ ...e, rank:i+1 }));

  const top3 = sorted.slice(0,3);
  const rest = sorted.slice(3);

  return (
    <div>
      {/* Sort tabs */}
      <div style={{ display:"flex",gap:4,background:T.card,padding:4,borderRadius:12,marginBottom:20,border:`1px solid ${T.border}`,width:"fit-content" }}>
        {[["completed","🎬 Courses"],["streak","🔥 Streak"],["days","📅 Days Active"]].map(([key,label])=>(
          <button key={key} onClick={()=>setSort(key)} style={{ padding:"7px 14px",borderRadius:9,border:"none",background:sort===key?color:"transparent",color:sort===key?T.bg:T.muted,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .2s" }}>{label}</button>
        ))}
      </div>

      {/* Podium — top 3 */}
      <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"center",gap:12,marginBottom:28,padding:"0 8px" }}>
        {/* 2nd */}
        {top3[1] && (
          <div style={{ flex:1,textAlign:"center" }}>
            <Avatar initials={top3[1].initials} color={T.silver} size={44}/>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:700,color:T.text,marginTop:8,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{top3[1].name.split(" ")[0]}</div>
            <div style={{ background:`${T.silver}22`,border:`1px solid ${T.silver}44`,borderRadius:10,padding:"10px 4px",marginTop:4 }}>
              <div style={{ fontSize:18,fontWeight:800,color:T.silver,fontFamily:"'Space Grotesk',sans-serif" }}>🥈</div>
              <div style={{ fontSize:12,color:T.dim,marginTop:4 }}>{top3[1].completed} done</div>
              <StreakFlame streak={top3[1].streak}/>
            </div>
          </div>
        )}
        {/* 1st */}
        {top3[0] && (
          <div style={{ flex:1,textAlign:"center" }}>
            <div style={{ position:"relative",display:"inline-block" }}>
              <Avatar initials={top3[0].initials} color={T.gold} size={56}/>
              <div style={{ position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",fontSize:20 }}>👑</div>
            </div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:800,color:T.text,marginTop:12,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{top3[0].name.split(" ")[0]}</div>
            <div style={{ background:`${T.gold}22`,border:`1px solid ${T.gold}44`,borderRa
