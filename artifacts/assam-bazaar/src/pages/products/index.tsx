import { useState, useEffect, useRef } from "react";
import { useSEO } from "@/hooks/use-seo";
import { imgProps } from "@/lib/img";
import { useLocation } from "wouter";
import { trackSearch } from "@/lib/analytics";

interface MainCategory { id: number; name: string; slug: string; imageUrl?: string; }
interface SubCategory  { id: number; name: string; slug: string; mainCategoryId: number; imageUrl?: string; }
interface ChildCategory{ id: number; name: string; slug: string; subCategoryId: number; }

interface Product {
  id: number; name: string; slug: string; description?: string;
  price: string | number; originalPrice?: string | number;
  imageUrl?: string; image_url?: string;
  categoryId?: number; category_id?: number;
  stock?: number; featured?: boolean;
  artisan?: string; origin?: string; rating?: string | number;
}

const CAT_ICONS: Record<string, string> = {
  all: "🏪", handloom: "🧵", tea: "🍵", handicrafts: "🏺",
  organic: "🌿", bags: "👜", gamusa: "🎀", silk: "✨", jewelry: "💎",
};
const FALLBACK_IMG = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=70";
const G = "#1a5a32";
const GOLD = "#c9a84c";

const DEFAULT_BANNERS = [
  { id: "1", label: "CELEBRATING ASSAM'S", title: "Timeless Crafts", desc: "Handpicked from 500+ master artisans", bg: `linear-gradient(135deg,#0d2e18,#1a5a32)`, btnText: "EXPLORE NOW", btnLink: "/products", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&q=70" },
  { id: "2", label: "PURE ASSAM TEA", title: "Garden Fresh", desc: "Award-winning orthodox varieties", bg: `linear-gradient(135deg,#0d2010,#2d6a1a)`, btnText: "SHOP TEA", btnLink: "/products?category=assam-tea", image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&q=70" },
  { id: "3", label: "HERITAGE HANDLOOM", title: "Muga & Pat Silk", desc: "GI tagged authentic Assamese weaves", bg: `linear-gradient(135deg,#2e1a0a,#7a4a1a)`, btnText: "VIEW HANDLOOM", btnLink: "/products?category=handloom", image: "https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=800&q=70" },
];

const SORT_OPTIONS = [
  { label: "Relevance", value: "relevance" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Newest First", value: "newest" },
  { label: "Top Rated", value: "rating" },
];

function useProductBanners() {
  const [banners, setBanners] = useState(DEFAULT_BANNERS);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("products_banners");
      if (saved) { const p = JSON.parse(saved); if (Array.isArray(p) && p.length) setBanners(p); }
    } catch {}
  }, []);
  return banners;
}

function toNum(v: string | number | undefined): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}
function discountPct(p: number, o: number) { return (!o || o <= p) ? 0 : Math.round((1 - p / o) * 100); }

function Stars({ r }: { r: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.round(r) ? "#f59e0b" : "#e0d8c0"}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
      <span style={{ fontSize: 10, color: "#4b5563", marginLeft: 3, fontFamily: "'Nunito',sans-serif" }}>{r.toFixed(1)}</span>
    </div>
  );
}

function sortProducts(products: Product[], sort: string): Product[] {
  const arr = [...products];
  if (sort === "price_asc") return arr.sort((a, b) => toNum(a.price) - toNum(b.price));
  if (sort === "price_desc") return arr.sort((a, b) => toNum(b.price) - toNum(a.price));
  if (sort === "rating") return arr.sort((a, b) => toNum(b.rating) - toNum(a.rating));
  if (sort === "newest") return arr.reverse();
  return arr;
}

