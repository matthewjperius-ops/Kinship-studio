"use client";
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
// ─── Constants ────────────────────────────────────────────────────────────────
const TRAVEL_BUFFER = 30;
const DURATIONS = [60, 90, 120];
const WORK_START = 8 * 60;
const WORK_END   = 19 * 60;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── In a real app these would be env vars / server-validated ─────────────────
// Admin token is a secret shared only with admins.
// Producer tokens are generated per-invite.
const ADMIN_TOKEN = "ADMIN-SECRET-2026";



// ─── Helpers ──────────────────────────────────────────────────────────────────
function toMins(str) { const d = new Date(str); return d.getHours()*60+d.getMinutes(); }
function dateKey(str) { return str.slice(0,10); }
function getDaysInMonth(y,m) { return new Date(y,m+1,0).getDate(); }
function getFirstDay(y,m) { return new Date(y,m,1).getDay(); }
function fmtMins(mins) {
  const h = Math.floor(mins/60)%12||12, m = mins%60, ap = Math.floor(mins/60)<12?"AM":"PM";
  return `${h}:${String(m).padStart(2,"0")} ${ap}`;
}
function fmtDuration(m) { return m===60?"1 hr":m===90?"1.5 hrs":"2 hrs"; }
function specialtyLabel(s) { return s==="photo"?"Photography":s==="video"?"Videography":"Photo + Video"; }
function genToken() { return Math.random().toString(36).slice(2,10).toUpperCase(); }

async function findFreeSlots(selectedProducers, durationMins, year, month, existingBookings=[]) {
const results = [];
  const count = getDaysInMonth(year, month);
  const timeMin = new Date(year, month, 1).toISOString();
  const timeMax = new Date(year, month + 1, 0, 23, 59).toISOString();
  const busyByEmail = {};

  // Fetch real calendar busy times and working hour settings per producer
  const settingsByEmail = {};
  await Promise.all(selectedProducers.map(async (p) => {
    const [calRes, settingsRes] = await Promise.allSettled([
      fetch(`/api/calendar?email=${encodeURIComponent(p.email)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`),
      fetch(`/api/producer/settings/${encodeURIComponent(p.email)}`),
    ]);
    if (calRes.status === "fulfilled" && calRes.value.ok) {
      const data = await calRes.value.json();
      if (Array.isArray(data)) busyByEmail[p.email] = data.map(b => ({ start: b.start, end: b.end }));
    }
    if (settingsRes.status === "fulfilled" && settingsRes.value.ok) {
      const s = await settingsRes.value.json();
      if (s) settingsByEmail[p.email] = s;
    }
  }));
  const DOW_NAMES = ["sun","mon","tue","wed","thu","fri","sat"];
  for (let d = 1; d <= count; d++) {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dow = new Date(ds+"T12:00:00").getDay();

    // Check if all selected producers are available on this day of week
    const dayName = DOW_NAMES[dow];
    const anyUnavailable = selectedProducers.some(p => {
      const s = settingsByEmail[p.email];
      if (!s?.days) return false; // no settings = use defaults, don't block
      return !s.days.includes(dayName);
    });
    if (anyUnavailable) continue;

    const allBlocked = [];
    for (const p of selectedProducers) {
      const calBusy = (busyByEmail[p.email]||[])
        .filter(b=>dateKey(b.start)===ds)
        .map(b=>({start:toMins(b.start)-TRAVEL_BUFFER,end:toMins(b.end)+TRAVEL_BUFFER}));
      const bookedBlocks = existingBookings
        .filter(b=>dateKey(b.startsAt)===ds && b.attendees?.some(a=>a.email===p.email))
        .map(b=>({start:toMins(b.startsAt)-TRAVEL_BUFFER,end:toMins(b.endsAt)+TRAVEL_BUFFER}));
      allBlocked.push(...calBusy,...bookedBlocks);
    }

    // Use the most restrictive working hours across all selected producers
    const workStart = Math.max(...selectedProducers.map(p => {
      const s = settingsByEmail[p.email];
      return s?.startHour != null ? s.startHour * 60 : WORK_START;
    }));
    const workEnd = Math.min(...selectedProducers.map(p => {
      const s = settingsByEmail[p.email];
      return s?.endHour != null ? s.endHour * 60 : WORK_END;
    }));

    const slots = [];
    for (let ss=workStart+TRAVEL_BUFFER; ss+durationMins+TRAVEL_BUFFER<=workEnd; ss+=30) {
      const bS=ss-TRAVEL_BUFFER, bE=ss+durationMins+TRAVEL_BUFFER;
      if (!allBlocked.some(b=>b.start<bE&&b.end>bS)) {
        slots.push({date:ds,shootStart:ss,shootEnd:ss+durationMins,blockStart:bS,blockEnd:bE});
      }
    }
    if (slots.length) results.push({date:ds,slots});
  }
  return results;
}


