import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCart, useInvalidateCart } from "@/hooks/use-shop-data";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import {
  Truck, CreditCard, Banknote, CheckCircle, Loader2, Zap,
  Tag, X, ShieldCheck, RefreshCw, Leaf, ChevronDown, ChevronUp,
  Lock, BadgeCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import { trackPurchase, trackBeginCheckout, trackCouponApplied } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { fetchShippingConfig, DEFAULT_SHIPPING } from "@/lib/shipping-config";
import { apiFetch } from "@/lib/api";
import { openRazorpayCheckout, loadRazorpayScript, type GatewayParams } from "@/lib/razorpay";

// Server-validated coupon preview. The amount actually charged is recomputed by the server.
interface AppliedCoupon { code: string; discount: number }

const checkoutSchema = z.object({
  customerName:    z.string().min(2, "Name required"),
  customerEmail:   z.string().email("Invalid email"),
  customerPhone:   z.string().min(10, "Invalid phone").max(15),
  shippingAddress: z.string().min(5, "Address required"),
  shippingCity:    z.string().min(2, "City required"),
  shippingState:   z.string().min(2, "State required"),
  shippingPincode: z.string().length(6, "Invalid pincode").regex(/^\d+$/, "Numbers only"),
  paymentMethod:   z.enum(["cod", "razorpay"]),
  notes:           z.string().optional(),
});
type CheckoutForm = z.infer<typeof checkoutSchema>;

// ── Trust badge component ──────────────────────────────────────────────────
function TrustBadge({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-1.5 flex-1">
      <div className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "rgba(26,92,42,0.10)" }}>
        <Icon className="h-5 w-5" style={{ color: "#1a5c2a" }} />
      </div>
      <p className="text-xs font-semibold text-gray-800">{title}</p>
      <p className="text-[10px] text-gray-500 leading-tight">{sub}</p>
    </div>
  );
}

