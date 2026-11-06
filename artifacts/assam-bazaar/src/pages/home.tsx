import ExperienceAssamSection from "@/components/ExperienceAssamSection";
import ArtisanBanner from "@/components/ArtisanBanner";
import { Link } from "wouter";
import { useEffect, useState, useRef } from "react";
import { useGetFeaturedProducts } from "@workspace/api-client-react";
import { getGetFeaturedProductsQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "@/components/product-card";
import FloatingParticles from "@/components/floating-particles";
import FloatingLeaves from "@/components/floating-leaves";
import React from "react";

const G = "#1a5a32";
const GOLD = "#c9a84c";
const BG = "#f5f0e8";

const IconArrowRight = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
const IconPlay = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);
const IconLeafSmall = ({ color = GOLD }: { color?: string }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill={color}>
    <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/>
  </svg>
);

// ─── CINEMATIC SECTION REVEAL HOOK ───────────────────────────────────────────
function useCinematicReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("cin-visible"); }),
      { threshold: 0.1, rootMargin: "0px 0px -30px 0px" }
    );
    document.querySelectorAll(".cin-title").forEach(el => observer.observe(el));
    document.querySelectorAll(".cin-trust-card").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');
      .ab-root { font-family: 'DM Sans', sans-serif; background: ${BG}; }
      .ab-serif { font-family: 'Playfair Display', serif; }

      @keyframes ab-shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
      @keyframes ab-pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:.6} }
      @keyframes ab-marquee { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
      @keyframes ab-rotateleaf { 0%{transform:rotate(-5deg)} 50%{transform:rotate(5deg)} 100%{transform:rotate(-5deg)} }
      @keyframes ab-quoteglow { 0%,100%{opacity:.15} 50%{opacity:.35} }

      /* 1. Ken Burns */
      @keyframes ken-burns {
        0%   { transform: scale(1.0) translate(0px, 0px); }
        25%  { transform: scale(1.06) translate(-8px, -4px); }
        50%  { transform: scale(1.10) translate(6px, -8px); }
        75%  { transform: scale(1.06) translate(-4px, 4px); }
        100% { transform: scale(1.0) translate(0px, 0px); }
      }

      /* 3. Title slide from left */
      .cin-title {
        opacity: 0;
        transform: translateX(-36px);
        transition: opacity .75s cubic-bezier(.16,1,.3,1), transform .75s cubic-bezier(.16,1,.3,1);
        will-change: opacity, transform;
      }
      .cin-title.cin-visible {
        opacity: 1;
        transform: translateX(0);
      }

      /* 2. Trust card cinematic hover */
      .cin-trust-card {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity .6s ease, transform .6s ease, box-shadow .3s, border-color .3s;
        will-change: opacity, transform;
      }
      .cin-trust-card.cin-visible {
        opacity: 1;
        transform: translateY(0);
      }
      .cin-trust-card:hover {
        box-shadow: 0 12px 32px rgba(26,90,50,0.14), 0 0 0 1.5px rgba(201,168,76,0.35) !important;
        transform: translateY(-4px) scale(1.02) !important;
      }
      .cin-trust-card.cin-visible:nth-child(2) { transition-delay: .08s; }
      .cin-trust-card.cin-visible:nth-child(3) { transition-delay: .16s; }
      .cin-trust-card.cin-visible:nth-child(4) { transition-delay: .24s; }

      .ab-noscroll { scrollbar-width:none; -ms-overflow-style:none; }
      .ab-noscroll::-webkit-scrollbar { display:none; }
      .ab-label { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:${GOLD}; margin-bottom:6px; }
      .ab-h2 { font-family:'Playfair Display',serif; font-size:clamp(1.5rem,4vw,2rem); font-weight:700; color:#111827; line-height:1.2; }
      .ab-h2 span { color:${GOLD}; }
      .ab-viewall { display:inline-flex; align-items:center; gap:4px; font-size:13px; font-weight:600; color:${G}; text-decoration:none; transition:gap .2s; }
      .ab-viewall:hover { gap:8px; }
      .ab-hero-primary { display:inline-flex; align-items:center; gap:8px; padding:13px 26px; border-radius:50px; background:${GOLD}; color:#111; font-weight:700; font-size:14px; border:none; cursor:pointer; text-decoration:none; box-shadow:0 8px 24px rgba(201,168,76,.45); transition:transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s; }
      .ab-hero-primary:hover { transform:scale(1.06); box-shadow:0 14px 32px rgba(201,168,76,.6); }
      .ab-hero-secondary { display:inline-flex; align-items:center; gap:8px; padding:13px 26px; border-radius:50px; background:rgba(255,255,255,.13); backdrop-filter:blur(12px); border:1.5px solid rgba(255,255,255,.45); color:#fff; font-weight:700; font-size:14px; cursor:pointer; text-decoration:none; transition:transform .2s cubic-bezier(.34,1.56,.64,1), background .2s; }
      .ab-hero-secondary:hover { transform:scale(1.06); background:rgba(255,255,255,.22); }
      .ab-arrow-btn { width:32px; height:32px; border-radius:50%; border:1.5px solid #e5e7eb; background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; color:${G}; transition:background .2s, border-color .2s, transform .2s; }
      .ab-arrow-btn:hover { background:${G}; color:#fff; border-color:${G}; transform:scale(1.1); }
      .ab-test-card { transition: transform .35s cubic-bezier(.34,1.56,.64,1), box-shadow .35s; }
      .ab-test-card:active { transform: scale(0.98); }

      @media (prefers-reduced-motion: reduce) {
        .cin-title, .cin-trust-card { transition: none !important; opacity: 1 !important; transform: none !important; }
        .ken-burns-img { animation: none !important; }
      }
    `}</style>
  );
}

const DEFAULT_SLIDES = [
  { id: "1", badge: "STARTING FROM ASSAM", title: "The Heart of", titleAccent: "Northeast India", subtitle: "Authentic Assam Tea, Handloom & Handmade Products – Delivered Across India.", ctaLabel: "Shop Now", ctaHref: "/products?category=assam-tea", ctaSecondaryLabel: "Explore Assam", ctaSecondaryHref: "/products", bgColor: "#0d2e10", image: "https://confused-white-nzcyx8ks.edgeone.dev/file_0000000024b472079b26166ceba5eb81.png", accent: GOLD },
  { id: "2", badge: "Pride of Assam", title: "Awesome Assam", titleAccent: "TEA", subtitle: "From Assam's lush gardens to your cup — pure, rich & truly authentic.", ctaLabel: "Shop Now", ctaHref: "/products?category=handloom", ctaSecondaryLabel: "View All", ctaSecondaryHref: "/products", bgColor: "#1a0d2e", image: "https://sad-beige-a5kcyl8q.edgeone.app/44e87171-865e-40d5-9a20-b585e9b34956.png", accent: "#7ec850" },
  { id: "3", badge: "Cultural Heritage", title: "Traditional", titleAccent: "Goodness", subtitle: "More than a cloth—it's the symbol of Assamese pride, respect, and tradition. Handwoven by skilled local artisans.", ctaLabel: "Shop Gamusa", ctaHref: "/products?category=organic", ctaSecondaryLabel: "View All", ctaSecondaryHref: "/products", bgColor: "#0a2510", image: "https://used-brown-xwgezqax.edgeone.dev/file_00000000d0c871fda2a3bce7ec311c9c.png", accent: "#d4a017" },
  { id: "5", badge: "Pride of Assam", title: "Assam Tea", titleAccent: "Gardens", subtitle: "First flush, second flush — every sip tells the story of Assam's hills.", ctaLabel: "Shop Tea", ctaHref: "/products?category=tea", ctaSecondaryLabel: "View All", ctaSecondaryHref: "/products", bgColor: "#1a0808", image: "https://thundering-black-udqfmt7p.edgeone.app/785269bd-8b13-433b-a1ef-912e8699eeee.png", accent: GOLD },
];

// ─── HERO SLIDER — Ken Burns added ───────────────────────────────────────────
function HeroSlider() {
  const [slides, setSlides] = useState(DEFAULT_SLIDES);
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);

  const loadSlides = () => {
    try {
      const saved = localStorage.getItem("hero_slides");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) { setSlides(parsed); setCurrent(0); }
      }
    } catch {}
  };

  useEffect(() => {
    loadSlides();
    const onStorage = (e: StorageEvent) => { if (e.key === "hero_slides") loadSlides(); };
    const onUpdate = () => loadSlides();
    window.addEventListener("storage", onStorage);
    window.addEventListener("hero_slides_updated", onUpdate);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("hero_slides_updated", onUpdate); };
  }, []);

  const goTo = (i: number) => {
    if (fading) return;
    setFading(true);
    setTimeout(() => { setCurrent(i); setFading(false); }, 380);
  };

  useEffect(() => {
    slides.forEach((sl, i) => { if (i === 0 || !sl.image) return; const img = new Image(); img.src = sl.image; });
  }, [slides]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => goTo((current + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [current, paused, slides.length]);

  const s = slides[current];

  return (
    <section style={{ position: "relative", overflow: "hidden", minHeight: "86vh" }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div style={{ position: "absolute", inset: 0, zIndex: -1, background: "linear-gradient(90deg, #0d2e10 0%, #1a4a20 40%, #0d3318 60%, #0d2e10 100%)", backgroundSize: "200% 100%", animation: "ab-shimmer 1.8s ease infinite" }} />

      {slides.map((sl, i) => (
        <div key={sl.id} style={{ position: "absolute", inset: 0, opacity: i === current ? 1 : 0, transition: "opacity 0.65s ease", zIndex: 0 }}>
          <div style={{ position: "absolute", inset: 0, background: sl.bgColor }} />
          {sl.image && (
            <img
              src={sl.image} alt=""
              loading={i === 0 ? "eager" : "lazy"}
              decoding={i === 0 ? "sync" : "async"}
              fetchPriority={i === 0 ? "high" : "low"}
              /* ── 1. KEN BURNS ── */
              className="ken-burns-img"
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "center",
                transformOrigin: "center center",
                animation: i === current ? "ken-burns 18s ease-in-out infinite" : "none",
              }}
            />
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.05) 75%, transparent 100%)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, background: "linear-gradient(to top, rgba(0,0,0,0.40), transparent)" }} />
        </div>
      ))}

      {/* Floating golden particles (same effect as the portfolio hero) */}
      {/* Falling leaves (same effect as the portfolio hero) */}
      <FloatingLeaves className="floating-leaves--hero" />
      <FloatingParticles className="floating-particles--hero" />
      <FloatingParticles className="floating-particles--hero" variant="dust" count={30} />

      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(to right, transparent, ${s.accent}cc, transparent)`, zIndex: 2 }} />

      <div style={{ position: "relative", zIndex: 3, display: "flex", alignItems: "center", minHeight: "86vh", padding: "100px 22px 80px" }}>
        <div style={{ maxWidth: 520, opacity: fading ? 0 : 1, transform: fading ? "translateY(16px)" : "translateY(0)", transition: "opacity .38s, transform .38s" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.12)", backdropFilter: "blur(14px)", border: `1.5px solid ${s.accent}55`, color: s.accent, padding: "5px 14px", borderRadius: 50, fontSize: 10.5, fontWeight: 700, letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 18 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.accent, display: "inline-block", animation: "ab-pulse 2s ease-in-out infinite" }} />
            <IconLeafSmall color={s.accent} /> {s.badge}
          </div>
          <h1 className="ab-serif" style={{ fontSize: "clamp(2.4rem,7vw,4.4rem)", color: "#fff", lineHeight: 1.06, fontWeight: 800, marginBottom: 10 }}>
            {s.title}<br />
            <span style={{ backgroundImage: `linear-gradient(90deg, ${s.accent} 0%, rgba(255,255,255,.95) 45%, ${s.accent} 100%)`, backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "ab-shimmer 3s linear infinite" }}>{s.titleAccent}</span>
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 44, height: 2, background: s.accent, borderRadius: 2 }} />
            <IconLeafSmall color={s.accent} />
            <div style={{ width: 44, height: 2, background: s.accent, borderRadius: 2 }} />
          </div>
          <p style={{ color: "rgba(255,255,255,.85)", fontSize: "1rem", lineHeight: 1.72, maxWidth: 400, marginBottom: 30 }}>{s.subtitle}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Link href={s.ctaHref} className="ab-hero-primary">{s.ctaLabel} <IconArrowRight size={15} /></Link>
            <Link href={s.ctaSecondaryHref} className="ab-hero-secondary"><IconPlay size={12} /> {s.ctaSecondaryLabel}</Link>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", top: 22, right: 18, zIndex: 4, color: "rgba(255,255,255,.4)", fontSize: 12, fontWeight: 700 }}>
        {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
      </div>
      <div style={{ position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 4, display: "flex", gap: 7, alignItems: "center" }}>
        {slides.map((sl, i) => (
          <button key={sl.id} onClick={() => goTo(i)} style={{ height: 8, width: i === current ? 26 : 8, borderRadius: 4, background: i === current ? s.accent : "rgba(255,255,255,.38)", border: "none", cursor: "pointer", transition: "all .35s", padding: 0 }} />
        ))}
      </div>
    </section>
  );
}

// ─── TRUST BAR — cinematic hover effect added ─────────────────────────────────
function TrustBar() {
  const items = [
    { tag: "Fast & Reliable", title: "Free Shipping", desc: "Orders Above ₹499", iconColor: "#1a5a32", ringColor: "#4caf50", bg: "#f0f7f0", border: "#c2e0ce", tagColor: "#2e7d32", icon: (c: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
    { tag: "Pure & Authentic", title: "100% Authentic", desc: "Verified Assamese Products", iconColor: "#c9a84c", ringColor: "#e6b94a", bg: "#fdf8ee", border: "#e8d5a0", tagColor: "#b8860b", icon: (c: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
    { tag: "Clean & Natural", title: "Natural Products", desc: "Fresh & Carefully Selected", iconColor: "#2e7d32", ringColor: "#4caf50", bg: "#f0f7f0", border: "#bddfa0", tagColor: "#2e7d32", icon: (c: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/></svg> },
    { tag: "Always With You", title: "24/7 Support", desc: "Always Here To Help", iconColor: "#1565c0", ringColor: "#42a5f5", bg: "#e8f0fb", border: "#a8bede", tagColor: "#1565c0", icon: (c: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg> },
  ];
  return (
    <section style={{ background: BG, padding: "10px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {items.map((item) => (
          /* ── 2. cin-trust-card class added ── */
          <div key={item.title} className="cin-trust-card" style={{ background: "#fff", borderRadius: 14, padding: "10px 9px", border: "0.5px solid #ede8de", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-start", gap: 8, minHeight: 82 }}>
            <div style={{ position: "relative", flexShrink: 0, width: 44, height: 44 }}>
              <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: "absolute", inset: 0 }}>
                <circle cx="22" cy="22" r="19" fill="none" stroke={item.ringColor} strokeWidth="2" strokeDasharray="30 90" strokeDashoffset="-22" strokeLinecap="round" opacity="0.5" />
              </svg>
              <div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: item.bg, border: `1px solid ${item.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.icon(item.iconColor)}
              </div>
            </div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <p style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: item.tagColor, margin: "0 0 3px" }}>{item.tag}</p>
              <div style={{ width: 16, height: 1.5, background: item.tagColor, borderRadius: 2, marginBottom: 4, opacity: 0.7 }} />
              <p style={{ fontSize: 12.5, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#1a2d1a", margin: "0 0 3px", lineHeight: 1.2 }}>{item.title}</p>
              <p style={{ fontSize: 9.5, color: "#888", margin: 0, lineHeight: 1.4 }}>{item.desc}</p>
            </div>
            <svg style={{ position: "absolute", bottom: -3, right: -3, opacity: 0.06, pointerEvents: "none" }} width="46" height="46" viewBox="0 0 24 24" fill={item.iconColor}><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/></svg>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── CATEGORY SECTION ─────────────────────────────────────────────────────────
const FALLBACK_CATS = [
  { id: "tea", name: "Tea", slug: "tea" },
  { id: "handloom", name: "Handloom", slug: "handloom" },
  { id: "handicrafts", name: "Handicrafts", slug: "handicrafts" },
  { id: "organic", name: "Organic Food", slug: "organic" },
  { id: "bamboo", name: "Bamboo", slug: "bamboo" },
];

// Category cards ab icon/emoji ki jagah in photos ko use karte hain
const CAT_IMAGES = ["tea", "gamusa", "mekhela", "handicrafts"].map(n => `${import.meta.env.BASE_URL}categories/${n}.webp`);
function categoryImage(cat: any, index: number): string {
  const key = `${cat.slug ?? ""} ${cat.name ?? ""}`.toLowerCase();
  if (/tea|chai/.test(key)) return CAT_IMAGES[0];
  if (/mekhela|chador|saree|sari|silk/.test(key)) return CAT_IMAGES[2];
  if (/gamusa|gamosa|handloom|textile|cloth|fabric/.test(key)) return CAT_IMAGES[1];
  if (/handicraft|craft|bamboo|cane|bag|wood|brass|jewel/.test(key)) return CAT_IMAGES[3];
  return CAT_IMAGES[index % CAT_IMAGES.length];
}

function CategorySection({ categories, isLoading }: { categories: any[]; isLoading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const cats = (Array.isArray(categories) && categories.length > 0) ? categories : FALLBACK_CATS;

  useEffect(() => {
    if (paused || isLoading || !cats.length) return;
    const CARD_W = 148, GAP = 14;
    const t = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 8) { el.scrollTo({ left: 0, behavior: "smooth" }); }
      else { el.scrollTo({ left: el.scrollLeft + CARD_W + GAP, behavior: "smooth" }); }
    }, 4000);
    return () => clearInterval(t);
  }, [paused, isLoading, cats.length]);

  return (
    <section style={{ background: BG, paddingBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "22px 16px 14px" }}>
        <div>
          <p className="ab-label" style={{ marginBottom: 5 }}><IconLeafSmall /> Explore categories</p>
          {/* ── 3. cin-title class ── */}
          <h2 className="ab-serif cin-title" style={{ fontSize: "1.35rem", fontWeight: 700, color: "#1B3A22", margin: 0, lineHeight: 1.2 }}>
            Shop by <span style={{ color: GOLD }}>Category</span>
          </h2>
        </div>
        <Link href="/products" className="ab-viewall" style={{ fontSize: 12 }}>View all <IconArrowRight size={13} /></Link>
      </div>
      <p style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 16px 4px", color: "#9ca3af", fontSize: 10.5, margin: 0 }}>
        <IconArrowRight size={11} /> Swipe to explore
      </p>
      <div ref={scrollRef} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setTimeout(() => setPaused(false), 2000)}
        style={{ display: "flex", gap: 14, overflowX: "auto", padding: "4px 16px 12px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } as React.CSSProperties}
        className="ab-noscroll">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ flexShrink: 0, width: 148, height: 210, borderRadius: 20, background: "#e5e7eb" }} />)
          : cats.map((cat: any, idx: number) => {
              // Local (same-origin, chhoti webp) image sabse tez hai — isliye pehle wahi
              const imgSrc = categoryImage(cat, idx);
              return (
                <Link key={cat.id ?? cat.slug} href={`/category/${cat.slug}`}
                  style={{ flexShrink: 0, width: 148, borderRadius: 20, overflow: "hidden", textDecoration: "none", scrollSnapAlign: "start", background: "#fff", border: `0.5px solid rgba(212,175,55,0.22)`, boxShadow: "0 4px 18px rgba(27,94,32,0.10), 0 1px 4px rgba(0,0,0,0.06)", display: "block" }}>
                  <div style={{ width: "100%", height: 158, overflow: "hidden", position: "relative", background: "#edf5ef" }}>
                    <img src={imgSrc} alt={cat.name} width={148} height={158}
                      loading={idx < 3 ? "eager" : "lazy"} decoding="async" fetchPriority={idx < 3 ? "high" : "auto"}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(27,94,32,0.18) 0%, transparent 55%)", pointerEvents: "none" }} />
                  </div>
                  <div style={{ padding: "10px 10px 12px", textAlign: "center" }}>
                    <p className="ab-serif" style={{ fontSize: 13.5, fontWeight: 700, color: "#1B3A22", margin: "0 0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                      <span style={{ width: 28, height: 1, background: GOLD, display: "block", borderRadius: 1 }} />
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: GOLD, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ width: 28, height: 1, background: GOLD, display: "block", borderRadius: 1 }} />
                    </div>
                  </div>
                </Link>
              );
            })
        }
      </div>
    </section>
  );
}

// ─── FEATURED CAROUSEL ────────────────────────────────────────────────────────
function FeaturedCarousel({ products, isLoading }: { products: any[]; isLoading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const CARD_W = 172, GAP = 12;

  useEffect(() => {
    if (paused || isLoading || !products.length) return;
    const t = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 8) { el.scrollTo({ left: 0, behavior: "smooth" }); setCurrent(0); }
      else { el.scrollTo({ left: el.scrollLeft + CARD_W + GAP, behavior: "smooth" }); setCurrent(c => c + 1); }
    }, 3000);
    return () => clearInterval(t);
  }, [paused, isLoading, products.length]);

  const dots = products.length > 0 ? Math.ceil(products.length / 2) : 0;
  return (
    <section style={{ padding: "24px 0 20px", background: BG }}>
      <div style={{ padding: "0 16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p className="ab-label"><IconLeafSmall /> HANDPICKED FOR YOU</p>
          {/* ── 3. cin-title ── */}
          <h2 className="ab-h2 cin-title" style={{ fontSize: "1.5rem" }}>Featured <span>Products</span></h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <button className="ab-arrow-btn" onClick={() => { scrollRef.current?.scrollBy({ left: -(CARD_W + GAP), behavior: "smooth" }); setPaused(true); setTimeout(() => setPaused(false), 2000); }}><ChevronLeft size={14} /></button>
          <button className="ab-arrow-btn" onClick={() => { scrollRef.current?.scrollBy({ left: CARD_W + GAP, behavior: "smooth" }); setPaused(true); setTimeout(() => setPaused(false), 2000); }}><ChevronRight size={14} /></button>
          <Link href="/products?featured=true" className="ab-viewall" style={{ fontSize: 12 }}>View All <IconArrowRight size={13} /></Link>
        </div>
      </div>
      <div ref={scrollRef} className="ab-noscroll" style={{ display: "flex", gap: GAP, overflowX: "auto", padding: "4px 16px 8px", scrollSnapType: "x mandatory" }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ width: CARD_W, flexShrink: 0 }}><Skeleton style={{ height: 260, borderRadius: 16, width: "100%" }} /></div>)
          : products.map(p => <div key={p.id} style={{ width: CARD_W, flexShrink: 0, scrollSnapAlign: "start" }}><ProductCard product={p} /></div>)
        }
      </div>
      {dots > 0 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {Array.from({ length: dots }).map((_, i) => (
            <div key={i} style={{ width: Math.floor(current / 2) === i ? 22 : 7, height: 7, borderRadius: 4, background: Math.floor(current / 2) === i ? G : "rgba(0,0,0,.18)", transition: "all .3s" }} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── HERITAGE MARQUEE ─────────────────────────────────────────────────────────
function HeritageMarquee() {
  const items = [
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/></svg>, label: "Premium Assam Tea" },
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0"/><path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2"/><path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/></svg>, label: "Handmade Handicrafts" },
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/></svg>, label: "GI Tagged Products" },
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, label: "From Local Artisans" },
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, label: "Pan India Delivery" },
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>, label: "100% Authentic" },
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2l9 9M4.5 4.5l3 3M9 9l3 3M7 21c-1.657 0-3-1.343-3-3 0-2 2-4 5-7l-1-1c-3 3-5 5.5-5 8 0 2.761 2.239 5 5 5 2.761 0 5-2.239 5-5 0-1.5-.5-3-2-5l-1 1c1.5 2 2 3 2 4 0 1.657-1.343 3-3 3z"/></svg>, label: "Authentic Handloom" },
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill={GOLD} stroke={GOLD} strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>, label: "Pride of Assam" },
  ];
  const Sep = () => <span style={{ color: GOLD, fontSize: 10, opacity: 0.5, flexShrink: 0 }}>✦</span>;
  const doubled = [...items, ...items];
  return (
    <div style={{ background: `${G}08`, borderTop: `1px solid ${G}18`, borderBottom: `1px solid ${G}18`, padding: "12px 0", overflow: "hidden" }}>
      <div style={{ display: "flex", width: "max-content", animation: "ab-marquee 28s linear infinite", alignItems: "center", gap: 10 }}>
        {doubled.map((item, i) => (
          <React.Fragment key={i}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 16px", borderRadius: 50, background: "#fff", border: `1px solid rgba(201,168,76,0.28)`, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", fontSize: 12.5, fontWeight: 600, color: G, whiteSpace: "nowrap", flexShrink: 0 }}>
              {item.icon}{item.label}
            </span>
            <Sep />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── NEW ARRIVALS ─────────────────────────────────────────────────────────────
function NewArrivalsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () => { const r = await fetch("/api/products?limit=6"); const d = await r.json(); return Array.isArray(d) ? d : d?.products ?? []; },
  });
  if (isLoading) return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} style={{ height: 280, borderRadius: 18 }} />)}</div>;
  const products = Array.isArray(data) ? data : [];
  if (!products.length) return <div style={{ textAlign: "center", padding: "36px 0", color: "#9ca3af" }}><div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}><IconLeafSmall color="#9ca3af" /></div><p style={{ fontSize: 13 }}>New arrivals coming soon!</p></div>;
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{products.map((p: any) => <ProductCard key={p.id} product={p} />)}</div>;
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
const TESTIMONIAL_AVATAR_GRADIENTS = [
  `linear-gradient(135deg,${G},${GOLD})`, `linear-gradient(135deg,${GOLD},${G})`,
  `linear-gradient(135deg,#7ec850,${G})`, `linear-gradient(135deg,${GOLD},#b8860b)`,
  `linear-gradient(135deg,${G},#0d3318)`, `linear-gradient(135deg,#e8c84a,${GOLD})`,
];

function TestimonialsSection() {
  const reviews = [
    { name: "Priya Das", city: "Guwahati, Assam", rating: 5, verified: true, text: "The quality of the products is exceptional! You can truly taste the authenticity of Assam in every bite.", avatar: "https://i.pinimg.com/736x/f0/28/e1/f028e19c8d53b04fd93ce8808c3c2007.jpg", bg: "#f5f9f2", leaf: "#c8dfc0" },
    { name: "Ritwik Sharma", city: "Bangalore, Karnataka", rating: 5, verified: true, text: "Fast delivery, great packaging and super fresh products. ApunBazar is now my go-to store for Assamese products.", avatar: "https://prideofassam.shop/cdn/shop/files/FB_IMG_1773725885203_600x600_crop_center.jpg?v=1774086143", bg: "#fdf8ee", leaf: "#e8d5a0" },
    { name: "Ananya Saikia", city: "Delhi, Delhi", rating: 5, verified: true, text: "I love how they support local farmers and bring the best of Assam to our doorstep. Highly recommended!", avatar: "https://img.trustoo.io/pro/98394767645/2026/3/22/WDTZFcwzmt.jpeg?x-oss-process=style/trustoo_small", bg: "#f5f9f2", leaf: "#c8dfc0" },
    { name: "Manoj Baruah", city: "Jorhat, Assam", rating: 5, verified: true, text: "Their Muga silk gamosa is a piece of art. You can feel the craftsmanship in every thread — worth every rupee.", avatar: "https://www.shutterstock.com/image-photo/young-indian-bengali-assamese-married-600w-1554784457.jpg", bg: "#fdf8ee", leaf: "#e8d5a0" },
    { name: "Sneha Patil", city: "Pune, Maharashtra", rating: 5, verified: true, text: "Ordered Joha rice and bamboo shoot pickle — both tasted exactly like homemade Assamese food. Will order again!", avatar: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTi7aHVV79-mxM3A-cQpmA8QfSmDho0tdL3i_FI_2eBhQ&s=10", bg: "#f5f9f2", leaf: "#c8dfc0" },
    { name: "Arif Hussain", city: "Kolkata, West Bengal", rating: 5, verified: true, text: "Customer support is genuinely helpful and the packaging keeps everything fresh. A brand that actually cares.", avatar: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRpOi2Jyxivsbagpt3A9MU45Eox3D_kqZGtGKZxcvcmkQ&s=10", bg: "#fdf8ee", leaf: "#e8d5a0" },
  ];

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);
  const CARD_W = 240, GAP = 14, STEP = CARD_W + GAP;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      isProgrammaticScroll.current = true;
      if (el.scrollLeft >= maxScroll - 8) { el.scrollTo({ left: 0, behavior: "smooth" }); setActive(0); }
      else { const nextIdx = Math.min(active + 1, reviews.length - 1); el.scrollTo({ left: nextIdx * STEP, behavior: "smooth" }); setActive(nextIdx); }
    }, 3800);
    return () => clearInterval(t);
  }, [paused, active, reviews.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (isProgrammaticScroll.current) { isProgrammaticScroll.current = false; return; }
        const idx = Math.round(el.scrollLeft / STEP);
        setActive(Math.min(Math.max(idx, 0), reviews.length - 1));
      }, 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(scrollTimeout); };
  }, [reviews.length]);

  function goTo(idx: number) {
    const el = scrollRef.current;
    if (!el) return;
    isProgrammaticScroll.current = true;
    el.scrollTo({ left: idx * STEP, behavior: "smooth" });
    setActive(idx);
    setPaused(true);
    setTimeout(() => setPaused(false), 5000);
  }

  return (
    <section style={{ padding: "28px 0 24px", overflow: "hidden", position: "relative", background: BG }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <svg style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", opacity: 0.15, animation: "ab-quoteglow 4s ease-in-out infinite", pointerEvents: "none", zIndex: 1 }} width="120" height="120" viewBox="0 0 24 24" fill={GOLD}>
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
      </svg>
      <div style={{ textAlign: "center", marginBottom: 20, padding: "0 16px", position: "relative", zIndex: 2 }}>
        <p style={{ color: GOLD, fontSize: 10.5, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <IconLeafSmall /> WHAT CUSTOMERS SAY <IconLeafSmall />
        </p>
        {/* ── 3. cin-title ── */}
        <h2 className="ab-serif cin-title" style={{ fontSize: "1.8rem", fontWeight: 800, color: "#151515", margin: 0 }}>
          Loved Across <span style={{ color: GOLD }}>India</span>
        </h2>
      </div>
      <div ref={scrollRef} style={{ display: "flex", gap: GAP, overflowX: "auto", padding: "4px 16px 8px", scrollbarWidth: "none", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", position: "relative", zIndex: 2 }} className="ab-noscroll" onTouchStart={() => setPaused(true)} onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}>
        {reviews.map((r, idx) => (
          <div key={r.name} className="ab-test-card" style={{ flexShrink: 0, width: CARD_W, background: r.bg, borderRadius: 20, padding: "18px 16px 16px", border: idx === active ? `1px solid ${GOLD}66` : "1px solid rgba(0,0,0,0.06)", boxShadow: idx === active ? "0 10px 28px rgba(201,168,76,0.22)" : "0 2px 12px rgba(0,0,0,0.06)", transform: idx === active ? "translateY(-3px) scale(1.015)" : "translateY(0) scale(1)", scrollSnapAlign: "start", position: "relative", overflow: "hidden" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(201,168,76,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={GOLD}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 2 }}>{Array.from({ length: r.rating }).map((_, i) => <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={GOLD}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
              {r.verified && <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 8.5, fontWeight: 700, color: G, background: "rgba(26,90,50,0.1)", borderRadius: 100, padding: "2px 7px", letterSpacing: 0.3 }}><svg width="9" height="9" viewBox="0 0 24 24" fill={G}><path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5z"/></svg>VERIFIED</div>}
            </div>
            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: "#374151", fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontWeight: 500, margin: "0 0 16px", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>"{r.text}"</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 2 }}>
              <img src={r.avatar} alt={r.name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid ${GOLD}55`, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }} onError={e => { const el = e.target as HTMLImageElement; el.style.display = "none"; const fb = el.nextElementSibling as HTMLElement; if (fb) fb.style.display = "flex"; }} />
              <div style={{ display: "none", width: 44, height: 44, borderRadius: "50%", background: TESTIMONIAL_AVATAR_GRADIENTS[idx % TESTIMONIAL_AVATAR_GRADIENTS.length], alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>{r.name[0]}</div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 13, color: "#1a2d1a", margin: 0, fontFamily: "'Nunito',sans-serif" }}>{r.name}</p>
                <p style={{ fontSize: 10.5, color: "#888", margin: 0, fontFamily: "'Nunito',sans-serif" }}>{r.city}</p>
              </div>
            </div>
            <svg style={{ position: "absolute", bottom: -8, right: -8, opacity: 0.18, pointerEvents: "none" }} width="70" height="70" viewBox="0 0 24 24" fill={r.leaf}><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2-8 2s1-3 3-4c-4 0-6 2-6 2S5 3 5 6c0 2.23 1.93 3.42 2 5z"/></svg>
            {idx % 3 === 0 && <svg style={{ position: "absolute", bottom: 0, left: 0, opacity: 0.06, pointerEvents: "none" }} width="80" height="50" viewBox="0 0 100 60"><path d="M0 60 L0 35 L15 20 L30 35 L30 60Z" fill={G}/><path d="M25 60 L25 30 L45 10 L65 30 L65 60Z" fill={G}/><path d="M55 60 L55 40 L70 28 L85 40 L85 60Z" fill={G}/><rect x="40" y="45" width="8" height="15" fill={G}/></svg>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 4, marginBottom: 16, position: "relative", zIndex: 2 }}>
        {reviews.map((_, i) => <button key={i} onClick={() => goTo(i)} aria-label={`Go to review ${i + 1}`} style={{ width: i === active ? 18 : 6, height: 6, borderRadius: 4, background: i === active ? G : "#d8cfc0", border: "none", cursor: "pointer", padding: 0, transition: "all .3s" }} />)}
      </div>
      <div style={{ margin: "0 16px 0", background: "#fff", borderRadius: 16, padding: "14px 16px", border: "1px solid #f0e8df", boxShadow: "0 4px 16px rgba(0,0,0,0.04)", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex" }}>
          {[
            { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill={GOLD}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, label: "4.9/5 Rating", sub: "2,400+ reviews" },
            { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>, label: "Fast Delivery", sub: "Pan India" },
            { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>, label: "Secure Pay", sub: "100% safe" },
            { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>, label: "500+ Artisans", sub: "Directly sourced" },
          ].map((b, idx) => (
            <div key={b.label} style={{ flex: 1, textAlign: "center", borderRight: idx < 3 ? "1px solid #f0ece4" : "none", padding: "0 4px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 3 }}>{b.icon}</div>
              <p style={{ fontWeight: 700, fontSize: 9.5, color: "#111827", lineHeight: 1.2, margin: 0 }}>{b.label}</p>
              <p style={{ fontSize: 8.5, color: "#9ca3af", lineHeight: 1.3, margin: 0 }}>{b.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── RECENTLY VIEWED ──────────────────────────────────────────────────────────
function RecentlyViewedSection() {
  const [productIds, setProductIds] = useState<number[]>([]);
  useEffect(() => { try { const ids: number[] = JSON.parse(localStorage.getItem("apunbazar_recently_viewed") ?? "[]"); setProductIds(ids.slice(0, 4)); } catch {} }, []);
  const { data: productsData, isLoading } = useQuery({ queryKey: ["recently-viewed", productIds], queryFn: async () => { if (!productIds.length) return []; const results = await Promise.all(productIds.map(id => fetch(`/api/products/${id}`).then(r => r.ok ? r.json() : null).catch(() => null))); return results.filter(Boolean); }, enabled: productIds.length > 0, staleTime: 2 * 60 * 1000 });
  if (!productIds.length) return null;
  return (
    <section style={{ padding: "22px 16px 24px", background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p className="ab-label"><IconLeafSmall /> RECENTLY VIEWED</p>
          <h2 className="ab-h2" style={{ fontSize: "1.25rem" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 6 }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            VIEWED
          </h2>
        </div>
        <Link href="/products" className="ab-viewall" style={{ fontSize: 12 }}>See all <IconArrowRight size={13} /></Link>
      </div>
      {isLoading ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{[1, 2].map(i => <Skeleton key={i} style={{ height: 220, borderRadius: 18 }} />)}</div>
        : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>{(productsData ?? []).map((p: any) => <ProductCard key={p.id} product={p} />)}</div>}
    </section>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { data: featured, isLoading: featuredLoading } = useGetFeaturedProducts({ query: { queryKey: getGetFeaturedProductsQueryKey() } });
  const { data: categoriesRaw, isLoading: catLoading } = useQuery({
    queryKey: ["main-categories-with-count"],
    queryFn: async () => {
      const [cats, products] = await Promise.all([fetch("/api/categories/tree").then(r => r.json()), fetch("/api/products?limit=100").then(r => r.json())]);
      const prods = products?.products ?? [];
      const catsArr = Array.isArray(cats) ? cats : [];
      return catsArr.map((cat: any) => ({ ...cat, productCount: prods.filter((p: any) => p.categoryId === cat.id).length }));
    },
  });

  // Activate cinematic observers after mount
  useCinematicReveal();

  return (
    <div className="ab-root">
      <GlobalStyles />
      <HeroSlider />
      <TrustBar />
      <CategorySection categories={Array.isArray(categoriesRaw) ? categoriesRaw : []} isLoading={catLoading} />
      <FeaturedCarousel products={Array.isArray(featured) ? featured : []} isLoading={featuredLoading} />
      <ArtisanBanner />
      <ExperienceAssamSection />
      <HeritageMarquee />
      <section style={{ padding: "24px 16px 20px", background: BG }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p className="ab-label"><IconLeafSmall /> NEW ARRIVALS</p>
            {/* ── 3. cin-title ── */}
            <h2 className="ab-h2 cin-title">Latest From Our <span>Artisans</span></h2>
          </div>
          <Link href="/products" className="ab-viewall">View All <IconArrowRight size={14} /></Link>
        </div>
        <NewArrivalsSection />
      </section>
      <TestimonialsSection />
      <RecentlyViewedSection />
    </div>
  );
}
