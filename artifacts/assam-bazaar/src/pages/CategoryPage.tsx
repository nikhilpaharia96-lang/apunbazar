import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";

interface Category { id: number; name: string; slug: string; description?: string; imageUrl?: string; }
interface Product {
  id: number; name: string; slug?: string; description?: string;
  price: string | number; originalPrice?: string | number;
  imageUrl?: string; image_url?: string;
  categoryId?: number; category_id?: number;
  stock?: number; featured?: boolean;
  artisan?: string; origin?: string; rating?: string | number;
  images?: string[];
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface BannerSlide { tag: string; title: string; sub: string; }
interface CatConfig {
  emoji: string; color: string; accent: string; image?: string;
  banners: BannerSlide[];
  subCategories: { name: string; slug: string; emoji: string; image?: string; childCategories?: { name: string; slug: string }[] }[];
  featuredBanner?: {
    enabled: boolean; label: string; title: string; desc: string; btnText: string; image?: string;
  };
}

// ─── DEFAULT CONFIG ───────────────────────────────────────────────────────────
const CAT_CONFIG: Record<string, CatConfig> = {
  handloom: {
    emoji: "🧵", color: "#1a3a2e", accent: "#c9a84c",
    image: "https://images.unsplash.com/photo-1590439471364-192aa70c0b53?w=1400&q=80",
    banners: [
      { tag: "GI TAGGED AUTHENTIC", title: "Muga & Pat Silk", sub: "Woven by master artisans of Sualkuchi" },
      { tag: "HERITAGE COLLECTION", title: "Mekhela Chador", sub: "Traditional Assamese women's attire" },
      { tag: "GAMOSA SPECIAL", title: "Symbol of Assam", sub: "Gifted with love across generations" },
    ],
    subCategories: [
      { name: "Silk Fabrics", slug: "silk", emoji: "✨", image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200&q=70", childCategories: [{ name: "Muga Silk", slug: "muga" }, { name: "Pat Silk", slug: "pat" }, { name: "Eri Silk", slug: "eri" }] },
      { name: "Mekhela Chador", slug: "mekhela", emoji: "👘", image: "https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=200&q=70", childCategories: [{ name: "Bridal", slug: "bridal" }, { name: "Casual", slug: "casual" }] },
      { name: "Gamosa", slug: "gamosa", emoji: "🎀", image: "https://images.unsplash.com/photo-1611042553365-9b101441c135?w=200&q=70" },
      { name: "Sarees", slug: "sarees", emoji: "🪡", image: "https://images.unsplash.com/photo-1610189025619-d22fea0c5d3a?w=200&q=70" },
      { name: "Fabric Rolls", slug: "fabric", emoji: "🧶", image: "https://images.unsplash.com/photo-1606722590583-6951b5ea92ad?w=200&q=70" },
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
    emoji: "🍵", color: "#1a2e1a", accent: "#7ab648",
    image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=1400&q=80",
    banners: [
      { tag: "AWARD WINNING", title: "Assam Orthodox", sub: "Bold, malty, world-famous black tea" },
      { tag: "GARDEN FRESH", title: "First Flush 2026", sub: "Limited seasonal harvest — just arrived" },
      { tag: "WELLNESS BLEND", title: "Green & Herbal", sub: "Pure Assam herbs for mind & body" },
    ],
    subCategories: [
      { name: "Black Tea", slug: "black", emoji: "⬛", image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=200&q=70", childCategories: [{ name: "Orthodox", slug: "orthodox" }, { name: "CTC", slug: "ctc" }, { name: "Tippy Golden", slug: "tgfop" }] },
      { name: "Green Tea", slug: "green", emoji: "🍃", image: "https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=200&q=70" },
      { name: "White Tea", slug: "white", emoji: "🤍", image: "https://images.unsplash.com/photo-1556881286-fc6915169721?w=200&q=70" },
      { name: "Herbal Blend", slug: "herbal", emoji: "🌿", image: "https://images.unsplash.com/photo-1597318181409-cf64d0b5d8a2?w=200&q=70" },
      { name: "Gift Sets", slug: "gift-sets", emoji: "🎁", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&q=70" },
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
    emoji: "🏺", color: "#2e1a0e", accent: "#c97a3a",
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400&q=80",
    banners: [
      { tag: "MASTER CRAFTSMEN", title: "Bamboo & Cane", sub: "Eco-friendly art from the forests of Assam" },
      { tag: "TRIBAL HERITAGE", title: "Masks & Pottery", sub: "Traditional Assamese folk art forms" },
      { tag: "HOME DÉCOR", title: "Handcrafted Wonders", sub: "Unique pieces for your living space" },
    ],
    subCategories: [
      { name: "Bamboo Craft", slug: "bamboo", emoji: "🪵", image: "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?w=200&q=70", childCategories: [{ name: "Furniture", slug: "furniture" }, { name: "Baskets", slug: "baskets" }] },
      { name: "Pottery", slug: "pottery", emoji: "🏺", image: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=200&q=70" },
      { name: "Masks", slug: "masks", emoji: "🎭", image: "https://images.unsplash.com/photo-1604871082972-c5e6c4b6f8d8?w=200&q=70" },
      { name: "Paintings", slug: "paintings", emoji: "🎨", image: "https://images.unsplash.com/photo-1579541591970-e5780dc6b31f?w=200&q=70" },
      { name: "Jewelry", slug: "jewelry", emoji: "💎", image: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=200&q=70" },
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
    emoji: "🌿", color: "#1e2e10", accent: "#82c341",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1400&q=80",
    banners: [
      { tag: "100% NATURAL", title: "Joha Rice", sub: "Fragrant heirloom rice from Assam's fields" },
      { tag: "COLD PRESSED", title: "Mustard Oil", sub: "Kachi ghani — traditional extraction method" },
      { tag: "FOREST HARVEST", title: "Wild Honey", sub: "Raw, unprocessed, straight from the hive" },
    ],
    subCategories: [
      { name: "Rice & Grains", slug: "rice", emoji: "🌾", image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&q=70", childCategories: [{ name: "Joha Rice", slug: "joha" }, { name: "Red Rice", slug: "red-rice" }] },
      { name: "Oils & Ghee", slug: "oils", emoji: "🫙", image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=200&q=70" },
      { name: "Honey", slug: "honey", emoji: "🍯", image: "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=200&q=70" },
      { name: "Spices", slug: "spices", emoji: "🌶️", image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200&q=70" },
      { name: "Pickles", slug: "pickles", emoji: "🥒", image: "https://images.unsplash.com/photo-1589135233292-c3db535b6e64?w=200&q=70" },
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
    emoji: "👜", color: "#2e1a2e", accent: "#c97ac9",
    image: "https://images.unsplash.com/photo-1605618474884-e4adc4b8d099?w=1400&q=80",
    banners: [
      { tag: "SUSTAINABLE FASHION", title: "Jute & Cane Bags", sub: "Eco-chic accessories from Assam" },
      { tag: "HANDWOVEN", title: "Tribal Totes", sub: "Bold patterns, zero plastic" },
      { tag: "GIFTING SPECIAL", title: "Gift Hampers", sub: "Curated Assamese luxury gift sets" },
    ],
    subCategories: [
      { name: "Jute Bags", slug: "jute", emoji: "🎒", image: "https://images.unsplash.com/photo-1605618474884-e4adc4b8d099?w=200&q=70" },
      { name: "Cane Baskets", slug: "cane", emoji: "🧺", image: "https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?w=200&q=70" },
      { name: "Clutches", slug: "clutches", emoji: "👛", image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=200&q=70" },
      { name: "Travel Bags", slug: "travel", emoji: "🧳", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=200&q=70" },
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

const DEFAULT_CFG: CatConfig = {
  emoji: "🏪", color: "#1a3a2e", accent: "#c9a84c",
  banners: [{ tag: "CELEBRATING ASSAM", title: "Artisan Collection", sub: "Handpicked from 500+ master artisans" }],
  subCategories: [],
  featuredBanner: { enabled: false, label: "", title: "", desc: "", btnText: "" },
};

const FALLBACK_IMG = "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400&q=70";
const PAGE_SIZE = 10;

function toNum(v: string | number | undefined): number {
  if (!v) return 0;
  return typeof v === "number" ? v : parseFloat(String(v)) || 0;
}
function discPct(p: number, o: number) { return (!o || o <= p) ? 0 : Math.round((1 - p / o) * 100); }

// ─── LOAD ADMIN OVERRIDES ─────────────────────────────────────────────────────
function loadAdminConfig(slug: string, base: CatConfig): CatConfig {
  try {
    const saved = localStorage.getItem("category_configs");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.[slug]) {
        return {
          ...base,
          ...parsed[slug],
          featuredBanner: {
            ...base.featuredBanner,
            ...(parsed[slug].featuredBanner ?? {}),
          },
        };
      }
    }
  } catch {}
  return base;
}

// ─── STAR RATING ──────────────────────────────────────────────────────────────
function Stars({ rating, accent }: { rating: number; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} width="11" height="11" viewBox="0 0 24 24"
          fill={s <= Math.round(rating) ? accent : "#e0d8c0"}
          stroke={s <= Math.round(rating) ? accent : "#e0d8c0"}
          strokeWidth="1">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
      <span style={{ fontSize: 10, color: "#999", marginLeft: 2 }}>{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────
function ProductCard({
  product: p, cfg, onNavigate, onAddCart, onWishlist, inCart, isWishlisted,
}: {
  product: Product; cfg: CatConfig;
  onNavigate: (id: number) => void;
  onAddCart: (id: number) => void;
  onWishlist: (id: number) => void;
  inCart: boolean; isWishlisted: boolean;
}) {
  const price = toNum(p.price);
  const orig = toNum(p.originalPrice);
  const disc = discPct(price, orig);
  const rating = toNum(p.rating) || 4.2;
  const img = p.imageUrl ?? p.image_url ?? FALLBACK_IMG;
  const soldOut = p.stock === 0;

  return (
    <div className="cp-card" style={{
      borderRadius: 20,
      overflow: "hidden",
      background: "#fff",
      border: "1px solid #ede8de",
      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Image — navigates using numeric id only */}
      <div style={{ position: "relative", paddingTop: "115%", overflow: "hidden", background: "#f5f1e8", cursor: "pointer" }}
        onClick={() => onNavigate(p.id)}>
        <img src={img} alt={p.name}
          loading="lazy"
          className="cp-img"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }} />

        {/* Gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.38) 0%, transparent 50%)", pointerEvents: "none" }} />

        {/* Badges */}
        {p.featured && !disc && (
          <div style={{ position: "absolute", top: 10, left: 10, background: cfg.color, color: "#fff", borderRadius: 100, padding: "3px 10px", fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>
            ★ TOP PICK
          </div>
        )}
        {disc >= 10 && (
          <div style={{ position: "absolute", top: 10, left: 10, background: "#d44c2a", color: "#fff", borderRadius: 100, padding: "3px 10px", fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>
            -{disc}%
          </div>
        )}
        {soldOut && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 2, border: "1.5px solid rgba(255,255,255,0.5)", padding: "4px 14px", borderRadius: 100 }}>SOLD OUT</span>
          </div>
        )}

        {/* Wishlist */}
        <button
          onClick={e => { e.stopPropagation(); onWishlist(p.id); }}
          style={{
            position: "absolute", top: 10, right: 10,
            width: 30, height: 30, borderRadius: "50%",
            background: isWishlisted ? "#fff5f0" : "rgba(255,255,255,0.92)",
            border: `1.5px solid ${isWishlisted ? "#e05c2a" : "rgba(255,255,255,0.5)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", backdropFilter: "blur(4px)",
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24"
            fill={isWishlisted ? "#e05c2a" : "none"}
            stroke={isWishlisted ? "#e05c2a" : "#666"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>

        {/* Artisan tag */}
        {p.artisan && (
          <div style={{ position: "absolute", bottom: 8, left: 10, fontSize: 9, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
            ✦ {p.artisan}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Name — navigates using numeric id only */}
        <div onClick={() => onNavigate(p.id)} style={{ cursor: "pointer" }}>
          <p style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 13, fontWeight: 600, color: "#1a2d1a",
            lineHeight: 1.4, margin: 0,
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const, overflow: "hidden",
            minHeight: 36,
          }}>{p.name}</p>
        </div>

        {/* Origin */}
        {p.origin && (
          <p style={{ fontSize: 9.5, color: "#aaa", margin: 0, display: "flex", alignItems: "center", gap: 3 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            {p.origin}
          </p>
        )}

        {/* Rating */}
        <Stars rating={rating} accent={cfg.accent} />

        {/* Price */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: cfg.color }}>
            ₹{price.toLocaleString()}
          </span>
          {disc > 0 && (
            <span style={{ fontSize: 11, color: "#bbb", textDecoration: "line-through" }}>₹{orig.toLocaleString()}</span>
          )}
          {disc >= 10 && (
            <span style={{ fontSize: 9, color: "#d44c2a", fontWeight: 700, background: "#fff0ea", padding: "1px 7px", borderRadius: 100 }}>
              {disc}% OFF
            </span>
          )}
        </div>

        {/* Add to cart */}
        <button
          disabled={soldOut}
          onClick={() => onAddCart(p.id)}
          className={inCart ? "cp-btn-done" : "cp-btn"}
          style={{
            marginTop: "auto",
            width: "100%", borderRadius: 12, padding: "9px 0",
            fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
            background: inCart ? cfg.color : "#fff",
            color: inCart ? "#fff" : soldOut ? "#bbb" : cfg.color,
            border: `1.5px solid ${soldOut ? "#e0d8c0" : cfg.color}`,
            cursor: soldOut ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: "'Nunito', sans-serif",
            transition: "all 0.2s",
          }}>
          {inCart ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              ADDED!
            </>
          ) : soldOut ? "OUT OF STOCK" : (
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
}

// ─── SKELETON CARD ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ borderRadius: 20, overflow: "hidden", background: "#fff", border: "1px solid #ede8de" }}>
      <div className="cp-shimmer" style={{ paddingTop: "115%" }} />
      <div style={{ padding: "12px 12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="cp-shimmer" style={{ height: 13, width: "80%", borderRadius: 6 }} />
        <div className="cp-shimmer" style={{ height: 11, width: "50%", borderRadius: 6 }} />
        <div className="cp-shimmer" style={{ height: 36, borderRadius: 10 }} />
      </div>
    </div>
  );
}

// ─── SLUG NORMALIZER ──────────────────────────────────────────────────────────
// Backend sometimes sends display names ("Assam Tea") instead of clean slugs
// ("tea") in the URL. This maps whatever comes in to the right CAT_CONFIG key.
function normalizeSlug(raw: string): string {
  const clean = decodeURIComponent(raw).trim().toLowerCase();
  const kebab = clean.replace(/\s+/g, "-");

  // 1. Exact match (already a clean slug like "tea", "handloom")
  if (CAT_CONFIG[clean]) return clean;
  if (CAT_CONFIG[kebab]) return kebab;

  // 2. Keyword match — find a config key that appears inside the raw text
  const keys = Object.keys(CAT_CONFIG);
  const found = keys.find(key => clean.includes(key));
  if (found) return found;

  // 3. Common alias mapping for known display names
  const aliases: Record<string, string> = {
    "assam tea": "tea",
    "assam-tea": "tea",
    "handloom & textiles": "handloom",
    "handloom and textiles": "handloom",
    "handicraft": "handicrafts",
    "organic food": "organic",
    "bags & accessories": "bags",
    "bags and accessories": "bags",
  };
  if (aliases[clean]) return aliases[clean];

  // 4. No match — fall through to default config
  return clean;
}


export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const rawSlug = decodeURIComponent(params.slug ?? "all");
  const slug = normalizeSlug(params.slug ?? "all");

  const baseCfg = CAT_CONFIG[slug] ?? DEFAULT_CFG;
  const [cfg, setCfg] = useState<CatConfig>(() => loadAdminConfig(slug, baseCfg));

  const [category, setCategory] = useState<Category | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const [activeChild, setActiveChild] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("popular");
  const [wishlist, setWishlist] = useState<Set<number>>(new Set());
  const [cartAnim, setCartAnim] = useState<Set<number>>(new Set());
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reload admin config on storage change
  useEffect(() => {
    const handler = () => setCfg(loadAdminConfig(slug, baseCfg));
    window.addEventListener("storage", handler);
    window.addEventListener("category_config_updated", handler);
    return () => { window.removeEventListener("storage", handler); window.removeEventListener("category_config_updated", handler); };
  }, [slug]);

  // Load category
  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then((cats: Category[]) => {
      const found = (Array.isArray(cats) ? cats : []).find(c => c.slug === rawSlug || c.slug === slug);
      setCategory(found ?? null);
    }).catch(() => {});
  }, [slug]);

  // Load products
  useEffect(() => {
    setLoading(true); setPage(1); setProducts([]); setAllProducts([]);
    fetch(`/api/products?category=${encodeURIComponent(rawSlug)}&limit=100`)
      .then(r => r.json())
      .then(d => {
        const arr: Product[] = Array.isArray(d) ? d : (d?.products ?? []);
        setAllProducts(arr);
        setProducts(arr.slice(0, PAGE_SIZE));
        setHasMore(arr.length > PAGE_SIZE);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [slug]);

  // Banner rotation
  useEffect(() => {
    const t = setInterval(() => {
      setBannerVisible(false);
      setTimeout(() => { setBannerIdx(i => (i + 1) % cfg.banners.length); setBannerVisible(true); }, 280);
    }, 4500);
    return () => clearInterval(t);
  }, [cfg.banners.length]);

  // Filter + sort
  function getFiltered() {
    let arr = [...allProducts];
    if (search) arr = arr.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (sort === "price_asc") arr.sort((a, b) => toNum(a.price) - toNum(b.price));
    else if (sort === "price_desc") arr.sort((a, b) => toNum(b.price) - toNum(a.price));
    else if (sort === "rating") arr.sort((a, b) => toNum(b.rating) - toNum(a.rating));
    else arr.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return arr;
  }

  useEffect(() => {
    const filtered = getFiltered();
    setProducts(filtered.slice(0, page * PAGE_SIZE));
    setHasMore(filtered.length > page * PAGE_SIZE);
  }, [search, sort, allProducts]);

  // Infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMore && !loadingMore) {
      setLoadingMore(true);
      setTimeout(() => {
        setPage(prev => {
          const next = prev + 1;
          const filtered = getFiltered();
          const slice = filtered.slice(0, next * PAGE_SIZE);
          setProducts(slice);
          setHasMore(slice.length < filtered.length);
          setLoadingMore(false);
          return next;
        });
      }, 500);
    }
  }, [hasMore, loadingMore]);

  useEffect(() => {
    const obs = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    if (loadMoreRef.current) obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [handleObserver]);

  function addCart(id: number) {
    setCartAnim(p => new Set([...p, id]));
    setTimeout(() => setCartAnim(p => { const n = new Set(p); n.delete(id); return n; }), 1600);
  }

  // ── Navigate to product detail page (ALWAYS by numeric id) ──
  function goToProduct(id: number) {
    navigate(`/products/${id}`);
  }

  const banner = cfg.banners[bannerIdx];
  const activeSub_ = cfg.subCategories.find(s => s.slug === activeSub);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,400&family=Nunito:wght@300;400;500;600;700&display=swap');

        @keyframes cpSlideUp { from { opacity:0; transform:translateY(22px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cpFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes cpShimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        @keyframes cpScan    { 0%{transform:translateX(-100%)} 100%{transform:translateX(450%)} }
        @keyframes cpDot     { 0%,100%{opacity:.35;transform:scale(.75)} 50%{opacity:1;transform:scale(1)} }
        @keyframes cpPop     { 0%{transform:scale(1)} 40%{transform:scale(.88)} 80%{transform:scale(1.06)} 100%{transform:scale(1)} }
        @keyframes cpPulse   { 0%,100%{opacity:1} 50%{opacity:.5} }

        .cp-card {
          transition: transform .28s cubic-bezier(.34,1.56,.64,1), box-shadow .28s;
        }
        .cp-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 18px 48px rgba(0,0,0,0.13) !important;
        }
        .cp-img {
          transition: transform .5s cubic-bezier(.16,1,.3,1);
        }
        .cp-card:hover .cp-img {
          transform: scale(1.08);
        }
        .cp-btn {
          transition: background .2s, color .2s, transform .15s;
        }
        .cp-btn:hover:not(:disabled) {
          background: var(--cfg-color, #1a3a2e) !important;
          color: #fff !important;
          transform: scale(1.02);
        }
        .cp-btn-done {
          animation: cpPop .35s ease;
        }
        .cp-shimmer {
          background: linear-gradient(90deg, #f0ede4 0%, #e8e4d8 50%, #f0ede4 100%);
          background-size: 1200px 100%;
          animation: cpShimmer 1.8s infinite;
        }
        .cp-sub-btn {
          transition: all .2s cubic-bezier(.34,1.56,.64,1);
        }
        .cp-sub-btn:hover { transform: translateY(-3px); }
        .cp-sub-btn.active { transform: translateY(-2px); }
        .cp-child-btn { transition: all .18s; }
        .cp-search-wrap:focus-within { box-shadow: 0 0 0 2px var(--cfg-accent, #c9a84c) !important; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { border-radius: 4px; background: rgba(0,0,0,0.15); }
      `}</style>

      <div style={{ background: "#f7f4ed", minHeight: "100vh", fontFamily: "'Nunito', sans-serif", "--cfg-color": cfg.color, "--cfg-accent": cfg.accent } as React.CSSProperties}>

        {/* ═══ HERO BANNER ═══════════════════════════════════════════════════ */}
        <div style={{ position: "relative", height: 260, overflow: "hidden", borderRadius: "0 0 20px 20px" }}>
          {/* BG Image */}
          {cfg.image && (
            <img src={cfg.image} alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          )}
          {/* Left-to-right dark gradient so left text stays readable */}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${cfg.color}f5 0%, ${cfg.color}cc 28%, ${cfg.color}55 55%, transparent 80%)` }} />
          {/* Subtle bottom fade for polish */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.25) 0%, transparent 35%)" }} />

          {/* Back button */}
          <button onClick={() => navigate("/")}
            style={{ position: "absolute", top: 16, left: 16, zIndex: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 100, padding: "7px 16px", color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "'Nunito', sans-serif", cursor: "pointer", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>

          {/* Content — left aligned, bottom-weighted like the reference */}
          <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 22px 26px", maxWidth: "72%" }}>
            {/* Tag badge */}
            <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 6, background: "transparent", padding: 0, fontSize: 10.5, letterSpacing: 3, color: cfg.accent, fontWeight: 700, marginBottom: 8, animation: "cpFadeIn .4s ease" }}>
              <span style={{ width: 16, height: 1.5, background: cfg.accent, display: "inline-block" }} />
              {banner?.tag ?? category?.name?.toUpperCase()}
            </div>

            {/* Main text */}
            <div style={{ opacity: bannerVisible ? 1 : 0, transform: bannerVisible ? "translateY(0)" : "translateY(8px)", transition: "all 0.28s ease" }}>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(1.6rem,7vw,2.3rem)", fontWeight: 700, color: "#fff", lineHeight: 1.12, margin: "0 0 8px", textShadow: "0 2px 16px rgba(0,0,0,0.35)" }}>
                {banner?.title}
              </h1>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", margin: "0 0 16px", lineHeight: 1.5, maxWidth: 240 }}>
                {banner?.sub}
              </p>
            </div>

            {/* Explore button */}
            <button
              onClick={() => document.getElementById("cp-product-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#fff", fontSize: 12.5, fontWeight: 700, fontFamily: "'Nunito', sans-serif", cursor: "pointer", padding: 0 }}>
              Explore Collection
              <span style={{ color: cfg.accent }}>→</span>
            </button>
          </div>

          {/* Banner dots */}
          <div style={{ position: "absolute", bottom: 12, right: 16, display: "flex", gap: 6, zIndex: 5 }}>
            {cfg.banners.map((_, i) => (
              <button key={i} onClick={() => setBannerIdx(i)}
                style={{ height: 4, borderRadius: 100, cursor: "pointer", border: "none", padding: 0, transition: "all .3s", width: i === bannerIdx ? 18 : 4, background: i === bannerIdx ? cfg.accent : "rgba(255,255,255,0.4)" }} />
            ))}
          </div>
        </div>


        {/* Assam stripe divider */}
        <div style={{ height: 3, background: `repeating-linear-gradient(90deg, ${cfg.color} 0, ${cfg.color} 7px, transparent 7px, transparent 12px, ${cfg.accent} 12px, ${cfg.accent} 14px, transparent 14px, transparent 20px)`, opacity: 0.4 }} />

        {/* ═══ STICKY SEARCH + FILTER ════════════════════════════════════════ */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(247,244,237,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e8e2d0", padding: "10px 14px" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Search */}
            <div className="cp-search-wrap" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1.5px solid #e0d8c0", borderRadius: 12, padding: "0 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "box-shadow .2s" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${category?.name ?? slug}...`}
                style={{ flex: 1, border: "none", outline: "none", fontFamily: "'Nunito', sans-serif", fontSize: 13, color: "#333", background: "transparent", padding: "10px 0" }} />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
              )}
            </div>

            {/* Filter btn (now contains Sort options too) */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button onClick={() => setFilterOpen(!filterOpen)}
                style={{ background: filterOpen ? cfg.color : "#fff", border: `1.5px solid ${filterOpen ? cfg.color : "#e0d8c0"}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: filterOpen ? "#fff" : "#555", fontFamily: "'Nunito', sans-serif", fontWeight: 600, transition: "all .2s" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
                Filter
                {sort !== "popular" && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: filterOpen ? "#fff" : cfg.accent, marginLeft: 2 }} />
                )}
              </button>

              {/* Filter dropdown panel */}
              {filterOpen && (
                <>
                  <div onClick={() => setFilterOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60 }} />
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 61,
                    background: "#fff", borderRadius: 14, border: "1px solid #e8e2d0",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.15)", width: 200, overflow: "hidden",
                    animation: "cpSlideUp .2s ease",
                  }}>
                    <p style={{ padding: "12px 14px 6px", fontSize: 9.5, letterSpacing: 2, color: cfg.color, fontWeight: 700, margin: 0, fontFamily: "'Nunito', sans-serif" }}>
                      SORT BY
                    </p>
                    {[
                      { value: "popular", label: "Popular" },
                      { value: "price_asc", label: "Price: Low to High" },
                      { value: "price_desc", label: "Price: High to Low" },
                      { value: "rating", label: "Top Rated" },
                    ].map(opt => (
                      <button key={opt.value}
                        onClick={() => { setSort(opt.value); setFilterOpen(false); }}
                        style={{
                          width: "100%", textAlign: "left", padding: "10px 14px",
                          background: sort === opt.value ? `${cfg.color}10` : "transparent",
                          border: "none", cursor: "pointer",
                          fontSize: 13, fontWeight: sort === opt.value ? 700 : 500,
                          color: sort === opt.value ? cfg.color : "#444",
                          fontFamily: "'Nunito', sans-serif",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                        {opt.label}
                        {sort === opt.value && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ═══ SUBCATEGORIES ══════════════════════════════════════════════════ */}
        {cfg.subCategories.length > 0 && (
          <div style={{ paddingTop: 16 }}>
            <p style={{ padding: "0 14px 8px", fontSize: 9.5, letterSpacing: 3, color: cfg.color, fontWeight: 700, margin: 0, opacity: 0.7 }}>
              BROWSE SUBCATEGORIES
            </p>
            <div style={{ display: "flex", gap: 10, padding: "2px 14px 2px", overflowX: "auto", scrollbarWidth: "none" }}>
              {cfg.subCategories.map(sub => (
                <button key={sub.slug}
                  className={`cp-sub-btn${activeSub === sub.slug ? " active" : ""}`}
                  onClick={() => { setActiveSub(activeSub === sub.slug ? null : sub.slug); setActiveChild(null); }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    padding: "10px 10px 8px", borderRadius: 16, minWidth: 76, flexShrink: 0,
                    background: activeSub === sub.slug
                      ? `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`
                      : "rgba(255,255,255,0.85)",
                    border: `1.5px solid ${activeSub === sub.slug ? cfg.color : "#e0d8c0"}`,
                    boxShadow: activeSub === sub.slug ? `0 6px 18px ${cfg.color}30` : "0 2px 8px rgba(0,0,0,0.05)",
                    cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                  }}>
                  {sub.image ? (
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                      border: `2px solid ${activeSub === sub.slug ? cfg.accent : "#fff"}`,
                      boxShadow: activeSub === sub.slug ? `0 0 0 2px ${cfg.color}` : "0 2px 6px rgba(0,0,0,0.1)",
                    }}>
                      <img src={sub.image} alt={sub.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={e => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }} />
                      <div style={{ display: "none", width: "100%", height: "100%", marginTop: -52, alignItems: "center", justifyContent: "center", fontSize: 20, background: "#f5f1e8" }}>
                        {sub.emoji}
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: 28 }}>{sub.emoji}</span>
                  )}
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: activeSub === sub.slug ? "#fff" : "#444", whiteSpace: "nowrap", textAlign: "center" }}>
                    {sub.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Child chips */}
            {activeSub_ && (activeSub_.childCategories?.length ?? 0) > 0 && (
              <div style={{ display: "flex", gap: 8, padding: "10px 14px 4px", overflowX: "auto", scrollbarWidth: "none", animation: "cpSlideUp .3s ease" }}>
                {activeSub_.childCategories!.map(child => (
                  <button key={child.slug}
                    className="cp-child-btn"
                    onClick={() => setActiveChild(activeChild === child.slug ? null : child.slug)}
                    style={{
                      flexShrink: 0, padding: "5px 14px", borderRadius: 100,
                      background: activeChild === child.slug ? cfg.accent : "#fff",
                      border: `1.5px solid ${activeChild === child.slug ? cfg.accent : "#e0d8c0"}`,
                      color: activeChild === child.slug ? "#fff" : "#555",
                      fontFamily: "'Nunito', sans-serif", fontSize: 11, fontWeight: 600,
                      cursor: "pointer",
                    }}>
                    {child.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ FEATURED COLLECTION BANNER (admin controlled) ═══════════════════ */}
        {cfg.featuredBanner?.enabled && (
          <div style={{ margin: "16px 14px 0", borderRadius: 18, overflow: "hidden", position: "relative", minHeight: 150, display: "flex", alignItems: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
            {cfg.featuredBanner.image && (
              <img src={cfg.featuredBanner.image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${cfg.color}f2 35%, ${cfg.color}55 100%)` }} />
            <div style={{ position: "relative", padding: "20px 22px", maxWidth: "78%" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: cfg.accent, margin: "0 0 6px", fontFamily: "'Nunito', sans-serif", letterSpacing: 0.3 }}>
                {cfg.featuredBanner.label}
              </p>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 700, color: "#fff", margin: "0 0 5px", lineHeight: 1.2 }}>
                {cfg.featuredBanner.title}
              </h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", margin: "0 0 14px", fontFamily: "'Nunito', sans-serif" }}>
                {cfg.featuredBanner.desc}
              </p>
              <button
                onClick={() => document.getElementById("cp-product-grid")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                style={{ background: cfg.accent, color: cfg.color, border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12.5, fontWeight: 700, fontFamily: "'Nunito', sans-serif", cursor: "pointer" }}>
                {cfg.featuredBanner.btnText}
              </button>
            </div>
          </div>
        )}

        {/* ═══ SECTION HEADER ═════════════════════════════════════════════════ */}
        <div style={{ padding: "14px 14px 6px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 9.5, letterSpacing: 3, color: cfg.accent, fontWeight: 700, margin: "0 0 2px" }}>
              {activeSub_ ? activeSub_.name.toUpperCase() : "ALL PRODUCTS"}
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 600, color: "#1a2d1a", margin: 0 }}>
              {activeChild
                ? activeSub_?.childCategories?.find(c => c.slug === activeChild)?.name
                : activeSub_?.name ?? (category?.name ?? "Collection")}
              <span style={{ fontSize: 12, color: "#bbb", marginLeft: 6, fontFamily: "'Nunito', sans-serif", fontWeight: 400 }}>
                ({products.length} items)
              </span>
            </h2>
          </div>
        </div>

        {/* ═══ PRODUCT GRID ════════════════════════════════════════════════════ */}
        <div id="cp-product-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, padding: "4px 12px 100px" }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : products.length === 0
            ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "64px 20px", animation: "cpFadeIn .4s ease" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>{cfg.emoji}</div>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#555", margin: "0 0 6px" }}>No products found</p>
                <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>Try a different search or browse all categories</p>
              </div>
            )
            : products.map((p, i) => (
              <div key={p.id} style={{ animation: `cpSlideUp .35s ease ${Math.min(i, 7) * 0.04}s both` }}>
                <ProductCard
                  product={p} cfg={cfg}
                  onNavigate={goToProduct}
                  onAddCart={addCart}
                  onWishlist={id => setWishlist(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  inCart={cartAnim.has(p.id)}
                  isWishlisted={wishlist.has(p.id)}
                />
              </div>
            ))
          }
        </div>

        {/* ═══ LOAD MORE ═══════════════════════════════════════════════════════ */}
        <div ref={loadMoreRef} style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          {loadingMore && (
            <div style={{ display: "flex", gap: 7 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.accent, animation: `cpDot 1.1s ease ${i * 0.18}s infinite` }} />
              ))}
            </div>
          )}
          {!hasMore && !loading && products.length > 0 && (
            <p style={{ fontSize: 11, color: "#bbb", letterSpacing: 2.5, fontWeight: 600, margin: 0 }}>
              ✦ END OF COLLECTION ✦
            </p>
          )}
        </div>
      </div>
    </>
  );
}
