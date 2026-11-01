/**
 * pages/admin/analytics.tsx — Live Analytics Dashboard
 *
 * Shows real data from API + links to GA4 and Clarity dashboards.
 * Visitors / Sessions / Heatmaps come from GA4 & Clarity (external).
 * Orders / Revenue / Products / Conversion come from our own API.
 */

import { useMemo } from "react";
import {
  useGetAdminStats,
  useGetRecentOrders,
  useGetTopProducts,
  useGetSalesByCategory,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  TrendingUp, ShoppingBag, Package, Users, IndianRupee,
  BarChart3, ExternalLink, MousePointerClick, Eye,
  Zap, Activity, ArrowUpRight,
} from "lucide-react";

// ── Config ─────────────────────────────────────────────────────────────────
const GA_ID      = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const CLARITY_ID = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;

const GA_URL      = GA_ID
  ? `https://analytics.google.com/analytics/web/#/p${GA_ID.replace("G-", "")}/reports/intelligenthome`
  : "https://analytics.google.com";
const CLARITY_URL = CLARITY_ID
  ? `https://clarity.microsoft.com/projects/view/${CLARITY_ID}/dashboard`
  : "https://clarity.microsoft.com";

// ── Helpers ────────────────────────────────────────────────────────────────
function normalise<T>(raw: T | { data: T } | undefined | null): T | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "object" && "data" in (raw as object)) return (raw as { data: T }).data;
  return raw as T;
}
function normaliseArray<T>(raw: T[] | { data: T[] } | undefined | null): T[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) && typeof raw === "object" && "data" in (raw as object))
    return (raw as { data: T[] }).data ?? [];
  return Array.isArray(raw) ? raw : [];
}

function RupeeValue({ amount }: { amount: number }) {
  return (
    <span>
      <span style={{ fontFamily: "system-ui, sans-serif", fontWeight: 700 }}>₹</span>
      {amount.toLocaleString("en-IN")}
    </span>
  );
}

const COLORS = ["#1a5c2a", "#e8920a", "#2563eb", "#7c3aed", "#dc2626"];

const statusColors: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-800",
  confirmed:  "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped:    "bg-indigo-100 text-indigo-800",
  delivered:  "bg-green-100 text-green-800",
  cancelled:  "bg-red-100 text-red-800",
};

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color, loading,
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon: React.ElementType; color: string; loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + "20" }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          {sub && (
            <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />{sub}
            </span>
          )}
        </div>
        {loading
          ? <Skeleton className="h-8 w-28 rounded-lg mb-1" />
          : <p className="text-2xl font-bold">{value}</p>
        }
        <p className="text-muted-foreground text-xs mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

