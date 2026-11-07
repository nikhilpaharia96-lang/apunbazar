/** pages/admin/reports.tsx — CSV exports of real data */
import { useState } from "react";
import { FileSpreadsheet, ShoppingBag, Users, Boxes, CreditCard, LineChart, Download, Loader2 } from "lucide-react";
import { PageHeader, DashboardCard } from "@/components/admin/ui";
import { DateRange } from "@/components/admin/DateRange";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDateRange, downloadCsv, errMsg } from "@/lib/admin-api";

const REPORTS = [
  { type: "sales", title: "Daily sales", desc: "Orders, revenue and average order value for every day in the range.", icon: LineChart, dated: true },
  { type: "orders", title: "Orders", desc: "Every order with customer, items, totals, coupon, status and payment.", icon: ShoppingBag, dated: true },
  { type: "customers", title: "Customers", desc: "Customers with orders, lifetime spend and first/last order dates.", icon: Users, dated: true },
  { type: "payments", title: "Payments", desc: "Payment status per order, gateway ids and refunds still owed.", icon: CreditCard, dated: true },
  { type: "inventory", title: "Inventory snapshot", desc: "Current stock and stock value for every product.", icon: Boxes, dated: false },
] as const;

export default function AdminReports() {
  const r = useDateRange(30);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  async function run(type: string) {
    setBusy(type);
    try { await downloadCsv("/api/manage/reports/export", { type, from: r.from, to: r.to }); toast({ title: "Report downloaded" }); }
    catch (e) { toast({ title: "Export failed", description: errMsg(e), variant: "destructive" }); }
    finally { setBusy(null); }
  }

  return (
    <div className="page-enter p-4 sm:p-6 space-y-5">
      <PageHeader eyebrow="Insights" title="Reports & exports" description="Download live data as CSV — opens in Excel or Google Sheets. Dates are India time." />
      <DateRange from={r.from} to={r.to} onFrom={r.setFrom} onTo={r.setTo} onPreset={r.preset} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map((rep) => (
          <DashboardCard key={rep.type}>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center flex-shrink-0"><rep.icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-neutral-900">{rep.title}</h2>
                <p className="text-sm text-neutral-500 mt-0.5">{rep.desc}</p>
                <p className="text-xs text-neutral-400 mt-2 flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" />{rep.dated ? `${r.from} → ${r.to}` : "Current snapshot"}</p>
                <Button size="sm" className="mt-3 gap-2" onClick={() => run(rep.type)} disabled={busy !== null}>
                  {busy === rep.type ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download CSV
                </Button>
              </div>
            </div>
          </DashboardCard>
        ))}
      </div>
    </div>
  );
}
