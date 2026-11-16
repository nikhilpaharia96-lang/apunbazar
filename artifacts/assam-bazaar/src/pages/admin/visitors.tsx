/**
 * pages/admin/visitors.tsx — Who visited the website, from where, and at what time.
 * Data: /api/manage/visitors/* (own first-party tracking; all times in India time, IST).
 * Complements Microsoft Clarity (session recordings/heatmaps) with simple numbers you can export.
 */
import { useState } from "react";
import { Users, Eye, Activity, CalendarClock, Globe2 } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { PageHeader, DashboardCard, StatCard, EmptyState, ErrorState, DataTable, LoadingSkeleton } from "@/components/admin/ui";
import { DateRange } from "@/components/admin/DateRange";
import { Pager } from "@/components/admin/Pager";
import { T } from "@/components/admin/tokens";
import { useAdminQuery, useDateRange } from "@/lib/admin-api";

interface Named { name: string; visits?: number; visitors: number }
interface Summary {
  totals: { visits: number; visitors: number; sessions: number };
  liveNow: number;
  today: { visits: number; visitors: number };
  trend: { date: string; visits: number; visitors: number }[];
  hourly: { hour: number; label: string; visits: number; visitors: number }[];
  countries: Named[];
  regions: (Named & { country: string })[];
  cities: (Named & { region: string })[];
  devices: Named[];
  browsers: Named[];
  sources: Named[];
  pages: Named[];
}
interface Recent {
  items: { id: number; at: string; path: string; source: string; country: string | null; region: string | null; city: string | null; device: string | null; browser: string | null; os: string | null; visitor: string }[];
  total: number; page: number; limit: number;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });

const place = (v: { city: string | null; region: string | null; country: string | null }) =>
  [v.city, v.region, v.country].filter(Boolean).join(", ") || "Unknown";