// ── External Tool Card ─────────────────────────────────────────────────────
function ExternalCard({
  title, description, href, icon: Icon, color, features,
}: {
  title: string; description: string; href: string;
  icon: React.ElementType; color: string; features: string[];
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + "20" }}>
              <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-muted-foreground text-xs">{description}</p>
            </div>
          </div>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
            style={{ background: color }}
          >
            Open <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {features.map(f => (
            <span key={f} className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
              {f}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const statsQuery    = useGetAdminStats();
  const recentQuery   = useGetRecentOrders({ limit: 5 });
  const topQuery      = useGetTopProducts({ limit: 5 });
  const categoryQuery = useGetSalesByCategory();

  const stats    = useMemo(() => normalise(statsQuery.data),          [statsQuery.data]);
  const recent   = useMemo(() => normaliseArray(recentQuery.data),    [recentQuery.data]);
  const top      = useMemo(() => normaliseArray(topQuery.data),       [topQuery.data]);
  const catSales = useMemo(() => normaliseArray(categoryQuery.data),  [categoryQuery.data]);

  const isLoading = statsQuery.isLoading;

  // Conversion rate = orders / unique customers (rough estimate)
  const conversionRate = stats
    ? ((stats.totalOrders / Math.max(stats.totalCustomers, 1)) * 100).toFixed(1)
    : "—";

  return (
    <div className="page-enter p-3 sm:p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm">Live store performance + behaviour insights</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full font-medium">
            <Activity className="h-3 w-3 animate-pulse" /> Live Data
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={stats ? <RupeeValue amount={stats.totalRevenue} /> : "—"}
          sub={stats ? `₹${stats.revenueThisMonth.toLocaleString("en-IN")} this month` : undefined}
          icon={IndianRupee}
          color="#1a5c2a"
          loading={isLoading}
        />
        <StatCard
          label="Total Orders"
          value={stats?.totalOrders ?? "—"}
          sub={stats ? `${stats.pendingOrders} pending` : undefined}
          icon={ShoppingBag}
          color="#e8920a"
          loading={isLoading}
        />
        <StatCard
          label="Products"
          value={stats?.totalProducts ?? "—"}
          icon={Package}
          color="#2563eb"
          loading={isLoading}
        />
        <StatCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          sub={stats ? `${stats.totalCustomers} customers` : undefined}
          icon={TrendingUp}
          color="#7c3aed"
          loading={isLoading}
        />
      </div>

      {/* ── External Tools ── */}
      <div>
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
          Behaviour Analytics Tools
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <ExternalCard
            title="Google Analytics 4"
            description={GA_ID ? `Tracking ID: ${GA_ID}` : "Set VITE_GA_MEASUREMENT_ID in .env"}
            href={GA_URL}
            icon={BarChart3}
            color="#e37400"
            features={["Page Views", "Add to Cart", "Purchases", "Revenue", "Traffic Sources", "Referrals", "Coupon Usage"]}
          />
          <ExternalCard
            title="Microsoft Clarity"
            description={CLARITY_ID ? `Project: ${CLARITY_ID}` : "Set VITE_CLARITY_PROJECT_ID in .env"}
            href={CLARITY_URL}
            icon={MousePointerClick}
            color="#0078d4"
            features={["Session Recordings", "Heatmaps", "Scroll Depth", "Rage Clicks", "Dead Clicks", "User Journeys"]}
          />
        </div>

        {/* Setup warning if env vars missing */}
        {(!GA_ID || !CLARITY_ID) && (
          <div className="mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Zap className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-800">Analytics not fully configured</p>
              <p className="text-amber-700 text-xs mt-1">
                Add these to your Vercel/Railway environment variables:
                {!GA_ID && <span className="block mt-1 font-mono bg-amber-100 px-2 py-0.5 rounded">VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX</span>}
                {!CLARITY_ID && <span className="block mt-1 font-mono bg-amber-100 px-2 py-0.5 rounded">VITE_CLARITY_PROJECT_ID=xxxxxxxxxx</span>}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Sales by Category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Sales by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryQuery.isLoading
              ? <Skeleton className="h-48 w-full rounded-xl" />
              : catSales.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={catSales} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="categoryName" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {catSales.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
            }
          </CardContent>
        </Card>

        {/* Category Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Revenue Share
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryQuery.isLoading
              ? <Skeleton className="h-48 w-full rounded-xl" />
              : catSales.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={catSales}
                        dataKey="revenue"
                        nameKey="categoryName"
                        cx="50%" cy="50%"
                        outerRadius={80}
                        label={({ categoryName, percentage }) =>
                          `${categoryName} ${percentage?.toFixed(0) ?? ""}%`
                        }
                        labelLine={false}
                      >
                        {catSales.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )
            }
          </CardContent>
        </Card>
      </div>

      {/* ── Top Products + Recent Orders ── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Top Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topQuery.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg mb-2" />)
              : top.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">No product data yet</p>
                : (
                  <div className="space-y-3">
                    {top.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white flex-shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}>
                          {i + 1}
                        </span>
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <img src={p.imageUrl} alt={p.name}
                            className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.categoryName}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold">
                            <span style={{ fontFamily: "system-ui" }}>₹</span>
                            {Number(p.revenue ?? 0).toLocaleString("en-IN")}
                          </p>
                          <p className="text-xs text-muted-foreground">{p.totalSold ?? 0} sold</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
            }
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" /> Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentQuery.isLoading
              ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg mb-2" />)
              : recent.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-6">No orders yet</p>
                : (
                  <div className="space-y-3">
                    {recent.map(o => (
                      <div key={o.id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{o.customerName}</p>
                          <p className="text-xs text-muted-foreground">{o.orderNumber}</p>
                        </div>
                        <Badge className={`text-[10px] flex-shrink-0 ${statusColors[o.status] ?? ""}`}>
                          {o.status}
                        </Badge>
                        <p className="text-sm font-bold flex-shrink-0">
                          <span style={{ fontFamily: "system-ui" }}>₹</span>
                          {Number(o.total).toLocaleString("en-IN")}
                        </p>
                      </div>
                    ))}
                  </div>
                )
            }
          </CardContent>
        </Card>
      </div>

      {/* ── Tracking Events Reference ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Tracked Events Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { event: "page_view",        tool: "GA4",     desc: "Every page navigation" },
              { event: "view_item",        tool: "GA4",     desc: "Product detail viewed" },
              { event: "add_to_cart",      tool: "GA4",     desc: "Item added to cart" },
              { event: "remove_from_cart", tool: "GA4",     desc: "Item removed from cart" },
              { event: "add_to_wishlist",  tool: "GA4",     desc: "Item wishlisted" },
              { event: "begin_checkout",   tool: "GA4",     desc: "Checkout page opened" },
              { event: "purchase",         tool: "GA4",     desc: "Order placed successfully" },
              { event: "select_promotion", tool: "GA4",     desc: "Coupon applied" },
              { event: "Session Replay",   tool: "Clarity", desc: "Full session recording" },
              { event: "Heatmaps",         tool: "Clarity", desc: "Click & scroll heatmaps" },
              { event: "Rage Clicks",      tool: "Clarity", desc: "Frustrated click detection" },
              { event: "Dead Clicks",      tool: "Clarity", desc: "Clicks on non-interactive elements" },
            ].map(({ event, tool, desc }) => (
              <div key={event} className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${
                  tool === "GA4" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {tool}
                </span>
                <div>
                  <p className="text-xs font-mono font-semibold">{event}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
