"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const T = {
  bg:"#ffffff", surface:"#ffffff", surface2:"#f0f4f8", border:"#d0dde8",
  text:"#1a1a2e", muted:"#6b7c93", accent:"#2b7fa8", accentHov:"#236d92",
};

const GLOBAL_CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Gotham','Helvetica Neue',Arial,sans-serif;}
  .hp:hover{opacity:0.85;}
  .hg:hover{background:#f0f4f8!important;color:#1a1a2e!important;}
  @keyframes fade{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
  .pg{animation:fade 0.28s ease;}
  @keyframes tIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
`;

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS = { mon:"Mon", tue:"Tue", wed:"Wed", thu:"Thu", fri:"Fri", sat:"Sat", sun:"Sun" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const css = {
  card: {background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,padding:28,marginBottom:18},
  card2:{background:T.surface2,border:`1px solid ${T.border}`,borderRadius:3,padding:20},
  lbl:  {fontSize:10,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
         color:T.muted,marginBottom:10,display:"block",fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"},
  btnP: {padding:"11px 24px",background:T.accent,color:"#ffffff",border:"none",borderRadius:3,
         cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",
         letterSpacing:"0.1em",textTransform:"uppercase"},
  btnG: {padding:"10px 20px",background:"transparent",color:T.muted,border:`1px solid ${T.border}`,
         borderRadius:3,cursor:"pointer",fontSize:12,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"},
  inp:  {background:T.surface,border:`1px solid ${T.border}`,borderRadius:3,color:T.text,
         padding:"10px 14px",fontSize:14,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",outline:"none",width:"100%"},
};

function fmtDate(dt) {
  const d = new Date(dt);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtTime(dt) {
  const d = new Date(dt);
  const h = d.getHours()%12||12, m = String(d.getMinutes()).padStart(2,"0"), ap = d.getHours()<12?"AM":"PM";
  return `${h}:${m} ${ap}`;
}

const DEFAULT_AVAIL = { days: ["mon","tue","wed","thu","fri"], startHour: 8, endHour: 18 };

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [avail, setAvail] = useState(null);
  const [calBusy, setCalBusy] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bookingLink, setBookingLink] = useState(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/api/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/producer/profile").then(r => r.json()).then(data => {
      setProfile(data); setProfileDraft(data);
    });
    fetch("/api/producer/bookings").then(r => r.json()).then(data => {
      if (Array.isArray(data)) setBookings(data);
    });
    fetch("/api/availability").then(r => r.json()).then(data => {
      setAvail(data || DEFAULT_AVAIL);
    });

    // Fetch Google Calendar busy times for the next 4 weeks
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
    fetch(`/api/calendar?email=${encodeURIComponent(session?.user?.email)}&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setCalBusy(data); })
      .catch(() => {});
  }, [status]);

  function showToast(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),3000); }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/producer/profile", {
        method: "PATCH",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(profileDraft),
      });
      const data = await res.json();
      setProfile(data); setProfileDraft(data);
      setEditingProfile(false);
      showToast("Profile saved!");
    } catch { showToast("Save failed","err"); }
    finally { setSavingProfile(false); }
  }

  async function generateBookingLink() {
    setGeneratingLink(true);
    try {
      const res = await fetch("/api/booking-links", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setBookingLink(`${window.location.origin}/book/${data.token}`);
    } catch { showToast("Failed to generate link","err"); }
    finally { setGeneratingLink(false); }
  }

  async function saveAvail() {
    setSaving(true);
    try {
      await fetch("/api/availability", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(avail),
      });
      setSaved(true); setTimeout(()=>setSaved(false), 2000);
      showToast("Availability saved!");
    } catch { showToast("Save failed","err"); }
    finally { setSaving(false); }
  }

  function toggleDay(day) {
    setAvail(a => ({
      ...a,
      days: a.days.includes(day) ? a.days.filter(d=>d!==day) : [...a.days, day]
    }));
  }

  if (status === "loading" || !avail) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:14,color:T.muted,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"}}>Loading…</div>
      </div>
    );
  }

  const now = new Date();
  const upcomingBookings = bookings.filter(b => new Date(b.startsAt) >= now);
  const pastBookings = bookings.filter(b => new Date(b.startsAt) < now);

  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const monthCounts = [0,1,2].map(offset => {
    const d = new Date(thisYear, thisMonth + offset, 1);
    const count = bookings.filter(b => {
      const bd = new Date(b.startsAt);
      return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear();
    }).length;
    return { label: MONTHS[d.getMonth()], count };
  });

  const hours = Array.from({length:13},(_,i)=>i+6);

  return (
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"}}>
      <style>{GLOBAL_CSS}</style>

      {/* Nav */}
      <div style={{background:T.accent,padding:"0 48px",height:62,display:"flex",
        alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:20,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
            fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",color:"#ffffff"}}>Kinship</span>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.7)",letterSpacing:"0.14em",
            textTransform:"uppercase",fontWeight:500}}>Producer</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {session?.user?.image && (
            <img src={session.user.image} alt="" style={{width:30,height:30,borderRadius:"50%",
              border:"2px solid rgba(255,255,255,0.3)"}}/>
          )}
          <span style={{fontSize:13,color:"rgba(255,255,255,0.85)"}}>{session?.user?.name}</span>
          <a href="/" style={{fontSize:11,color:"rgba(255,255,255,0.8)",textDecoration:"none",
            fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>
            Booking Page
          </a>
          <button className="hg" onClick={()=>signOut({callbackUrl:"/"})}
            style={{...css.btnG,fontSize:11,color:"rgba(255,255,255,0.8)",
              borderColor:"rgba(255,255,255,0.3)",letterSpacing:"0.1em",textTransform:"uppercase"}}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:"48px 32px"}} className="pg">
        <div style={{fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontSize:36,fontWeight:400,marginBottom:6}}>
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </div>
        <div style={{fontSize:14,color:T.muted,marginBottom:36}}>Your shoots and availability</div>

        {/* Profile */}
        <div style={css.card}>
          {!editingProfile
            ? <div style={{display:"flex",alignItems:"center",gap:20}}>
                {profile?.image
                  ? <img src={profile.image} alt="" style={{width:64,height:64,borderRadius:"50%",
                      objectFit:"cover",border:`2px solid ${T.border}`,flexShrink:0}}/>
                  : <div style={{width:64,height:64,borderRadius:"50%",background:T.surface2,
                      border:`2px solid ${T.border}`,display:"flex",alignItems:"center",
                      justifyContent:"center",fontSize:24,color:T.accent,fontWeight:600,flexShrink:0,
                      fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif"}}>
                      {(profile?.name||session?.user?.name||"?")[0].toUpperCase()}
                    </div>
                }
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:18}}>{profile?.name || session?.user?.name}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{session?.user?.email}</div>
                  {profile?.specialty && (
                    <div style={{fontSize:11,fontWeight:600,marginTop:6,padding:"3px 10px",borderRadius:2,
                      display:"inline-block",background:"rgba(45,74,53,0.08)",color:T.accent,
                      letterSpacing:"0.1em",textTransform:"uppercase"}}>
                      {profile.specialty==="photo"?"Photography":profile.specialty==="video"?"Videography":"Photo + Video"}
                    </div>
                  )}
                  {profile?.bio && <div style={{fontSize:12,color:T.muted,marginTop:8,lineHeight:1.55}}>{profile.bio}</div>}
                </div>
                <button className="hg" style={css.btnG} onClick={()=>setEditingProfile(true)}>Edit Profile</button>
              </div>
            : <div style={{display:"flex",flexDirection:"column",gap:16}}>
                <div style={{fontSize:14,fontWeight:700,color:T.accent}}>Edit Profile</div>

                {/* Photo upload */}
                <div style={{display:"flex",alignItems:"center",gap:16}}>
                  <div onClick={()=>document.getElementById("photo-upload").click()}
                    style={{width:64,height:64,borderRadius:"50%",cursor:"pointer",flexShrink:0,
                      border:`2px dashed ${T.border}`,overflow:"hidden",position:"relative"}}>
                    {profileDraft.image
                      ? <img src={profileDraft.image} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",
                          justifyContent:"center",fontSize:22,color:T.muted}}>+</div>
                    }
                  </div>
                  <input id="photo-upload" type="file" accept="image/*" style={{display:"none"}}
                    onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=ev=>setProfileDraft(p=>({...p,image:ev.target.result}));r.readAsDataURL(f);}}}/>
                  <div style={{fontSize:12,color:T.muted}}>Click the circle to upload a photo</div>
                </div>

                <div>
                  <label style={css.lbl}>Display Name</label>
                  <input style={css.inp} value={profileDraft.name||""} onChange={e=>setProfileDraft(p=>({...p,name:e.target.value}))}/>
                </div>
                <div>
                  <label style={css.lbl}>Specialty</label>
                  <div style={{display:"flex",gap:10}}>
                    {[["photo","Photography"],["video","Videography"],["both","Photo + Video"]].map(([v,l])=>(
                      <div key={v} onClick={()=>setProfileDraft(p=>({...p,specialty:v}))} style={{
                        flex:1,padding:"10px",borderRadius:6,textAlign:"center",cursor:"pointer",fontSize:12,
                        fontWeight:profileDraft.specialty===v?700:400,
                        border:`2px solid ${profileDraft.specialty===v?T.accent:T.border}`,
                        background:profileDraft.specialty===v?"rgba(45,74,53,0.07)":T.surface2,
                        color:profileDraft.specialty===v?T.accent:T.muted,transition:"all 0.12s"}}>
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={css.lbl}>Bio</label>
                  <textarea style={{...css.inp,minHeight:72,resize:"vertical"}}
                    placeholder="Tell clients about your style and experience…"
                    value={profileDraft.bio||""} onChange={e=>setProfileDraft(p=>({...p,bio:e.target.value}))}/>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button className="hp" style={css.btnP} onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile?"Saving…":"Save Profile"}
                  </button>
                  <button style={css.btnG} className="hg" onClick={()=>{setEditingProfile(false);setProfileDraft(profile);}}>
                    Cancel
                  </button>
                </div>
              </div>
          }
        </div>

        {/* Month counts */}
        <div style={{display:"flex",gap:14,marginBottom:24}}>
          {monthCounts.map(m=>(
            <div key={m.label} style={{flex:1,...css.card2,padding:22}}>
              <div style={{fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontSize:40,fontWeight:400,
                color:T.accent,letterSpacing:"-1px"}}>{m.count}</div>
              <div style={{fontSize:10,color:T.muted,textTransform:"uppercase",
                letterSpacing:"0.1em",marginTop:4}}>{m.label} shoots</div>
            </div>
          ))}
        </div>

        {/* Private booking link */}
        <div style={css.card}>
          <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Private Booking Link</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:20}}>
            Generate a one-time link for a client to book outside your normal availability. Expires in 24 hours.
          </div>
          {bookingLink
            ? <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontFamily:"monospace",fontSize:12,background:T.surface2,
                  border:`1px solid ${T.border}`,borderRadius:4,padding:"10px 14px",
                  wordBreak:"break-all",color:T.text}}>
                  {bookingLink}
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button className="hp" style={css.btnP} onClick={()=>{
                    navigator.clipboard?.writeText(bookingLink);
                    showToast("Link copied!");
                  }}>Copy Link</button>
                  <button style={css.btnG} className="hg" onClick={()=>setBookingLink(null)}>
                    Generate New
                  </button>
                </div>
                <div style={{fontSize:11,color:T.muted}}>⚠ This link can only be used once and expires in 24 hours.</div>
              </div>
            : <button className="hp" style={css.btnP} onClick={generateBookingLink} disabled={generatingLink}>
                {generatingLink?"Generating…":"Generate Booking Link"}
              </button>
          }
        </div>

        {/* Upcoming bookings */}
        <div style={css.card}>
          <div style={{fontSize:16,fontWeight:800,marginBottom:upcomingBookings.length?18:0}}>
            Upcoming Shoots
          </div>
          {upcomingBookings.length === 0
            ? <div style={{fontSize:13,color:T.muted,marginTop:10}}>No upcoming shoots scheduled.</div>
            : upcomingBookings.map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:16,padding:"13px 0",
                borderBottom:`1px solid ${T.border}`}}>
                <div style={{width:48,textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:22,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontWeight:400,
                    color:T.accent,lineHeight:1}}>{new Date(b.startsAt).getDate()}</div>
                  <div style={{fontSize:10,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>
                    {MONTHS[new Date(b.startsAt).getMonth()]}
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{b.title}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>
                    {fmtTime(b.startsAt)} – {fmtTime(b.endsAt)}
                    {b.clientName && <> · {b.clientName}</>}
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Google Calendar busy times */}
        <div style={css.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <div style={{fontSize:16,fontWeight:800}}>Calendar Conflicts</div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:T.accent,fontWeight:600}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:T.accent}}/>
              Synced from Google Calendar
            </div>
          </div>
          <div style={{fontSize:13,color:T.muted,marginBottom:20}}>
            Times below are blocked on your Google Calendar and won't appear as available for bookings.
          </div>
          {calBusy.length === 0
            ? <div style={{fontSize:13,color:T.muted,fontStyle:"italic"}}>
                No conflicts in the next 4 weeks — you're wide open.
              </div>
            : <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {calBusy.slice(0,10).map((b,i)=>{
                  const start = new Date(b.start), end = new Date(b.end);
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:16,
                      padding:"11px 0",borderBottom:`1px solid ${T.border}`}}>
                      <div style={{width:48,textAlign:"center",flexShrink:0}}>
                        <div style={{fontSize:20,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontWeight:400,
                          color:T.muted,lineHeight:1}}>{start.getDate()}</div>
                        <div style={{fontSize:10,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>
                          {MONTHS[start.getMonth()]}
                        </div>
                      </div>
                      <div style={{flex:1,fontSize:13,color:T.text}}>
                        {fmtTime(b.start)} – {fmtTime(b.end)}
                      </div>
                    </div>
                  );
                })}
                {calBusy.length > 10 && (
                  <div style={{fontSize:12,color:T.muted,paddingTop:12}}>
                    +{calBusy.length - 10} more conflicts not shown
                  </div>
                )}
              </div>
          }
        </div>

        {/* Working hours preference */}
        <div style={css.card}>
          <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Working Hours</div>
          <div style={{fontSize:13,color:T.muted,marginBottom:22}}>
            Define which days and hours you're available for bookings. Conflicts from your Google Calendar are automatically excluded on top of these.
          </div>

          <label style={css.lbl}>Available Days</label>
          <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
            {DAYS.map(d=>{
              const on = avail.days.includes(d);
              return (
                <div key={d} onClick={()=>toggleDay(d)} style={{
                  padding:"8px 16px",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,
                  border:`2px solid ${on?T.accent:T.border}`,
                  background:on?"rgba(45,74,53,0.08)":T.surface,
                  color:on?T.accent:T.muted,transition:"all 0.12s"}}>
                  {DAY_LABELS[d]}
                </div>
              );
            })}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
            <div>
              <label style={css.lbl}>Start Time</label>
              <select value={avail.startHour} onChange={e=>setAvail(a=>({...a,startHour:Number(e.target.value)}))}
                style={{...css.inp,cursor:"pointer"}}>
                {hours.map(h=>(
                  <option key={h} value={h}>{h<=12?h:h-12}:00 {h<12?"AM":"PM"}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={css.lbl}>End Time</label>
              <select value={avail.endHour} onChange={e=>setAvail(a=>({...a,endHour:Number(e.target.value)}))}
                style={{...css.inp,cursor:"pointer"}}>
                {hours.map(h=>(
                  <option key={h} value={h}>{h<=12?h:h-12}:00 {h<12?"AM":"PM"}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="hp" style={css.btnP} onClick={saveAvail} disabled={saving}>
            {saving?"Saving…":saved?"Saved ✓":"Save"}
          </button>
        </div>

        {/* Past bookings */}
        {pastBookings.length > 0 && (
          <div style={css.card}>
            <div style={{fontSize:16,fontWeight:800,marginBottom:18}}>Past Shoots</div>
            {pastBookings.map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:16,padding:"11px 0",
                borderBottom:`1px solid ${T.border}`,opacity:0.6}}>
                <div style={{width:48,textAlign:"center",flexShrink:0}}>
                  <div style={{fontSize:20,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontWeight:400,lineHeight:1}}>
                    {new Date(b.startsAt).getDate()}
                  </div>
                  <div style={{fontSize:10,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase"}}>
                    {MONTHS[new Date(b.startsAt).getMonth()]}
                  </div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14}}>{b.title}</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{fmtDate(b.startsAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast&&(
        <div style={{position:"fixed",bottom:28,right:28,zIndex:9999,
          background:toast.type==="err"?"#5a1a1a":T.accent,
          color:"#ffffff",padding:"13px 22px",borderRadius:3,
          fontSize:13,fontFamily:"'Gotham','Helvetica Neue',Arial,sans-serif",fontWeight:500,
          boxShadow:"0 8px 32px rgba(45,74,53,0.25)",animation:"tIn 0.2s ease"}}>
          {toast.type==="err"?"✕  ":"✓  "}{toast.msg}
        </div>
      )}
    </div>
  );
}
