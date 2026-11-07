/**
 * pages/admin/analytics.tsx — Sales analytics (real data from /api/manage/analytics/*)
 * Revenue = not cancelled/refunded AND (COD or online-paid). Days are India time.
 */
import { useState } from "react";
import { IndianRupee, ShoppingBag, Receipt, Boxes, UserPlus, Repeat, Download } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { PageHeader, DashboardCard, StatCard, EmptyState, ErrorState, DataTable, inr, compactInr, LoadingSkeleton } from "@/components/admin/ui";
import { DateRange } from "@/components/admin/DateRange";
import { T } from "@/components/admin/tokens";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAdminQuery, useDateRange, downloadCsv, errMsg } from "@/lib/admin-api";

interface Overview {
  revenue: number; orders: number; placedOrders: number; cancelledOrders: number; averageOrderValue: number; unitsSold: number;
  newCustomers: number; repeatCustomers: number;
  previous: { revenue: number; orders: number };
  paymentMix: { method: string; orders: number; revenue: number }[];
  statusBreakdown: { status: string; count: number }[];
}
interface TrendRow { date: string; revenue: number; orders: number }
interface TopProduct { id: number; name: string; units: number; revenue: number }
interface CategoryRow { categoryName: string; orderCount: number; units: number; revenue: number }

const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
const METHOD: Record<string, string> = { cod: "Cash on Delivery", razorpay: "Online (Razorpay)" };

export default function AdminAnalytics() {
  const r = useDateRange(30);
  const [group, setGroup] = useState<"day" | "week" | "month">("day");
  const { toast } = useToast();
  const range = { from: r.from, to: r.to };

  const overview = useAdminQuery<Overview>("/api/manage/analytics/overview", range);
  const trend = useAdminQuery<TrendRow[]>("/api/manage/analytics/trend", { ...range, group });
  const top = useAdminQuery<TopProduct[]>("/api/manage/analytics/top-products", { ...range, limit: 8 });
  const cats = useAdminQuery<CategoryRow[]>("/api/manage/analytics/categories", range);
  const o = overview.data;

  async function exportSales() {
    try { await downloadCsv("/api/manage/reports/export", { type: "sales", ...range }); }
    catch (e) { toast({ title: "Export failed", description: errMsg(e), variant: "destructive" }); }
  }

  return (
    <div className="page-enter p-4 sm:p-6 space-y-5">
      <PageHeader
        eyebrow="Insights" title="Sales Analytics"
        description="Counts only real sales: cancelled, refunded and unpaid online orders are excluded."
        actions={<Button variant="outline" size="sm" onClick={exportSales} className="gap-2"><Download className="h-4 w-4" />Export CSV</Button>}
      />
      <DateRange from={r.from} to={r.to} onFrom={r.setFrom} onTo={r.setTo} onPreset={r.preset} />

      {overview.isError ? <ErrorState message="Couldn't load analytics." onRetry={() => overview.refetch()} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Revenue" value={inr(o?.revenue ?? 0)} icon={IndianRupee} loading={overview.isLoading} trend={o ? pct(o.revenue, o.previous.revenue) : null} hint="vs previous period" />
          <StatCard label="Orders" value={o?.orders ?? 0} icon={ShoppingBag} loading={overview.isLoading} tone="blue" trend={o ? pct(o.orders, o.previous.orders) : null} hint={o ? `${o.cancelledOrders} cancelled` : undefined} />
          <StatCard label="Avg. order" value={inr(o?.averageOrderValue ?? 0)} icon={Receipt} loading={overview.isLoading} tone="amber" />
          <StatCard label="Units sold" value={o?.unitsSold ?? 0} icon={Boxes} loading={overview.isLoading} tone="violet" />
          <StatCard label="New customers" value={o?.newCustomers ?? 0} icon={UserPlus} loading={overview.isLoading} />
          <StatCard label="Repeat customers" value={o?.repeatCustomers ?? 0} icon={Repeat} loading={overview.isLoading} tone="rose" />
        </div>
      )}

      <DashboardCard
        title="Revenue & orders" subtitle={`${r.from} → ${r.to}`}
        action={
          <div className="inline-flex rounded-lg border border-neutral-200 p-0.5" role="group" aria-label="Group by">
            {(["day", "week", "month"] as const).map((g) => (
              <button key={g} onClick={() => setGroup(g)} aria-pressed={group === g}
                className={`h-8 px-3 text-xs font-medium rounded-md capitalize ${group === g ? "bg-emerald-800 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>{g}</button>
            ))}
          </div>
        }
      >
        {trend.isError ? <ErrorState onRetry={() => trend.refetch()} /> : trend.isLoading ? <LoadingSkeleton rows={4} /> :
          !trend.data?.some((d) => d.revenue > 0) ? <EmptyState title="No sales in this period" description="Try a wider date range." compact /> : (
            <div className="h-64 sm:h-72" role="img" aria-label="Revenue over time chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend.data} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs><linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.brand} stopOpacity={0.25} /><stop offset="100%" stopColor={T.brand} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => compactInr(v)} width={56} />
                  <Tooltip formatter={(v: number, n: string) => (n === "revenue" ? inr(v) : v)} labelFormatter={(l) => `Date: ${l}`} />
                  <Area type="monotone" dataKey="revenue" stroke={T.brand} strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
      </DashboardCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <DashboardCard title="Payment methods" subtitle="Share of revenue">
          {overview.isLoading ? <LoadingSkeleton rows={3} /> : !o?.paymentMix.length ? <EmptyState title="No data" compact /> : (
            <div className="h-60" role="img" aria-label="Payment method share">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={o.paymentMix.map((p) => ({ name: METHOD[p.method] ?? p.method, value: p.revenue }))} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {o.paymentMix.map((_, i) => <Cell key={i} fill={T.chart[i % T.chart.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(v)} /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>
        <DashboardCard title="Revenue by category" subtitle="Line totals, before coupon discounts">
          {cats.isLoading ? <LoadingSkeleton rows={3} /> : !cats.data?.length ? <EmptyState title="No data" compact /> : (
            <div className="h-60" role="img" aria-label="Revenue by category">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cats.data} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => compactInr(v)} />
                  <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 11 }} width={96} />
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Bar dataKey="revenue" fill={T.brand} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <DashboardCard title="Best sellers" subtitle="By units sold" className="lg:col-span-2">
          {top.isError ? <ErrorState onRetry={() => top.refetch()} /> : (
            <DataTable<TopProduct> loading={top.isLoading} rows={top.data ?? []} rowKey={(p) => p.id}
              empty={<EmptyState title="No sales yet" description="Best sellers appear once orders come in." compact />}
              columns={[
                { key: "name", header: "Product", primary: true, cell: (p) => <span className="line-clamp-1">{p.name}</span> },
                { key: "units", header: "Units", cell: (p) => `${p.units} sold` },
                { key: "revenue", header: "Revenue", align: "right", cell: (p) => inr(p.revenue) },
              ]} />
          )}
        </DashboardCard>
        <DashboardCard title="Order status" subtitle="All orders placed in range">
          {!o?.statusBreakdown.length ? <EmptyState title="No orders" compact /> : (
            <ul className="space-y-2">
              {o.statusBreakdown.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-neutral-700">{s.status}</span>
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
