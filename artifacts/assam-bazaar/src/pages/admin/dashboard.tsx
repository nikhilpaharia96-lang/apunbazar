import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetAdminStats, useGetRecentOrders, useGetTopProducts, useGetSalesByCategory,
  getGetAdminStatsQueryKey, getGetRecentOrdersQueryKey, getGetTopProductsQueryKey, getGetSalesByCategoryQueryKey,
} from "@workspace/api-client-react";
import {
  IndianRupee, ShoppingBag, Package, Users, Clock, CalendarDays, Star, ArrowRight, Receipt, Activity, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { getAuthHeaders } from "@/lib/admin-auth";
import { loadActivities } from "@/lib/staff-auth";
import {
  PageHeader, StatCard, DashboardCard, DataTable, EmptyState, ErrorState, LoadingSkeleton,
  StatusBadge, inr, compactInr, type Column,
} from "@/components/admin/ui";
import { T } from "@/components/admin/tokens";

// API may return the array/object directly or wrapped as { data }
const unwrap = <X,>(raw: any): X | undefined => (raw == null ? undefined : (typeof raw === "object" && !Array.isArray(raw) && "data" in raw ? raw.data : raw));
const unwrapArr = (raw: any): any[] => { const v = unwrap<any>(raw); return Array.isArray(v) ? v : []; };

type TrendPoint = { date: string; revenue: number; orders: number };

function useRevenueTrend(days: number) {
  return useQuery<TrendPoint[]>({
    queryKey: ["admin", "revenue-trend", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/revenue-trend?days=${days}`, { headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error("Failed to load revenue trend");
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 60_000,
  });
}

const RANGES = [{ d: 7, label: "7D" }, { d: 30, label: "30D" }, { d: 90, label: "90D" }];

function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30);

  const stats = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const recent = useGetRecentOrders({ limit: 8 }, { query: { queryKey: getGetRecentOrdersQueryKey({ limit: 8 }) } });
  const top = useGetTopProducts({ limit: 5 }, { query: { queryKey: getGetTopProductsQueryKey({ limit: 5 }) } });
  const byCat = useGetSalesByCategory({ query: { queryKey: getGetSalesByCategoryQueryKey() } });
  const trend = useRevenueTrend(days);

  const s: any = unwrap<any>(stats.data) ?? {};
  const totalRevenue = s.totalRevenue ?? 0;
  const totalOrders = s.totalOrders ?? 0;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const recentOrders = unwrapArr(recent.data);
  const topProducts = unwrapArr(top.data);
  const categories = unwrapArr(byCat.data);
  const trendData = trend.data ?? [];
  const trendRevenue = trendData.reduce((a, p) => a + (p.revenue ?? 0), 0);
  const trendOrders = trendData.reduce((a, p) => a + (p.orders ?? 0), 0);
  const catTotal = categories.reduce((a, c) => a + (c.revenue ?? 0), 0);

  // Recent activity feed: real orders + this device's staff activity log
  const activities = useMemo(() => {
    const fromOrders = recentOrders.slice(0, 5).map((o: any) => ({
      id: `o-${o.id}`, at: o.createdAt, icon: Receipt,
      text: `New order ${o.orderNumber} from ${o.customerName ?? "customer"}`, meta: inr(o.total ?? 0),
    }));
    const fromStaff = loadActivities().slice(0, 5).map(a => ({
      id: `s-${a.id}`, at: a.timestamp, icon: Activity, text: `${a.staffName}: ${a.details}`, meta: a.action,
    }));
    return [...fromOrders, ...fromStaff].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 7);
  }, [recentOrders]);

  const orderCols: Column<any>[] = [
    { key: "no", header: "Order", primary: true, cell: o => (
      <Link href="/admin/orders" className="font-medium hover:underline" style={{ color: T.brand }}>{o.orderNumber}</Link>) },
    { key: "cust", header: "Customer", cell: o => (
      <span className="block min-w-0"><span className="block truncate text-neutral-800">{o.customerName}</span>
      <span className="hidden sm:block truncate text-xs text-neutral-400">{o.customerEmail}</span></span>) },
    { key: "date", header: "Date", cell: o => <span className="text-neutral-500 text-xs">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</span> },
    { key: "status", header: "Status", cell: o => <StatusBadge status={o.status} /> },
    { key: "total", header: "Total", align: "right", cell: o => <span className="font-semibold tabular-nums">{inr(o.total ?? 0)}</span> },
  ];

  return (
    <div className="p-3.5 sm:p-6 max-w-[1400px] mx-auto space-y-4 sm:space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="How your store is performing right now."
        actions={<Link href="/admin/orders" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium text-white active:scale-95 transition" style={{ background: T.brand }}>
          View orders <ArrowRight className="h-3.5 w-3.5" /></Link>}
      />

      {/* KPI cards: 2-col on mobile */}
      {stats.isError ? (
        <DashboardCard><ErrorState message="Couldn't load store statistics." onRetry={() => stats.refetch()} /></DashboardCard>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
          <StatCard label="Total Revenue" value={compactInr(totalRevenue)} hint={inr(totalRevenue)} icon={IndianRupee} loading={stats.isLoading} href="/admin/analytics" />
          <StatCard label="Total Orders" value={totalOrders.toLocaleString("en-IN")} icon={ShoppingBag} loading={stats.isLoading} tone="blue" href="/admin/orders" />
          <StatCard label="Pending Orders" value={(s.pendingOrders ?? 0).toLocaleString("en-IN")} icon={Clock} loading={stats.isLoading} tone="amber" hint="Need attention" href="/admin/orders" />
          <StatCard label="This Month" value={compactInr(s.revenueThisMonth ?? 0)} hint={inr(s.revenueThisMonth ?? 0)} icon={CalendarDays} loading={stats.isLoading} />
          <StatCard label="Products" value={(s.totalProducts ?? 0).toLocaleString("en-IN")} icon={Package} loading={stats.isLoading} tone="violet" href="/admin/products" />
          <StatCard label="Customers" value={(s.totalCustomers ?? 0).toLocaleString("en-IN")} icon={Users} loading={stats.isLoading} tone="rose" />
        </div>
      )}

      {/* Revenue analytics */}
      <DashboardCard
        title="Revenue analytics"
        subtitle={trend.isLoading ? "Loading…" : `${inr(trendRevenue)} from ${trendOrders} orders · last ${days} days · avg order ${inr(avgOrder)}`}
        action={
          <div className="inline-flex rounded-lg bg-neutral-100 p-0.5 flex-shrink-0" role="tablist" aria-label="Date range">
            {RANGES.map(r => (
              <button key={r.d} role="tab" aria-selected={days === r.d} onClick={() => setDays(r.d)}
                className={`h-8 min-w-[40px] px-2.5 rounded-md text-xs font-medium transition ${days === r.d ? "bg-white shadow-sm text-neutral-900" : "text-neutral-500"}`}>{r.label}</button>
            ))}
          </div>}
      >
        {trend.isError ? <ErrorState message="Couldn't load revenue trend." onRetry={() => trend.refetch()} />
          : trend.isLoading ? <div className="h-[220px] sm:h-[280px] rounded-lg bg-neutral-100 animate-pulse" />
          : trendRevenue === 0 ? <EmptyState icon={TrendingUp} title="No revenue in this period" description="Revenue will appear here as orders come in." compact />
          : (
            <div className="h-[220px] sm:h-[280px] -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={T.brand} stopOpacity={0.18} /><stop offset="100%" stopColor={T.brand} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} minTickGap={28}
                    tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} />
                  <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v: number) => compactInr(v)} />
                  <Tooltip cursor={{ stroke: "#d4d4d4" }}
                    contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,.06)" }}
                    labelFormatter={(d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    formatter={(v: number, name: string) => name === "revenue" ? [inr(v), "Revenue"] : [v, "Orders"]} />
                  <Area type="monotone" dataKey="revenue" stroke={T.brand} strokeWidth={2} fill="url(#revFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
      </DashboardCard>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Sales by category */}
        <DashboardCard title="Sales by category" subtitle="Share of revenue" className="lg:col-span-2">
          {byCat.isError ? <ErrorState onRetry={() => byCat.refetch()} />
            : byCat.isLoading ? <LoadingSkeleton rows={4} />
            : categories.length === 0 ? <EmptyState title="No category sales yet" compact />
            : (
              <div className="flex flex-col items-center gap-4">
                <div className="h-[170px] w-full max-w-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories} dataKey="revenue" nameKey="categoryName" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none">
                        {categories.map((_: any, i: number) => <Cell key={i} fill={T.chart[i % T.chart.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e5e5", fontSize: 12 }} formatter={(v: number) => inr(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="w-full space-y-2">
                  {categories.slice(0, 6).map((c: any, i: number) => (
                    <li key={c.categoryId ?? i} className="flex items-center gap-2.5 text-sm">
                      <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: T.chart[i % T.chart.length] }} />
                      <span className="flex-1 truncate text-neutral-700">{c.categoryName}</span>
                      <span className="text-xs text-neutral-400 tabular-nums">{catTotal ? Math.round((c.revenue / catTotal) * 100) : 0}%</span>
                      <span className="font-medium tabular-nums text-neutral-900 w-16 text-right">{compactInr(c.revenue ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </DashboardCard>

        {/* Top products */}
        <DashboardCard title="Top products" subtitle="Most reviewed" className="lg:col-span-3"
          action={<Link href="/admin/products" className="text-xs font-medium hover:underline" style={{ color: T.brand }}>View all</Link>}>
          {top.isError ? <ErrorState onRetry={() => top.refetch()} />
            : top.isLoading ? <LoadingSkeleton rows={5} />
            : topProducts.length === 0 ? <EmptyState icon={Package} title="No products yet" compact />
            : (
              <ul className="divide-y divide-neutral-100 -my-2">
                {topProducts.map((p: any, i: number) => (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-6 h-6 rounded-md bg-neutral-100 text-[11px] font-semibold text-neutral-500 flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">{p.name}</p>
                      <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />{Number(p.rating ?? 0).toFixed(1)}
                        <span className="text-neutral-300">·</span>{p.reviewCount ?? 0} reviews
                        <span className="text-neutral-300">·</span>
                        <span className={(p.stock ?? 0) <= 5 ? "text-rose-600 font-medium" : ""}>{p.stock ?? 0} in stock</span>
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-neutral-900">{inr(p.price ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}
        </DashboardCard>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-6">
        <DashboardCard title="Recent orders" className="lg:col-span-3"
          action={<Link href="/admin/orders" className="text-xs font-medium hover:underline" style={{ color: T.brand }}>View all</Link>}>
          {recent.isError ? <ErrorState onRetry={() => recent.refetch()} />
            : <DataTable columns={orderCols} rows={recentOrders} rowKey={o => o.id} loading={recent.isLoading}
                empty={<EmptyState icon={ShoppingBag} title="No orders yet" description="New orders will show up here." compact />} />}
        </DashboardCard>

        <DashboardCard title="Recent activities" subtitle="Orders and staff actions" className="lg:col-span-2">
          {activities.length === 0 ? <EmptyState icon={Activity} title="No activity yet" compact /> : (
            <ul className="space-y-3.5">
              {activities.map(a => (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.brandSoft, color: T.brand }}><a.icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-neutral-800 leading-snug break-words">{a.text}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{timeAgo(a.at)} · {a.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
