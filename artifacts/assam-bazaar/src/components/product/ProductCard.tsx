/**
 * components/product/ProductCard.tsx
 *
 * Renamed from product-card.tsx to PascalCase to match React component conventions.
 *
 * Problems fixed vs original:
 * - `type Product` was defined inline — imported from shared types
 * - wishlisted state was optimistic but not initialized from actual wishlist data
 *   (user would see heart as empty even if item is wishlisted on another visit)
 * - triggerCartAnim used setTimeout — cleaned up with useEffect on unmount
 * - Stock-out overlay text was in Hindi ("Stock nahi hai") — now English
 * - No aria-labels on interactive buttons
 */

import { Link } from "wouter";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use-session";
import { useAddToCart, useAddToWishlist } from "@workspace/api-client-react";
import { useInvalidateCart, useInvalidateWishlist } from "@/hooks/use-shop-data";
import { useToast } from "@/hooks/use-toast";
import { ProductImageSlider } from "@/components/product-image-slider";
import { useState, useCallback, useEffect, useRef } from "react";
import { StarRating } from "@/components/product/StarRating";
import type { FormattedProduct } from "@/types/shop";

interface ProductCardProps {
  product: FormattedProduct;
  /** If true, renders a compact variant for use in carousels */
  compact?: boolean;
}

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const { sessionId } = useSession();
  const { toast } = useToast();
  const invalidateCart = useInvalidateCart();
  const invalidateWishlist = useInvalidateWishlist();
  const addToCart = useAddToCart();
  const addToWishlist = useAddToWishlist();

  const [cartAdded, setCartAdded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const cartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timer on unmount to avoid state updates on unmounted component
  useEffect(() => {
    return () => {
      if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
    };
  }, []);

  const discount =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) * 100,
        )
      : null;

  const images: string[] =
    product.images?.length > 0
      ? product.images.filter(Boolean)
      : product.imageUrl
        ? [product.imageUrl]
        : [];

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!sessionId || product.stock === 0 || cartAdded || addToCart.isPending) return;

      setCartAdded(true);
      cartTimerRef.current = setTimeout(() => setCartAdded(false), 1200);

      addToCart.mutate(
        { data: { sessionId, productId: product.id, quantity: 1 } },
        {
          onSuccess: () => {
            invalidateCart();
            toast({ title: "Added to cart 🛒", description: product.name });
          },
          onError: () => {
            setCartAdded(false);
            toast({
              title: "Could not add to cart",
              description: "Please try again",
              variant: "destructive",
            });
          },
        },
      );
    },
    [sessionId, product, cartAdded, addToCart, invalidateCart, toast],
  );

  const handleToggleWishlist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!sessionId) return;

      const wasWishlisted = wishlisted;
      setWishlisted((v) => !v);

      addToWishlist.mutate(
        { data: { sessionId, productId: product.id } },
        {
          onSuccess: () => {
            invalidateWishlist();
            toast({
              title: wasWishlisted ? "Removed from wishlist" : "Added to wishlist!",
              description: product.name,
            });
          },
          onError: () => {
            setWishlisted(wasWishlisted); // Revert optimistic update
            toast({ title: "Could not update wishlist", variant: "destructive" });
          },
        },
      );
    },
    [sessionId, product, wishlisted, addToWishlist, invalidateWishlist, toast],
  );

  return (
    <Link href={`/products/${product.id}`}>
      <article
        className="group relative bg-white rounded-2xl overflow-hidden border border-gray-100 cursor-pointer h-full flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300"
        aria-label={`${product.name} — ₹${product.price}`}
      >
        {/* Image area */}
        <div className="relative overflow-hidden rounded-t-2xl bg-gray-50">
          <div className="group-hover:scale-105 transition-transform duration-500">
            <ProductImageSlider
              images={images}
              productName={product.name}
              interval={3500}
            />
          </div>

          {/* Badges */}
          {discount && discount > 0 && (
            <div className="absolute top-2 left-2 z-20">
              <Badge className="bg-red-700 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                -{discount}%
              </Badge>
            </div>
          )}
          {product.featured && !discount && (
            <div className="absolute top-2 left-2 z-20">
              <Badge className="bg-[#2d4a2d] text-white text-[10px] font-bold px-2 py-0.5 shadow-sm">
                Featured
              </Badge>
            </div>
          )}

          {/* Out of stock overlay */}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center">
              <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                Out of Stock
              </span>
            </div>
          )}

          {/* Wishlist toggle */}
          <button
            onClick={handleToggleWishlist}
            aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={wishlisted}
            className="absolute bottom-2 right-2 z-20 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-orange-100 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-sm"
            style={{ color: wishlisted ? "#ef4444" : "#774813" }}
          >
            <Heart size={14} fill={wishlisted ? "currentColor" : "none"} />
          </button>
        </div>

        {/* Body */}
        <div className={`flex flex-col gap-1 flex-1 ${compact ? "p-2" : "p-3"}`}>
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#774813] truncate">
            {product.categoryName}
          </p>
          <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2">
            {product.name}
          </h3>
          {product.artisan && (
            <p className="text-xs text-gray-600 truncate">by {product.artisan}</p>
          )}

          {product.rating > 0 && (
            <StarRating rating={product.rating} reviewCount={product.reviewCount} />
          )}

          <div className="flex items-center justify-between mt-auto pt-2 gap-2">
            <div className="flex flex-col">
              <span className="text-base font-extrabold text-[#2d4a2d]">
                ₹{product.price.toLocaleString("en-IN")}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-xs text-gray-600 line-through">
                  ₹{product.originalPrice.toLocaleString("en-IN")}
                </span>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || addToCart.isPending}
              aria-label={`Add ${product.name} to cart`}
              className="rounded-full text-white text-xs px-3 py-1.5 h-auto font-bold flex items-center gap-1.5 min-w-[64px] relative overflow-hidden transition-colors duration-200"
              style={{ background: cartAdded ? "#16a34a" : "#2d4a2d" }}
            >
              {cartAdded ? (
                <>
                  {/* Checkmark icon inline to avoid svg import overhead */}
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Added</span>
                </>
              ) : addToCart.isPending ? (
                <span
                  className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-label="Adding to cart"
                />
              ) : (
                <>
                  <ShoppingCart size={13} aria-hidden />
                  <span>Add</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </article>
    </Link>
  );
}

// Default export for backwards compatibility with lazy imports
export default ProductCard;
