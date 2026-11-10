import { Link } from "wouter";
import { useSEO } from "@/hooks/use-seo";
import { useRemoveFromWishlist, useAddToCart } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, ShoppingCart, Trash2, Share2, ShieldCheck, Bell, Bookmark, Lock } from "lucide-react";
import { useWishlist, useInvalidateWishlist, useInvalidateCart } from "@/hooks/use-shop-data";
import { trackAddToCart } from "@/lib/analytics";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";

const TRUST = [
  { icon: ShieldCheck, label: "Best Prices",   sub: "Handpicked for you" },
  { icon: Bell,        label: "Price Alerts",  sub: "Never miss a deal" },
  { icon: Bookmark,    label: "Easy Access",   sub: "All saved in one place" },
  { icon: Lock,        label: "Safe & Secure", sub: "Your data is protected" },
];

export default function Wishlist() {
  useSEO({ title: "Wishlist", noindex: true });
  const { wishlist, isLoading } = useWishlist();
  const { sessionId } = useSession();
  const { toast } = useToast();
  const invalidateWishlist = useInvalidateWishlist();
  const invalidateCart = useInvalidateCart();
  const removeFromWishlist = useRemoveFromWishlist();
  const addToCart = useAddToCart();

  function handleRemove(productId: number) {
    if (!sessionId) return;
    removeFromWishlist.mutate(
      { productId, params: { sessionId } },
      { onSuccess: () => invalidateWishlist() }
    );
  }

  function handleMoveToCart(productId: number, name: string) {
    if (!sessionId) return;
    addToCart.mutate(
      { data: { sessionId, productId, quantity: 1 } },
      {
        onSuccess: () => {
          invalidateCart();
          removeFromWishlist.mutate({ productId, params: { sessionId } });
          invalidateWishlist();
          toast({ title: "Moved to cart! 🛒", description: name });
          const item = wishlist.find(i => i.productId === productId);
          if (item?.product) trackAddToCart({ id: item.product.id, name: item.product.name, price: item.product.price, category: item.product.categoryName, quantity: 1 });
        },
      }
    );
  }

  const items = Array.isArray(wishlist) ? wishlist : (wishlist as any)?.data ?? [];

  return (
    <div className="min-h-screen" style={{ background: "#F5F5F0" }}>
      <div className="container mx-auto px-4 py-6 max-w-2xl">

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-3">
            <Heart className="h-7 w-7 fill-rose-500 text-rose-500" />
            <div>
              <div className="flex items-center gap-2">
                <h1 style={{ fontFamily: "'Georgia',serif", fontSize: 26, fontWeight: 700, color: "#1a1a1a" }}>
                  Wishlist
                </h1>
                {wishlist && (
                  <span style={{ fontSize: 15, color: "#666", fontWeight: 400 }}>
                    ({items.length} Items)
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: "#4b5563", marginTop: 2 }}>Your saved favourites</p>
            </div>
          </div>
          <button
            style={{
              display: "flex", alignItems: "center", gap: 6,
              border: "1.5px solid #1A6B3C", borderRadius: 20,
              padding: "7px 16px", background: "transparent",
              color: "#1A6B3C", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {/* ── CONTENT ── */}
        {isLoading ? (
          <div className="flex flex-col gap-4 mt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 rounded-2xl mt-6" style={{ background: "#fff" }}>
            <Heart className="h-16 w-16 mx-auto mb-4 opacity-20 text-rose-400" />
            <h2 style={{ fontFamily: "'Georgia',serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Your wishlist is empty
            </h2>
            <p style={{ color: "#4b5563", fontSize: 14, marginBottom: 20 }}>
              Save products you love
            </p>
            <Link href="/products">
              <button style={{
                background: "#1A6B3C", color: "#fff", border: "none",
                borderRadius: 12, padding: "12px 28px",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}>
                Browse Products
              </button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-5">
            {items.map((item: any) => {
              const p = item.product;
              if (!p) return null;
              const discount = p.originalPrice
                ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
                : 0;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
                  data-testid={`card-wishlist-${item.id}`}
                >
                  <div className="flex gap-0">
                    {/* Image */}
                    <Link href={`/products/${p.id}`}>
                      <div className="relative flex-shrink-0" style={{ width: 150, height: 180 }}>
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              `https://placehold.co/150x180/EAF5EE/1A6B3C?text=${encodeURIComponent(p.name.slice(0, 8))}`;
                          }}
                        />
                        {discount > 0 && (
                          <div style={{
                            position: "absolute", top: 10, left: 10,
                            background: "#E5432A", color: "#fff",
                            fontSize: 11, fontWeight: 700,
                            padding: "3px 8px", borderRadius: 20,
                          }}>
                            -{discount}%
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Info */}
                    <div style={{ flex: 1, padding: "14px 14px 14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        {/* Category + Delete */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#1A6B3C", letterSpacing: 1 }}>
                            {p.categoryName?.toUpperCase()}
                          </span>
                          <button
                            onClick={() => handleRemove(item.productId)}
                            disabled={removeFromWishlist.isPending}
                            style={{
                              width: 32, height: 32, borderRadius: "50%",
                              background: "#FFF0F0", border: "none",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer", flexShrink: 0,
                            }}
                            data-testid={`button-remove-wishlist-${item.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </button>
                        </div>

                        {/* Name */}
                        <Link href={`/products/${p.id}`}>
                          <h3 style={{
                            fontFamily: "'Georgia',serif", fontSize: 17, fontWeight: 700,
                            color: "#1a1a1a", lineHeight: 1.3, marginBottom: 4,
                          }}>
                            {p.name}
                          </h3>
                        </Link>

                        {/* Artisan/desc */}
                        {p.artisan && (
                          <p style={{ fontSize: 12, color: "#4b5563", marginBottom: 6 }}>{p.artisan}</p>
                        )}

                        {/* Stars */}
                        {p.rating > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} style={{ color: i < Math.round(p.rating) ? "#F5A623" : "#ddd", fontSize: 13 }}>★</span>
                            ))}
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{p.rating.toFixed(1)}</span>
                            {p.reviewCount > 0 && (
                              <span style={{ fontSize: 11, color: "#4b5563" }}>({p.reviewCount})</span>
                            )}
                          </div>
                        )}

                        {/* Price */}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontFamily: "'Georgia',serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a" }}>
                            ₹{p.price.toLocaleString("en-IN")}
                          </span>
                          {p.originalPrice && (
                            <span style={{ fontSize: 13, color: "#4b5563", textDecoration: "line-through" }}>
                              ₹{p.originalPrice.toLocaleString("en-IN")}
                            </span>
                          )}
                          {discount > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#1A6B3C", background: "#E8F7EE", padding: "2px 7px", borderRadius: 20 }}>
                              Save ₹{(p.originalPrice - p.price).toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>

                        {/* Authentic tag */}
                        <p style={{ fontSize: 11, color: "#1A6B3C", display: "flex", alignItems: "center", gap: 4 }}>
                          🌿 100% Authentic · Direct from Assam
                        </p>
                      </div>

                      {/* CTA Buttons */}
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button
                          onClick={() => handleMoveToCart(item.productId, p.name)}
                          disabled={addToCart.isPending}
                          style={{
                            flex: 1, height: 40,
                            border: "1.5px solid #ccc", background: "#fff",
                            borderRadius: 10, fontSize: 12, fontWeight: 600,
                            color: "#333", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          }}
                          data-testid={`button-move-to-cart-${item.id}`}
                        >
                          <Heart className="h-3.5 w-3.5 text-rose-400" />
                          Move to Cart
                        </button>
                        <button
                          onClick={() => handleMoveToCart(item.productId, p.name)}
                          disabled={addToCart.isPending}
                          style={{
                            flex: 1.4, height: 40,
                            background: "#1A6B3C", border: "none",
                            borderRadius: 10, fontSize: 12, fontWeight: 600,
                            color: "#fff", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          }}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ── EXPLORE BANNER ── */}
            <div
              className="rounded-2xl p-5 flex items-center justify-between gap-4 mt-2"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              <div style={{ fontSize: 44 }}>🛍️</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a", marginBottom: 3 }}>
                  Keep adding your favourites!
                </p>
                <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>
                  We'll remind you when there are great offers.
                </p>
              </div>
              <Link href="/products">
                <button style={{
                  border: "1.5px solid #1A6B3C", background: "#fff",
                  color: "#1A6B3C", borderRadius: 10,
                  padding: "9px 16px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  Explore Now
                </button>
              </Link>
            </div>

            {/* ── TRUST BADGES ── */}
            <div
              className="grid grid-cols-4 rounded-2xl overflow-hidden mt-2"
              style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              {TRUST.map(({ icon: Icon, label, sub }, i) => (
                <div
                  key={label}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    textAlign: "center", padding: "18px 8px",
                    borderRight: i < 3 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: "#EAF5EE",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 8,
                  }}>
                    <Icon className="h-5 w-5 text-[#1A6B3C]" />
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{label}</p>
                  <p style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.4 }}>{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
