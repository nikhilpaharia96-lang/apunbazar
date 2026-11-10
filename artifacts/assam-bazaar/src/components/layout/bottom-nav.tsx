import { Link, useLocation } from "wouter";
import { Home, ShoppingCart, Heart, Package, Search } from "lucide-react";
import { useCart, useWishlist } from "@/hooks/use-shop-data";

const G    = "#1a5a32";
const GOLD = "#c9a84c";

const NAV_ITEMS = [
  { href: "/",         icon: Home,         label: "Home"   },
  { href: "/products", icon: Search,       label: "Shop"   },
  { href: "/cart",     icon: ShoppingCart, label: "Cart"   },
  { href: "/wishlist", icon: Heart,        label: "Saved"  },
  { href: "/orders",   icon: Package,      label: "Orders" },
];

export default function BottomNav() {
  const [location]   = useLocation();
  const { cart }     = useCart();
  const { wishlist } = useWishlist();

  const cartCount = cart?.itemCount || 0;
  const wishCount = (wishlist as any[])?.length || 0;

  if (location.startsWith("/admin") || location.startsWith("/staff")) return null;

  return (
    <>
      <style>{`
        @keyframes bn-pop { 0%{transform:scale(.7);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        .bn-item { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; padding:6px 0 4px; gap:3px; position:relative; text-decoration:none; -webkit-tap-highlight-color:transparent; }
        .bn-pill { display:flex; align-items:center; justify-content:center; border-radius:20px; transition:all .25s cubic-bezier(.34,1.56,.64,1); }
        .bn-label { font-size:9.5px; font-weight:600; letter-spacing:.3px; transition:color .2s; line-height:1; }
        .bn-badge { position:absolute; top:-2px; right:-5px; min-width:16px; height:16px; border-radius:8px; font-size:8.5px; font-weight:800; color:#fff; display:flex; align-items:center; justify-content:center; padding:0 3px; border:1.5px solid #fff; animation:bn-pop .3s cubic-bezier(.34,1.56,.64,1); }
      `}</style>

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
        style={{
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          paddingBottom: "env(safe-area-inset-bottom)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.07)",
          minHeight: 58,
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive     = href === "/" ? location === "/" : location.startsWith(href);
          const isBadged     = href === "/cart"     && cartCount > 0;
          const isWishBadged = href === "/wishlist" && wishCount > 0;
          const badgeCount   = isBadged ? cartCount : wishCount;
          const isWish       = href === "/wishlist";

          return (
            <Link key={href} href={href} className="bn-item">
              {/* Active bg pill behind icon */}
              <div
                className="bn-pill"
                style={{
                  background: isActive ? `${G}14` : "transparent",
                  width:  isActive ? 46 : 36,
                  height: 30,
                  marginBottom: 1,
                }}
              >
                <div style={{ position: "relative" }}>
                  <Icon
                    style={{
                      width: 20, height: 20,
                      strokeWidth: isActive ? 2.2 : 1.6,
                      color: isActive ? G : isWish && wishCount > 0 ? "#f43f5e" : "rgba(0,0,0,0.65)",
                      fill: isActive && isWish && wishCount > 0
                        ? "#f43f5e"
                        : isWish && wishCount > 0 && !isActive
                          ? "#f43f5e22"
                          : "none",
                      transition: "all .2s",
                    }}
                  />
                  {(isBadged || isWishBadged) && (
                    <span
                      className="bn-badge"
                      style={{ background: isBadged ? G : "#f43f5e" }}
                    >
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </div>
              </div>

              <span
                className="bn-label"
                style={{ color: isActive ? G : "rgba(0,0,0,0.65)", fontWeight: isActive ? 700 : 500 }}
              >
                {label}
              </span>

              {/* Active dot */}
              {isActive && (
                <div style={{
                  position: "absolute", bottom: 0,
                  width: 20, height: 2.5, borderRadius: 2,
                  background: GOLD,
                  animation: "bn-pop .3s cubic-bezier(.34,1.56,.64,1)",
                }} />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
