import { Link, useLocation } from "wouter";
import { useCart, useWishlist } from "@/hooks/use-shop-data";
import { ShoppingCart, Heart, Menu, ChevronDown, X, User } from "lucide-react";
import { useCustomer } from "@/lib/customer-auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export default function Navbar() {
  const { cart }              = useCart();
  const { wishlist }          = useWishlist();
  const [location, navigate]  = useLocation();
  const customer = useCustomer();
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [hoveredMain, setHoveredMain] = useState<number | null>(null);
  const [scrolled, setScrolled]       = useState(false);

  const { data: tree = [] } = useQuery({
    queryKey: ["categories-tree"],
    queryFn: async () => {
      const r = await fetch("/api/categories/tree");
      return r.ok ? r.json() : [];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const cartCount = cart?.itemCount || 0;
  const wishCount = (wishlist as any[])?.length || 0;

  return (
    <>
      {/* Announcement bar */}
      <div className="hidden sm:flex items-center justify-center gap-6 py-2 px-4 text-[11px] font-medium tracking-wide"
        style={{ background: "#1a3a1a", color: "rgba(255,255,255,.8)" }}>
        <span>🚚 Free shipping above ₹499</span>
        <span style={{ color: "rgba(255,255,255,.25)" }}>|</span>
        <span>🌿 100% authentic Assamese products</span>
        <span style={{ color: "rgba(255,255,255,.25)" }}>|</span>
        <Link href="/products">
          <span className="underline underline-offset-2 cursor-pointer"
            style={{ color: "#d4a017" }}>Shop Now →</span>
        </Link>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-50 w-full transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,.97)" : "#fff",
          boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,.10)" : "0 1px 0 rgba(0,0,0,.06)",
          backdropFilter: scrolled ? "blur(12px)" : "none",
        }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(true)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors -ml-1"
            aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
<Link href="/" className="flex items-center gap-2 select-none flex-shrink-0">
  <img src="/logo.png" alt="ApunBazar" className="h-9 w-auto object-contain"
    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
  <div className="flex flex-col leading-none">
    <span className="font-serif font-bold text-xl leading-none">
      <span style={{ color: "#1a5c2a" }}>Apun</span>
      <span style={{ color: "#b86a00" }}>Bazar</span>
    </span>
    <span style={{
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: "2.5px",
      color: "#1a5c2a",
      textTransform: "uppercase",
      marginTop: 3,
      display: "flex",
      alignItems: "center",
      gap: 4,
    }}>
      <span style={{ flex: 1, height: 1, background: "#1a5c2a", opacity: 0.4 }} />
      The Pride of Assam
      <span style={{ flex: 1, height: 1, background: "#1a5c2a", opacity: 0.4 }} />
    </span>
  </div>
</Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 text-sm font-medium ml-6">
            <Link href="/products">
              <span className={`px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                location === "/products"
                  ? "text-primary bg-primary/8 font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}>Shop All</span>
            </Link>

            {(tree as any[]).slice(0, 5).map((main: any) => (
              <div key={main.id} className="relative"
                onMouseEnter={() => setHoveredMain(main.id)}
                onMouseLeave={() => setHoveredMain(null)}>
                <Link href={`/category/${main.slug}`}>
                  <span className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                    location.includes(main.slug)
                      ? "text-primary bg-primary/8 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}>
                    {main.name}
                    {main.subCategories?.length > 0 && <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
                  </span>
                </Link>

                {hoveredMain === main.id && main.subCategories?.length > 0 && (
                  <div className="absolute top-full left-0 bg-white border rounded-xl py-2 min-w-48 z-50"
                    style={{ boxShadow: "0 16px 48px rgba(0,0,0,.12)" }}>
                    {main.subCategories.map((sub: any) => (
                      <Link key={sub.id} href={`/category/${sub.slug}`}>
                        <span className="block px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors cursor-pointer font-medium">
                          {sub.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Right icons */}
          <div className="flex items-center gap-2 ml-auto mr-2">

            <Link href={customer ? "/account" : "/login"} aria-label={customer ? "My account" : "Log in"}>
              <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label={customer ? "My account" : "Log in"} data-testid="button-account">
                <User className="h-5 w-5" style={customer ? { color: "#1a5c2a" } : undefined} />
                {customer && <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden />}
              </button>
            </Link>

            <Link href="/wishlist">
              <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Wishlist">
                <Heart className={`h-5 w-5 transition-colors ${wishCount > 0 ? "fill-rose-500 text-rose-500" : ""}`} />
                {wishCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center">
                    {wishCount > 9 ? "9+" : wishCount}
                  </span>
                )}
              </button>
            </Link>

            <Link href="/cart" aria-label="Cart">
              <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" aria-label="Cart">
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                    style={{ background: "#1a5c2a" }}>
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)} />
          <div className="absolute top-0 left-0 h-full w-72 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b flex-shrink-0">
              <span className="font-serif font-bold text-lg">
                <span style={{ color: "#1a5c2a" }}>Apun</span>
                <span style={{ color: "#b86a00" }}>Bazar</span>
              </span>
              <button onClick={() => setMobileOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Browse</p>
              <Link href="/products">
                <span className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-muted transition-colors mb-0.5 text-primary">
                  🛍️ All Products
                </span>
              </Link>
              {(tree as any[]).map((main: any) => (
                <div key={main.id}>
                  <Link href={`/category/${main.slug}`}>
                    <span className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors mb-0.5">
                      {main.name}
                    </span>
                  </Link>
                  {main.subCategories?.slice(0, 3).map((sub: any) => (
                    <Link key={sub.id} href={`/category/${sub.slug}`}>
                      <span className="block pl-8 pr-3 py-2 text-xs text-muted-foreground hover:bg-muted rounded-lg mb-0.5">
                        · {sub.name}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}

              <div className="mt-4 pt-4 border-t">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Account</p>
                {[
                  { href: "/orders",   label: "📦 My Orders" },
                  { href: "/wishlist", label: "❤️ Wishlist" },
                  { href: "/cart",     label: "🛒 Cart" },
                ].map(l => (
                  <Link key={l.href} href={l.href}>
                    <span className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors mb-0.5">
                      {l.label}
                    </span>
                  </Link>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Info</p>
                {[
                  { href: "/about",         label: "About Us" },
                  { href: "/contact",       label: "Contact" },
                  { href: "/refund-policy", label: "Refund Policy" },
                ].map(l => (
                  <Link key={l.href} href={l.href}>
                    <span className="block px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg mb-0.5">
                      {l.label}
                    </span>
                  </Link>
                ))}
              </div>
            </nav>

            <div className="p-4 border-t bg-muted/30 flex-shrink-0">
              <p className="text-xs text-muted-foreground">📍 Delivering across India from Assam 🌿</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
