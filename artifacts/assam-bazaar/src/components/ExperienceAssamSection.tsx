import { useState } from "react";

const G    = "#1a5a32";
const GOLD = "#c9a84c";
const BG   = "#f5f0e8";

const COLLAGE_IMGS = [
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLDPxd-dWlvp9iM3pnxr-HUa0VN_oEGAC7-5L-6GBToJFt6eFcM-as1H4C&s=10",
  "https://assamholidays.com/wp-content/uploads/2025/01/WhatsApp-Image-2025-01-17-at-18.33.01-1080x675.jpeg",
  "https://sandpebblestours.com/wp-content/uploads/2018/11/assam-1.jpg",
  "https://www.travelandtourworld.com/wp-content/uploads/2026/04/Assam-1-850x567.jpg",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTParCuXRWg4CJhOHz3UhS5KqeqYVo5L8NScdU8nVh1x92xam8PctswHs2h&s=10",
];

const STORY_VIDEOS = [
  { id: "tdljGhkH0jY", title: "Our Assam Story", desc: "Journey from Assam's lush gardens to your home", thumb: "https://img.youtube.com/vi/tdljGhkH0jY/hqdefault.jpg" },
  { id: "UDHklYvDkv8", title: "Artisan Crafts", desc: "Handloom weavers preserving centuries of tradition", thumb: "https://img.youtube.com/vi/UDHklYvDkv8/hqdefault.jpg" },
  { id: "9wVoJu9PrpQ", title: "Tea Gardens of Assam", desc: "First flush to your cup — the golden journey", thumb: "https://img.youtube.com/vi/9wVoJu9PrpQ/hqdefault.jpg" },
];

