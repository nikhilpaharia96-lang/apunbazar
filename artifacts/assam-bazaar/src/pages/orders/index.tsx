import { useState } from "react";
import { useSEO } from "@/hooks/use-seo";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Order } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Search, Shield, Mail, Phone, ClipboardList, Headphones, MessageCircle } from "lucide-react";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  pending:    { bg: "#fff8e1", text: "#b45309", dot: "#f59e0b" },
  confirmed:  { bg: "#e8f4fd", text: "#1d4ed8", dot: "#3b82f6" },
  processing: { bg: "#f3e8ff", text: "#7c3aed", dot: "#a855f7" },
  shipped:    { bg: "#e0e7ff", text: "#4338ca", dot: "#6366f1" },
  delivered:  { bg: "#dcfce7", text: "#15803d", dot: "#22c55e" },
  cancelled:  { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
};

export default function Orders() {
  useSEO({ title: "Track Your Orders", noindex: true });
  const [email, setEmail] = useState<string>(() => {
    try { return localStorage.getItem("apunbazar_last_email") ?? ""; } catch { return ""; }
  });
  const [phone, setPhone] = useState<string>(() => {
    try { return localStorage.getItem("apunbazar_last_phone") ?? ""; } catch { return ""; }
  });
  const [search, setSearch] = useState<{ email: string; phone: string } | null>(null);
  const searchEmail = search?.email ?? "";

  // Customers must present BOTH the email and mobile number used at checkout
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-orders", search?.email, search?.phone],
    enabled: !!search,
    retry: false,
    queryFn: () =>
      apiFetch<{ orders: Order[] }>(
        `/api/orders?email=${encodeURIComponent(search!.email)}&phone=${encodeURIComponent(search!.phone)}`,
      ),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const clean = { email: email.trim(), phone: phone.replace(/\D/g, "").slice(-10) };
    setSearch(clean);
    try { localStorage.setItem("apunbazar_last_email", clean.email); localStorage.setItem("apunbazar_last_phone", clean.phone); } catch {}
  }

  return (
    <div className="page-enter min-h-screen" style={{ background: "#f5f5f0" }}>
      <style>{`
        .order-card { background: #fff; border-radius: 16px; padding: 18px; margin-bottom: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); cursor: pointer; transition: box-shadow 0.2s, transform 0.2s; }
        .order-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .search-btn { background: #1a5a32; color: #fff; border: none; border-radius: 12px; padding: 12px 24px; font-weight: 700; font-size: 15px; cursor: pointer; white-space: nowrap; }
        .feature-card { background: #fff; border-radius: 12px; padding: 16px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; flex: 1; }
      `}</style>

      <div className="container mx-auto px-4 py-6 max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0faf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Package className="h-6 w-6" style={{ color: "#1a5a32" }} />
          </div>
          <h1 className="font-serif text-2xl font-bold text-gray-900">Track Your Orders</h1>
        </div>
        <p className="text-gray-600 text-sm mb-6 ml-14">Enter the email and mobile number used at checkout</p>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
            <input
              type="email" required
              placeholder="Enter your email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              data-testid="input-email-search"
              style={{ width: "100%", paddingLeft: 40, paddingRight: 16, height: 48, border: "1.5px solid #e0e0e0", borderRadius: 12, fontSize: 14, outline: "none", background: "#fff" }}
            />
          </div>
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
            <input
              type="tel" inputMode="numeric" required
              placeholder="Mobile number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              data-testid="input-phone-search"
              style={{ width: "100%", paddingLeft: 40, paddingRight: 16, height: 48, border: "1.5px solid #e0e0e0", borderRadius: 12, fontSize: 14, outline: "none", background: "#fff" }}
            />
          </div>
          <button type="submit" className="search-btn" data-testid="button-search-orders">Search</button>
        </form>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : !search ? (
          /* Empty state */
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {/* Illustration */}
            <div style={{ width: 140, height: 140, margin: "0 auto 20px", background: "#f0faf4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package className="h-16 w-16" style={{ color: "#1a5a32", opacity: 0.4 }} />
            </div>
            <h3 className="font-serif text-lg font-bold text-gray-800 mb-2">Enter your email and mobile to find your orders</h3>
            <p className="text-gray-600 text-sm mb-8">Both are needed to keep your<br />order details private.</p>

            {/* Feature cards */}
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              {[
                { icon: Shield, label: "Secure & Safe", sub: "Your data is\n100% protected" },
                { icon: Mail, label: "Quick Access", sub: "Get order updates\ninstantly" },
                { icon: ClipboardList, label: "Order History", sub: "View all your past\norders in one place" },
                { icon: Headphones, label: "Need Help?", sub: "Our support team is\nalways here" },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="feature-card">
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#f0faf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon className="h-5 w-5" style={{ color: "#1a5a32" }} />
                  </div>
                  <p style={{ fontWeight: 700, fontSize: 11, color: "#222", lineHeight: 1.2 }}>{label}</p>
                  <p style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.4, whiteSpace: "pre-line" }}>{sub}</p>
                </div>
              ))}
            </div>

            {/* Contact support */}
            <div style={{ background: "#f5f5f0", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div className="flex items-center gap-3">
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageCircle className="h-4 w-4" style={{ color: "#1a5a32" }} />
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: "#222" }}>Need help?</p>
                  <p style={{ fontSize: 11, color: "#4b5563" }}>Contact our support team for any assistance.</p>
                </div>
              </div>
              <a href="https://wa.me/91XXXXXXXXXX" target="_blank" rel="noreferrer"
                style={{ background: "#fff", border: "1.5px solid #1a5a32", color: "#1a5a32", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
                <MessageCircle className="h-3.5 w-3.5" /> Contact Support
              </a>
            </div>
          </div>

        ) : error ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: 32, textAlign: "center" }}>
            <p className="font-semibold text-gray-700">Could not look up orders</p>
            <p className="text-sm text-gray-600 mt-1">{(error as { data?: { error?: string } }).data?.error ?? "Please try again in a moment."}</p>
          </div>
        ) : data?.orders.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 20, padding: 40, textAlign: "center" }}>
            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" style={{ color: "#1a5a32" }} />
            <p className="font-semibold text-gray-700 mb-1">No orders found</p>
            <p className="text-sm text-gray-600 mb-5">No orders match {searchEmail} with that mobile number</p>
            <Link href="/products">
              <button style={{ background: "#1a5a32", color: "#fff", border: "none", borderRadius: 12, padding: "12px 28px", fontWeight: 700, cursor: "pointer" }}>
                Start Shopping
              </button>
            </Link>
          </div>
        ) : (
          <div>
            {data?.orders.map((order) => {
              const sc = statusColors[order.status] ?? statusColors.pending;
              const items = order.items as any[];
              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="order-card" data-testid={`row-order-${order.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-base text-gray-900">{order.orderNumber}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p className="font-bold text-lg" style={{ color: "#1a5a32" }}>
                          ₹{(order.total ?? 0).toLocaleString("en-IN")}
                        </p>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: sc.bg, color: sc.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </div>
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 10, display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#4b5563" }}>
                      <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
                      <span>•</span>
                      <span>{order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</span>
                      <span>•</span>
                      <span>{order.shippingCity}, {order.shippingState}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}