"use client";
import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const T = {
  bg:"#f5f1eb", surface:"#ffffff", surface2:"#ede9e2", border:"#ddd6cc",
  text:"#1c1c19", muted:"#7a7568", accent:"#2d4a35",
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Jost:wght@300;400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  .hp:hover{opacity:0.85;}
`;

export default function JoinPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [valid, setValid] = useState(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!token) { setValid(false); return; }
    fetch(`/api/invites/${token}`)
      .then(r => r.json())
      .then(d => setValid(d.valid))
      .catch(() => setValid(false));
  }, [token]);

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  function handleSignIn() {
    setSigning(true);
    signIn("google", { callbackUrl: "/dashboard" });
  }

  if (status === "loading" || valid === null) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:14,color:T.muted,fontFamily:"'Jost',sans-serif"}}>Loading…</div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Jost',sans-serif"}}>
        <style>{GLOBAL_CSS}</style>
        <div style={{textAlign:"center",padding:32}}>
          <div style={{fontSize:32,marginBottom:16}}>✕</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8,color:T.text}}>Invalid or expired invite</div>
          <div style={{fontSize:14,color:T.muted}}>Contact your studio admin for a new invite link.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'Jost',sans-serif"}}>
      <style>{GLOBAL_CSS}</style>
      <div style={{background:T.accent,padding:"0 48px",height:62,display:"flex",alignItems:"center"}}>
        <span style={{fontSize:20,fontWeight:600,letterSpacing:"0.18em",textTransform:"uppercase",
          fontFamily:"'Cormorant Garamond',serif",color:"#ffffff"}}>Kinship</span>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"calc(100vh - 62px)",padding:24}}>
        <div style={{width:"100%",maxWidth:400}}>
          <div style={{background:T.surface,borderRadius:8,boxShadow:"0 4px 32px rgba(0,0,0,0.08)",overflow:"hidden",
            border:`1px solid ${T.border}`}}>
            <div style={{padding:"36px 40px 28px",borderBottom:`1px solid ${T.border}`,textAlign:"center"}}>
              <div style={{fontSize:28,fontFamily:"'Cormorant Garamond',serif",fontWeight:400,marginBottom:6,color:T.text}}>
                You're invited
              </div>
              <div style={{fontSize:14,color:T.muted,lineHeight:1.6}}>
                Join the Kinship producer team.<br/>Sign in with Google to set up your account.
              </div>
            </div>
            <div style={{padding:"28px 40px 32px"}}>
              {email && (
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",
                  border:`1px solid ${T.border}`,borderRadius:24,marginBottom:24}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:T.accent,display:"flex",
                    alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",fontWeight:600,flexShrink:0}}>
                    {email[0].toUpperCase()}
                  </div>
                  <div style={{fontSize:14,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {email}
                  </div>
                </div>
              )}
              <button className="hp" onClick={handleSignIn} disabled={signing}
                style={{width:"100%",padding:"11px",borderRadius:4,border:`1px solid ${T.border}`,
                  background:signing?"#f8f8f8":T.surface,cursor:signing?"not-allowed":"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                  fontSize:14,color:"#3c4043",fontWeight:500,fontFamily:"'Jost',sans-serif",
                  boxShadow:"0 1px 3px rgba(0,0,0,0.08)"}}>
                {signing ? "Signing in…" : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
