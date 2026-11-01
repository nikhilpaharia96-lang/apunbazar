import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";

const CATEGORY_SLUGS = [
  { slug: "handloom", name: "Handloom & Textiles", emoji: "🧵" },
  { slug: "tea", name: "Assam Tea", emoji: "🍵" },
  { slug: "handicrafts", name: "Handicrafts", emoji: "🏺" },
  { slug: "organic", name: "Organic Food", emoji: "🌿" },
  { slug: "bags", name: "Bags & Accessories", emoji: "👜" },
];

const DEFAULT_CONFIGS: Record<string, any> = {
  handloom: {
    color: "#1a3a2e", accent: "#c9a84c",
    image: "https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=1400&q=80",
    banners: [
      { tag: "GI TAGGED AUTHENTIC", title: "Muga & Pat Silk", sub: "Woven by master artisans of Sualkuchi" },
      { tag: "HERITAGE COLLECTION", title: "Mekhela Chador", sub: "Traditional Assamese women's attire" },
      { tag: "GAMOSA SPECIAL", title: "Symbol of Assam", sub: "Gifted with love across generations" },
    ],
    featuredBanner: {
      enabled: true,
      label: "★ Best Selling Collection",
      title: "Heritage Handloom Edit",
      desc: "Handwoven · GI Tagged · Pure Quality",
      btnText: "Shop Now →",
      image: "https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=900&q=80",
    },
  },
  tea: {
    color: "#1a2e1a", accent: "#7ab648",
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=1400&q=80",
    banners: [
      { tag: "AWARD WINNING", title: "Assam Orthodox", sub: "Bold, malty, world-famous black tea" },
      { tag: "GARDEN FRESH", title: "First Flush 2026", sub: "Limited seasonal harvest — just arrived" },
      { tag: "WELLNESS BLEND", title: "Green & Herbal", sub: "Pure Assam herbs for mind & body" },
    ],
    featuredBanner: {
      enabled: true,
      label: "★ Best Selling Collection",
      title: "Premium Orthodox Assam Tea",
      desc: "Rich Aroma · Pure & Natural",
      btnText: "Shop Now →",
      image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=900&q=80",
    },
  },
  handicrafts: {
    color: "#2e1a0e", accent: "#c97a3a",
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400&q=80",
    banners: [
      { tag: "MASTER CRAFTSMEN", title: "Bamboo & Cane", sub: "Eco-friendly art from the forests of Assam" },
      { tag: "TRIBAL HERITAGE", title: "Masks & Pottery", sub: "Traditional Assamese folk art forms" },
      { tag: "HOME DÉCOR", title: "Handcrafted Wonders", sub: "Unique pieces for your living space" },
    ],
    featuredBanner: {
      enabled: true,
      label: "★ Best Selling Collection",
      title: "Artisan Handicraft Edit",
      desc: "Handcrafted · Eco-Friendly · Unique",
      btnText: "Shop Now →",
      image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=900&q=80",
    },
  },
  organic: {
    color: "#1e2e10", accent: "#82c341",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&q=80",
    banners: [
      { tag: "100% NATURAL", title: "Joha Rice", sub: "Fragrant heirloom rice from Assam's fields" },
      { tag: "COLD PRESSED", title: "Mustard Oil", sub: "Kachi ghani — traditional extraction method" },
      { tag: "FOREST HARVEST", title: "Wild Honey", sub: "Raw, unprocessed, straight from the hive" },
    ],
    featuredBanner: {
      enabled: true,
      label: "★ Best Selling Collection",
      title: "Farm Fresh Organic Pack",
      desc: "100% Natural · No Chemicals",
      btnText: "Shop Now →",
      image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=80",
    },
  },
  bags: {
    color: "#2e1a2e", accent: "#c97ac9",
    image: "https://images.unsplash.com/photo-1605618474884-e4adc4b8d099?w=1400&q=80",
    banners: [
      { tag: "SUSTAINABLE FASHION", title: "Jute & Cane Bags", sub: "Eco-chic accessories from Assam" },
      { tag: "HANDWOVEN", title: "Tribal Totes", sub: "Bold patterns, zero plastic" },
      { tag: "GIFTING SPECIAL", title: "Gift Hampers", sub: "Curated Assamese luxury gift sets" },
    ],
    featuredBanner: {
      enabled: true,
      label: "★ Best Selling Collection",
      title: "Sustainable Bag Edit",
      desc: "Eco-Chic · Zero Plastic",
      btnText: "Shop Now →",
      image: "https://images.unsplash.com/photo-1605618474884-e4adc4b8d099?w=900&q=80",
    },
  },
};

