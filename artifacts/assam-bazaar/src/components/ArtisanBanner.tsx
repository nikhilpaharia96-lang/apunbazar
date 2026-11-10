import { useState, useEffect } from "react";
import { Link } from "wouter";

const GOLD = "#c9a84c";
const G = "#1a5a32";

// ─── 3 SLIDES ─────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: 1,
    eyebrow: "Our Assam Story",
    titleWhite: "From Assam's",
    titleGold: "Tea Gardens",
    titleWhite2: "To Your Home",
    desc: "From the lush green tea gardens and vibrant handlooms to the skilled hands of our artisans – every product carries Assam's heritage, craftsmanship and pride.",
    cta: "Explore Assam",
    ctaHref: "/products",
    image: "https://permanent-maroon-km2lblfj.edgeone.dev/file_000000003920720887dd3839d2bbe8fb.png",
    footer: "AUTHENTIC. HANDCRAFTED. PROUDLY ASSAMESE.",
  },
  {
    id: 2,
    eyebrow: "Our Assam Story",
    titleWhite: "Handwoven with",
    titleGold: "Heart & Heritage",
    titleWhite2: "By Master Weavers",
    desc: "Every thread tells a story — our weavers carry forward centuries-old traditions of Assam, weaving love and craft into every piece of fabric.",
    cta: "Shop Handloom",
    ctaHref: "/products?category=handloom",
    image: "https://improved-harlequin-p1r1nfee.edgeone.dev/file_0000000061ac72089014ce7c1188170e.png",
    footer: "WOVEN IN ASSAM. WORN WITH PRIDE.",
  },
  {
    id: 3,
    eyebrow: "Our Assam Story",
    titleWhite: "Crafted by",
    titleGold: "Skilled Artisans",
    titleWhite2: "Straight to You",
    desc: "Every product carries the heritage, craftsmanship, and authentic spirit of Assam. Supporting 500+ artisans across 25+ districts.",
    cta: "Explore Crafts",
    ctaHref: "/products?category=handicrafts",
    image: "https://superb-black-ffjvsarf.edgeone.dev/file_00000000549472088d6a31fc9dabf801.png",
    footer: "PURE ASSAM. DELIVERED WITH LOVE.",
  },
];

const STATS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/>
      </svg>
    ),
    value: "10,000+", label: "Acres", sub: "Tea Gardens",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    value: "500+", label: "Artisans", sub: "Supporting Local Families",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
    ),
    value: "1200+", label: "Products", sub: "Authentically Assamese",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    ),
    value: "25+", label: "Districts", sub: "Across Assam",
  },
];

