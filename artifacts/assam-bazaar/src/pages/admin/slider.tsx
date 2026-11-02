import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Eye, Save, RotateCcw, ChevronUp, ChevronDown, ImageIcon } from "lucide-react";

const DEFAULT_SLIDES = [
  { id: "1", badge: "Pride of Assam", title: "Assam Tea", titleAccent: "Gardens", subtitle: "From Assam's lush gardens to your cup — pure, rich & truly authentic.", ctaLabel: "Shop Assam Tea", ctaHref: "/products?category=assam-tea", ctaSecondaryLabel: "Explore Collection", ctaSecondaryHref: "/products", bgColor: "#1a3a1a", image: "https://images.unsplash.com/photo-1605618474884-e4adc4b8d099?w=1400&q=80", accent: "#d4a017" },
  { id: "2", badge: "Straight from Assam", title: "Awesome Assam", titleAccent: "TEA", subtitle: "From Assam's lush gardens to your cup — pure, rich & truly authentic.", ctaLabel: "Discover Now", ctaHref: "/products?category=assam-tea", ctaSecondaryLabel: "View All", ctaSecondaryHref: "/products", bgColor: "#4a0e0e", image: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=1400&q=80", accent: "#d4a017" },
  { id: "3", badge: "Cultural Heritage", title: "Traditional", titleAccent: "Gamusa", subtitle: "The sacred cloth of Assam — handwoven with love, gifted with pride.", ctaLabel: "Shop Gamusa", ctaHref: "/products?category=handloom", ctaSecondaryLabel: "Learn More", ctaSecondaryHref: "/products", bgColor: "#1a1a4a", image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400&q=80", accent: "#e8c84a" },
  { id: "4", badge: "Handloom Heritage", title: "Assamese", titleAccent: "Handloom", subtitle: "Centuries of weaving tradition — megh, muga, pat silk from master weavers.", ctaLabel: "Shop Handloom", ctaHref: "/products?category=handloom", ctaSecondaryLabel: "Meet Artisans", ctaSecondaryHref: "/products", bgColor: "#2a1a0a", image: "https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=1400&q=80", accent: "#d4a017" },
  { id: "5", badge: "Nature's Best", title: "Organic Assam", titleAccent: "Products", subtitle: "Chemical-free, farm-fresh organic produce straight from Assam's fertile lands.", ctaLabel: "Shop Organic", ctaHref: "/products?category=organic", ctaSecondaryLabel: "Explore All", ctaSecondaryHref: "/products", bgColor: "#0a2a1a", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&q=80", accent: "#7ec850" },
];

type Slide = typeof DEFAULT_SLIDES[0];

const BLANK_SLIDE: Slide = {
  id: Date.now().toString(),
  badge: "New Slide",
  title: "Your Title",
  titleAccent: "Here",
  subtitle: "Your subtitle text goes here. Describe your product or offer.",
  ctaLabel: "Shop Now",
  ctaHref: "/products",
  ctaSecondaryLabel: "View All",
  ctaSecondaryHref: "/products",
  bgColor: "#1a3a2a",
  image: "",
  accent: "#d4a017",
};

export default function SliderManager() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("hero_slides");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setSlides(parsed);
      }
    } catch {}
  }, []);

  function save() {
    localStorage.setItem("hero_slides", JSON.stringify(slides));
    // Notify home page on same tab — storage event only fires on OTHER tabs
    window.dispatchEvent(new Event("hero_slides_updated"));
    toast({ title: "✅ Slider saved!", description: "Changes are live on homepage." });
  }

  function reset() {
    if (!confirm("Reset to default slides?")) return;
    setSlides(DEFAULT_SLIDES);
    localStorage.removeItem("hero_slides");
    toast({ title: "Reset done", description: "Default slides restored." });
  }

  function addSlide() {
    const ns = { ...BLANK_SLIDE, id: Date.now().toString() };
    setSlides(p => [...p, ns]);
    setEditing(ns.id);
  }

  function deleteSlide(id: string) {
    if (slides.length <= 1) { toast({ title: "Need at least 1 slide", variant: "destructive" }); return; }
    if (!confirm("Delete this slide?")) return;
    setSlides(p => p.filter(s => s.id !== id));
    if (editing === id) setEditing(null);
  }

  function moveSlide(id: string, dir: -1 | 1) {
    setSlides(p => {
      const idx = p.findIndex(s => s.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= p.length) return p;
      const arr = [...p];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  function updateSlide(id: string, field: keyof Slide, val: string) {
    setSlides(p => p.map(s => s.id === id ? { ...s, [field]: val } : s));
  }

  const editingSlide = slides.find(s => s.id === editing);
  const previewSlide = slides.find(s => s.id === preview);

  return (
    <div className="page-enter p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Hero Slider Manager</h1>
          <p className="text-muted-foreground text-sm">{slides.length} slides • Changes saved to homepage instantly</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={save} className="gap-2 bg-primary">
            <Save className="h-4 w-4" /> Save & Publish
          </Button>
        </div>
      </div>

      {/* Slides list */}
      <div className="space-y-3">
        {slides.map((slide, idx) => (
          <Card key={slide.id} className={`transition-all duration-200 ${editing === slide.id ? "ring-2 ring-primary" : ""}`}>
            <CardContent className="p-4">
              {/* Slide header row */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveSlide(slide.id, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => moveSlide(slide.id, 1)} disabled={idx === slides.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>

                {/* Mini preview */}
                <div
                  className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 relative"
                  style={{ background: slide.bgColor }}
                >
                  {slide.image && (
                    <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  )}
                  <div className="absolute inset-0 flex items-end p-1">
                    <div style={{ width: "60%", height: 3, borderRadius: 2, background: slide.accent }} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{idx + 1}</Badge>
                    <p className="font-semibold text-sm truncate">{slide.title} <span style={{ color: slide.accent }}>{slide.titleAccent}</span></p>
                  </div>
                  <p className="text-muted-foreground text-xs truncate mt-0.5">{slide.subtitle}</p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setPreview(preview === slide.id ? null : slide.id)} className="h-8 w-8 p-0">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant={editing === slide.id ? "default" : "outline"} onClick={() => setEditing(editing === slide.id ? null : slide.id)} className="h-8 px-3 text-xs">
                    {editing === slide.id ? "Done" : "Edit"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteSlide(slide.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Preview */}
              {preview === slide.id && (
                <div className="mt-4 rounded-xl overflow-hidden" style={{ height: 200, position: "relative", background: slide.bgColor }}>
                  {slide.image && <img src={slide.image} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.35 }} />}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,.6) 0%, transparent 70%)" }} />
                  <div className="absolute inset-0 flex flex-col justify-center p-6">
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: slide.accent }}>{slide.badge}</p>
                    <h3 className="font-serif font-bold text-white text-2xl leading-tight">{slide.title}<br /><span style={{ color: slide.accent }}>{slide.titleAccent}</span></h3>
                    <p className="text-white/75 text-xs mt-2 max-w-xs">{slide.subtitle}</p>
                    <div className="flex gap-2 mt-3">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: slide.accent, color: "#1a1a1a" }}>{slide.ctaLabel}</span>
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ border: "1.5px solid rgba(255,255,255,.4)" }}>{slide.ctaSecondaryLabel}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit form */}
              {editing === slide.id && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-4">
                  {[
                    { label: "Badge Text", field: "badge" as keyof Slide },
                    { label: "Title", field: "title" as keyof Slide },
                    { label: "Title Accent (colored part)", field: "titleAccent" as keyof Slide },
                    { label: "Subtitle", field: "subtitle" as keyof Slide },
                    { label: "CTA Button Label", field: "ctaLabel" as keyof Slide },
                    { label: "CTA Button Link", field: "ctaHref" as keyof Slide },
                    { label: "Secondary Button Label", field: "ctaSecondaryLabel" as keyof Slide },
                    { label: "Secondary Button Link", field: "ctaSecondaryHref" as keyof Slide },
                    { label: "Image URL", field: "image" as keyof Slide },
                  ].map(({ label, field }) => (
                    <div key={field} className={field === "subtitle" || field === "image" ? "sm:col-span-2" : ""}>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
                      <Input
                        value={String(slide[field] ?? "")}
                        onChange={e => updateSlide(slide.id, field, e.target.value)}
                        className="h-8 text-sm"
                        placeholder={label}
                      />
                    </div>
                  ))}

                  {/* Color pickers */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Background Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={slide.bgColor} onChange={e => updateSlide(slide.id, "bgColor", e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-input" />
                      <Input value={slide.bgColor} onChange={e => updateSlide(slide.id, "bgColor", e.target.value)} className="h-8 text-sm flex-1" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Accent Color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={slide.accent} onChange={e => updateSlide(slide.id, "accent", e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-input" />
                      <Input value={slide.accent} onChange={e => updateSlide(slide.id, "accent", e.target.value)} className="h-8 text-sm flex-1" />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add slide */}
      <Button onClick={addSlide} variant="outline" className="w-full h-12 gap-2 border-dashed text-muted-foreground hover:text-foreground">
        <Plus className="h-4 w-4" /> Add New Slide
      </Button>

      {/* Save reminder */}
      <div className="flex items-center justify-between bg-muted/50 rounded-xl p-4">
        <div>
          <p className="font-semibold text-sm">Ready to publish?</p>
          <p className="text-muted-foreground text-xs">Click "Save & Publish" to make changes live on homepage</p>
        </div>
        <Button onClick={save} className="gap-2">
          <Save className="h-4 w-4" /> Save & Publish
        </Button>
      </div>
    </div>
  );
}