export default function ExperienceAssamSection() {
  const [playing, setPlaying]     = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const video = STORY_VIDEOS[activeIdx];

  function openVideo(idx = 0) { setActiveIdx(idx); setPlaying(true); }

  return (
    <>
      <style>{`
        @keyframes ea-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.5); }
          60%      { box-shadow: 0 0 0 12px rgba(255,255,255,0); }
        }
        @keyframes ea-fadein  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ea-slidein { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }

        /* ── FIX: pulse only animates box-shadow, NOT transform ── */
        .ea-play-btn {
          animation: ea-pulse 2.4s ease-in-out infinite;
          transition: transform .2s;
        }
        .ea-play-btn:hover { transform: scale(1.12); }

        /* ── FIX: watch button — isolated transform, no scroll jitter ── */
        .ea-watch-btn {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          border: none;
          border-radius: 50px;
          padding: 13px 24px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          color: #fff;
          /* isolate this element from ancestor transforms */
          isolation: isolate;
          will-change: background;
          transform: translateZ(0);          /* promote to own layer — stops scroll jitter */
          transition: background .2s;        /* ONLY background transitions, no transform */
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        /* hover: tiny scale via separate wrapper trick — no jitter */
        .ea-watch-btn:hover { background: #135228 !important; }
        .ea-watch-btn:active { filter: brightness(.92); }

        .ea-img { width:100%; height:100%; object-fit:cover; display:block; }
        .ea-video-wrap { animation: ea-slidein 0.35s cubic-bezier(0.22,1,0.36,1) both; }
        .ea-thumb-btn { transition: transform .2s, opacity .2s; border: none; padding: 0; cursor: pointer; background: transparent; }
        .ea-thumb-btn:hover { transform: translateY(-2px); opacity: 1 !important; }

        .ea-section { background: ${BG}; padding: 32px 20px 28px; font-family: 'DM Sans', sans-serif; }
        .ea-inner { display: flex; gap: 24px; align-items: center; max-width: 900px; margin: 0 auto; }
        .ea-left  { flex: 0 0 36%; animation: ea-fadein .6s ease both; }
        .ea-right { flex: 1; animation: ea-fadein .6s ease .15s both; }

        @media (max-width: 600px) {
          .ea-section { padding: 24px 14px 22px; }
          .ea-inner   { flex-direction: column; gap: 20px; }
          .ea-left    { flex: none; width: 100%; }
          .ea-right   { flex: none; width: 100%; }
        }
      `}</style>

      <section className="ea-section">
        <div className="ea-inner">

          {/* ── LEFT: TEXT ── */}
          <div className="ea-left">
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:14 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill={G}>
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/>
              </svg>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:G, textTransform:"uppercase" }}>
                Experience Assam
              </span>
            </div>

            <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:"clamp(1.5rem,4vw,1.9rem)", fontWeight:800, color:"#0d2e10", lineHeight:1.2, marginBottom:14 }}>
              A Land of Heritage,<br />Craft &amp; Tradition
            </h2>

            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
              <div style={{ width:30, height:1.5, background:GOLD, borderRadius:2 }} />
              <svg width="9" height="9" viewBox="0 0 24 24" fill={GOLD}><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/></svg>
              <div style={{ width:30, height:1.5, background:GOLD, borderRadius:2 }} />
            </div>

            <p style={{ fontSize:13, color:"#4b5563", lineHeight:1.75, marginBottom:24 }}>
              Watch our stories and discover the journey of authentic Assamese
              products — from the lush tea gardens and skilled hands of artisans to
              reaching your home.
            </p>

            {/* ── CTA BUTTON — fixed size, no transform on scroll ── */}
            <button
              className="ea-watch-btn"
              onClick={() => openVideo(0)}
              style={{ background: playing ? "#0d2e10" : G }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              {playing ? "Now Playing" : "Watch Our Story"}
            </button>

            <p style={{ marginTop:10, fontSize:11, color:"#4b5563", display:"flex", alignItems:"center", gap:5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill={GOLD}><path d="M8 5v14l11-7z"/></svg>
              {STORY_VIDEOS.length} videos available
            </p>
          </div>

          {/* ── RIGHT: COLLAGE / VIDEO ── */}
          <div className="ea-right">
            {!playing && (
              <div style={{ borderRadius:14, overflow:"hidden", position:"relative", cursor:"pointer" }} onClick={() => openVideo(0)}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gridTemplateRows:"130px 130px", gap:3 }}>
                  <div style={{ gridColumn:"1", gridRow:"1/3", overflow:"hidden" }}><img className="ea-img" src={COLLAGE_IMGS[0]} alt="Tea garden" style={{ height:263 }} /></div>
                  <div style={{ gridColumn:"2", gridRow:"1", overflow:"hidden" }}><img className="ea-img" src={COLLAGE_IMGS[1]} alt="Weaver" /></div>
                  <div style={{ gridColumn:"3", gridRow:"1", overflow:"hidden" }}><img className="ea-img" src={COLLAGE_IMGS[2]} alt="Craft" /></div>
                  <div style={{ gridColumn:"2", gridRow:"2", overflow:"hidden" }}><img className="ea-img" src={COLLAGE_IMGS[3]} alt="Pour" /></div>
                  <div style={{ gridColumn:"3", gridRow:"2", overflow:"hidden", background:"#1a3a1a" }}><img className="ea-img" src={COLLAGE_IMGS[4]} alt="ApunBazar" /></div>
                </div>
                <div style={{ position:"absolute", inset:0, background:"rgba(5,20,8,.42)", pointerEvents:"none" }} />
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", zIndex:3 }}>
                  <div className="ea-play-btn" style={{ width:62, height:62, borderRadius:"50%", background:"rgba(255,255,255,.93)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={G}><path d="M8 5v14l11-7z"/></svg>
                  </div>
                </div>
                <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(to top, rgba(0,0,0,0.7), transparent)", padding:"20px 14px 10px", display:"flex", alignItems:"center", justifyContent:"space-between", zIndex:3 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:"#fff" }}>Our Story</span>
                  <span style={{ fontSize:10, fontWeight:700, color:"#111", background:GOLD, borderRadius:20, padding:"3px 10px" }}>▶ {STORY_VIDEOS.length} Videos</span>
                </div>
              </div>
            )}

            {playing && (
              <div className="ea-video-wrap" style={{ borderRadius:14, overflow:"hidden", background:"#000" }}>
                <div style={{ position:"relative", width:"100%", paddingBottom:"56.25%" }}>
                  <iframe key={video.id} src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`} title={video.title} allow="autoplay; encrypted-media; fullscreen" allowFullScreen style={{ position:"absolute", inset:0, width:"100%", height:"100%", border:"none" }} />
                </div>
                <div style={{ background:"#0d1f10", padding:"10px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:"#fff", margin:0 }}>{video.title}</p>
                      <p style={{ fontSize:11, color:"rgba(255,255,255,0.5)", margin:0 }}>{video.desc}</p>
                    </div>
                    <button onClick={() => setPlaying(false)} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:"50%", width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#fff", flexShrink:0 }} title="Close video">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                  {STORY_VIDEOS.length > 1 && (
                    <div style={{ display:"flex", gap:8, overflowX:"auto", scrollbarWidth:"none" }}>
                      {STORY_VIDEOS.map((v, i) => (
                        <button key={v.id} className="ea-thumb-btn" onClick={() => setActiveIdx(i)} style={{ flexShrink:0, width:100, borderRadius:8, overflow:"hidden", opacity: i === activeIdx ? 1 : 0.55, outline: i === activeIdx ? `2px solid ${GOLD}` : "none" }}>
                          <div style={{ position:"relative", paddingBottom:"56.25%" }}>
                            <img src={v.thumb} alt={v.title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            {i === activeIdx && <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill={GOLD}><path d="M8 5v14l11-7z"/></svg></div>}
                          </div>
                          <p style={{ fontSize:9.5, color:"#fff", margin:"4px 4px 6px", lineHeight:1.3, textAlign:"left" }}>{v.title}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!playing && (
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background:"#fff", borderRadius:"0 0 14px 14px", borderTop:"1px solid #eee" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill={G}><path d="M8 5v14l11-7z"/></svg>
                <div style={{ flex:1, height:3, background:"#e5e7eb", borderRadius:2 }} />
                <span style={{ fontSize:10, color:"#4b5563", whiteSpace:"nowrap" }}>Click to play</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
