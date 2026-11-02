import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Plus, Trash2, ChevronUp, ChevronDown, Eye } from "lucide-react";

const DEFAULT_BANNERS = [
  { id: "1", label: "CELEBRATING ASSAM'S", title: "Timeless Crafts", desc: "Handpicked from 500+ master artisans", bg: "linear-gradient(135deg,#1a4a2e,#2d7a50,#1a4a2e)", btnText: "EXPLORE NOW →", btnLink: "/products", image: "" },
  { id: "2", label: "PURE ASSAM TEA", title: "Garden Fresh", desc: "Award-winning orthodox varieties", bg: "linear-gradient(135deg,#2d4a1a,#4a7a2d,#2d4a1a)", btnText: "SHOP TEA →", btnLink: "/products?category=assam-tea", image: "" },
  { id: "3", label: "HERITAGE HANDLOOM", title: "Muga & Pat Silk", desc: "GI tagged authentic Assamese weaves", bg: "linear-gradient(135deg,#3a2d1a,#7a5a2d,#3a2d1a)", btnText: "VIEW HANDLOOM →", btnLink: "/products?category=handloom", image: "" },
];

type Banner = typeof DEFAULT_BANNERS[0];

export default function BannerManager() {
  const [banners, setBanners] = useState<Banner[]>(DEFAULT_BANNERS);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("products_banners");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setBanners(parsed);
      }
    } catch {}
  }, []);

  function save() {
    localStorage.setItem("products_banners", JSON.stringify(banners));
    toast({ title: "✅ Banners saved!", description: "Changes are live on Products page." });
  }

  function reset() {
    if (!confirm("Reset to default banners?")) return;
    setBanners(DEFAULT_BANNERS);
    localStorage.removeItem("products_banners");
    toast({ title: "Reset done" });
  }

  function addBanner() {
    const nb: Banner = { id: Date.now().toString(), label: "NEW BANNER", title: "Your Title", desc: "Your description here", bg: "linear-gradient(135deg,#1a4a2e,#2d7a50)", btnText: "EXPLORE →", btnLink: "/products", image: "" };
    setBanners(p => [...p, nb]);
    setEditing(nb.id);
  }

  function deleteBanner(id: string) {
    if (banners.length <= 1) { toast({ title: "Need at least 1 banner", variant: "destructive" }); return; }
    if (!confirm("Delete this banner?")) return;
    setBanners(p => p.filter(b => b.id !== id));
    if (editing === id) setEditing(null);
  }

  function move(id: string, dir: -1 | 1) {
    setBanners(p => {
      const idx = p.findIndex(b => b.id === id);
      const ni = idx + dir;
      if (ni < 0 || ni >= p.length) return p;
      const arr = [...p];
      [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
      return arr;
    });
  }

  function update(id: string, field: keyof Banner, val: string) {
    setBanners(p => p.map(b => b.id === id ? { ...b, [field]: val } : b));
  }

  return (
    <div className="page-enter p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold">Products Page Banners</h1>
          <p className="text-muted-foreground text-sm">{banners.length} banners • Auto-rotates every 3.8s</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" /> Reset</Button>
          <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Save & Publish</Button>
        </div>
      </div>

      <div className="space-y-3">
        {banners.map((banner, idx) => (
          <Card key={banner.id} className={`transition-all ${editing === banner.id ? "ring-2 ring-primary" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* Order controls */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(banner.id, -1)} disabled={idx === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button onClick={() => move(banner.id, 1)} disabled={idx === banners.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>

                {/* Mini preview */}
                <div className="w-16 h-12 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ background: banner.bg }}>
                  <span className="text-white text-xs font-bold text-center leading-tight px-1" style={{ fontSize: 8 }}>{banner.title}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{banner.title}</p>
                  <p className="text-muted-foreground text-xs truncate">{banner.label} • {banner.desc}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setPreview(preview === banner.id ? null : banner.id)} className="h-8 w-8 p-0"><Eye className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant={editing === banner.id ? "default" : "outline"} onClick={() => setEditing(editing === banner.id ? null : banner.id)} className="h-8 px-3 text-xs">
                    {editing === banner.id ? "Done" : "Edit"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteBanner(banner.id)} className="h-8 w-8 p-0 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              {/* Preview */}
              {preview === banner.id && (
                <div className="mt-4 rounded-xl overflow-hidden flex flex-col items-center justify-center text-center gap-2 p-6" style={{ height: 160, background: banner.bg }}>
                  {banner.image && (
  <img src={banner.image} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.35 }} />
)}
                  <div style={{ background: "rgba(201,168,76,.2)", border: "1px solid rgba(201,168,76,.5)", borderRadius: 100, padding: "3px 12px", fontSize: 9, letterSpacing: 3, color: "#f0d080", fontWeight: 600 }}>✦ APUNBAZAR PREMIUM ✦</div>
                  <div style={{ fontSize: 9, letterSpacing: 3, color: "rgba(240,220,140,.8)", fontWeight: 600 }}>{banner.label}</div>
                  <div style={{ fontFamily: "serif", fontSize: 24, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{banner.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.65)" }}>{banner.desc}</div>
                  <div style={{ background: "linear-gradient(135deg,#c9a84c,#a8883c)", borderRadius: 100, padding: "6px 18px", color: "#fff", fontSize: 10, fontWeight: 700 }}>{banner.btnText}</div>
                </div>
              )}

              {/* Edit form */}
              {editing === banner.id && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-4">
                  {[
                    { label: "Label (small top text)", field: "label" as keyof Banner },
                    { label: "Title (big text)", field: "title" as keyof Banner },
                    { label: "Description", field: "desc" as keyof Banner },
                    { label: "Button Text", field: "btnText" as keyof Banner },
                    { label: "Image URL (optional — paste Unsplash/any URL)", field: "image" as keyof Banner },
                  ].map(({ label, field }) => (
                    <div key={field} className={field === "desc" ? "sm:col-span-2" : ""}>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</label>
                      <Input value={String(banner[field] ?? "")} onChange={e => update(banner.id, field, e.target.value)} className="h-8 text-sm" />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Background Gradient (CSS)</label>
                    <div className="flex gap-2 items-center">
                      <div className="w-10 h-8 rounded flex-shrink-0" style={{ background: banner.bg }} />
                      <Input value={banner.bg} onChange={e => update(banner.id, "bg", e.target.value)} className="h-8 text-sm flex-1" placeholder="linear-gradient(...)" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Quick colors: <span className="cursor-pointer text-primary" onClick={() => update(banner.id, "bg", "linear-gradient(135deg,#1a4a2e,#2d7a50,#1a4a2e)")}>Green</span> · <span className="cursor-pointer text-primary" onClick={() => update(banner.id, "bg", "linear-gradient(135deg,#4a0e0e,#7a1a1a,#4a0e0e)")}>Red</span> · <span className="cursor-pointer text-primary" onClick={() => update(banner.id, "bg", "linear-gradient(135deg,#1a1a4a,#2d2d7a,#1a1a4a)")}>Blue</span> · <span className="cursor-pointer text-primary" onClick={() => update(banner.id, "bg", "linear-gradient(135deg,#3a2d1a,#7a5a2d,#3a2d1a)")}>Brown</span></p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={addBanner} variant="outline" className="w-full h-12 gap-2 border-dashed text-muted-foreground">
        <Plus className="h-4 w-4" /> Add New Banner
      </Button>

      <div className="flex items-center justify-between bg-muted/50 rounded-xl p-4">
        <div>
          <p className="font-semibold text-sm">Ready to publish?</p>
          <p className="text-muted-foreground text-xs">Changes go live on Products page instantly</p>
        </div>
        <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Save & Publish</Button>
      </div>
    </div>
  );
}
