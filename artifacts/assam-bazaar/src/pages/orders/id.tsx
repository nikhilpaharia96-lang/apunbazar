import { useState } from "react";
import { useSEO } from "@/hooks/use-seo";
import { useParams, Link } from "wouter";
import { useAddToCart, type Order } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { fetchGatewayParams, openRazorpayCheckout } from "@/lib/razorpay";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, MapPin, CreditCard, CheckCircle, Circle, Truck, RefreshCw, Loader2, MessageCircle, Edit2 } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { TrackOnWhatsApp } from "@/components/WhatsAppButtons";
import { useInvalidateCart } from "@/hooks/use-shop-data";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending:    { bg: "#fff8e1", text: "#b45309", border: "#fde68a" },
  confirmed:  { bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe" },
  processing: { bg: "#f3e8ff", text: "#7c3aed", border: "#e9d5ff" },
  shipped:    { bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe" },
  delivered:  { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
  cancelled:  { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" },
};

const statusSteps = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function OrderDetail() {
  useSEO({ title: "Order Details", noindex: true });
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const { sessionId } = useSession();
  const { toast } = useToast();
  const invalidateCart = useInvalidateCart();
  const addToCart = useAddToCart();
  const [reordering, setReordering] = useState(false);

  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>(() => {
    try { return localStorage.getItem("apunbazar_last_email") ?? ""; } catch { return ""; }
  });
  const [emailInput, setEmailInput] = useState("");
  const [paying, setPaying] = useState(false);

  // The order is only returned to the person who knows the checkout email (admins use their token)
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id, email],
    enabled: !!id,
    retry: false,
    queryFn: () => apiFetch<Order>(`/api/orders/${id}${email ? `?email=${encodeURIComponent(email)}` : ""}`, { auth: true }),
  });

  async function handlePayNow() {
    if (!order) return;
    setPaying(true);
    try {
      const gateway = await fetchGatewayParams(order.id, order.customerEmail);
      await openRazorpayCheckout({
        gateway, orderId: order.id, description: `Order ${order.orderNumber}`,
        prefill: { name: order.customerName, email: order.customerEmail, contact: order.customerPhone },
        onPaid: () => { setPaying(false); toast({ title: "Payment successful 🎉" }); queryClient.invalidateQueries({ queryKey: ["order", id] }); },
        onDismiss: () => setPaying(false),
        onError: (message) => { setPaying(false); toast({ title: "Payment issue", description: message, variant: "destructive" }); },
      });
    } catch (e) {
      setPaying(false);
      toast({ title: "Could not start payment", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    }
  }

  async function handleReorder() {
    if (!sessionId || !order) return;
    setReordering(true);
    try {
      const orderItems = order.items as Array<{ productId: number; price: number; quantity: number }>;
      for (const item of orderItems) {
        await new Promise<void>((resolve, reject) =>
          addToCart.mutate({ data: { sessionId, productId: item.productId, quantity: item.quantity } },
            { onSuccess: () => resolve(), onError: reject })
        );
      }
      invalidateCart();
      toast({ title: "Added to cart! 🛒", description: `${orderItems.length} items added` });
    } catch {
      toast({ title: "Reorder failed", variant: "destructive" });
    } finally {
      setReordering(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-enter container mx-auto px-4 py-8 max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-enter container mx-auto px-4 py-16 max-w-2xl text-center">
        <p className="text-gray-600 mb-4">We couldn't find this order{email ? " for that email" : ""}. Enter the email address used at checkout to view it.</p>
        <form onSubmit={e => { e.preventDefault(); setEmail(emailInput.trim()); }} style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <input type="email" required value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="Email used at checkout"
            style={{ height: 44, padding: "0 14px", border: "1.5px solid #e0e0e0", borderRadius: 12, fontSize: 14, minWidth: 240 }} />
          <button type="submit" style={{ background: "#1a5a32", color: "#fff", border: "none", borderRadius: 12, padding: "0 22px", height: 44, fontWeight: 700, cursor: "pointer" }}>View order</button>
        </form>
        <Link href="/orders">
          <button style={{ marginTop: 16, background: "#1a5a32", color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 700, cursor: "pointer" }}>
            Back to Orders
          </button>
        </Link>
      </div>
    );
  }

  const currentStep = statusSteps.indexOf(order.status);
  const sc = statusColors[order.status] ?? statusColors.pending;
  const items = (order.items as Array<{ productId: number; name?: string; imageUrl?: string; productName?: string; productImage?: string; price: number; quantity: number }>)
    .map(i => ({ ...i, productName: i.name ?? i.productName ?? `Product #${i.productId}`, productImage: i.imageUrl ?? i.productImage ?? "" }));

  return (
    <div className="page-enter min-h-screen" style={{ background: "#f5f5f0" }}>
      <style>{`
        .detail-card { background: #fff; border-radius: 16px; padding: 20px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .step-line { flex: 1; height: 2px; margin-bottom: 20px; }
        .action-btn { border: none; border-radius: 12px; padding: 10px 18px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: opacity 0.2s; }
        .wa-btn { background: #0b7a3a; color: #fff; }
        .wa-btn:hover { opacity: 0.9; }
        .change-btn { background: #fff; border: 1.5px solid #ddd !important; color: #555; border-radius: 10px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
      `}</style>

      <div className="container mx-auto px-4 py-6 max-w-2xl">

        {/* Back */}
        <Link href="/orders">
          <button style={{ display: "flex", alignItems: "center", gap: 6, color: "#1a5a32", fontWeight: 600, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>
            <ArrowLeft className="h-4 w-4" /> Back to Orders
          </button>
        </Link>

        {/* Header */}
        <div className="detail-card">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-bold text-xl text-gray-900">{order.orderNumber}</h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <TrackOnWhatsApp orderNumber={order.orderNumber} />
              <div style={{ background: sc.bg, color: sc.text, border: `1.5px solid ${sc.border}`, borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 700 }}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </div>
            </div>
          </div>
          {/* Decorative leaf */}
          <div style={{ position: "absolute", right: 20, bottom: 10, opacity: 0.07, fontSize: 48, pointerEvents: "none" }}>🌿</div>
        </div>

        {/* Progress timeline */}
        {order.status !== "cancelled" && (
          <div className="detail-card">
            <h2 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: "#1a5a32" }} /> Order Progress
            </h2>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              {statusSteps.map((step, i) => (
                <div key={step} style={{ display: "flex", alignItems: "center", flex: i < statusSteps.length - 1 ? 1 : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {i <= currentStep ? (
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a5a32", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #ddd", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Circle className="h-3 w-3 text-gray-600" />
                      </div>
                    )}
                    <span style={{ fontSize: 10, marginTop: 4, fontWeight: i <= currentStep ? 700 : 400, color: i <= currentStep ? "#1a5a32" : "#aaa", textAlign: "center", whiteSpace: "nowrap" }}>
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </span>
                  </div>
                  {i < statusSteps.length - 1 && (
                    <div className="step-line" style={{ background: i < currentStep ? "#1a5a32" : "#e5e7eb" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items ordered */}
        <div className="detail-card">
          <h2 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2">
            <Package className="h-4 w-4" style={{ color: "#1a5a32" }} /> Items Ordered
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", background: "#f5f5f0", flexShrink: 0 }}>
                  {item.productImage && (
                    <img src={item.productImage} alt={item.productName} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/56x56/e8f0e9/2d6a4f?text=${encodeURIComponent(item.productName.slice(0, 4))}`; }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <Link href={`/products/${item.productId}`}>
                    <p className="font-semibold text-sm hover:text-green-700 transition-colors">{item.productName}</p>
                  </Link>
                  <p style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>Qty: {item.quantity}</p>
                </div>
                <p className="font-bold text-sm">₹{(item.price * item.quantity).toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>

          {/* Price breakdown */}
          <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 16, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{(order.subtotal ?? 0).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping{order.paymentMethod === "cod" ? " + COD" : ""}</span>
              {(order.shippingFee ?? 0) === 0
                ? <span style={{ color: "#1a5a32", fontWeight: 700 }}>Free</span>
                : <span>₹{(order.shippingFee ?? 0).toLocaleString("en-IN")}</span>
              }
            </div>
            <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 10 }} className="flex justify-between">
              <span className="font-bold text-base">Total</span>
              <span className="font-bold text-base" style={{ color: "#1a5a32" }}>₹{(order.total ?? 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="detail-card" style={{ position: "relative" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-gray-700 flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: "#1a5a32" }} /> Shipping Address
            </h2>
            <button className="change-btn">Change</button>
          </div>
          <p className="font-bold text-sm text-gray-900">{order.customerName}</p>
          <p className="text-sm text-gray-600 mt-0.5">{order.shippingAddress}</p>
          <p className="text-sm text-gray-600">{order.shippingCity}, {order.shippingState} — {order.shippingPincode}</p>
          <p className="text-sm text-gray-600 mt-1">{order.customerPhone}</p>
        </div>

        {/* Payment */}
        <div className="detail-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-gray-700 flex items-center gap-2">
              <CreditCard className="h-4 w-4" style={{ color: "#1a5a32" }} /> Payment Info
            </h2>
            <button className="change-btn">Change</button>
          </div>
          <p className="font-semibold text-sm">{order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: order.paymentStatus === "paid" ? "#dcfce7" : "#fff8e1", color: order.paymentStatus === "paid" ? "#15803d" : "#b45309", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, marginTop: 8 }}>
            Payment {order.paymentStatus === "paid" ? "Completed" : "Pending"}
          </div>
          {order.paymentMethod === "razorpay" && order.paymentStatus === "pending" && !["cancelled", "refunded"].includes(order.status) && (
            <div style={{ marginTop: 12 }}>
              <button onClick={handlePayNow} disabled={paying}
                style={{ background: "#1a5a32", color: "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, fontSize: 14, cursor: paying ? "wait" : "pointer", opacity: paying ? 0.7 : 1 }}>
                {paying ? "Opening payment…" : `Pay ₹${(order.total ?? 0).toLocaleString("en-IN")} now`}
              </button>
              <p className="text-xs text-gray-600 mt-1.5">Your items are reserved for you. Complete payment to confirm the order.</p>
            </div>
          )}
          {order.notes && (
            <p className="text-gray-600 text-xs mt-3 italic">Note: {order.notes}</p>
          )}
        </div>

        {/* Support */}
        <div style={{ background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle className="h-4 w-4" style={{ color: "#1a5a32" }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: "#1a5a32" }}>Need help with your order?</p>
              <p style={{ fontSize: 11, color: "#555" }}>Our support team is here to help you.</p>
            </div>
          </div>
          <a href="https://wa.me/919395722454" target="_blank" rel="noreferrer" className="action-btn wa-btn">
            <MessageCircle className="h-3.5 w-3.5" /> Contact Support
          </a>
        </div>

        {/* Reorder */}
        {order.status === "delivered" && (
          <button onClick={handleReorder} disabled={reordering}
            style={{ width: "100%", background: "#1a5a32", color: "#fff", border: "none", borderRadius: 14, padding: "16px", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {reordering ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding to cart…</> : <><RefreshCw className="h-4 w-4" /> Dobara Order Karo</>}
          </button>
        )}
      </div>
    </div>
  );
}
