import { useEffect, useState } from "react";

interface LoaderProps {
  fullScreen?: boolean;
  message?: string;
  onComplete?: () => void;
  duration?: number; // ms, default 2200
}

export function ApunBazarLoader({
  fullScreen = true,
  message = "Loading",
  onComplete,
  duration = 2200,
}: LoaderProps) {
  const [dots, setDots] = useState(0);
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // Animated dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);

  // Progress bar + auto-complete
  useEffect(() => {
    if (!onComplete) return;
    const step = 100 / (duration / 30);
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(t);
          setLeaving(true);
          setTimeout(onComplete, 380);
          return 100;
        }
        return p + step;
      });
    }, 30);
    return () => clearInterval(t);
  }, [onComplete, duration]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Nunito:wght@400;600&display=swap');

        @keyframes ap-spin    { to { transform: rotate(360deg); } }
        @keyframes ap-pulse   { 0%,100%{opacity:.3;transform:scale(.85)} 50%{opacity:1;transform:scale(1)} }
        @keyframes ap-fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ap-fadeOut { from{opacity:1} to{opacity:0} }
        @keyframes ap-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes ap-ring    { 0%{stroke-dashoffset:220} 100%{stroke-dashoffset:0} }
        @keyframes ap-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }

        .ap-wrap {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:18px;
          animation: ${leaving ? "ap-fadeOut .38s ease forwards" : "ap-fadeIn .4s ease"};
        }
        .ap-wrap.fullscreen {
          position:fixed; inset:0;
          background:#f7f4ed;
          z-index:9999;
        }
        .ap-wrap.inline { padding:48px 20px; min-height:200px; }

        .ap-ring-wrap { position:relative; width:80px; height:80px; animation:ap-float 3s ease infinite; }
        .ap-ring-bg      { fill:none; stroke:#e8e2d0; stroke-width:3; }
        .ap-ring-main    { fill:none; stroke:#1a4a2e; stroke-width:3; stroke-linecap:round; stroke-dasharray:220; animation:ap-ring 1.8s ease-in-out infinite alternate; }
        .ap-ring-gold    { fill:none; stroke:#c9a84c; stroke-width:1.5; stroke-linecap:round; stroke-dasharray:110; animation:ap-ring 1.4s ease-in-out infinite alternate-reverse; opacity:.6; }
        .ap-logo         { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-family:'Playfair Display',serif; font-size:22px; font-weight:600; color:#1a4a2e; animation:ap-pulse 2s ease infinite; }

        .ap-brand   { font-family:'Playfair Display',serif; font-size:18px; font-weight:600; color:#1a4a2e; }
        .ap-tagline { font-family:'Nunito',sans-serif; font-size:11px; letter-spacing:2.5px; color:#8a6a10; font-weight:600; text-transform:uppercase; margin-top:-12px; }
        .ap-msg     { font-family:'Nunito',sans-serif; font-size:13px; color:#4b5563; }

        .ap-progress-track { width:120px; height:2px; background:#e8e2d0; border-radius:100px; overflow:hidden; }
        .ap-progress-fill  { height:100%; background:linear-gradient(90deg,#1a4a2e,#c9a84c,#1a4a2e); background-size:200% 100%; border-radius:100px; transition:width .03s linear; }

        .ap-dots { display:flex; gap:5px; }
        .ap-dot  { width:5px; height:5px; border-radius:50%; animation:ap-pulse 1.2s ease infinite; }

        .ap-weave { width:80px; height:20px; overflow:visible; }
        .ap-wpath { fill:none; stroke:#1a4a2e; stroke-width:1.5; stroke-linecap:round; opacity:.3; }
        .ap-wpath.g { stroke:#c9a84c; opacity:.5; }
      `}</style>

      <div className={`ap-wrap ${fullScreen ? "fullscreen" : "inline"}`}>
        {/* Ring */}
        <div className="ap-ring-wrap">
          <svg viewBox="0 0 80 80" style={{ width:"100%", height:"100%", transform:"rotate(-90deg)" }}>
            <circle cx="40" cy="40" r="35" className="ap-ring-bg"/>
            <circle cx="40" cy="40" r="35" className="ap-ring-main"/>
            <circle cx="40" cy="40" r="28" className="ap-ring-gold"/>
          </svg>
          <div className="ap-logo">অ</div>
        </div>

        {/* Brand */}
        <div style={{ textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div className="ap-brand">ApunBazar</div>
          <div className="ap-tagline">From Assam, With Love</div>
        </div>

        {/* Weave */}
        <svg className="ap-weave" viewBox="0 0 80 20" aria-hidden="true">
          <path className="ap-wpath"   d="M0,10 Q10,2 20,10 Q30,18 40,10 Q50,2 60,10 Q70,18 80,10"/>
          <path className="ap-wpath g" d="M0,10 Q10,18 20,10 Q30,2 40,10 Q50,18 60,10 Q70,2 80,10"/>
        </svg>

        {/* Message */}
        <div className="ap-msg">{message}{"...".slice(0, dots)}</div>

        {/* Progress */}
        <div className="ap-progress-track">
          <div className="ap-progress-fill" style={{ width: onComplete ? `${progress}%` : "100%" }}>
            {!onComplete && (
              <div style={{ height:"100%", background:"linear-gradient(90deg,#1a4a2e,#c9a84c,#1a4a2e)", backgroundSize:"200% 100%", animation:"ap-shimmer 1.5s linear infinite" }}/>
            )}
          </div>
        </div>

        {/* Dots */}
        <div className="ap-dots">
          {[0,1,2].map(i => (
            <div key={i} className="ap-dot" style={{ background: i===1?"#c9a84c":"#1a4a2e", animationDelay:`${i*0.2}s` }}/>
          ))}
        </div>
      </div>
    </>
  );
}

// Default export bhi chahiye App.tsx ke liye
export default ApunBazarLoader;