// ─── Kinship Design Tokens ───────────────────────────────────────────────────
const T = {
  bg:      "#f5f1eb",   // warm cream — page background
  surface: "#ffffff",   // white cards
  surface2:"#ede9e2",   // slightly darker cream for inset areas
  border:  "#ddd6cc",   // warm warm border
  text:    "#1c1c19",   // near-black ink
  muted:   "#7a7568",   // warm mid-grey
  accent:  "#2d4a35",   // Kinship forest green — primary action
  accentHov:"#3d6045",  // green hover
  green:   "#3d6045",   // confirmation / success green
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  .hp:hover{opacity:0.85;}
  .hg:hover{background:#ede9e2!important;color:#1c1c19!important;}
  .hs:hover{border-color:#2d4a35!important;}
  .pc:hover{border-color:#2d4a35!important;transform:translateY(-2px);box-shadow:0 6px 24px rgba(45,74,53,0.14);}
  .sd:hover{border-color:#2d4a35!important;background:rgba(45,74,53,0.04)!important;}
  @keyframes fade{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  @keyframes tIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
  .pg{animation:fade 0.28s ease;}
  .shake{animation:shake 0.35s ease;}
  input::placeholder{color:#b0a898;} textarea::placeholder{color:#b0a898;}
  input:focus{border-color:#2d4a35!important;outline:none;}
  textarea:focus{border-color:#2d4a35!important;outline:none;}
  ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#ddd6cc;border-radius:2px}
`;

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Avatar({ p, size=48 }) {
  return p.photo
    ? <img src={p.photo} alt={p.name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`1.5px solid ${T.border}`,flexShrink:0}}/>
    : <div style={{width:size,height:size,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",
        justifyContent:"center",fontSize:size*.4,fontWeight:500,color:T.accent,flexShrink:0,
        border:`1.5px solid ${T.border}`,fontFamily:"'Cormorant Garamond',serif",letterSpacing:"0.04em"}}>
        {p.name[0].toUpperCase()}
      </div>;
}

function StackedAvatars({ producers, size=36 }) {
  return (
    <div style={{display:"flex",alignItems:"center"}}>
      {producers.map((p,i)=>(
        <div key={p.id} style={{marginLeft:i===0?0:-size*0.28,zIndex:producers.length-i,position:"relative"}}>
          <Avatar p={p} size={size}/>
        </div>
      ))}
    </div>
  );
}

function Badge({ s }) {
  return <span style={{fontSize:10,fontWeight:600,padding:"3px 11px",borderRadius:2,
    background:"rgba(45,74,53,0.08)",color:T.accent,
    fontFamily:"'Jost',sans-serif",letterSpacing:"0.12em",textTransform:"uppercase"}}>
    {s==="photo"?"Photography":s==="video"?"Videography":"Photo & Video"}
  </span>;
}

function ToastEl({ msg, type }) {
  return <div style={{position:"fixed",bottom:28,right:28,zIndex:9999,
    background:type==="err"?"#5a1a1a":T.accent,
    color:"#ffffff",padding:"13px 22px",borderRadius:3,
    fontSize:13,fontFamily:"'Jost',sans-serif",fontWeight:500,letterSpacing:"0.03em",
    boxShadow:"0 8px 32px rgba(45,74,53,0.25)",animation:"tIn 0.2s ease"}}>
    {type==="err"?"✕  ":"✓  "}{msg}
  </div>;
}

// shared style object
const css = {
  app:   {minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Jost',sans-serif",fontWeight:400},
  bar:   {background:T.accent,borderBottom:"none",padding:"0 48px",
          height:62,display:"flex",alignItems:"center",justifyContent:"space-between"},
  logo:  {fontSize:20,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
          fontFamily:"'Cormorant Garamond',serif",color:"#ffffff"},
  wrap:  {maxWidth:1020,margin:"0 auto",padding:"52px 32px"},
  wrapNarrow: {maxWidth:580,margin:"0 auto",padding:"52px 32px"},
  h1:    {fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:400,
          letterSpacing:"-0.3px",marginBottom:8,color:T.text,lineHeight:1.2},
  sub:   {fontSize:14,color:T.muted,marginBottom:34,lineHeight:1.65,fontWeight:300},
  card:  {background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,padding:28,marginBottom:18},
  card2: {background:T.surface2,border:`1px solid ${T.border}`,borderRadius:3,padding:20},
  lbl:   {fontSize:10,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
          color:T.muted,marginBottom:10,display:"block",fontFamily:"'Jost',sans-serif"},
  inp:   {background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,color:T.text,
          padding:"11px 14px",fontSize:14,fontFamily:"'Jost',sans-serif",outline:"none",width:"100%",
          fontWeight:400},
  btnP:  {padding:"12px 28px",background:T.accent,color:"#ffffff",border:"none",borderRadius:3,
          cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Jost',sans-serif",
          letterSpacing:"0.1em",textTransform:"uppercase",transition:"background 0.15s"},
  btnG:  {padding:"10px 20px",background:"transparent",color:T.muted,border:`1px solid ${T.border}`,
          borderRadius:3,cursor:"pointer",fontSize:12,fontFamily:"'Jost',sans-serif",
          letterSpacing:"0.06em"},
  btnSm: {padding:"6px 13px",background:"transparent",color:T.muted,border:`1px solid ${T.border}`,
          borderRadius:3,cursor:"pointer",fontSize:11,fontFamily:"'Jost',sans-serif",
          letterSpacing:"0.06em"},
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN LOGIN GATE
// ═══════════════════════════════════════════════════════════════════════════════
function AdminLogin({ onSuccess }) {
  const [token, setToken] = useState("");
  const [shake, setShake] = useState(false);
  const [err, setErr] = useState("");

  function attempt() {
    if (token.trim() === ADMIN_TOKEN) {
      onSuccess();
    } else {
      setErr("Invalid access token.");
      setShake(true);
      setTimeout(()=>setShake(false), 400);
    }
  }

  return (
    <div style={css.app}>
      <style>{GLOBAL_CSS}</style>
      <div style={css.bar}>
        <span style={css.logo}>Kinship</span>
      </div>
      <div style={{...css.wrapNarrow,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 58px)"}}>
        <div style={{width:"100%",maxWidth:400}}>
          <div style={{textAlign:"center",marginBottom:36}}>
            <div style={{fontSize:40,marginBottom:16}}>🔒</div>
            <div style={{fontSize:22,fontWeight:900,marginBottom:6}}>Admin Access</div>
            <div style={{fontSize:13,color:T.muted}}>This area is restricted to LENS team members.<br/>Enter your access token to continue.</div>
          </div>
          <div className={shake?"shake":""} style={css.card}>
            <label style={css.lbl}>Access Token</label>
            <input
              style={{...css.inp,marginBottom:err?8:16,fontFamily:"monospace",letterSpacing:"0.08em",
                borderColor:err?"#7f1d1d":T.border}}
              placeholder="Paste your token here"
              value={token}
              onChange={e=>{setToken(e.target.value);setErr("");}}
              onKeyDown={e=>e.key==="Enter"&&attempt()}
              type="password"
            />
            {err&&<div style={{fontSize:12,color:"#f87171",marginBottom:14}}>{err}</div>}
            <button className="hp" style={{...css.btnP,width:"100%",padding:12}} onClick={attempt}>
              Enter Admin Portal →
            </button>
          </div>
          <div style={{textAlign:"center",fontSize:12,color:T.muted}}>
            Need access? Contact your studio administrator.
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPortal({ producers, setProducers, invites, setInvites, bookings, onLogout }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [toast, setToast] = useState(null);
  const [onboardToken, setOnboardToken] = useState(null);
  const [showAddProducer, setShowAddProducer] = useState(false);
  const [addProducerEmail, setAddProducerEmail] = useState("");
  const [addProducerToken, setAddProducerToken] = useState(null);

  async function addProducer() {
    if (!addProducerEmail.includes("@")) { showToast("Enter a valid email","err"); return; }
    try {
      // Create invite
      const invRes = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addProducerEmail }),
      });
      const invData = await invRes.json();
      if (!invRes.ok) throw new Error(invData.error);

      // Create producer record in DB so they appear in roster
      const colors = ["#f4c2c2","#c2d4f4","#c2f4d4","#e8d4f4","#f4e8c2","#d4f4c2"];
      const pRes = await fetch("/api/admin/producers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addProducerEmail.split("@")[0],
          email: addProducerEmail,
          color: colors[producers.length % colors.length],
        }),
      });
      const pData = await pRes.json();
      setProducers(ps => ps.find(p=>p.email===addProducerEmail) ? ps : [...ps, pData]);
      setInvites(iv => iv.find(i=>i.email===invData.email) ? iv : [...iv, { email: invData.email, token: invData.token, status: "pending" }]);
      setAddProducerToken(invData.token);
    } catch(e) {
      showToast("Failed to create invite","err");
    }
  }

  async function removeProducer(id) {
    await fetch(`/api/admin/producers/${id}`, { method: "DELETE" });
    setProducers(ps=>ps.filter(p=>p.id!==id));
    showToast("Producer removed");
  }

  // Onboard state
  const [oName, setOName] = useState(""); const [oSpec, setOSpec] = useState("photo");
  const [oBio, setOBio] = useState(""); const [oPhoto, setOPhoto] = useState(null);
  const [oConn, setOConn] = useState(false); const [oConning, setOConning] = useState(false);
  const photoRef = useRef();

  function showToast(msg,type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),3000); }

  function sendInvite() {
    if (!inviteEmail.includes("@")) { showToast("Enter a valid email","err"); return; }
    if (invites.find(i=>i.email===inviteEmail)) { showToast("Already invited","err"); return; }
    const token = genToken();
    setInvites(iv=>[...iv,{email:inviteEmail,token,status:"pending"}]);
    setInviteEmail(""); showToast(`Invite link created for ${inviteEmail}`);
  }

  function copyLink(token, email) {
    const link = `${window.location.origin}/join?token=${token}&email=${encodeURIComponent(email)}`;
    navigator.clipboard?.writeText(link).catch(()=>{});
    showToast("Invite link copied to clipboard!");
  }

  function previewOnboard(token) {
    setOnboardToken(token); setOName(""); setOSpec("photo"); setOBio(""); setOPhoto(null);
    setOConn(false); setOStep(1); setOGoogleAuthed(false); setOGoogleAuthing(false);
  }

  function submitProfile() {
    if (!oName.trim()) { showToast("Enter your name","err"); return; }
    if (!oConn) { showToast("Connect your Google Calendar","err"); return; }
    const inv = invites.find(i=>i.token===onboardToken);
    const colors = ["#f4c2c2","#c2d4f4","#c2f4d4","#e8d4f4","#f4e8c2","#d4f4c2"];
    setProducers(ps=>[...ps,{id:"p"+Date.now(),name:oName,email:inv?.email||"new@studio.com",
      specialty:oSpec,bio:oBio,connected:true,photo:oPhoto,color:colors[ps.length%colors.length]}]);
    setInvites(iv=>iv.map(i=>i.token===onboardToken?{...i,status:"completed"}:i));
    showToast(`${oName} joined the roster!`);
    setOnboardToken(null); setOStep(1); setOGoogleAuthed(false); setOGoogleAuthing(false);
  }

  // Onboarding flow — step 1: Gmail sign-in, step 2: profile builder
  const [oStep, setOStep] = useState(1); // 1 = google sign-in, 2 = profile builder
  const [oGoogleAuthing, setOGoogleAuthing] = useState(false);
  const [oGoogleAuthed, setOGoogleAuthed] = useState(false);

  function handleGoogleSignIn() {
    setOGoogleAuthing(true);
    // Simulate Google OAuth popup + callback
    setTimeout(()=>{
      setOGoogleAuthing(false);
      setOGoogleAuthed(true);
      // Auto-fill name from email prefix
      const inv = invites.find(i=>i.token===onboardToken);
      if (inv && !oName) {
        const namePart = inv.email.split("@")[0].replace(/[._-]/g," ").replace(/\w/g,c=>c.toUpperCase());
        setOName(namePart);
      }
      setTimeout(()=>setOStep(2), 700);
    }, 1800);
  }

  if (onboardToken) {
    const inv = invites.find(i=>i.token===onboardToken);

    // Step 1: Google Sign-In screen
    if (oStep===1) return (
      <div style={css.app}>
        <style>{GLOBAL_CSS}</style>
        <div style={css.bar}>
          <span style={css.logo}>Kinship</span>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 58px)",padding:24}}>
          <div style={{width:"100%",maxWidth:400}}>
            {/* Google-style sign-in card */}
            <div style={{background:"#fff",borderRadius:12,boxShadow:"0 8px 48px rgba(0,0,0,0.5)",overflow:"hidden"}}>
              {/* Google header */}
              <div style={{padding:"32px 40px 24px",borderBottom:"1px solid #e8eaed",textAlign:"center"}}>
                {/* Google logo */}
                <svg width="75" height="24" viewBox="0 0 75 24" style={{marginBottom:20}}>
                  <text x="0" y="20" style={{fontFamily:"'Product Sans',Arial,sans-serif",fontSize:"22px",fontWeight:400}}>
                    <tspan fill="#4285F4">G</tspan>
                    <tspan fill="#EA4335">o</tspan>
                    <tspan fill="#FBBC05">o</tspan>
                    <tspan fill="#4285F4">g</tspan>
                    <tspan fill="#34A853">l</tspan>
                    <tspan fill="#EA4335">e</tspan>
                  </text>
                </svg>
                <div style={{fontSize:22,fontWeight:400,color:"#202124",marginBottom:8,fontFamily:"'Roboto',sans-serif"}}>Sign in</div>
                <div style={{fontSize:14,color:"#5f6368",fontFamily:"'Roboto',sans-serif"}}>to continue to LENS Studio</div>
              </div>
              {/* Email display */}
              <div style={{padding:"24px 40px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                  border:"1px solid #dadce0",borderRadius:24,marginBottom:24,cursor:"pointer"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"#4285F4",display:"flex",
                    alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",fontWeight:600,flexShrink:0}}>
                    {inv?.email?.[0]?.toUpperCase()||"U"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,color:"#202124",fontFamily:"'Roboto',sans-serif",
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv?.email}</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#5f6368"><path d="M7 10l5 5 5-5z"/></svg>
                </div>

                {oGoogleAuthed
                  ? <div style={{textAlign:"center",padding:"12px 0",fontSize:14,color:"#34a853",fontWeight:500,fontFamily:"'Roboto',sans-serif"}}>
                      ✓ Signed in — setting up your profile…
                    </div>
                  : <>
                    <div style={{fontSize:13,color:"#5f6368",fontFamily:"'Roboto',sans-serif",marginBottom:20,lineHeight:1.5}}>
                      You've been invited to join the LENS producer team. Sign in with your Google account to get started.
                    </div>
                    <button
                      onClick={handleGoogleSignIn}
                      disabled={oGoogleAuthing}
                      style={{width:"100%",padding:"10px",borderRadius:4,border:"1px solid #dadce0",
                        background:oGoogleAuthing?"#f8f9fa":"#fff",cursor:oGoogleAuthing?"not-allowed":"pointer",
                        display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                        fontFamily:"'Roboto',sans-serif",fontSize:14,color:"#3c4043",fontWeight:500,
                        boxShadow:"0 1px 3px rgba(0,0,0,0.08)",transition:"box-shadow 0.15s"}}>
                      {oGoogleAuthing
                        ? <><span style={{fontSize:13,color:"#5f6368"}}>Signing in…</span></>
                        : <>
                          <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Sign in with Google
                        </>
                      }
                    </button>
                  </>
                }
              </div>
              <div style={{padding:"0 40px 24px",display:"flex",justifyContent:"space-between"}}>
                <a href="#" style={{fontSize:12,color:"#1a73e8",textDecoration:"none",fontFamily:"'Roboto',sans-serif"}} onClick={e=>e.preventDefault()}>Help</a>
                <a href="#" style={{fontSize:12,color:"#1a73e8",textDecoration:"none",fontFamily:"'Roboto',sans-serif"}} onClick={e=>e.preventDefault()}>Privacy</a>
                <a href="#" style={{fontSize:12,color:"#1a73e8",textDecoration:"none",fontFamily:"'Roboto',sans-serif"}} onClick={e=>e.preventDefault()}>Terms</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    // Step 2: Profile builder (post-Google auth)
    return (
      <div style={css.app}>
        <style>{GLOBAL_CSS}</style>
        <div style={css.bar}>
          <span style={css.logo}>Kinship</span>
          <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:T.green}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:T.green}}/> Signed in as {inv?.email}
          </div>
        </div>
        <div style={{...css.wrapNarrow,maxWidth:520}} className="pg">
          <div style={css.h1}>Complete Your Profile</div>
          <div style={css.sub}>You're in! Now set up your producer profile so clients can find and book you.</div>
          <div style={css.card}>
            <div style={{marginBottom:28,textAlign:"center"}}>
              <div onClick={()=>photoRef.current?.click()} style={{cursor:"pointer",display:"inline-block",position:"relative"}}>
                {oPhoto
                  ? <img src={oPhoto} alt="Profile" style={{width:96,height:96,borderRadius:"50%",objectFit:"cover",border:`3px solid ${T.accent}`}}/>
                  : <div style={{width:96,height:96,borderRadius:"50%",background:T.surface2,
                      border:`2px dashed ${T.border}`,display:"flex",flexDirection:"column",
                      alignItems:"center",justifyContent:"center",gap:4,color:T.muted}}>
                      <span style={{fontSize:26,lineHeight:1}}>+</span>
                      <span style={{fontSize:9,letterSpacing:"0.1em"}}>PHOTO</span>
                    </div>
                }
                <div style={{position:"absolute",bottom:2,right:2,width:26,height:26,borderRadius:"50%",
                  background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:13,color:"#0c0c0f",fontWeight:900}}>✎</div>
              </div>
              <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}}
                onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=ev=>setOPhoto(ev.target.result);r.readAsDataURL(f);}}}/>
              <div style={{fontSize:11,color:T.muted,marginTop:10}}>Click to upload a profile photo</div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={css.lbl}>Full Name *</label>
              <input style={css.inp} placeholder="Your name" value={oName} onChange={e=>setOName(e.target.value)}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={css.lbl}>What do you shoot? *</label>
              <div style={{display:"flex",gap:10}}>
                {[["photo","Photography ◈"],["video","Videography ◉"],["both","Photo + Video"]].map(([v,l])=>(
                  <div key={v} onClick={()=>setOSpec(v)} style={{flex:1,padding:"13px 8px",borderRadius:8,textAlign:"center",cursor:"pointer",
                    border:`2px solid ${oSpec===v?T.accent:T.border}`,
                    background:oSpec===v?"rgba(45,74,53,0.07)":T.surface2,
                    fontSize:12,fontWeight:oSpec===v?800:400,color:oSpec===v?T.accent:T.muted,transition:"all 0.12s"}}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
            <div style={{marginBottom:22}}>
              <label style={css.lbl}>Short Bio</label>
              <textarea style={{...css.inp,minHeight:78,resize:"vertical"}}
                placeholder="Tell clients about your style and experience…"
                value={oBio} onChange={e=>setOBio(e.target.value)}/>
            </div>
            <div style={{borderTop:`1px solid ${T.border}`,paddingTop:20,marginBottom:22}}>
              <label style={css.lbl}>Google Calendar *</label>
              {oConn
                ? <div style={{display:"flex",alignItems:"center",gap:8,fontSize:14,color:T.green,fontWeight:600}}><span>✓</span> Calendar Connected</div>
                : <button className="hp" style={{...css.btnP,display:"flex",alignItems:"center",gap:8}} disabled={oConning}
                    onClick={()=>{setOConning(true);setTimeout(()=>{setOConn(true);setOConning(false);showToast("Calendar connected!");},1500);}}>
                    {oConning?"Connecting…":"Connect Google Calendar"}
                  </button>
              }
              <div style={{fontSize:12,color:T.muted,marginTop:8}}>Required so clients can book based on your real availability.</div>
            </div>
            <button className="hp" style={{...css.btnP,width:"100%",padding:13,fontSize:14}} onClick={submitProfile}>
              Join the Roster →
            </button>
          </div>
        </div>
        {toast&&<ToastEl {...toast}/>}
      </div>
    );
  }

  // Main admin dashboard
  const uniqueBookings = [...new Map(bookings.map(b=>[b.id,b])).values()];

  const now = new Date();
  const upcomingMonths = [0,1,2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTHS[d.getMonth()] };
  });

  function shootsForProducerMonth(producerId, year, month) {
    return uniqueBookings.filter(b => {
      if (b.producerId !== producerId) return false;
      if (!b.slot?.date) return false;
      const d = new Date(b.slot.date + "T12:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
  }

  return (
    <div style={css.app}>
      <style>{GLOBAL_CSS}</style>
      <div style={css.bar}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={css.logo}>Kinship</span>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:"0.14em",
            textTransform:"uppercase",fontFamily:"'Jost',sans-serif",fontWeight:500}}>Admin Portal</span>
        </div>
        <button style={{...css.btnG,fontSize:11,color:"rgba(255,255,255,0.8)",
          borderColor:"rgba(255,255,255,0.3)",letterSpacing:"0.1em",textTransform:"uppercase"}}
          className="hg" onClick={onLogout}>
          Sign Out
        </button>
      </div>

      <div style={css.wrap} className="pg">
        <div style={css.h1}>Studio Dashboard</div>
        <div style={css.sub}>Manage producers, send invites, and view bookings</div>

        <div style={{display:"flex",gap:14,marginBottom:24}}>
          {[
            {l:"Producers",v:producers.length},
            {l:"Pending Invites",v:invites.filter(i=>i.status==="pending").length},
            {l:"Total Bookings",v:uniqueBookings.length}
          ].map(s=>(
            <div key={s.l} style={{flex:1,...css.card2,padding:22}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:40,fontWeight:400,color:T.accent,letterSpacing:"-1px"}}>{s.v}</div>
              <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginTop:4}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Schedule overview */}
        <div style={css.card}>
          <div style={{fontSize:16,fontWeight:800,marginBottom:18}}>Shoots by Producer</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr>
                  <th style={{textAlign:"left",padding:"8px 12px 12px 0",color:T.muted,fontWeight:600,fontSize:10,
                    letterSpacing:"0.12em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>
                    Producer
                  </th>
                  {upcomingMonths.map(m=>(
                    <th key={m.label} style={{textAlign:"center",padding:"8px 16px 12px",color:T.muted,fontWeight:600,
                      fontSize:10,letterSpacing:"0.12em",textTransform:"uppercase",borderBottom:`1px solid ${T.border}`}}>
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {producers.map(p=>(
                  <tr key={p.id}>
                    <td style={{padding:"12px 12px 12px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <Avatar p={p} size={28}/>
                        <span style={{fontWeight:600}}>{p.name}</span>
                      </div>
                    </td>
                    {upcomingMonths.map(m=>{
                      const count = shootsForProducerMonth(p.id, m.year, m.month);
                      return (
                        <td key={m.label} style={{textAlign:"center",padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
                          {count > 0
                            ? <span style={{display:"inline-block",minWidth:28,padding:"3px 10px",borderRadius:20,
                                background:"rgba(45,74,53,0.1)",color:T.accent,fontWeight:700,fontSize:13}}>
                                {count}
                              </span>
                            : <span style={{color:T.border}}>—</span>
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Roster */}
        <div style={css.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
            <span style={{fontSize:16,fontWeight:800}}>Content Producers</span>
            <button style={{...css.btnP,fontSize:11,padding:"7px 16px"}} className="hp"
              onClick={()=>setShowAddProducer(v=>!v)}>
              {showAddProducer?"Cancel":"+ Add Producer"}
            </button>
          </div>

          {showAddProducer&&(
            <div style={{...css.card2,marginBottom:20,display:"flex",flexDirection:"column",gap:14}}>
              {addProducerToken
                ? <>
                    <div style={{fontSize:13,fontWeight:700,color:T.accent}}>Invite link created!</div>
                    <div style={{fontFamily:"monospace",fontSize:12,background:T.surface,border:`1px solid ${T.border}`,
                      borderRadius:4,padding:"10px 14px",color:T.text,wordBreak:"break-all"}}>
                      {window.location.origin}/join?token={addProducerToken}&email={encodeURIComponent(addProducerEmail)}
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      <button style={css.btnP} className="hp" onClick={()=>{
                        navigator.clipboard?.writeText(`${window.location.origin}/join?token=${addProducerToken}&email=${encodeURIComponent(addProducerEmail)}`);
                        showToast("Link copied!");
                      }}>Copy Link</button>
                      <button style={css.btnG} className="hg" onClick={()=>{
                        setShowAddProducer(false); setAddProducerEmail(""); setAddProducerToken(null);
                      }}>Done</button>
                    </div>
                  </>
                : <>
                    <div style={{fontSize:13,fontWeight:700,color:T.accent}}>Add Producer</div>
                    <div>
                      <label style={css.lbl}>Email Address</label>
                      <input style={css.inp} placeholder="producer@email.com"
                        value={addProducerEmail} onChange={e=>setAddProducerEmail(e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&addProducer()}/>
                    </div>
                    <button style={{...css.btnP,alignSelf:"flex-start"}} className="hp" onClick={addProducer}>
                      Send Invite
                    </button>
                  </>
              }
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:12}}>
            {producers.map(p=>(
              <div key={p.id} style={{...css.card2,display:"flex",flexDirection:"column",gap:11,position:"relative"}}>
                <button onClick={()=>removeProducer(p.id)} title="Remove producer"
                  style={{position:"absolute",top:10,right:10,background:"none",border:"none",
                    cursor:"pointer",fontSize:16,color:T.muted,lineHeight:1,padding:"2px 6px",borderRadius:4}}
                  className="hg">✕</button>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Avatar p={p} size={44}/>
                  <div>
                    <div style={{fontWeight:800,fontSize:15}}>{p.name}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:1}}>{p.email}</div>
                  </div>
                </div>
                <Badge s={p.specialty}/>
                {p.bio&&<div style={{fontSize:12,color:T.muted,lineHeight:1.55}}>{p.bio}</div>}
                <div style={{fontSize:11,color:p.connected?T.accent:T.muted}}>
                  {p.connected?"● Calendar connected":"○ Not connected"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite */}
        <div style={css.card}>
          <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Create Account Link</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:18}}>
            Enter a producer's Gmail address to generate a private sign-up link. They'll sign in with Google and set up their profile.
          </div>
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <input style={{...css.inp,flex:1}} placeholder="producer@gmail.com"
              value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&sendInvite()}/>
            <button style={css.btnP} className="hp" onClick={sendInvite}>Generate Link</button>
          </div>
          {invites.length>0&&(
            <div style={{marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:18}}>
              <div style={{...css.lbl,marginBottom:14}}>Account Links</div>
              {invites.map(inv=>(
                <div key={inv.token} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600}}>{inv.email}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:3,display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontFamily:"monospace",color:"#555",background:T.surface2,
                        padding:"2px 8px",borderRadius:4,border:`1px solid ${T.border}`,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220,display:"inline-block"}}>
                        {typeof window !== "undefined" ? window.location.origin : ""}/join?token={inv.token}
                      </span>
                    </div>
                  </div>
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,flexShrink:0,
                    background:inv.status==="completed"?"rgba(45,74,53,0.1)":"rgba(45,74,53,0.06)",
                    color:T.accent}}>
                    {inv.status==="completed"?"Joined":"Pending"}
                  </span>
                  {inv.status==="pending"&&(
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button style={{...css.btnSm,color:T.accent,borderColor:"rgba(200,240,122,0.3)"}} className="hg"
                        onClick={()=>copyLink(inv.token,inv.email)}>
                        Copy Link
                      </button>
                      <button style={css.btnSm} className="hg" onClick={()=>previewOnboard(inv.token)}>
                        Preview →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bookings */}
        {uniqueBookings.length>0&&(
          <div style={css.card}>
            <div style={{fontSize:16,fontWeight:800,marginBottom:18}}>Bookings</div>
            {uniqueBookings.map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:16,padding:"12px 0",borderBottom:`1px solid ${T.border}`}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>
                    {b.clientBusiness||b.clientName}
                    {b.clientName&&b.clientBusiness&&<span style={{color:T.muted,fontWeight:400}}> · {b.clientName}</span>}
                  </div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>
                    {b.startsAt&&new Date(b.startsAt).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
                    {b.startsAt&&` · ${new Date(b.startsAt).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}`}
                    {b.shootType&&` · ${specialtyLabel(b.shootType)}`}
                  </div>
                </div>
                {b.shootType&&<Badge s={b.shootType}/>}
              </div>
            ))}
          </div>
        )}
      </div>
      {toast&&<ToastEl {...toast}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC BOOKING PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function BookingPortal({ producers, bookings, setBookings }) {
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [bProducers, setBProducers] = useState([]);
  const [bShootType, setBShootType] = useState(null);
  const [bDuration, setBDuration] = useState(null);
  const [bYear, setBYear] = useState(2026);
  const [bMonth, setBMonth] = useState(2);
  const [bSlots, setBSlots] = useState([]);
  const [bDay, setBDay] = useState(null);
  const [bSlot, setBSlot] = useState(null);
  const [bName, setBName] = useState("");
  const [bEmail, setBEmail] = useState("");
  const [bBusiness, setBBusiness] = useState("");
  const [bNote, setBNote] = useState("");
  const [toast, setToast] = useState(null);
  const resolvedShootTypeRef = useRef(null);

  function showToast(msg,type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),3000); }

  function reset() {
    setStep(1); setBProducers([]); setBShootType(null); setBDuration(null);
    setBSlots([]); setBDay(null); setBSlot(null); setBName(""); setBEmail(""); setBBusiness(""); setBNote("");
    resolvedShootTypeRef.current = null;
  }

  function toggleProducer(p) {
    setBProducers(prev=>{
      const already = prev.find(x=>x.id===p.id);
      if (already) return prev.filter(x=>x.id!==p.id);
      if (prev.length>=2) { showToast("You can select up to 2 producers","err"); return prev; }
      return [...prev,p];
    });
  }

  function getAllowedShootTypes() {
    if (bProducers.length===0) return [];
    const allPhoto = bProducers.every(p=>p.specialty==="photo"||p.specialty==="both");
    const allVideo = bProducers.every(p=>p.specialty==="video"||p.specialty==="both");
    const somePhoto = bProducers.some(p=>p.specialty==="photo"||p.specialty==="both");
    const someVideo = bProducers.some(p=>p.specialty==="video"||p.specialty==="both");
    // Mixed producers (e.g. photo + video) → automatically "both"
    if (somePhoto && someVideo && !allPhoto && !allVideo) return ["both"];
    // All producers cover both → let client choose
    if (allPhoto && allVideo) return ["photo","video"];
    if (allPhoto) return ["photo"];
    if (allVideo) return ["video"];
    return ["both"];
  }

  function goToStep2() {
    if (bProducers.length===0) { showToast("Select at least one producer","err"); return; }
    const types = getAllowedShootTypes();
    // Auto-set if there's no ambiguity (single type or auto-resolved "both")
    if (types.length===1) setBShootType(types[0]); else setBShootType(null);
    setStep(2);
  }

  function findSlots() {
    const types = getAllowedShootTypes();
    const resolvedType = types.length >= 1 ? types[0] : bShootType;
    if (!resolvedType) { showToast("Select a shoot type","err"); return; }
    if (!bDuration) { showToast("Select a duration","err"); return; }
    // Set synchronously via ref so confirmBooking can also read it
    resolvedShootTypeRef.current = resolvedType;
    setBShootType(resolvedType);
findFreeSlots(bProducers, bDuration, bYear, bMonth, bookings).then(slots => setBSlots(slots));    setBDay(null); setBSlot(null); setStep(3);
  }

  async function confirmBooking() {
    if (!bBusiness.trim()||!bName.trim()||!bEmail.includes("@")) { showToast("Fill in all required fields","err"); return; }
    const shootType = bShootType || resolvedShootTypeRef.current;
    showToast("Confirming your booking…");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: bName,
          clientEmail: bEmail,
          clientBusiness: bBusiness,
          clientNote: bNote,
          producerEmails: bProducers.map(p => p.email),
          shootType,
          duration: bDuration,
          slot: bSlot,
        }),
      });
      if (!res.ok) throw new Error("Booking failed");
      const data = await res.json();
      const newBookings = bProducers.map(p=>({
        id: data.bookingId,
        producers: bProducers.map(x=>x.name).join(" & "),
        producerNames: bProducers.map(x=>x.name),
        producerEmail: p.email, producerId: p.id,
        shootType, duration: bDuration, slot: bSlot,
        clientName: bName, clientEmail: bEmail, note: bNote,
      }));
      setBookings(bs=>[...bs,...newBookings]);
      setStep(5);
    } catch (e) {
      showToast("Booking failed — please try again","err");
    }
  }

  const freeDays = new Set(bSlots.map(d=>d.date));
  const daySlots = bDay?(bSlots.find(d=>d.date===bDay)?.slots||[]):[];
  const calFirst = getFirstDay(bYear,bMonth);
  const calCount = getDaysInMonth(bYear,bMonth);
  const allowedTypes = getAllowedShootTypes();

  return (
    <div style={css.app}>
      <style>{GLOBAL_CSS}</style>

      {/* Clean public topbar — no admin link */}
      <div style={css.bar}>
        <span style={css.logo}>Kinship</span>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {step<5&&[1,2,3,4].map(n=>(
            <div key={n} style={{width:7,height:7,borderRadius:"50%",
              background:step>=n?"#ffffff":"rgba(255,255,255,0.3)",transition:"background 0.2s"}}/>
          ))}
          {session?.user && (
            <a href="/dashboard" style={{fontSize:13,color:"#ffffff",opacity:0.85,textDecoration:"none",fontWeight:600,letterSpacing:"0.01em"}}>
              My Dashboard
            </a>
          )}
        </div>
      </div>

      <div style={{...css.wrap,maxWidth:step===3?940:680}} className="pg">

        {/* ── Step 1: Select Producers ── */}
        {step===1&&(
          <>
            <div style={css.h1}>Book a Shoot</div>
            <div style={css.sub}>Choose up to 2 content producers — we'll find times that work for everyone</div>

            <div style={{...css.card,padding:18,marginBottom:16,display:"flex",alignItems:"center",gap:16,minHeight:72}}>
              {bProducers.length===0
                ? <span style={{fontSize:13,color:T.muted,fontStyle:"italic"}}>No producers selected yet</span>
                : <>
                    <StackedAvatars producers={bProducers} size={40}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:15}}>{bProducers.map(p=>p.name).join(" & ")}</div>
                      <div style={{fontSize:12,color:T.muted,marginTop:2}}>{bProducers.map(p=>specialtyLabel(p.specialty)).join(", ")}</div>
                    </div>
                    <button style={{...css.btnSm}} className="hg" onClick={()=>setBProducers([])}>Clear</button>
                  </>
              }
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(196px,1fr))",gap:12,marginBottom:24}}>
              {producers.map(p=>{
                const sel=bProducers.find(x=>x.id===p.id);
                const maxed=bProducers.length>=2&&!sel;
                return (
                  <div key={p.id} className={maxed?"":"pc"} onClick={()=>!maxed&&toggleProducer(p)} style={{
                    ...css.card2,cursor:maxed?"not-allowed":"pointer",
                    border:`2px solid ${sel?T.accent:T.border}`,
                    background:sel?"rgba(45,74,53,0.06)":T.surface2,
                    display:"flex",flexDirection:"column",alignItems:"center",
                    textAlign:"center",gap:10,padding:22,transition:"all 0.15s",
                    opacity:maxed?0.4:1,position:"relative"}}>
                    {sel&&(
                      <div style={{position:"absolute",top:10,right:10,width:20,height:20,borderRadius:"50%",
                        background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:11,fontWeight:600,color:"#ffffff"}}>✓</div>
                    )}
                    <Avatar p={p} size={68}/>
                    <div>
                      <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>{p.name}</div>
                      <Badge s={p.specialty}/>
                    </div>
                    {p.bio&&<div style={{fontSize:12,color:T.muted,lineHeight:1.55}}>{p.bio}</div>}
                  </div>
                );
              })}
            </div>

            <button className="hp" style={{...css.btnP,width:"100%",padding:13,fontSize:14,
              opacity:bProducers.length===0?0.4:1,cursor:bProducers.length===0?"not-allowed":"pointer"}}
              onClick={goToStep2}>Continue →</button>
          </>
        )}

        {/* ── Step 2: Type + Duration ── */}
        {step===2&&(
          <>
            <button style={{...css.btnG,marginBottom:22,fontSize:12}} className="hg" onClick={()=>setStep(1)}>← Back</button>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:6}}>
              <StackedAvatars producers={bProducers} size={48}/>
              <div>
                <div style={{...css.h1,marginBottom:3}}>{bProducers.map(p=>p.name).join(" & ")}</div>
                <div style={{display:"flex",gap:6}}>{bProducers.map(p=><Badge key={p.id} s={p.specialty}/>)}</div>
              </div>
            </div>
            <div style={{...css.sub,marginTop:10}}>Configure your shoot</div>

            <div style={css.card}>
              {/* Shoot type — auto-resolved, only show picker when all producers do "both" */}
              <div style={{marginBottom:20}}>
                <label style={css.lbl}>Shoot Type</label>
                {allowedTypes.length>1
                  ? /* All producers cover both — let client pick */
                    <div style={{display:"flex",gap:10}}>
                      {allowedTypes.map(v=>(
                        <div key={v} onClick={()=>setBShootType(v)} style={{flex:1,padding:"14px",borderRadius:8,
                          textAlign:"center",cursor:"pointer",
                          border:`2px solid ${bShootType===v?T.accent:T.border}`,
                          background:bShootType===v?"rgba(45,74,53,0.07)":T.surface2,
                          fontSize:13,fontWeight:bShootType===v?800:400,
                          color:bShootType===v?T.accent:T.muted,transition:"all 0.12s"}}>
                          {v==="photo"?"Photography ◈":"Videography ◉"}
                        </div>
                      ))}
                    </div>
                  : /* Auto-resolved — show as a read-only pill with explanation */
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <Badge s={allowedTypes[0]}/>
                      <span style={{fontSize:12,color:T.muted}}>
                        {allowedTypes[0]==="both"
                          ? `Auto-selected — ${bProducers.map(p=>p.name).join(" covers photo, ")} covers video`
                          : `All selected producers shoot ${allowedTypes[0]}`}
                      </span>
                    </div>
                }
              </div>

              <label style={css.lbl}>Session Duration</label>
              <div style={{display:"flex",gap:12}}>
                {DURATIONS.map(d=>(
                  <div key={d} onClick={()=>setBDuration(d)} style={{flex:1,padding:"18px 10px",borderRadius:8,
                    textAlign:"center",cursor:"pointer",
                    border:`2px solid ${bDuration===d?T.accent:T.border}`,
                    background:bDuration===d?"rgba(45,74,53,0.07)":T.surface2,
                    transition:"all 0.12s"}}>
                    <div style={{fontSize:22,fontWeight:900,color:bDuration===d?T.accent:T.text,marginBottom:4}}>{fmtDuration(d)}</div>
                    <div style={{fontSize:11,color:T.muted}}>{d} minutes</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={css.card}>
              <label style={css.lbl}>Search Month</label>
              <div style={{display:"flex",alignItems:"center",gap:18}}>
                <button style={css.btnSm} className="hg" onClick={()=>{if(bMonth===0){setBYear(y=>y-1);setBMonth(11);}else setBMonth(m=>m-1);}}>←</button>
                <span style={{fontSize:18,fontWeight:800,minWidth:160,textAlign:"center"}}>{MONTHS[bMonth]} {bYear}</span>
                <button style={css.btnSm} className="hg" onClick={()=>{if(bMonth===11){setBYear(y=>y+1);setBMonth(0);}else setBMonth(m=>m+1);}}>→</button>
              </div>
            </div>

            <button className="hp" style={{...css.btnP,width:"100%",padding:13,fontSize:14}}
              onClick={findSlots}>
              Find Open Slots →
            </button>
          </>
        )}

        {/* ── Step 3: Pick Slot ── */}
        {step===3&&(
          <>
            <button style={{...css.btnG,marginBottom:22,fontSize:12}} className="hg" onClick={()=>setStep(2)}>← Back</button>
            <div style={css.h1}>Available Times</div>
            <div style={{...css.sub,marginBottom:16}}>
              Showing openings for <strong style={{color:T.text}}>{bProducers.map(p=>p.name).join(" & ")}</strong> in {MONTHS[bMonth]} {bYear}
            </div>

            <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
              {bProducers.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,background:T.surface,
                  border:`1px solid ${T.border}`,borderRadius:20,padding:"5px 12px 5px 6px"}}>
                  <Avatar p={p} size={22}/>
                  <span style={{fontSize:12,fontWeight:600}}>{p.name}</span>
                  <Badge s={p.specialty}/>
                </div>
              ))}
              <div style={{fontSize:11,color:T.muted}}>· {fmtDuration(bDuration)} · {specialtyLabel(bShootType)}</div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1.05fr",gap:18}}>
              <div style={css.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <span style={{fontWeight:800}}>{MONTHS[bMonth]} {bYear}</span>
                  <div style={{display:"flex",gap:6}}>
                    <button style={css.btnSm} className="hg" onClick={()=>{if(bMonth===0){setBYear(y=>y-1);setBMonth(11);}else setBMonth(m=>m-1);}}>←</button>
                    <button style={css.btnSm} className="hg" onClick={()=>{if(bMonth===11){setBYear(y=>y+1);setBMonth(0);}else setBMonth(m=>m+1);}}>→</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
                  {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:T.muted,paddingBottom:7,letterSpacing:"0.06em",fontWeight:700}}>{d}</div>)}
                  {Array.from({length:calFirst}).map((_,i)=><div key={`e${i}`}/>)}
                  {Array.from({length:calCount}).map((_,i)=>{
                    const d=i+1;
                    const ds=`${bYear}-${String(bMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                    const free=freeDays.has(ds), sel=bDay===ds;
                    const cnt=bSlots.find(x=>x.date===ds)?.slots.length||0;
                    return (
                      <div key={d} className={free?"hs":""} onClick={()=>free&&setBDay(sel?null:ds)} style={{
                        aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",
                        justifyContent:"center",borderRadius:6,fontSize:12,cursor:free?"pointer":"default",
                        border:`1px solid ${sel?T.accent:free?"rgba(45,74,53,0.4)":T.border}`,
                        background:sel?"rgba(45,74,53,0.12)":free?"rgba(45,74,53,0.06)":"transparent",
                        color:sel?T.accent:free?T.accent:T.muted,fontWeight:free?600:400,transition:"all 0.1s"}}>
                        {d}
                        {free&&<span style={{fontSize:8,color:T.accent,marginTop:1}}>{cnt}</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{marginTop:14,display:"flex",gap:12,fontSize:11,color:T.muted}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:10,height:10,borderRadius:2,background:"rgba(45,74,53,0.1)",border:"1px solid rgba(45,74,53,0.3)"}}/>
                    Available
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:10,height:10,borderRadius:2,background:T.surface2,border:`1px solid ${T.border}`}}/>
                    Unavailable
                  </div>
                </div>
              </div>

              <div style={css.card}>
                {!bDay
                  ? <div style={{color:T.muted,fontSize:14,textAlign:"center",padding:"50px 0",fontStyle:"italic"}}>
                      Select a date to see available times
                    </div>
                  : <>
                    <div style={{fontWeight:800,fontSize:15,marginBottom:3}}>
                      {new Date(bDay+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                    </div>
                    <div style={{fontSize:11,color:T.muted,marginBottom:16}}>
                      All times open for {bProducers.map(p=>p.name).join(" & ")}
                    </div>
                    {daySlots.length===0
                      ? <div style={{color:T.muted,fontSize:13}}>No openings on this day.</div>
                      : <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          {daySlots.map((sl,i)=>{
                            const sel=bSlot?.date===sl.date&&bSlot?.shootStart===sl.shootStart;
                            return (
                              <div key={i} className="sd" onClick={()=>setBSlot(sl)} style={{
                                padding:"10px 12px",borderRadius:8,cursor:"pointer",textAlign:"center",
                                border:`2px solid ${sel?T.accent:T.border}`,
                                background:sel?"rgba(45,74,53,0.07)":T.surface2,transition:"all 0.1s"}}>
                                <div style={{fontWeight:800,fontSize:16,color:sel?T.accent:T.text}}>{fmtMins(sl.shootStart)}</div>
                                <div style={{fontSize:11,color:T.muted,marginTop:2}}>→ {fmtMins(sl.shootEnd)}</div>
                              </div>
                            );
                          })}
                        </div>
                    }
                  </>
                }
              </div>
            </div>

            {bSlot&&(
              <div style={{marginTop:14,background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.2)",
                borderRadius:10,padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <StackedAvatars producers={bProducers} size={34}/>
                  <div>
                    <div style={{fontWeight:600,fontSize:15,color:T.accent,fontFamily:"'Cormorant Garamond',serif",fontSize:17}}>
                      {new Date(bSlot.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"long",day:"numeric"})} · {fmtMins(bSlot.shootStart)} – {fmtMins(bSlot.shootEnd)}
                    </div>
                    <div style={{fontSize:12,color:T.muted,marginTop:2}}>
                      {fmtDuration(bDuration)} · {specialtyLabel(bShootType)} · {bProducers.map(p=>p.name).join(" & ")}
                    </div>
                  </div>
                </div>
                <button className="hp" style={css.btnP} onClick={()=>setStep(4)}>Continue →</button>
              </div>
            )}

            {bSlots.length===0&&(
              <div style={{textAlign:"center",padding:40,color:T.muted,fontStyle:"italic"}}>
                No mutual openings in {MONTHS[bMonth]}. Try a different month or shorter duration.
              </div>
            )}
          </>
        )}

        {/* ── Step 4: Client Details ── */}
        {step===4&&bSlot&&(
          <>
            <button style={{...css.btnG,marginBottom:22,fontSize:12}} className="hg" onClick={()=>setStep(3)}>← Back</button>
            <div style={css.h1}>Your Details</div>
            <div style={css.sub}>Almost done — review and confirm your shoot</div>

            <div style={{...css.card,background:"rgba(200,240,122,0.04)",border:"1px solid rgba(200,240,122,0.18)",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <StackedAvatars producers={bProducers} size={48}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:16}}>{bProducers.map(p=>p.name).join(" & ")}</div>
                  <div style={{fontSize:13,color:T.muted,marginTop:2}}>
                    {new Date(bSlot.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                    {" · "}{fmtMins(bSlot.shootStart)} – {fmtMins(bSlot.shootEnd)}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <Badge s={bShootType}/>
                  <div style={{fontSize:12,color:T.muted,marginTop:6}}>{fmtDuration(bDuration)}</div>
                </div>
              </div>
            </div>

            <div style={css.card}>
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div>
                  <label style={css.lbl}>Business Name *</label>
                  <input style={css.inp} placeholder="Your company or brand name" value={bBusiness} onChange={e=>setBBusiness(e.target.value)}/>
                </div>
                <div>
                  <label style={css.lbl}>Your Name *</label>
                  <input style={css.inp} placeholder="Full name" value={bName} onChange={e=>setBName(e.target.value)}/>
                </div>
                <div>
                  <label style={css.lbl}>Email Address *</label>
                  <input style={css.inp} placeholder="you@email.com" value={bEmail} onChange={e=>setBEmail(e.target.value)}/>
                </div>
                <div>
                  <label style={css.lbl}>Notes for the Shoot</label>
                  <textarea style={{...css.inp,minHeight:84,resize:"vertical"}}
                    placeholder="Brief, mood references, location ideas, wardrobe notes…"
                    value={bNote} onChange={e=>setBNote(e.target.value)}/>
                </div>
              </div>
            </div>
            <button className="hp" style={{...css.btnP,width:"100%",padding:13,fontSize:14}} onClick={confirmBooking}>
              Confirm Booking & Send Invites →
            </button>
          </>
        )}

        {/* ── Step 5: Confirmed ── */}
        {step===5&&(
          <div style={{textAlign:"center",padding:"72px 0"}}>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:72,marginBottom:16,color:T.accent,lineHeight:1}}>✦</div>
            <div style={{...css.h1,marginBottom:8}}>You're Booked!</div>
            <div style={{fontSize:16,color:T.muted,marginBottom:5}}>
              {bProducers.map(p=>p.name).join(" & ")} · {specialtyLabel(bShootType)}
            </div>
            <div style={{fontSize:14,color:T.muted,marginBottom:32}}>
              {bSlot&&new Date(bSlot.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
              {bSlot&&` · ${fmtMins(bSlot.shootStart)} – ${fmtMins(bSlot.shootEnd)}`}
            </div>
            <div style={{display:"inline-flex",flexDirection:"column",gap:8,
              background:"rgba(45,74,53,0.06)",border:"1px solid rgba(45,74,53,0.2)",
              borderRadius:10,padding:"20px 32px",marginBottom:32,textAlign:"left"}}>
              <div style={{color:T.accent,fontWeight:600,fontSize:14,marginBottom:4,letterSpacing:"0.04em"}}>✓ Calendar invites sent</div>
              {bProducers.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:T.muted}}>
                  <Avatar p={p} size={22}/> {p.name} · {p.email}
                </div>
              ))}
              <div style={{fontSize:12,color:T.muted,marginTop:4}}>+ confirmation to {bEmail}</div>
            </div>
            <div>
              <button className="hp" style={css.btnP} onClick={reset}>Book Another Shoot</button>
            </div>
          </div>
        )}
      </div>
      {toast&&<ToastEl {...toast}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — decides which surface to render
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const { data: session } = useSession();
  const [producers, setProducers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [route, setRoute] = useState("booking");
  const [adminAuthed, setAdminAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/producers").then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setProducers(d); });
    fetch("/api/admin/bookings").then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setBookings(d); });
  }, []);

  useEffect(() => {
    if (adminAuthed) {
      fetch("/api/admin/invites").then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setInvites(d); });
    }
  }, [adminAuthed]);

  // Simulate: tiny hidden trigger to reach the admin login
  // In production this would be a separate URL like /admin
  // We expose it as a subtle footer link on the booking confirmation / nowhere visible during booking
  function handleAdminRoute() {
    if (adminAuthed) setRoute("admin");
    else setRoute("admin-login");
  }

  if (route==="admin-login") {
    return <AdminLogin onSuccess={()=>{ setAdminAuthed(true); setRoute("admin"); }}/>;
  }

  if (route==="admin" && adminAuthed) {
    return (
      <AdminPortal
        producers={producers} setProducers={setProducers}
        invites={invites} setInvites={setInvites}
        bookings={bookings}
        onLogout={()=>{ setAdminAuthed(false); setRoute("booking"); }}
      />
    );
  }

  // Public booking page — completely self-contained, no admin leakage
  return (
    <div style={{position:"relative"}}>
      <BookingPortal
        producers={producers}
        bookings={bookings}
        setBookings={setBookings}
      />
      {/* Hidden admin access — would be a separate /admin URL in production */}
      <div
        onClick={handleAdminRoute}
        title="Team access"
        style={{position:"fixed",bottom:16,right:16,width:8,height:8,
          borderRadius:"50%",background:T.border,cursor:"pointer",opacity:0.3,zIndex:100}}
      />
    </div>
  );
}