export default function Products() {
  useSEO({ title: "Shop All Assamese Products", description: "Browse Assam tea, handloom, gamusa, bamboo & cane crafts and traditional foods. Authentic, artisan-made, delivered across India." });
  const [, navigate] = useLocation();
  const BANNERS = useProductBanners();
  const bannerScrollRef = useRef<HTMLDivElement>(null);

  const [mainCats, setMainCats]         = useState<MainCategory[]>([]);
  const [subCats, setSubCats]           = useState<SubCategory[]>([]);
  const [childCats, setChildCats]       = useState<ChildCategory[]>([]);
  const [activeMain, setActiveMain]     = useState<string>("all");
  const [activeSub, setActiveSub]       = useState<number | null>(null);
  const [activeChild, setActiveChild]   = useState<number | null>(null);
  const [expandedMain, setExpandedMain] = useState<number | null>(null);
  const [products, setProducts]         = useState<Product[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [wishlist, setWishlist]         = useState<Set<number>>(new Set());
  const [cartPops, setCartPops]         = useState<Set<number>>(new Set());
  const [bannerIdx, setBannerIdx]       = useState(0);
  const [sortBy, setSortBy]             = useState("relevance");
  const [showSort, setShowSort]         = useState(false);
  const [showFilter, setShowFilter]     = useState(false);
  const [priceRange, setPriceRange]     = useState<[number, number]>([0, 10000]);
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [viewMode, setViewMode]         = useState<"grid2" | "grid1">("grid2");

  useEffect(() => {
    fetch("/api/categories/main").then(r => r.json()).then(d => setMainCats(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/categories/sub").then(r => r.json()).then(d => setSubCats(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/categories/child").then(r => r.json()).then(d => setChildCats(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (activeChild !== null) p.set("childCategoryId", String(activeChild));
    else if (activeSub !== null) p.set("subCategoryId", String(activeSub));
    else if (activeMain !== "all") p.set("category", activeMain);
    fetch(`/api/products?${p}`).then(r => r.json())
      .then(d => { setProducts(Array.isArray(d) ? d : d?.products ?? []); setLoading(false); })
      .catch(() => { setProducts([]); setLoading(false); });
      if (search.length >= 3) trackSearch(search);
  }, [activeMain, activeSub, activeChild, search]);

  useEffect(() => {
    if (!BANNERS.length) return;
    const t = setInterval(() => {
      const next = (bannerIdx + 1) % BANNERS.length;
      setBannerIdx(next);
      bannerScrollRef.current?.scrollTo({ left: next * (bannerScrollRef.current?.offsetWidth ?? 0), behavior: "smooth" });
    }, 4000);
    return () => clearInterval(t);
  }, [bannerIdx, BANNERS.length]);

  function selectMain(cat: MainCategory) {
    if (activeMain === cat.slug && expandedMain === cat.id) {
      setExpandedMain(null); setActiveMain("all"); setActiveSub(null); setActiveChild(null);
    } else {
      setActiveMain(cat.slug); setExpandedMain(cat.id); setActiveSub(null); setActiveChild(null);
    }
  }
  function selectAll() { setActiveMain("all"); setExpandedMain(null); setActiveSub(null); setActiveChild(null); }
  function toggleWish(id: number) { setWishlist(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function addToCart(id: number) {
    setCartPops(prev => new Set([...prev, id]));
    setTimeout(() => setCartPops(prev => { const n = new Set(prev); n.delete(id); return n; }), 1500);
  }

  const activeChildObj = childCats.find(c => c.id === activeChild);
  const activeSubObj   = subCats.find(s => s.id === activeSub);
  const activeMainObj  = mainCats.find(m => m.slug === activeMain);
  const sectionLabel   = activeChildObj?.name ?? activeSubObj?.name ?? activeMainObj?.name ?? "All Products";

  const displayedProducts = sortProducts(
    products.filter(p => {
      const price = toNum(p.price);
      if (price < priceRange[0] || price > priceRange[1]) return false;
      if (onlyDiscount && discountPct(price, toNum(p.originalPrice)) < 1) return false;
      return true;
    }),
    sortBy
  );

  const activeFiltersCount = (onlyDiscount ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < 10000 ? 1 : 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Nunito:wght@300;400;500;600;700&display=swap');
        @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes cardIn     { 0%{opacity:0;transform:translateY(10px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes slideUp    { 0%{opacity:0;transform:translateY(100%)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn     { 0%{opacity:0} 100%{opacity:1} }
        @keyframes scanLine   { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
        @keyframes cartBounce { 0%{transform:scale(.8)} 60%{transform:scale(1.2)} 100%{transform:scale(1)} }
        * { box-sizing: border-box; }

        /* SEARCH */
        .p-topbar { position:sticky; top:0; z-index:50; background:#fff; border-bottom:1px solid #f0ece4; padding:10px 14px; }
        .p-search  { display:flex; align-items:center; gap:8px; background:#f5f5f7; border-radius:10px; padding:9px 12px; transition:all .2s; border:1.5px solid transparent; }
        .p-search.focused { background:#fff; border-color:${G}44; box-shadow:0 0 0 3px ${G}10; }
        .p-search input { flex:1; background:none; border:none; outline:none; font-size:13px; color:#1a2d1a; font-family:'Nunito',sans-serif; }
        .p-search input::placeholder { color:#4b5563; }

        /* BANNER */
        .p-banner-scroll { display:flex; overflow-x:hidden; scroll-snap-type:x mandatory; }
        .p-banner-slide  { flex-shrink:0; width:100%; height:195px; position:relative; overflow:hidden; scroll-snap-align:start; }
        .p-banner-slide img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform 8s ease; }
        .p-banner-dots   { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:5px; z-index:3; }
        .p-banner-dot    { height:4px; border-radius:2px; cursor:pointer; transition:all .35s; border:none; padding:0; }

        /* CATEGORY TABS */
        .p-cat-bar { display:flex; overflow-x:auto; scrollbar-width:none; background:#fff; border-bottom:1.5px solid #f0ece4; padding:4px 0 0; }
        .p-cat-bar::-webkit-scrollbar { display:none; }
        .p-cat-tab { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 12px 10px; flex-shrink:0; border:none; background:none; cursor:pointer; position:relative; min-width:64px; }
        .p-cat-tab .icon  { font-size:22px; }
        .p-cat-tab .label { font-size:10px; font-weight:600; color:#4b5563; white-space:nowrap; font-family:'Nunito',sans-serif; transition:color .2s; }
        .p-cat-tab.active .label { color:${G}; font-weight:700; }
        .p-cat-tab.active::after { content:''; position:absolute; bottom:0; left:18%; right:18%; height:2.5px; background:${G}; border-radius:2px 2px 0 0; }
        .p-cat-img { width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid #f0ece4; transition:border-color .2s; }
        .p-cat-tab.active .p-cat-img { border-color:${G}; }

        /* SUB CHIPS */
        .p-sub-bar { display:flex; gap:8px; padding:8px 14px; overflow-x:auto; scrollbar-width:none; background:#faf8f4; border-bottom:1px solid #f0ece4; }
        .p-sub-bar::-webkit-scrollbar { display:none; }
        .p-chip { padding:5px 14px; border-radius:20px; border:1.5px solid #e0d8c0; background:#fff; font-size:11px; font-weight:600; color:#555; cursor:pointer; white-space:nowrap; font-family:'Nunito',sans-serif; transition:all .18s; flex-shrink:0; }
        .p-chip.active { background:${G}; color:#fff; border-color:${G}; }
        .p-child-chip { padding:4px 12px; border-radius:14px; border:1px solid #e0d8c0; background:#fff; font-size:10.5px; font-weight:600; color:#666; cursor:pointer; white-space:nowrap; font-family:'Nunito',sans-serif; transition:all .18s; flex-shrink:0; }
        .p-child-chip.active { background:${GOLD}; color:#111; border-color:${GOLD}; }

        /* TOOLBAR */
        .p-toolbar  { display:flex; align-items:center; background:#fff; border-bottom:1.5px solid #f0ece4; }
        .p-tool-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:11px 0; font-size:11.5px; font-weight:700; color:#555; font-family:'Nunito',sans-serif; cursor:pointer; border:none; background:none; letter-spacing:.4px; transition:color .2s; }
        .p-tool-btn:not(:last-child) { border-right:1px solid #f0ece4; }
        .p-tool-btn.active { color:${G}; }
        .p-badge { background:${G}; color:#fff; border-radius:50%; width:15px; height:15px; font-size:8px; font-weight:700; display:flex; align-items:center; justify-content:center; }

        /* RESULTS BAR */
        .p-results       { padding:9px 14px; background:#fff; border-bottom:1px solid #f0f0f0; display:flex; align-items:center; justify-content:space-between; }
        .p-results-label { font-size:11.5px; color:#4b5563; font-family:'Nunito',sans-serif; }
        .p-results-label strong { color:#1a2d1a; }
        .p-view-btns { display:flex; gap:5px; }
        .p-view-btn  { width:28px; height:28px; border:1.5px solid #e0d8c0; border-radius:6px; background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
        .p-view-btn.active { border-color:${G}; background:${G}; color:#fff; }

        /* BREADCRUMB */
        .p-breadcrumb { display:flex; align-items:center; gap:4px; padding:7px 14px; background:#faf8f4; border-bottom:1px solid #f0ece4; flex-wrap:wrap; }
        .p-breadcrumb span { font-size:10.5px; color:#4b5563; font-family:'Nunito',sans-serif; cursor:pointer; }
        .p-breadcrumb span:hover { color:${G}; }
        .p-breadcrumb .cur { color:#1a2d1a; font-weight:700; cursor:default; }
        .p-breadcrumb .sep { color:#ddd; }

        /* GRID */
        .p-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px 12px 90px; background:#f5f2ed; }
        .p-grid1 { display:grid; grid-template-columns:1fr;   gap:12px; padding:12px 12px 90px; background:#f5f2ed; }

        /* PRODUCT CARD — reference screenshot style */
        .p-card {
          background:#fff; border-radius:16px; overflow:hidden;
          cursor:pointer; animation:cardIn .32s ease both; position:relative;
          box-shadow:0 2px 12px rgba(0,0,0,0.07);
          transition:box-shadow .25s, transform .25s;
        }
        .p-card:hover  { box-shadow:0 8px 28px rgba(0,0,0,0.13); transform:translateY(-2px); }
        .p-card:active { transform:scale(.98); opacity:.97; }

        .p-img-wrap { position:relative; overflow:hidden; background:#f8f6f2; }
        .p-img { width:100%; object-fit:cover; display:block; transition:transform .55s cubic-bezier(.16,1,.3,1); }
        .p-card:hover .p-img { transform:scale(1.06); }

        /* discount badge — pill, top-left */
        .p-disc-badge {
          position:absolute; top:10px; left:10px; z-index:2;
          background:#c62828; color:#fff;
          font-size:10px; font-weight:800; padding:3px 9px;
          border-radius:20px; font-family:'Nunito',sans-serif; letter-spacing:.3px;
        }
        .p-feat-badge {
          position:absolute; top:10px; left:10px; z-index:2;
          background:${G}; color:#fff;
          font-size:10px; font-weight:800; padding:3px 9px;
          border-radius:20px; font-family:'Nunito',sans-serif;
        }

        /* wishlist heart btn */
        .p-wish {
          position:absolute; top:10px; right:10px; z-index:2;
          width:32px; height:32px; border-radius:50%;
          background:rgba(255,255,255,.92); border:1.5px solid rgba(0,0,0,.08);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; backdrop-filter:blur(4px); transition:all .2s;
          box-shadow:0 2px 8px rgba(0,0,0,.1);
        }
        .p-wish:hover { transform:scale(1.12); }
        .p-wish.on { background:#fff0f3; border-color:#fecdd3; }

        /* artisan name overlay on image bottom */
        .p-artisan-bar {
          position:absolute; bottom:0; left:0; right:0; z-index:1;
          background:linear-gradient(to top, rgba(0,0,0,.52) 0%, transparent 100%);
          padding:22px 10px 8px;
        }
        .p-artisan-name {
          font-size:10.5px; font-weight:700; color:rgba(255,255,255,.92);
          font-family:'Nunito',sans-serif; display:flex; align-items:center; gap:4px;
        }

        /* card body */
        .p-info  { padding:10px 12px 12px; }
        .p-pname {
          font-size:13px; font-weight:700; color:#111; margin-bottom:5px;
          font-family:'Nunito',sans-serif; line-height:1.4;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
        }
        .p-origin {
          font-size:10px; color:#4b5563; margin-bottom:6px;
          font-family:'Nunito',sans-serif; display:flex; align-items:center; gap:3px;
        }
        .p-stars-row { margin-bottom:8px; }
        .p-price-row { display:flex; align-items:baseline; gap:5px; flex-wrap:wrap; margin-bottom:10px; }
        .p-price { font-size:16px; font-weight:800; color:#111; font-family:'Nunito',sans-serif; }
        .p-orig  { font-size:11px; color:#4b5563; text-decoration:line-through; font-family:'Nunito',sans-serif; }
        .p-disc  { font-size:10.5px; font-weight:700; color:#c62828; font-family:'Nunito',sans-serif; }

        /* ADD TO CART — outlined dark button, matches reference */
        .p-add-btn {
          width:100%; padding:9px 0;
          border:1.5px solid #1a2d1a; border-radius:8px;
          background:#fff; color:#1a2d1a;
          font-size:10.5px; font-weight:800; letter-spacing:.8px;
          font-family:'Nunito',sans-serif; cursor:pointer;
          display:flex; align-items:center; justify-content:center; gap:6px;
          transition:all .22s cubic-bezier(.34,1.56,.64,1);
        }
        .p-add-btn:hover { background:#1a2d1a; color:#fff; }
        .p-add-btn.done  { background:${G}; color:#fff; border-color:${G}; animation:cartBounce .4s cubic-bezier(.34,1.56,.64,1); }

        /* SKELETON */
        .p-skel { background:linear-gradient(90deg,#f0ede6 25%,#e8e4da 50%,#f0ede6 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }

        /* BOTTOM SHEETS */
        .p-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:100; animation:fadeIn .2s ease; }
        .p-sheet   { position:fixed; bottom:0; left:0; right:0; background:#fff; border-radius:20px 20px 0 0; z-index:101; animation:slideUp .25s ease; max-height:72vh; overflow-y:auto; }
        .p-sheet-handle { width:36px; height:4px; background:#e0d8c0; border-radius:2px; margin:12px auto 4px; }
        .p-sheet-title  { padding:10px 20px 12px; font-size:11px; font-weight:700; color:#4b5563; letter-spacing:1.5px; font-family:'Nunito',sans-serif; border-bottom:1px solid #f0ece4; }
        .p-sort-opt { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; font-size:13.5px; color:#282c3f; font-family:'Nunito',sans-serif; cursor:pointer; border-bottom:1px solid #f8f5f0; transition:background .15s; }
        .p-sort-opt:hover { background:#faf8f4; }
        .p-sort-opt.active { color:${G}; font-weight:700; }
        .p-radio { width:18px; height:18px; border-radius:50%; border:2px solid #d4d5d9; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:border-color .2s; }
        .p-radio.active { border-color:${G}; }
        .p-radio.active::after { content:''; width:9px; height:9px; border-radius:50%; background:${G}; display:block; }

        /* FILTER SHEET */
        .p-filter-wrap    { display:flex; height:65vh; }
        .p-filter-sidebar { width:110px; background:#faf8f4; border-right:1px solid #f0ece4; overflow-y:auto; }
        .p-filter-sec     { padding:14px 12px; font-size:12px; font-weight:700; color:#4b5563; font-family:'Nunito',sans-serif; cursor:pointer; border-bottom:1px solid #f0ece4; transition:all .15s; }
        .p-filter-sec.active { background:#fff; border-left:3px solid ${G}; color:${G}; }
        .p-filter-body { flex:1; padding:16px; overflow-y:auto; }
        .p-filter-lbl  { font-size:10.5px; color:#4b5563; font-family:'Nunito',sans-serif; margin-bottom:10px; font-weight:700; letter-spacing:1px; }
        .p-filter-row  { display:flex; align-items:center; gap:8px; padding:9px 0; font-size:12.5px; color:#282c3f; font-family:'Nunito',sans-serif; cursor:pointer; border-bottom:1px solid #f8f5f0; }
        .p-chk         { width:17px; height:17px; border:1.5px solid #d4d5d9; border-radius:4px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:9px; transition:all .15s; }
        .p-chk.on      { background:${G}; border-color:${G}; color:#fff; }
        .p-filter-footer { display:flex; gap:10px; padding:14px 16px; border-top:1px solid #f0ece4; background:#fff; }
        .p-filter-clear  { flex:1; padding:11px; border:1.5px solid #e0d8c0; border-radius:8px; background:#fff; font-size:12px; font-weight:700; color:#555; cursor:pointer; font-family:'Nunito',sans-serif; }
        .p-filter-apply  { flex:2; padding:11px; border:none; border-radius:8px; background:${G}; font-size:12px; font-weight:700; color:#fff; cursor:pointer; font-family:'Nunito',sans-serif; }

        /* EMPTY */
        .p-empty { padding:60px 20px; text-align:center; background:#fff; border-radius:16px; grid-column:1/-1; }
      `}</style>

      {/* ── SEARCH BAR ── */}
      <div className="p-topbar">
        <div className={`p-search${searchFocused ? " focused" : ""}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Search products, brands and more"
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#4b5563", lineHeight:1, padding:0 }}>×</button>
          )}
        </div>
      </div>

      {/* ── HERO BANNER ── */}
      <div style={{ position:"relative" }}>
        <div ref={bannerScrollRef} className="p-banner-scroll"
          onScroll={e => {
            const el = e.currentTarget;
            setBannerIdx(Math.round(el.scrollLeft / el.offsetWidth));
          }}>
          {BANNERS.map((b) => (
            <div key={b.id} className="p-banner-slide">
              <div style={{ position:"absolute", inset:0, background:b.bg }} />
              {b.image && <img src={b.image} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:.38 }} />}
              <div style={{ position:"absolute", top:0, bottom:0, width:"30%", background:"linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)", animation:"scanLine 5s ease-in-out infinite", pointerEvents:"none" }} />
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(0,0,0,.55) 0%,transparent 65%)" }} />
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:7, padding:"0 20px", textAlign:"center", zIndex:2 }}>
                <div style={{ fontSize:9.5, letterSpacing:4, color:"rgba(255,255,255,.65)", fontWeight:700, fontFamily:"'Nunito',sans-serif" }}>{b.label}</div>
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:27, fontWeight:700, color:"#fff", lineHeight:1.15, margin:0 }}>{b.title}</h2>
                <p style={{ fontSize:11.5, color:"rgba(255,255,255,.7)", fontFamily:"'Nunito',sans-serif", margin:0, lineHeight:1.5 }}>{b.desc}</p>
                <a href={b.btnLink} style={{
                  marginTop:4, background:GOLD, color:"#111",
                  borderRadius:7, padding:"7px 20px",
                  fontSize:10.5, letterSpacing:1.2, fontWeight:800,
                  cursor:"pointer", textDecoration:"none",
                  fontFamily:"'Nunito',sans-serif", display:"inline-block",
                }}>{b.btnText} →</a>
              </div>
            </div>
          ))}
        </div>
        <div className="p-banner-dots">
          {BANNERS.map((_, i) => (
            <button key={i} className="p-banner-dot" aria-label={`Show banner ${i + 1}`}
              style={{ width: i === bannerIdx ? 20 : 5, background: i === bannerIdx ? GOLD : "rgba(255,255,255,.4)" }}
              onClick={() => {
                setBannerIdx(i);
                bannerScrollRef.current?.scrollTo({ left: i * (bannerScrollRef.current?.offsetWidth ?? 0), behavior:"smooth" });
              }}
            />
          ))}
        </div>
      </div>

      {/* ── CATEGORY TABS ── */}
      {/* ── CATEGORY TABS ── */}
<div className="p-cat-bar">
  <button className={`p-cat-tab${activeMain === "all" ? " active" : ""}`} onClick={selectAll}>
  <div style={{
    width: 40, height: 40,
    borderRadius: "50%",
    background: activeMain === "all" ? "#f0f7f2" : "#f5f5f7",
    border: `2px solid ${activeMain === "all" ? G : "#f0ece4"}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all .2s",
  }}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2"  y="2"  width="7" height="7" rx="2"
        fill={activeMain === "all" ? G : "#aaa"} />
      <rect x="11" y="2"  width="7" height="7" rx="2"
        fill={activeMain === "all" ? G : "#aaa"} />
      <rect x="2"  y="11" width="7" height="7" rx="2"
        fill={activeMain === "all" ? G : "#aaa"} />
      <rect x="11" y="11" width="7" height="7" rx="2"
        fill={activeMain === "all" ? G : "#aaa"} />
    </svg>
  </div>
  <span className="label">All</span>
</button>
        {mainCats.map(cat => (
          <button key={cat.id} className={`p-cat-tab${activeMain === cat.slug ? " active" : ""}`} onClick={() => selectMain(cat)}>
            {cat.imageUrl
              ? <img {...imgProps(cat.imageUrl, "64px")} alt={cat.name} className="p-cat-img" loading="lazy" decoding="async" />
              : <span className="icon">{CAT_ICONS[cat.slug] ?? "🏷️"}</span>
            }
            <span className="label">{cat.name}</span>
          </button>
        ))}
      </div>

      {/* ── SUB CATEGORIES ── */}
      {expandedMain !== null && (() => {
        const subs = subCats.filter(s => s.mainCategoryId === expandedMain);
        if (!subs.length) return null;
        return (
          <div className="p-sub-bar">
            {subs.map(sub => (
              <button key={sub.id} className={`p-chip${activeSub === sub.id ? " active" : ""}`}
                onClick={() => { setActiveSub(activeSub === sub.id ? null : sub.id); setActiveChild(null); }}>
                {sub.name}
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── CHILD CATEGORIES ── */}
      {activeSub !== null && (() => {
        const children = childCats.filter(c => c.subCategoryId === activeSub);
        if (!children.length) return null;
        return (
          <div className="p-sub-bar" style={{ background:"#fff", paddingTop:6 }}>
            {children.map(child => (
              <button key={child.id} className={`p-child-chip${activeChild === child.id ? " active" : ""}`}
                onClick={() => setActiveChild(activeChild === child.id ? null : child.id)}>
                {child.name}
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── BREADCRUMB ── */}
      {activeMain !== "all" && (
        <div className="p-breadcrumb">
          <span onClick={selectAll}>Home</span>
          <span className="sep">›</span>
          <span onClick={selectAll}>Products</span>
          <span className="sep">›</span>
          <span className={!activeSubObj && !activeChildObj ? "cur" : ""} onClick={() => { setActiveSub(null); setActiveChild(null); }}>{activeMainObj?.name}</span>
          {activeSubObj && <><span className="sep">›</span><span className={!activeChildObj ? "cur" : ""} onClick={() => setActiveChild(null)}>{activeSubObj.name}</span></>}
          {activeChildObj && <><span className="sep">›</span><span className="cur">{activeChildObj.name}</span></>}
        </div>
      )}

      {/* ── TOOLBAR ── */}
      <div className="p-toolbar">
        <button className={`p-tool-btn${showSort ? " active" : ""}`} onClick={() => { setShowSort(true); setShowFilter(false); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M7 12h10M10 18h4"/></svg>
          SORT
          {sortBy !== "relevance" && <span style={{ fontSize:9, color:G, background:"#edf7f2", padding:"1px 5px", borderRadius:4, marginLeft:2 }}>ON</span>}
        </button>
        <button className={`p-tool-btn${showFilter ? " active" : ""}`} onClick={() => { setShowFilter(true); setShowSort(false); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          FILTER {activeFiltersCount > 0 && <span className="p-badge">{activeFiltersCount}</span>}
        </button>
      </div>

      {/* ── RESULTS BAR ── */}
      <div className="p-results">
        <span className="p-results-label">
          <strong>{displayedProducts.length}</strong> items — <strong>{sectionLabel}</strong>
        </span>
        <div className="p-view-btns">
          <button className={`p-view-btn${viewMode === "grid2" ? " active" : ""}`} aria-label="Two-column grid view" aria-pressed={viewMode === "grid2"} onClick={() => setViewMode("grid2")}>
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="0" width="5" height="5" rx="1"/><rect x="7" y="0" width="5" height="5" rx="1"/><rect x="0" y="7" width="5" height="5" rx="1"/><rect x="7" y="7" width="5" height="5" rx="1"/></svg>
          </button>
          <button className={`p-view-btn${viewMode === "grid1" ? " active" : ""}`} aria-label="Single-column list view" aria-pressed={viewMode === "grid1"} onClick={() => setViewMode("grid1")}>
            <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor"><rect x="0" y="0" width="12" height="4" rx="1"/><rect x="0" y="6" width="12" height="4" rx="1"/></svg>
          </button>
        </div>
      </div>

      {/* ── PRODUCT GRID ── */}
      <div className={viewMode === "grid2" ? "p-grid2" : "p-grid1"}>

        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
            <div className="p-skel" style={{ height: viewMode === "grid2" ? 220 : 165 }} />
            <div style={{ padding:"10px 12px 12px", display:"flex", flexDirection:"column", gap:7 }}>
              <div className="p-skel" style={{ height:12, width:"65%", borderRadius:4 }} />
              <div className="p-skel" style={{ height:10, width:"45%", borderRadius:4 }} />
              <div className="p-skel" style={{ height:10, width:"55%", borderRadius:4 }} />
              <div className="p-skel" style={{ height:35, borderRadius:8, marginTop:4 }} />
            </div>
          </div>
        ))}

        {!loading && displayedProducts.map((p, i) => {
          const price  = toNum(p.price);
          const orig   = toNum(p.originalPrice ?? p.price);
          const rating = toNum(p.rating) || 4.2;
          const img    = p.imageUrl ?? p.image_url ?? FALLBACK_IMG;
          const disc   = discountPct(price, orig);
          const inCart = cartPops.has(p.id);
          const imgH   = viewMode === "grid2" ? 215 : 175;

          return (
            <div key={p.id} className="p-card" style={{ animationDelay:`${Math.min(i,7)*0.04}s` }}>
              {/* IMAGE */}
              <div className="p-img-wrap" style={{ height:imgH }} onClick={() => navigate(`/products/${p.id}`)}>
                <img {...imgProps(img, "(min-width:1024px) 22vw, 48vw")} alt={p.name} className="p-img" style={{ height:imgH }} loading="lazy" decoding="async" width={400} height={imgH}
                  onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />

                {p.featured && !disc && <div className="p-feat-badge">FEATURED</div>}
                {disc >= 5  && <div className="p-disc-badge">-{disc}%</div>}

                <button className={`p-wish${wishlist.has(p.id) ? " on" : ""}`}
                  aria-label={wishlist.has(p.id) ? `Remove ${p.name} from wishlist` : `Add ${p.name} to wishlist`} aria-pressed={wishlist.has(p.id)}
                  onClick={e => { e.stopPropagation(); toggleWish(p.id); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24"
                    fill={wishlist.has(p.id) ? "#f43f5e" : "none"}
                    stroke={wishlist.has(p.id) ? "#f43f5e" : "#888"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                </button>

                {p.artisan && (
                  <div className="p-artisan-bar">
                    <div className="p-artisan-name">
                      <span style={{ color:GOLD }}>✦</span> {p.artisan}
                    </div>
                  </div>
                )}
              </div>

              {/* INFO */}
              <div className="p-info">
                <div className="p-pname" onClick={() => navigate(`/products/${p.id}`)}>{p.name}</div>

                {p.origin && (
                  <div className="p-origin">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    {p.origin}
                  </div>
                )}

                <div className="p-stars-row"><Stars r={rating} /></div>

                <div className="p-price-row">
                  <span className="p-price">₹{price.toLocaleString("en-IN")}</span>
                  {disc > 0 && <span className="p-orig">₹{orig.toLocaleString("en-IN")}</span>}
                  {disc > 0 && <span className="p-disc">{disc}% OFF</span>}
                </div>

                <button className={`p-add-btn${inCart ? " done" : ""}`} onClick={() => addToCart(p.id)}>
                  {inCart ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ADDED TO CART
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                        <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.66a2 2 0 001.98-1.71L23 6H6"/>
                      </svg>
                      ADD TO CART
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {!loading && displayedProducts.length === 0 && (
          <div className="p-empty">
            <div style={{ fontSize:44, marginBottom:12 }}>🛍️</div>
            <p style={{ fontSize:15, fontWeight:700, color:"#1a2d1a", fontFamily:"'Playfair Display',serif", margin:"0 0 6px" }}>Koi product nahi mila</p>
            <p style={{ fontSize:12, color:"#4b5563", fontFamily:"'Nunito',sans-serif", margin:"0 0 16px" }}>Filter ya search change karke try karo</p>
            <button onClick={selectAll} style={{ padding:"10px 24px", border:`1.5px solid ${G}`, borderRadius:8, background:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", color:G }}>
              CLEAR FILTERS
            </button>
          </div>
        )}
      </div>

      {/* ── SORT SHEET ── */}
      {showSort && (
        <>
          <div className="p-overlay" onClick={() => setShowSort(false)} />
          <div className="p-sheet">
            <div className="p-sheet-handle" />
            <div className="p-sheet-title">SORT BY</div>
            {SORT_OPTIONS.map(opt => (
              <div key={opt.value} className={`p-sort-opt${sortBy === opt.value ? " active" : ""}`}
                onClick={() => { setSortBy(opt.value); setShowSort(false); }}>
                {opt.label}
                <div className={`p-radio${sortBy === opt.value ? " active" : ""}`} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── FILTER SHEET ── */}
      {showFilter && (
        <>
          <div className="p-overlay" onClick={() => setShowFilter(false)} />
          <div className="p-sheet" style={{ display:"flex", flexDirection:"column" }}>
            <div className="p-sheet-handle" />
            <div className="p-sheet-title">FILTERS</div>
            <div className="p-filter-wrap">
              <div className="p-filter-sidebar">
                <div className="p-filter-sec active">Price</div>
                <div className="p-filter-sec">Discount</div>
              </div>
              <div className="p-filter-body">
                <div className="p-filter-lbl">PRICE RANGE</div>
                {([
                  [0, 500,   "Under ₹500"],
                  [500, 1000, "₹500 – ₹1,000"],
                  [1000, 2500,"₹1,000 – ₹2,500"],
                  [2500, 5000,"₹2,500 – ₹5,000"],
                  [5000, 10000,"Above ₹5,000"],
                ] as [number, number, string][]).map(([min, max, label]) => (
                  <div key={label} className="p-filter-row" onClick={() => setPriceRange([min, max])}>
                    <div className={`p-chk${priceRange[0] === min && priceRange[1] === max ? " on" : ""}`}>
                      {priceRange[0] === min && priceRange[1] === max ? "✓" : ""}
                    </div>
                    {label}
                  </div>
                ))}
                <div style={{ marginTop:16 }} className="p-filter-lbl">DISCOUNT</div>
                <div className="p-filter-row" onClick={() => setOnlyDiscount(v => !v)}>
                  <div className={`p-chk${onlyDiscount ? " on" : ""}`}>{onlyDiscount ? "✓" : ""}</div>
                  On Sale Only
                </div>
              </div>
            </div>
            <div className="p-filter-footer">
              <button className="p-filter-clear" onClick={() => { setPriceRange([0, 10000]); setOnlyDiscount(false); }}>CLEAR ALL</button>
              <button className="p-filter-apply" onClick={() => setShowFilter(false)}>APPLY FILTERS</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
