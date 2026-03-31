"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const T = {
  bg:"#ffffff", surface:"#ffffff", surface2:"#f0f4f8", border:"#d0dde8",
  text:"#1a1a2e", muted:"#6b7c93", accent:"#2b7fa8",
};
const GLOBAL_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Gotham','Helvetica Neue',Arial,sans-serif;}
  .hp:hover{opacity:0.85;}
  @keyframes fade{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  .pg{animation:fade 0.28s ease;}
  @keyframes tIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  input:focus,select:focus,textarea:focus{border-color:#2b7fa8!important;outline:none;}
`;
const css = {
  card: {background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,padding:28,marginBottom:18},
  lbl:  {fontSize:10,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
         color:T.muted,marginBottom:10,display:"block"},
  inp:  {background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,color:T.text,
         padding:"11px 14px",fontSize:14,outline:"none",width:"100%"},
  btnP: {padding:"12px 28px",background:T.accent,color:"#ffffff",border:"none",borderRadius:3,
         cursor:"pointer",fontSize:12,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"},
};

const DURATIONS = [60, 90, 120];
const SHOOT_TYPES = [["photo","Photography"],["video","Videography"],["both","Photo + Video"]];

function fmtDuration(m) { return m===60?"1 hr":m===90?"1.5 hrs":"2 hrs"; }

// Build time options in 30-min increments from 6am–10pm
const TIME_OPTIONS = [];
for (let h = 6; h <= 22; h++) {
  for (const m of [0, 30]) {
    if (h === 22 && m === 30) break;
    const label = `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h < 12 ? "AM" : "PM"}`;
    TIME_OPTIONS.push({ label, value: h * 60 + m });
  }
}

export default function UnrestrictedBookingPage() {
  const { token } = useParams();
  const [linkData, setLinkData] = useState(null);
  const [invalid, setInvalid] = useState(null);

  const [shootType, setShootType] = useState("photo");
  const [duration, setDuration] = useState(60);
  const [date, setDate] = useState("");
  const [startMins, setStartMins] = useState(9 * 60);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch(`/api/booking-links/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) setLinkData(d);
        else setInvalid(d.reason);
      })
      .catch(() => setInvalid("error"));
  }, [token]);

  function showToast(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),3000); }

  async function confirm() {
    if (!business.trim() || !name.trim() || !email.includes("@")) {
      showToast("Fill in all required fields","err"); return;
    }
    if (!date) { showToast("Select a date","err"); return; }
    setSubmitting(true);
    try {
      const startsAt = new Date(`${date}T${String(Math.floor(startMins/60)).padStart(2,"0")}:${String(startMins%60).padStart(2,"0")}:00`);
      const endsAt = new Date(startsAt.getTime() + duration * 60000);

      // Mark link as used
      await fetch(`/api/booking-links/${token}/use`, { method: "POST" });

      // Create booking
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          clientName: name, clientEmail: email, clientBusiness: business, clientNote: note,
          producerEmails: [linkData.producerEmail],
          shootType, duration,
          slot: {
            date,
            shootStart: startMins,
            shootEnd: startMins + duration,
          },
          // Pass raw datetimes so the API doesn't need to recalculate
          startsAtOverride: startsAt.toISOString(),
          endsAtOverride: endsAt.toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
      setStep(3);
    } catch {
      showToast("Booking failed — please try again","err");
    } finally {
      setSubmitting(false);
    }
  }

  if (!linkData && !invalid) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:14,color:T.muted,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"}}>Loading…</div>
      </div>
    );
  }

  if (invalid) {
    const msgs = { used:"This booking link has already been used.", expired:"This booking link has expired.", not_found:"This booking link is invalid." };
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"}}>
        <style>{GLOBAL_CSS}</style>
        <div style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:32,marginBottom:16,color:T.muted}}>✕</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>{msgs[invalid]||"This link is no longer valid."}</div>
          <div style={{fontSize:14,color:T.muted}}>Contact your producer for a new link.</div>
        </div>
      </div>
    );
  }

  // Confirmed screen
  if (step === 3) return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{background:T.accent,padding:"0 48px",height:62,display:"flex",alignItems:"center"}}>
        <span style={{fontSize:20,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
          fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",color:"#ffffff"}}>Kinship</span>
      </div>
      <div style={{maxWidth:580,margin:"0 auto",padding:"80px 32px",textAlign:"center"}} className="pg">
        <div style={{fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontSize:72,color:T.accent,lineHeight:1,marginBottom:16}}>✦</div>
        <div style={{fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontSize:36,fontWeight:400,marginBottom:8}}>You're Booked!</div>
        <div style={{fontSize:14,color:T.muted,marginBottom:6}}>{business} · {SHOOT_TYPES.find(t=>t[0]===shootType)?.[1]}</div>
        <div style={{fontSize:14,color:T.muted,marginBottom:32}}>
          {new Date(`${date}T12:00:00`).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
          {" · "}{TIME_OPTIONS.find(t=>t.value===startMins)?.label}
        </div>
        <div style={{fontSize:13,color:T.accent,fontWeight:600}}>✓ Calendar invites sent</div>
      </div>
    </div>
  );

  const endMins = startMins + duration;
  const endLabel = TIME_OPTIONS.find(t=>t.value===endMins)?.label ?? `${Math.floor(endMins/60)}:${String(endMins%60).padStart(2,"0")}`;
  const today = new Date().toISOString().slice(0,10);

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{background:T.accent,padding:"0 48px",height:62,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:20,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
          fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",color:"#ffffff"}}>Kinship</span>
        <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",letterSpacing:"0.1em",textTransform:"uppercase"}}>
          Private Booking
        </span>
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"48px 32px"}} className="pg">
        <div style={{fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontSize:36,fontWeight:400,marginBottom:6}}>Book a Shoot</div>
        <div style={{fontSize:14,color:T.muted,marginBottom:32}}>
          This is a private booking link. Choose your date, time, and details below.
        </div>

        {/* Shoot type */}
        <div style={css.card}>
          <label style={css.lbl}>Shoot Type</label>
          <div style={{display:"flex",gap:10,marginBottom:24}}>
            {SHOOT_TYPES.map(([v,l])=>(
              <div key={v} onClick={()=>setShootType(v)} style={{flex:1,padding:"13px 8px",borderRadius:8,
                textAlign:"center",cursor:"pointer",
                border:`2px solid ${shootType===v?T.accent:T.border}`,
                background:shootType===v?"rgba(45,74,53,0.07)":T.surface2,
                fontSize:12,fontWeight:shootType===v?700:400,
                color:shootType===v?T.accent:T.muted,transition:"all 0.12s"}}>
                {l}
              </div>
            ))}
          </div>

          <label style={css.lbl}>Duration</label>
          <div style={{display:"flex",gap:10,marginBottom:24}}>
            {DURATIONS.map(d=>(
              <div key={d} onClick={()=>setDuration(d)} style={{flex:1,padding:"16px 8px",borderRadius:8,
                textAlign:"center",cursor:"pointer",
                border:`2px solid ${duration===d?T.accent:T.border}`,
                background:duration===d?"rgba(45,74,53,0.07)":T.surface2,
                transition:"all 0.12s"}}>
                <div style={{fontSize:20,fontWeight:700,color:duration===d?T.accent:T.text,marginBottom:2}}>{fmtDuration(d)}</div>
                <div style={{fontSize:11,color:T.muted}}>{d} min</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div>
              <label style={css.lbl}>Date</label>
              <input type="date" min={today} value={date} onChange={e=>setDate(e.target.value)}
                style={{...css.inp}}/>
            </div>
            <div>
              <label style={css.lbl}>Start Time</label>
              <select value={startMins} onChange={e=>setStartMins(Number(e.target.value))}
                style={{...css.inp,cursor:"pointer"}}>
                {TIME_OPTIONS.map(t=>(
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {date && (
            <div style={{marginTop:14,padding:"12px 16px",background:"rgba(45,74,53,0.05)",
              borderRadius:6,border:"1px solid rgba(45,74,53,0.15)",fontSize:13,color:T.accent,fontWeight:600}}>
              {new Date(`${date}T12:00:00`).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
              {" · "}{TIME_OPTIONS.find(t=>t.value===startMins)?.label} – {endLabel}
            </div>
          )}
        </div>

        {/* Client details */}
        <div style={css.card}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <label style={css.lbl}>Business Name *</label>
              <input style={css.inp} placeholder="Your company or brand" value={business} onChange={e=>setBusiness(e.target.value)}/>
            </div>
            <div>
              <label style={css.lbl}>Your Name *</label>
              <input style={css.inp} placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>
            </div>
            <div>
              <label style={css.lbl}>Email Address *</label>
              <input style={css.inp} placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
            </div>
            <div>
              <label style={css.lbl}>Notes for the Shoot</label>
              <textarea style={{...css.inp,minHeight:80,resize:"vertical"}}
                placeholder="Brief, mood references, location ideas…"
                value={note} onChange={e=>setNote(e.target.value)}/>
            </div>
          </div>
        </div>

        <button className="hp" style={{...css.btnP,width:"100%",padding:13,fontSize:14}}
          onClick={confirm} disabled={submitting}>
          {submitting?"Confirming…":"Confirm Booking & Send Invites →"}
        </button>
      </div>

      {toast&&(
        <div style={{position:"fixed",bottom:28,right:28,zIndex:9999,
          background:toast.type==="err"?"#5a1a1a":T.accent,color:"#ffffff",
          padding:"13px 22px",borderRadius:3,fontSize:13,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",
          fontWeight:500,boxShadow:"0 8px 32px rgba(45,74,53,0.25)",animation:"tIn 0.2s ease"}}>
          {toast.type==="err"?"✕  ":"✓  "}{toast.msg}
        </div>
      )}
    </div>
  );
}
