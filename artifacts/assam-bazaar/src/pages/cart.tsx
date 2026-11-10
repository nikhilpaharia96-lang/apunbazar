import { Link } from "wouter";
import { useSEO } from "@/hooks/use-seo";
import { imgProps } from "@/lib/img";
import { useUpdateCartItem, useRemoveFromCart } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, ShoppingCart, ArrowRight, ArrowLeft, Tag, Truck, Shield, RotateCcw } from "lucide-react";
import { useCart, useInvalidateCart } from "@/hooks/use-shop-data";
import { trackRemoveFromCart, clarityCartValue } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";

export default function Cart() {
  useSEO({ title: "Your Cart", noindex: true });
  const { cart, isLoading } = useCart();
  const invalidateCart = useInvalidateCart();
  const { toast } = useToast();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();

  function handleUpdateQty(itemId: number, quantity: number) {
    if (quantity < 1) return;
    updateItem.mutate({ itemId, data: { quantity } }, { onSuccess: () => invalidateCart() });
  }

  function handleRemove(itemId: number, name: string) {
    removeItem.mutate({ itemId }, {
      onSuccess: () => {
        invalidateCart();
        toast({ title: "Removed", description: name });
        const item = cartItems.find(i => i.id === itemId);
        if (item?.product) trackRemoveFromCart({ id: item.product.id, name: item.product.name, price: item.product.price, category: item.product.categoryName, quantity: item.quantity });
      },
    });
  }

  const cartItems = Array.isArray(cart?.items) ? cart!.items : [];
  const hasItems = cartItems.length > 0;
  const subtotal = cart?.total ?? 0;
  const totalOriginal = cartItems.reduce((acc, item) => acc + ((item.product?.originalPrice ?? item.product?.price ?? 0) * item.quantity), 0);
  const totalSavings = totalOriginal - subtotal;
  // Tag cart value in Clarity for session segmentation
  clarityCartValue(subtotal);
  const shippingFee = subtotal >= 999 ? 0 : 49;
  const grandTotal = subtotal + shippingFee;

  return (
    <div className="page-enter min-h-screen" style={{ background: "#f5f5f0" }}>
      <style>{`
        .cart-item { background: #fff; border-radius: 16px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .qty-btn { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid #1a5a32; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #1a5a32; background: #fff; cursor: pointer; transition: all 0.2s; line-height: 1; }
        .qty-btn:hover:not(:disabled) { background: #1a5a32; color: #fff; }
        .qty-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .savings-badge { background: #f0faf4; border: 1px solid #c3e6cb; color: #1a5a32; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
        .checkout-btn { background: #1a5a32; color: #fff; border-radius: 14px; font-weight: 700; font-size: 16px; padding: 16px 24px; width: 100%; display: flex; align-items: center; justify-content: center; gap-8px; border: none; cursor: pointer; transition: background 0.2s; gap: 8px; }
        .checkout-btn:hover { background: #14472a; }
        .trust-bar { display: flex; gap: 0; border-top: 1px solid #eee; padding-top: 16px; margin-top: 8px; }
        .trust-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: #666; text-align: center; padding: 0 4px; }
        .trust-item svg { color: #1a5a32; }
      `}</style>

      <div className="container mx-auto px-4 py-6 max-w-2xl pb-36 lg:pb-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <ShoppingCart className="h-6 w-6" style={{ color: "#1a5a32" }} />
          <h1 className="font-serif text-2xl font-bold text-gray-900">
            Shopping Cart
          </h1>
          {cart && (
            <span className="text-sm text-gray-600 font-medium">
              ({cart.itemCount} item{cart.itemCount !== 1 ? "s" : ""})
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : !hasItems ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm">
            <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-20" style={{ color: "#1a5a32" }} />
            <h2 className="font-serif text-2xl font-bold mb-2">Cart khali hai</h2>
            <p className="text-gray-600 mb-6 text-sm">Kuch khoobsurat Assamese products add karo</p>
            <Link href="/products">
              <button className="checkout-btn" style={{ width: "auto", padding: "12px 28px" }}>
                Products Browse Karo
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* Savings banner */}
            {totalSavings > 0 && (
              <div className="savings-badge mb-4">
                <Tag className="h-4 w-4 flex-shrink-0" />
                Yay! You are saving ₹{totalSavings.toLocaleString("en-IN")} on this order
                <span style={{ marginLeft: "auto", fontSize: 20 }}>🌿</span>
              </div>
            )}

            {/* Cart Items */}
            <div className="mb-4">
              {cartItems.map((item) => {
                const product = item.product;
                const price = product?.price ?? 0;
                const originalPrice = product?.originalPrice ?? price;
                const savings = (originalPrice - price) * item.quantity;
                const lineTotal = price * item.quantity;
                const name = product?.name ?? "Product";
                const imgSrc = product?.imageUrl ?? "";

                return (
                  <div key={item.id} className="cart-item" data-testid={`row-cart-${item.id}`}>
                    <div className="flex gap-3">
                      {/* Image */}
                      <Link href={`/products/${product?.id ?? ""}`}>
                        <div style={{ width: 90, height: 90, borderRadius: 12, overflow: "hidden", background: "#f5f5f0", flexShrink: 0 }}>
                          <img {...imgProps(imgSrc, "90px")} alt={name} loading="lazy" decoding="async" width={90} height={90} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/90x90/e8f0e9/2d6a4f?text=${encodeURIComponent(name.slice(0, 4))}`; }} />
                        </div>
                      </Link>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link href={`/products/${product?.id ?? ""}`}>
                          <p className="font-semibold text-sm leading-snug line-clamp-2 hover:text-green-700 transition-colors" style={{ marginBottom: 2 }}>
                            {name}
                          </p>
                        </Link>

                        {product?.artisan && (
                          <p className="text-xs text-gray-600" style={{ marginBottom: 4 }}>by {product.artisan}</p>
                        )}

                        {/* Authentic badge */}
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f0faf4", borderRadius: 6, padding: "2px 8px", marginBottom: 6 }}>
                          <span style={{ fontSize: 10, color: "#1a5a32" }}>🌿</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#1a5a32" }}>100% Authentic</span>
                        </div>

                        {/* Price row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base" style={{ color: "#1a5a32" }}>₹{price.toLocaleString("en-IN")}</span>
                          {originalPrice > price && (
                            <span className="text-xs text-gray-600 line-through">₹{originalPrice.toLocaleString("en-IN")}</span>
                          )}
                          {savings > 0 && (
                            <span style={{ fontSize: 11, color: "#1a5a32", fontWeight: 700 }}>
                              You save ₹{savings.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom row: qty + total + delete */}
                    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #f0f0f0" }}>
                      {/* Qty stepper */}
                      <div className="flex items-center gap-3">
                        <button className="qty-btn" onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                          disabled={updateItem.isPending || item.quantity <= 1} data-testid={`button-decrease-${item.id}`}>−</button>
                        <span className="font-bold text-base min-w-[1.5rem] text-center" data-testid={`text-qty-${item.id}`}>{item.quantity}</span>
                        <button className="qty-btn" onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                          disabled={updateItem.isPending} data-testid={`button-increase-${item.id}`}>+</button>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-bold text-base">₹{lineTotal.toLocaleString("en-IN")}</span>
                        <button onClick={() => handleRemove(item.id, name)}
                          disabled={removeItem.isPending} data-testid={`button-remove-${item.id}`}
                          style={{ color: "#ef4444", opacity: 0.7, transition: "opacity 0.2s" }}
                          className="hover:opacity-100">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Savings summary banner */}
            {totalSavings > 0 && (
              <div style={{ background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}>🎁</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1a5a32" }}>
                    Congrats! ₹{totalSavings.toLocaleString("en-IN")} saved with offers
                  </span>
                </div>
                <Link href="/products">
                  <button style={{ fontSize: 12, fontWeight: 700, color: "#1a5a32", border: "1.5px solid #1a5a32", borderRadius: 8, padding: "4px 12px", background: "#fff", cursor: "pointer" }}>
                    View Offers ›
                  </button>
                </Link>
              </div>
            )}

            {/* Price breakdown */}
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                <div className="flex justify-between">
                  <span style={{ color: "#555" }}>Price ({cart!.itemCount} item{cart!.itemCount !== 1 ? "s" : ""})</span>
                  <span className="font-semibold">₹{totalOriginal.toLocaleString("en-IN")}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between">
                    <span style={{ color: "#555" }}>Discount</span>
                    <span style={{ color: "#1a5a32", fontWeight: 700 }}>−₹{totalSavings.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: "#555" }}>Shipping</span>
                  {shippingFee === 0
                    ? <span style={{ color: "#1a5a32", fontWeight: 700 }}>FREE</span>
                    : <span className="font-semibold">₹{shippingFee}</span>
                  }
                </div>
                {subtotal < 999 && (
                  <div style={{ background: "#fffbf0", border: "1px solid #f0d080", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#8a6800" }}>
                    ₹{(999 - subtotal).toFixed(0)} aur add karo free shipping ke liye! 🎁
                  </div>
                )}
                <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 10, marginTop: 4 }} className="flex justify-between">
                  <span className="font-bold text-base">Total Amount</span>
                  <span className="font-bold text-base">₹{grandTotal.toLocaleString("en-IN")}</span>
                </div>
                {totalSavings > 0 && (
                  <div style={{ background: "#f0faf4", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1a5a32", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <Shield className="h-3.5 w-3.5" />
                    You will save ₹{totalSavings.toLocaleString("en-IN")} on this order
                  </div>
                )}
              </div>
            </div>

            {/* Checkout button */}
            <Link href="/checkout" data-testid="button-checkout">
              <button className="checkout-btn mb-3">
                <Shield className="h-4 w-4" />
                Checkout Securely
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>

            {/* Continue shopping */}
            <Link href="/products">
              <button style={{ width: "100%", background: "#fff", border: "1.5px solid #ddd", borderRadius: 14, padding: "14px 24px", fontSize: 15, fontWeight: 600, color: "#444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
                <ArrowLeft className="h-4 w-4" /> Continue Shopping
              </button>
            </Link>

            {/* Trust bar */}
            <div className="trust-bar">
              <div className="trust-item">
                <Truck className="h-5 w-5" />
                <span className="font-semibold text-gray-700">Free Delivery</span>
                <span>On orders above ₹499</span>
              </div>
              <div className="trust-item" style={{ borderLeft: "1px solid #eee", borderRight: "1px solid #eee" }}>
                <Shield className="h-5 w-5" />
                <span className="font-semibold text-gray-700">Secure Payments</span>
                <span>100% safe & secure</span>
              </div>
              <div className="trust-item">
                <RotateCcw className="h-5 w-5" />
                <span className="font-semibold text-gray-700">Easy Returns</span>
                <span>7-day return policy</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile sticky checkout bar */}
      {hasItems && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div style={{ background: "#1a5a32", borderRadius: 16, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 -4px 24px rgba(0,0,0,0.15)" }}>
            <div>
              <p style={{ color: "#fff", fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
                ₹{grandTotal.toLocaleString("en-IN")}
              </p>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 }}>
                {cart!.itemCount} item{cart!.itemCount > 1 ? "s" : ""} · {shippingFee === 0 ? "Free delivery 🎉" : `+₹${shippingFee} shipping`}
              </p>
            </div>
            <Link href="/checkout" className="flex-shrink-0">
              <button style={{ background: "#fff", color: "#1a5a32", borderRadius: 10, padding: "10px 20px", fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                Checkout Securely <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
