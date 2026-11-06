import { Link } from "wouter";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use-session";
import { useAddToCart, useAddToWishlist } from "@workspace/api-client-react";
import { useInvalidateCart, useInvalidateWishlist } from "@/hooks/use-shop-data";
import { useToast } from "@/hooks/use-toast";
import { ProductImageSlider } from "./product-image-slider";
import { useState, useCallback } from "react";

type Product = {
  id: number;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number | null;
  imageUrl: string;
  images?: string[];
  rating: number;
  reviewCount: number;
  categoryName: string;
  artisan?: string | null;
  stock: number;
  featured: boolean;
};

export default function ProductCard({ product }: { product: Product }) {
  const { sessionId } = useSession();
  const { toast } = useToast();
  const invalidateCart = useInvalidateCart();
  const invalidateWishlist = useInvalidateWishlist();
  const addToCart = useAddToCart();
  const addToWishlist = useAddToWishlist();

  const [cartAdded, setCartAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishAnimKey, setWishAnimKey] = useState(0);

  const triggerCartAnim = useCallback(() => {
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 1200);
  }, []);

  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  const images: string[] =
    product.images && product.images.length > 0
      ? product.images.filter(Boolean)
      : product.imageUrl
      ? [product.imageUrl]
      : [];

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!sessionId) {
      toast({ title: "Session error", description: "Please refresh and try again", variant: "destructive" });
      return;
    }
    if (product.stock === 0) return;
    if (cartAdded || addToCart.isPending) return;
    triggerCartAnim();
    addToCart.mutate(
      { data: { sessionId, productId: product.id, quantity: 1 } },
      {
        onSuccess: () => {
          invalidateCart();
          toast({ title: "Added to cart! 🛒", description: product.name });
        },
        onError: () => {
          setCartAdded(false);
          toast({ title: "Could not add to cart", description: "Please try again", variant: "destructive" });
        },
      }
    );
  }

  function handleAddToWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!sessionId) return;
    setWishlisted(v => !v);
    setWishAnimKey(k => k + 1);
    addToWishlist.mutate(
      { data: { sessionId, productId: product.id } },
      {
        onSuccess: () => {
          invalidateWishlist();
          toast({ title: wishlisted ? "Removed from wishlist" : "Added to wishlist!", description: product.name });
        },
        onError: () => {
          setWishlisted(v => !v); // revert
          toast({ title: "Could not update wishlist", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Link href={`/products/${product.id}`} style={{ display: "block", minWidth: 0 }}>
      <div className="group relative w-full min-w-0 max-w-full bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer h-full flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300">

        {/* Image */}
        <div className="relative overflow-hidden rounded-t-2xl bg-gray-50">
          <div className="group-hover:scale-105 transition-transform duration-500">
            <ProductImageSlider images={images} productName={product.name} interval={3500} />
          </div>

          {/* Badges */}
          {discount && discount > 0 && (
            <div className="absolute top-2 left-2 z-20">
              <Badge className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">-{discount}%</Badge>
            </div>
          )}
          {product.featured && !discount && (
            <div className="absolute top-2 left-2 z-20">
              <Badge className="bg-[#2d4a2d] text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">Featured</Badge>
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center">
              <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                Stock nahi hai
              </span>
            </div>
          )}

          {/* Wishlist */}
          <button
            key={wishAnimKey}
            onClick={handleAddToWishlist}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className="absolute bottom-2 right-2 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-orange-100 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-sm"
            style={{ color: wishlisted ? "#ef4444" : "#c17b3e" }}
          >
            <Heart size={14} fill={wishlisted ? "currentColor" : "none"} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1 p-3 flex-1">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#c17b3e] truncate">
            {product.categoryName}
          </p>
          <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">{product.name}</h3>
          {product.artisan && (
            <p className="text-xs text-gray-400 truncate">by {product.artisan}</p>
          )}

          {product.rating > 0 && (
            <div className="flex items-center gap-0.5 mt-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={11} fill={s <= Math.round(product.rating) ? "#c17b3e" : "none"} stroke="#c17b3e" />
              ))}
              <span className="text-[11px] font-semibold text-[#c17b3e] ml-1">{Number(product.rating).toFixed(1)}</span>
              {product.reviewCount > 0 && (
                <span className="text-[11px] text-gray-400 ml-0.5">({product.reviewCount})</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-auto pt-2 gap-2">
            <div className="flex flex-col">
              <span className="text-base font-extrabold text-[#2d4a2d]">
                ₹{Number(product.price).toLocaleString("en-IN")}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-xs text-gray-400 line-through">
                  ₹{Number(product.originalPrice).toLocaleString("en-IN")}
                </span>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || addToCart.isPending}
              className="rounded-full text-white text-xs px-3 py-1.5 h-auto font-bold flex items-center gap-1.5 min-w-[64px] relative overflow-hidden transition-colors duration-200"
              style={{ background: cartAdded ? "#16a34a" : "#2d4a2d" }}
            >
              {cartAdded ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Added</span>
                </>
              ) : addToCart.isPending ? (
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ShoppingCart size={13} />
                  <span>Add</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