export default function Checkout() {
  const [, navigate]     = useLocation();
  const { cart }         = useCart();
  const { sessionId }    = useSession();
  const { toast }        = useToast();
  const invalidateCart   = useInvalidateCart();
  const createOrder      = useCreateOrder();
  const [submitted, setSubmitted]         = useState(false);
  const [orderId, setOrderId]             = useState<number | null>(null);
  const [razorpayLoading, setRpLoading]   = useState(false);
  const [couponOpen, setCouponOpen]       = useState(false);
  const [couponInput, setCouponInput]     = useState("");
  const [appliedCoupon, setApplied]       = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError]     = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const { data: shippingConfig = DEFAULT_SHIPPING } = useQuery({ queryKey: ["shipping-config"], queryFn: fetchShippingConfig, staleTime: 60_000 });

  useEffect(() => { loadRazorpayScript(); }, []);

  const form = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: "",
      customerEmail: (() => { try { return localStorage.getItem("apunbazar_last_email") ?? ""; } catch { return ""; } })(),
      customerPhone: "",
      shippingAddress: "", shippingCity: "", shippingState: "Assam",
      shippingPincode: "", paymentMethod: "cod", notes: "",
    },
  });

  const paymentMethod = form.watch("paymentMethod");
  const cartTotal     = cart?.total ?? 0;
  const isFreeShip    = shippingConfig.freeShippingEnabled && cartTotal >= shippingConfig.freeShippingAbove;
  const shippingFee   = isFreeShip ? 0 : shippingConfig.shippingFee;
  const codFee        = paymentMethod === "cod" && shippingConfig.codEnabled ? shippingConfig.codFee : 0;
  const discount      = appliedCoupon ? appliedCoupon.discount : 0;

  // Original price savings from products
  const cartItems = Array.isArray(cart?.items) ? cart!.items : [];
  const originalTotal = cartItems.reduce((sum, item) => {
    const orig = (item.product as any)?.originalPrice ?? item.product?.price ?? 0;
    return sum + orig * item.quantity;
  }, 0);
  const productSavings = Math.max(0, originalTotal - cartTotal);
  const totalSavings   = productSavings + discount;

  const grandTotal = cartTotal + shippingFee + codFee - discount;

  async function applyCoupon() {
    setCouponError(""); setCouponLoading(true);
    try {
      const r = await apiFetch<{ code: string; discount: number }>(
        `/api/coupons/validate?code=${encodeURIComponent(couponInput.trim())}&subtotal=${cartTotal}`,
      );
      setApplied({ code: r.code, discount: r.discount });
      trackCouponApplied(r.code, r.discount);
      toast({ title: "🎉 Coupon Applied!", description: `₹${r.discount} discount!` });
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : "Invalid or expired coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  function finishOrder(order: { id: number; orderNumber?: string }, values: CheckoutForm) {
    invalidateCart();
    try { localStorage.setItem("apunbazar_last_email", values.customerEmail); } catch {}
    trackPurchase(
      order.orderNumber ?? String(order.id),
      cartItems.map(i => ({
        id: i.product?.id ?? i.productId, name: i.product?.name ?? "Product",
        price: i.product?.price ?? 0, category: i.product?.categoryName, quantity: i.quantity,
      })),
      grandTotal, shippingFee, appliedCoupon?.code,
    );
    setOrderId(order.id);
    setSubmitted(true);
  }

  async function clearCartItems() {
    if (cart?.items) await Promise.all(cart.items.map(i => fetch(`/api/cart/${i.id}`, { method: "DELETE" }).catch(() => {})));
  }

  function onSubmit(values: CheckoutForm) {
    if (!cart || cartItems.length === 0) { toast({ title: "Cart is empty", variant: "destructive" }); return; }
    // Only product ids + quantities are meaningful: the server prices the order from the database.
    const items = cartItems.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.product?.price ?? 0 }));
    createOrder.mutate(
      {
        data: {
          ...values,
          paymentMethod: values.paymentMethod === "razorpay" ? "razorpay" : "cod",
          notes: values.notes || undefined, items, sessionId,
          // couponCode is validated and applied server-side
          ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        } as Parameters<typeof createOrder.mutate>[0]["data"],
      },
      {
        onSuccess: async (order) => {
          await clearCartItems();
          const gateway = (order as unknown as { razorpay?: GatewayParams }).razorpay;
          if (values.paymentMethod !== "razorpay" || !gateway) { finishOrder(order, values); return; }

          // Online payment: the order exists (stock reserved); pay for it, then verify on the server
          setRpLoading(true);
          await openRazorpayCheckout({
            gateway, orderId: order.id,
            description: `Order ${order.orderNumber}`,
            prefill: { name: values.customerName, email: values.customerEmail, contact: values.customerPhone },
            onPaid: () => { setRpLoading(false); finishOrder(order, values); },
            onDismiss: () => {
              setRpLoading(false);
              toast({ title: "Payment not completed", description: "Your order is saved. You can pay from Track Order." });
              try { localStorage.setItem("apunbazar_last_email", values.customerEmail); } catch {}
              invalidateCart();
              navigate(`/orders/${order.id}`);
            },
            onError: (message) => {
              setRpLoading(false);
              toast({ title: "Payment issue", description: message, variant: "destructive" });
              invalidateCart();
              navigate(`/orders/${order.id}`);
            },
          });
          setRpLoading(false);
        },
        onError: (err) => toast({
          title: "Order failed",
          description: (err as { data?: { error?: string } }).data?.error ?? "Please try again",
          variant: "destructive",
        }),
      },
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted && orderId) {
    return (
      <div className="page-enter container mx-auto px-4 py-16 max-w-lg text-center">
        <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ background: "rgba(26,92,42,0.12)" }}>
          <CheckCircle className="h-12 w-12" style={{ color: "#1a5c2a" }} />
        </div>
        <h1 className="font-serif text-3xl font-bold mb-3">Order Placed! 🎉</h1>
        <p className="text-muted-foreground mb-4">Shukriya! Aapka order confirm ho gaya hai.</p>
        <div className="bg-muted/50 rounded-xl px-5 py-4 mb-4 text-sm text-left space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Order Summary</p>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{form.getValues("customerEmail")}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-medium capitalize">{paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay"}</span></div>
          {totalSavings > 0 && <div className="flex justify-between text-primary"><span>You Saved</span><span className="font-bold">₹{totalSavings.toLocaleString("en-IN")}</span></div>}
        </div>
        <div className="flex gap-3 justify-center mt-6">
          <Button onClick={() => navigate(`/orders/${orderId}`)} className="gap-2"><Truck className="h-4 w-4" /> Track Order</Button>
          <Button variant="outline" onClick={() => navigate("/products")}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  // ── Empty cart ─────────────────────────────────────────────────────────────
  if (!cart || cartItems.length === 0) {
    return (
      <div className="page-enter container mx-auto px-4 py-16 max-w-lg text-center">
        <h2 className="font-serif text-2xl font-bold mb-3">Cart khali hai</h2>
        <Button onClick={() => navigate("/products")}>Products Browse Karo</Button>
      </div>
    );
  }

  // ── Form input component ───────────────────────────────────────────────────
  const FieldInput = ({ name, label, placeholder, type = "text", icon }: any) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel className="text-sm font-semibold text-gray-700">{label}</FormLabel>
        <FormControl>
          <div className="relative">
            {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
            <Input
              type={type}
              placeholder={placeholder}
              className={`h-12 rounded-xl border-gray-200 focus:border-primary ${icon ? "pl-9" : ""}`}
              {...field}
            />
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );

  return (
    <div className="page-enter min-h-screen" style={{ background: "#f8f9fa" }}>
      <div className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-serif text-3xl font-bold">Checkout</h1>
          <p className="text-muted-foreground text-sm mt-1">Complete your order in few simple steps</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid lg:grid-cols-5 gap-6">

              {/* ── LEFT COLUMN — Form (3/5) ── */}
              <div className="lg:col-span-3 space-y-4">

                {/* Contact Info */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: "#1a5c2a" }}>1</div>
                    <h2 className="font-semibold text-base">Contact Information</h2>
                  </div>
                  <div className="space-y-4">
                    <FieldInput name="customerName"  label="Full Name"     placeholder="Aapka naam" />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldInput name="customerPhone" label="Phone Number"  placeholder="10-digit number" />
                      <FieldInput name="customerEmail" label="Email Address" placeholder="you@example.com" type="email" />
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: "#1a5c2a" }}>2</div>
                    <h2 className="font-semibold text-base flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" /> Shipping Address
                    </h2>
                  </div>
                  <div className="space-y-4">
                    <FormField control={form.control} name="shippingAddress" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Street Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="House no., street, locality" rows={2}
                            className="rounded-xl border-gray-200 focus:border-primary resize-none" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-3 gap-3">
                      <FieldInput name="shippingCity"    label="City"    placeholder="City" />
                      <FormField control={form.control} name="shippingState" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-gray-700">State</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <select
                                className="w-full h-12 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:border-primary appearance-none"
                                value={field.value}
                                onChange={e => field.onChange(e.target.value)}
                              >
                                {["Assam","Arunachal Pradesh","Manipur","Meghalaya","Mizoram","Nagaland","Sikkim","Tripura",
                                  "West Bengal","Bihar","Delhi","Gujarat","Karnataka","Kerala","Maharashtra","Rajasthan",
                                  "Tamil Nadu","Telangana","Uttar Pradesh","Other"].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FieldInput name="shippingPincode" label="Pincode" placeholder="6-digit" />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: "#1a5c2a" }}>3</div>
                    <h2 className="font-semibold text-base">Payment Method</h2>
                  </div>
                  <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-3">
                          {/* COD */}
                          <label htmlFor="cod" className={`flex items-center gap-3 rounded-xl p-4 border-2 cursor-pointer transition-all ${field.value === "cod" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                            <RadioGroupItem value="cod" id="cod" />
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: "rgba(26,92,42,0.10)" }}>
                              <Banknote className="h-5 w-5" style={{ color: "#1a5c2a" }} />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm">Cash on Delivery</p>
                              <p className="text-xs text-gray-500">Pay when you receive your order</p>
                            </div>
                            {shippingConfig.codEnabled && (
                              <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg flex-shrink-0">
                                +₹{shippingConfig.codFee} COD charge
                              </span>
                            )}
                          </label>

                          {/* Razorpay */}
                          <label htmlFor="razorpay" className={`flex items-center gap-3 rounded-xl p-4 border-2 cursor-pointer transition-all ${field.value === "razorpay" ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}>
                            <RadioGroupItem value="razorpay" id="razorpay" />
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: "rgba(26,92,42,0.10)" }}>
                              <CreditCard className="h-5 w-5" style={{ color: "#1a5c2a" }} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm">Pay Online</p>
                                <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded">Razorpay</span>
                              </div>
                              <p className="text-xs text-gray-500">UPI · Card · Net Banking · Wallet</p>
                            </div>
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg flex-shrink-0">
                              No extra charges
                            </span>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Notes */}
                  <div className="mt-4">
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-gray-700">Order Notes <span className="font-normal text-gray-400">(Optional)</span></FormLabel>
                        <FormControl>
                          <Textarea placeholder="Any special instructions..." rows={2}
                            className="rounded-xl border-gray-200 resize-none" {...field} />
                        </FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Trust badges — mobile only */}
                <div className="lg:hidden bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex gap-2 justify-between">
                    <TrustBadge icon={ShieldCheck} title="Secure Payment"   sub="100% Safe & Secure" />
                    <TrustBadge icon={Truck}       title="Free Shipping"    sub="Above ₹999" />
                    <TrustBadge icon={RefreshCw}   title="Easy Returns"     sub="7-Day Return Policy" />
                    <TrustBadge icon={Leaf}        title="Direct From Assam" sub="Fresh & Authentic" />
                  </div>
                </div>
              </div>

              {/* ── RIGHT COLUMN — Summary (2/5) ── */}
              <div className="lg:col-span-2 space-y-4">

                {/* Order Summary Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-serif text-lg font-bold flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(26,92,42,0.10)" }}>
                        <Truck className="h-4 w-4" style={{ color: "#1a5c2a" }} />
                      </div>
                      Order Summary
                    </h2>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                      {cartItems.length} Items
                    </span>
                  </div>

                  {/* Items list */}
                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                    {cartItems.map(item => {
                      const orig = (item.product as any)?.originalPrice;
                      const price = item.product?.price ?? 0;
                      const saving = orig ? (orig - price) * item.quantity : 0;
                      return (
                        <div key={item.id} className="flex gap-3">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {item.product && (
                              <img src={item.product.imageUrl} alt={item.product.name}
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/56x56/e8f0e9/2d6a4f?text=${encodeURIComponent(item.product!.name.slice(0, 4))}`; }} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm leading-tight line-clamp-1">{item.product?.name}</p>
                                {(item.product as any)?.artisan && (
                                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                    <Leaf className="h-2.5 w-2.5" style={{ color: "#1a5c2a" }} />
                                    {(item.product as any).artisan}
                                  </p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-sm">₹{(price * item.quantity).toLocaleString("en-IN")}</p>
                                {orig && <p className="text-xs line-through text-gray-400">₹{(orig * item.quantity).toLocaleString("en-IN")}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                ×{item.quantity}
                              </span>
                              {saving > 0 && (
                                <span className="text-[11px] font-medium text-green-600">
                                  You save ₹{saving.toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Separator className="my-4" />

                  {/* Coupon */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setCouponOpen(!couponOpen)}
                      className="w-full flex items-center justify-between text-sm font-semibold text-primary py-1"
                    >
                      <span className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: "rgba(26,92,42,0.10)" }}>
                          <Tag className="h-3.5 w-3.5" style={{ color: "#1a5c2a" }} />
                        </div>
                        Apply Coupon
                      </span>
                      {couponOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {couponOpen && (
                      <div className="mt-3">
                        {appliedCoupon ? (
                          <div className="flex items-center justify-between rounded-xl px-3 py-2.5 border"
                            style={{ background: "rgba(26,92,42,0.08)", borderColor: "rgba(26,92,42,0.3)" }}>
                            <div>
                              <p className="text-sm font-bold font-mono" style={{ color: "#1a5c2a" }}>{appliedCoupon.code}</p>
                              <p className="text-xs" style={{ color: "#1a5c2a" }}>Saving ₹{discount}!</p>
                            </div>
                            <button type="button" onClick={() => { setApplied(null); setCouponInput(""); setCouponError(""); }}
                              className="text-gray-400 hover:text-destructive">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={couponInput}
                                onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), applyCoupon())}
                                placeholder="Enter coupon code"
                                className="flex-1 h-11 rounded-xl border border-gray-200 px-3 text-sm font-mono uppercase focus:outline-none focus:border-primary"
                              />
                              <button
                                type="button"
                                onClick={applyCoupon}
                                disabled={!couponInput || couponLoading}
                                className="h-11 px-5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                                style={{ background: "#1a5c2a" }}
                              >
                                {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                              </button>
                            </div>
                            {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Price breakdown */}
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal ({cartItems.length} items)</span>
                      <span>₹{cartTotal.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      {isFreeShip
                        ? <span className="font-bold text-green-600 flex items-center gap-1">
                            <BadgeCheck className="h-3.5 w-3.5" /> FREE
                          </span>
                        : <span>₹{shippingFee}</span>
                      }
                    </div>
                    {paymentMethod === "cod" && shippingConfig.codEnabled && (
                      <div className="flex justify-between text-gray-600">
                        <span>COD Charge</span>
                        <span>₹{codFee}</span>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between font-medium" style={{ color: "#1a5c2a" }}>
                        <span>Coupon ({appliedCoupon?.code})</span>
                        <span>-₹{discount}</span>
                      </div>
                    )}
                    {!isFreeShip && shippingConfig.freeShippingEnabled && (
                      <div className="text-xs text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                        🚚 ₹{(shippingConfig.freeShippingAbove - cartTotal).toFixed(0)} aur add karo free shipping ke liye!
                      </div>
                    )}
                  </div>

                  {/* You Saved */}
                  {totalSavings > 0 && (
                    <div className="flex items-center justify-between mt-3 rounded-xl px-3 py-2.5"
                      style={{ background: "rgba(26,92,42,0.08)" }}>
                      <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#1a5c2a" }}>
                        <Tag className="h-4 w-4" /> You Saved
                      </span>
                      <span className="font-bold text-base" style={{ color: "#1a5c2a" }}>
                        ₹{totalSavings.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  <Separator className="my-4" />

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base">Total Amount</span>
                    <span className="font-bold text-xl" style={{ color: "#1a5c2a" }}>
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Trust badges — desktop */}
                <div className="hidden lg:block bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <TrustBadge icon={ShieldCheck} title="Secure Payment"   sub="100% Safe & Secure" />
                    <TrustBadge icon={Truck}       title="Free Shipping"    sub="Above ₹999" />
                    <TrustBadge icon={RefreshCw}   title="Easy Returns"     sub="7-Day Return Policy" />
                    <TrustBadge icon={Leaf}        title="Direct From Assam" sub="Fresh & Authentic" />
                  </div>
                </div>

                {/* Sticky place order button */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 lg:sticky lg:top-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Total Amount</p>
                      <p className="font-bold text-xl" style={{ color: "#1a5c2a" }}>
                        ₹{grandTotal.toLocaleString("en-IN")}
                      </p>
                      {totalSavings > 0 && (
                        <p className="text-xs font-medium" style={{ color: "#1a5c2a" }}>
                          You Save ₹{totalSavings.toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      disabled={createOrder.isPending || razorpayLoading}
                      className="gap-2 rounded-xl px-6 font-bold"
                      style={{ background: "#1a5c2a", color: "#fff" }}
                    >
                      {createOrder.isPending || razorpayLoading
                        ? <><Loader2 className="h-4 w-4 animate-spin" />{razorpayLoading ? "Loading..." : "Placing..."}</>
                        : paymentMethod === "razorpay"
                          ? <><Zap className="h-4 w-4" />Pay Now</>
                          : <><Lock className="h-4 w-4" />Place Order Securely →</>
                      }
                    </Button>
                  </div>
                  <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> Safe & Secure Transactions
                  </p>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