export default function CategoryBannerManager() {
  const [configs, setConfigs] = useState<Record<string, any>>(DEFAULT_CONFIGS);
  const [activeSlug, setActiveSlug] = useState<string>("handloom");
  const [expandedBanner, setExpandedBanner] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("category_configs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          // Merge defaults so older saved configs (without featuredBanner) still work
          const merged: Record<string, any> = {};
          for (const slug of Object.keys(DEFAULT_CONFIGS)) {
            merged[slug] = {
              ...DEFAULT_CONFIGS[slug],
              ...parsed[slug],
              featuredBanner: {
                ...DEFAULT_CONFIGS[slug].featuredBanner,
                ...(parsed[slug]?.featuredBanner ?? {}),
              },
            };
          }
          setConfigs(merged);
        }
      }
    } catch {}
  }, []);

  function save() {
    localStorage.setItem("category_configs", JSON.stringify(configs));
    window.dispatchEvent(new Event("category_config_updated"));
    toast({ title: "✅ Saved!", description: "Category banners updated live." });
  }

  function reset() {
    if (!confirm("Reset all categories to default?")) return;
    setConfigs(DEFAULT_CONFIGS);
    localStorage.removeItem("category_configs");
    window.dispatchEvent(new Event("category_config_updated"));
    toast({ title: "Reset done" });
  }

  function updateField(slug: string, field: string, value: string) {
    setConfigs(prev => ({ ...prev, [slug]: { ...prev[slug], [field]: value } }));
  }

  function updateBanner(slug: string, idx: number, field: string, value: string) {
    setConfigs(prev => {
      const banners = [...(prev[slug]?.banners ?? [])];
      banners[idx] = { ...banners[idx], [field]: value };
      return { ...prev, [slug]: { ...prev[slug], banners } };
    });
  }

  function updateFeaturedBanner(slug: string, field: string, value: string | boolean) {
    setConfigs(prev => ({
      ...prev,
      [slug]: {
        ...prev[slug],
        featuredBanner: { ...prev[slug]?.featuredBanner, [field]: value },
      },
    }));
  }

  const cfg = configs[activeSlug];
  const catInfo = CATEGORY_SLUGS.find(c => c.slug === activeSlug);
  const fb = cfg?.featuredBanner ?? {};

  return (
    <div className="page-enter p-3 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Category Banner Manager</h1>
          <p className="text-muted-foreground text-sm">Edit hero banner & featured collection banner for each category page</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" /> Reset All</Button>
          <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Save & Publish</Button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORY_SLUGS.map(cat => (
          <button
            key={cat.slug}
            onClick={() => { setActiveSlug(cat.slug); setExpandedBanner(null); setShowPreview(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeSlug === cat.slug
                ? "bg-primary text-white shadow-md"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            <span>{cat.emoji}</span> {cat.name}
          </button>
        ))}
      </div>

      {/* Editor */}
      {cfg && (
        <Card>
          <CardContent className="p-3 sm:p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{catInfo?.emoji} {catInfo?.name}</h2>
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-2">
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPreview ? "Hide" : "Preview"}
              </Button>
            </div>

            {/* Live Preview — Hero */}
            {showPreview && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Hero Banner Preview</p>
                <div className="rounded-xl overflow-hidden" style={{ height: 200, position: "relative", background: `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.color}cc 100%)` }}>
                  {cfg.image && <img src={cfg.image} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.45 }} />}
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${cfg.color}99 0%, ${cfg.color}44 100%)` }} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6">
                    <div style={{ background: "rgba(255,255,255,.15)", border: `1px solid ${cfg.accent}60`, borderRadius: 100, padding: "3px 14px", fontSize: 9, letterSpacing: 3, color: cfg.accent, fontWeight: 700 }}>
                      ✦ {cfg.banners[0]?.tag} ✦
                    </div>
                    <div style={{ fontFamily: "serif", fontSize: 28, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{cfg.banners[0]?.title}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>{cfg.banners[0]?.sub}</div>
                    <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                      {["PRODUCTS", "ARTISANS", "GI CERTIFIED"].map(s => (
                        <div key={s} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: cfg.accent }}>500+</div>
                          <div style={{ fontSize: 8, color: "rgba(255,255,255,.5)", letterSpacing: 1 }}>{s}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Preview — Featured Collection */}
                {fb.enabled && (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 mt-4 uppercase tracking-wider">Featured Collection Banner Preview</p>
                    <div className="rounded-xl overflow-hidden" style={{ position: "relative", background: cfg.color, minHeight: 130, display: "flex", alignItems: "center" }}>
                      {fb.image && <img src={fb.image} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.35 }} />}
                      <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, ${cfg.color}f0 30%, ${cfg.color}66 100%)` }} />
                      <div className="relative p-5">
                        <div style={{ fontSize: 11, color: cfg.accent, fontWeight: 700, marginBottom: 6 }}>{fb.label}</div>
                        <div style={{ fontFamily: "serif", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{fb.title}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginBottom: 10 }}>{fb.desc}</div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.accent, padding: "6px 14px", borderRadius: 6 }}>{fb.btnText}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── HERO BANNER FIELDS ── */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Hero Banner (top of page)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Background Image URL</label>
                  <div className="flex gap-2">
                    {cfg.image && <img src={cfg.image} alt="" className="w-16 h-10 rounded object-cover flex-shrink-0 border" />}
                    <Input value={cfg.image ?? ""} onChange={e => updateField(activeSlug, "image", e.target.value)} className="h-10 text-sm" placeholder="https://images.unsplash.com/..." />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Quick picks: &nbsp;
                    {[
                      { label: "Tea Garden", url: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=1400&q=80" },
                      { label: "Handloom", url: "https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=1400&q=80" },
                      { label: "Organic", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&q=80" },
                      { label: "Handicraft", url: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400&q=80" },
                    ].map(p => (
                      <span key={p.label} className="cursor-pointer text-primary hover:underline mr-2" onClick={() => updateField(activeSlug, "image", p.url)}>{p.label}</span>
                    ))}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Background Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={cfg.color} onChange={e => updateField(activeSlug, "color", e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                    <Input value={cfg.color} onChange={e => updateField(activeSlug, "color", e.target.value)} className="h-10 text-sm flex-1" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={cfg.accent} onChange={e => updateField(activeSlug, "accent", e.target.value)} className="w-10 h-10 rounded cursor-pointer border" />
                    <Input value={cfg.accent} onChange={e => updateField(activeSlug, "accent", e.target.value)} className="h-10 text-sm flex-1" />
                  </div>
                </div>
              </div>
            </div>

            {/* Rotating banners */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-3 block uppercase tracking-wider">Rotating Banners ({cfg.banners?.length})</label>
              <div className="space-y-2">
                {cfg.banners?.map((banner: any, idx: number) => (
                  <div key={idx} className={`border rounded-xl overflow-hidden transition-all ${expandedBanner === idx ? "ring-2 ring-primary" : ""}`}>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedBanner(expandedBanner === idx ? null : idx)}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: cfg.color }}>{idx + 1}</div>
                        <div>
                          <p className="font-semibold text-sm">{banner.title}</p>
                          <p className="text-muted-foreground text-xs">{banner.tag}</p>
                        </div>
                      </div>
                      {expandedBanner === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>

                    {expandedBanner === idx && (
                      <div className="p-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: "Tag (small top text)", field: "tag" },
                          { label: "Title (big text)", field: "title" },
                          { label: "Subtitle", field: "sub" },
                        ].map(({ label, field }) => (
                          <div key={field} className={field === "sub" ? "sm:col-span-2" : ""}>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
                            <Input value={banner[field] ?? ""} onChange={e => updateBanner(activeSlug, idx, field, e.target.value)} className="h-8 text-sm" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── FEATURED COLLECTION BANNER ── */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-muted-foreground block uppercase tracking-wider">Featured Collection Banner (mid-page "Shop Now" banner)</label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fb.enabled ?? true}
                    onChange={e => updateFeaturedBanner(activeSlug, "enabled", e.target.checked)}
                    className="h-4 w-4 cursor-pointer"
                  />
                  Show on category page
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Banner Image URL</label>
                  <div className="flex gap-2">
                    {fb.image && <img src={fb.image} alt="" className="w-16 h-10 rounded object-cover flex-shrink-0 border" />}
                    <Input value={fb.image ?? ""} onChange={e => updateFeaturedBanner(activeSlug, "image", e.target.value)} className="h-10 text-sm" placeholder="https://images.unsplash.com/..." />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Label (small text, e.g. ★ Best Selling Collection)</label>
                  <Input value={fb.label ?? ""} onChange={e => updateFeaturedBanner(activeSlug, "label", e.target.value)} className="h-9 text-sm" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Button Text</label>
                  <Input value={fb.btnText ?? ""} onChange={e => updateFeaturedBanner(activeSlug, "btnText", e.target.value)} className="h-9 text-sm" placeholder="Shop Now →" />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Title</label>
                  <Input value={fb.title ?? ""} onChange={e => updateFeaturedBanner(activeSlug, "title", e.target.value)} className="h-9 text-sm" />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Description</label>
                  <Input value={fb.desc ?? ""} onChange={e => updateFeaturedBanner(activeSlug, "desc", e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex items-center justify-between bg-muted/50 rounded-xl p-4">
        <div>
          <p className="font-semibold text-sm">Ready to publish?</p>
          <p className="text-muted-foreground text-xs">Changes go live on all category pages instantly</p>
        </div>
        <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Save & Publish</Button>
      </div>
    </div>
  );
}