export default function ArtisanBanner() {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);

  // Auto-rotate every 4 seconds
  useEffect(() => {
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent(c => (c + 1) % SLIDES.length);
        setFading(false);
      }, 350);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  function goTo(i: number) {
    if (i === current) return;
    setFading(true);
    setTimeout(() => { setCurrent(i); setFading(false); }, 350);
  }

  const s = SLIDES[current];

  return (
    <>
      <style>{`
        @keyframes ab-fadein  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ab-shimmer { 0%{background-position:-300% center} 100%{background-position:300% center} }
        @keyframes ab-kenburns { 0%{transform:scale(1)} 100%{transform:scale(1.06)} }
        @keyframes ab-marquee  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ab-cta-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: ${GOLD}; color: #111;
          border: none; border-radius: 50px;
          padding: 12px 24px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 700;
          cursor: pointer; text-decoration: none;
          transition: transform .2s, box-shadow .2s;
          box-shadow: 0 6px 20px rgba(201,168,76,.45);
        }
        .ab-cta-btn:hover { transform: scale(1.05); box-shadow: 0 10px 28px rgba(201,168,76,.6); }
        .ab-dot { border: none; cursor: pointer; padding: 0; border-radius: 100px; transition: all .35s; }
        .ab-stat { transition: transform .2s; }
        .ab-stat:hover { transform: translateY(-2px); }
        .ab-gold-shimmer {
          background: linear-gradient(90deg, ${GOLD} 0%, #f5d878 40%, ${GOLD} 80%);
          background-size: 300% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: ab-shimmer 3s linear infinite;
        }
      `}</style>

      <section style={{ padding: "8px 14px 0", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{
          borderRadius: 20, overflow: "hidden",
          position: "relative", minHeight: 320,
          background: "#071a09",
        }}>

          {/* ── BG IMAGE with Ken Burns ── */}
          {SLIDES.map((sl, i) => (
            <img
              key={sl.id}
              src={sl.image}
              alt=""
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%", objectFit: "cover",
                objectPosition: "center top",
                opacity: i === current ? 1 : 0,
                transition: "opacity .6s ease",
                animation: i === current ? "ab-kenburns 8s ease-in-out forwards" : "none",
              }}
            />
          ))}

          {/* overlays */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(5,20,8,.88) 0%, rgba(5,20,8,.65) 45%, rgba(5,20,8,.2) 100%)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, background: "linear-gradient(to top, rgba(5,20,8,.95), transparent)" }} />

          {/* Gold top line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${GOLD}cc, transparent)` }} />

          {/* ── CONTENT ── */}
          <div style={{
            position: "relative", zIndex: 3,
            padding: "24px 20px 16px",
            opacity: fading ? 0 : 1,
            transform: fading ? "translateY(10px)" : "translateY(0)",
            transition: "opacity .35s, transform .35s",
          }}>

            {/* Eyebrow */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              marginBottom: 14,
            }}>
              <div style={{ width: 24, height: 1, background: GOLD, opacity: .7 }} />
              <svg width="11" height="11" viewBox="0 0 24 24" fill={GOLD}>
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/>
              </svg>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 2.5, color: GOLD, textTransform: "uppercase" }}>
                {s.eyebrow}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill={GOLD}>
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/>
              </svg>
              <div style={{ width: 24, height: 1, background: GOLD, opacity: .7 }} />
            </div>

            {/* Headline */}
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(1.7rem, 6vw, 2.6rem)",
              fontWeight: 800, lineHeight: 1.12, margin: "0 0 14px",
              maxWidth: 360,
            }}>
              <span style={{ color: "#fff" }}>{s.titleWhite}<br /></span>
              <span className="ab-gold-shimmer">{s.titleGold}<br /></span>
              <span style={{ color: "#fff" }}>{s.titleWhite2}</span>
            </h2>

            {/* Gold divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 36, height: 1.5, background: GOLD, borderRadius: 2 }} />
              <svg width="10" height="10" viewBox="0 0 24 24" fill={GOLD}>
                <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/>
              </svg>
              <div style={{ width: 36, height: 1.5, background: GOLD, borderRadius: 2 }} />
            </div>

            {/* Description */}
            <p style={{
              color: "rgba(255,255,255,.72)", fontSize: 12.5,
              lineHeight: 1.7, maxWidth: 320, marginBottom: 20,
            }}>
              {s.desc}
            </p>

            {/* CTA */}
            <Link href={s.ctaHref} className="ab-cta-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              {s.cta} →
            </Link>

            {/* Slide dots */}
            <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  className="ab-dot"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => goTo(i)}
                  style={{
                    width: i === current ? 22 : 6,
                    height: 6,
                    background: i === current ? GOLD : "rgba(255,255,255,.35)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── STATS BAR ── */}
          <div style={{
            position: "relative", zIndex: 3,
            margin: "12px 14px 14px",
            background: "rgba(5,20,8,.75)",
            border: `1px solid ${GOLD}28`,
            borderRadius: 14,
            padding: "12px 8px",
            backdropFilter: "blur(10px)",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 4,
          }}>
            {STATS.map((st, i) => (
              <div key={st.label} className="ab-stat" style={{
                textAlign: "center",
                borderRight: i < 3 ? `1px solid ${GOLD}22` : "none",
                padding: "0 6px",
              }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>{st.icon}</div>
                <p style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "1rem", fontWeight: 800,
                  color: GOLD, lineHeight: 1, margin: "0 0 2px",
                }}>{st.value}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#fff", margin: "0 0 1px" }}>{st.label}</p>
                <p style={{ fontSize: 8.5, color: "rgba(255,255,255,.45)", margin: 0, lineHeight: 1.3 }}>{st.sub}</p>
              </div>
            ))}
          </div>

          {/* ── FOOTER MARQUEE ── */}
          <div style={{
            position: "relative", zIndex: 3,
            borderTop: `1px solid ${GOLD}25`,
            background: "rgba(5,20,8,.6)",
            overflow: "hidden",
            padding: "8px 0",
          }}>
            <div style={{ display: "flex", width: "max-content", animation: "ab-marquee 14s linear infinite" }}>
              {[s.footer, s.footer].map((txt, i) => (
                <span key={i} style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  fontSize: 9.5, fontWeight: 700, letterSpacing: 3,
                  color: GOLD, padding: "0 32px", whiteSpace: "nowrap",
                }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill={GOLD}>
                    <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/>
                  </svg>
                  {txt}
                  <svg width="9" height="9" viewBox="0 0 24 24" fill={GOLD}>
                    <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/>
                  </svg>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