function Ranked({ rows, loading, empty, sub }: { rows: Named[]; loading: boolean; empty: string; sub?: (r: Named) => string }) {
  if (loading) return <LoadingSkeleton rows={4} />;
  if (!rows.length) return <EmptyState title={empty} compact />;
  const max = Math.max(...rows.map((r) => r.visitors), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`}>
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="truncate text-neutral-800">{r.name}{sub?.(r) ? <span className="text-neutral-400"> · {sub(r)}</span> : null}</span>
            <span className="font-semibold tabular-nums">{r.visitors}</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-100 mt-1">
            <div className="h-1.5 rounded-full" style={{ width: `${(r.visitors / max) * 100}%`, background: T.brand }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminVisitors() {
  const r = useDateRange(30);
  const [page, setPage] = useState(1);
  const range = { from: r.from, to: r.to };

  const summary = useAdminQuery<Summary>("/api/manage/visitors/summary", range, { refetchInterval: 30_000 });
  const recent = useAdminQuery<Recent>("/api/manage/visitors/recent", { page, limit: 25 }, { refetchInterval: 30_000 });
  const s = summary.data;
  const peak = s?.hourly.reduce((a, b) => (b.visitors > a.visitors ? b : a), { label: "—", visitors: 0 } as { label: string; visitors: number });

  return (
    <div className="page-enter p-4 sm:p-6 space-y-5">
      <PageHeader
        eyebrow="Insights" title="Website Visitors"
        description="Kitne log aaye, kahan se aaye aur kis time par — India time (IST). Bots aur aapke apne admin visits count nahi hote."
      />
      <DateRange from={r.from} to={r.to} onFrom={r.setFrom} onTo={r.setTo} onPreset={r.preset} />

      {summary.isError ? <ErrorState message="Couldn't load visitor data." onRetry={() => summary.refetch()} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard label="Live now (5 min)" value={s?.liveNow ?? 0} icon={Activity} loading={summary.isLoading} tone="rose" />
          <StatCard label="Today's visitors" value={s?.today.visitors ?? 0} icon={CalendarClock} loading={summary.isLoading} tone="blue" hint={s ? `${s.today.visits} page views` : undefined} />
          <StatCard label="Unique visitors" value={s?.totals.visitors ?? 0} icon={Users} loading={summary.isLoading} />
          <StatCard label="Page views" value={s?.totals.visits ?? 0} icon={Eye} loading={summary.isLoading} tone="amber" />
          <StatCard label="Busiest hour" value={peak?.visitors ? peak.label : "—"} icon={Globe2} loading={summary.isLoading} tone="violet" hint={peak?.visitors ? `${peak.visitors} visitors` : undefined} />
        </div>
      )}

      <DashboardCard title="Visitors per day" subtitle={`${r.from} → ${r.to}`}>
        {summary.isLoading ? <LoadingSkeleton rows={4} /> : !s?.trend.length ? <EmptyState title="No visits recorded yet" description="Data appears after the first real visitor on the live site." compact /> : (
          <div className="h-64" role="img" aria-label="Visitors per day chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.trend} margin={{ left: -10, right: 8, top: 8 }}>
                <defs><linearGradient id="vis" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.brand} stopOpacity={0.25} /><stop offset="100%" stopColor={T.brand} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                <Tooltip labelFormatter={(l) => `Date: ${l}`} />
                <Legend />
                <Area type="monotone" name="Unique visitors" dataKey="visitors" stroke={T.brand} strokeWidth={2} fill="url(#vis)" />
                <Area type="monotone" name="Page views" dataKey="visits" stroke={T.gold} strokeWidth={2} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardCard>

      <DashboardCard title="Kis time par aate hain" subtitle="Visitors by hour of day (IST)">
        {summary.isLoading ? <LoadingSkeleton rows={3} /> : !s?.totals.visits ? <EmptyState title="No data" compact /> : (
          <div className="h-56" role="img" aria-label="Visitors by hour of day">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.hourly} margin={{ left: -10, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h: number) => `${h}h`} interval={1} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                <Tooltip labelFormatter={(h) => `${String(h).padStart(2, "0")}:00 – ${String(h).padStart(2, "0")}:59`} />
                <Bar dataKey="visitors" name="Visitors" fill={T.brand} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardCard>

      <div className="grid lg:grid-cols-3 gap-4">
        <DashboardCard title="Countries" subtitle="Unique visitors">
          <Ranked rows={s?.countries ?? []} loading={summary.isLoading} empty="No location data yet" />
        </DashboardCard>
        <DashboardCard title="States / regions" subtitle="Unique visitors">
          <Ranked rows={s?.regions ?? []} loading={summary.isLoading} empty="No location data yet" sub={(x) => (x as Summary["regions"][number]).country} />
        </DashboardCard>
        <DashboardCard title="Cities" subtitle="Unique visitors">
          <Ranked rows={s?.cities ?? []} loading={summary.isLoading} empty="No location data yet" sub={(x) => (x as Summary["cities"][number]).region} />
        </DashboardCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <DashboardCard title="Traffic sources" subtitle="Kahan se link par click karke aaye">
          <Ranked rows={s?.sources ?? []} loading={summary.isLoading} empty="No data" />
        </DashboardCard>
        <DashboardCard title="Devices" subtitle="Mobile vs desktop">
          {summary.isLoading ? <LoadingSkeleton rows={3} /> : !s?.devices.length ? <EmptyState title="No data" compact /> : (
            <div className="h-56" role="img" aria-label="Device share">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.devices} dataKey="visitors" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {s.devices.map((_, i) => <Cell key={i} fill={T.chart[i % T.chart.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardCard>
        <DashboardCard title="Top pages" subtitle="By page views">
          <Ranked rows={(s?.pages ?? []).map((p) => ({ name: p.name, visitors: p.visits ?? p.visitors }))} loading={summary.isLoading} empty="No data" />
        </DashboardCard>
      </div>

      <DashboardCard title="Recent visits" subtitle="Live feed — refreshes every 30 seconds">
        {recent.isError ? <ErrorState onRetry={() => recent.refetch()} /> : (
          <>
            <DataTable<Recent["items"][number]> loading={recent.isLoading} rows={recent.data?.items ?? []} rowKey={(v) => v.id}
              empty={<EmptyState title="No visits yet" description="Visits show up here once real customers browse the live site." compact />}
              columns={[
                { key: "at", header: "Time (IST)", primary: true, cell: (v) => fmtTime(v.at) },
                { key: "where", header: "Location", cell: (v) => place(v) },
                { key: "path", header: "Page", cell: (v) => <span className="line-clamp-1">{v.path}</span> },
                { key: "source", header: "Source", cell: (v) => <span className="capitalize">{v.source}</span> },
                { key: "device", header: "Device", hideOnMobile: true, cell: (v) => [v.device, v.browser, v.os].filter(Boolean).join(" · ") },
                { key: "visitor", header: "Visitor", hideOnMobile: true, cell: (v) => <code className="text-xs text-neutral-500">{v.visitor}</code> },
              ]} />
            <Pager page={page} totalPages={Math.max(1, Math.ceil((recent.data?.total ?? 0) / 25))} total={recent.data?.total} onPage={setPage} />
          </>
        )}
      </DashboardCard>
    </div>
  );
}
