/** pages/admin/payments.tsx — Payment management (collections, pending COD, refunds needed) */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, Banknote, Clock, RotateCcw, CreditCard, Download } from "lucide-react";
import { PageHeader, DashboardCard, DataTable, SearchBar, FilterDropdown, EmptyState, ErrorState, StatCard, ConfirmationDialog, inr } from "@/components/admin/ui";
import { DateRange } from "@/components/admin/DateRange";
import { Pager } from "@/components/admin/Pager";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAdminQuery, useDateRange, adminPut, downloadCsv, errMsg } from "@/lib/admin-api";

interface Pay { id: number; orderNumber: string; customerName: string; customerEmail: string; total: number; paymentMethod: string; paymentStatus: string; status: string; razorpayPaymentId: string | null; createdAt: string; refundNeeded: boolean }
interface Resp { payments: Pay[]; total: number; totalPages: number; summary: Record<string, number> }

const tone: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200", pending: "bg-amber-50 text-amber-700 ring-amber-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200", refunded: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

export default function AdminPayments() {
  const r = useDateRange(30);
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [method, setMethod] = useState(""); const [page, setPage] = useState(1);
  const [refund, setRefund] = useState<Pay | null>(null);
  const { toast } = useToast(); const qc = useQueryClient();
  const params = { from: r.from, to: r.to, q, status, method, page, limit: 20 };
  const res = useAdminQuery<Resp>("/api/manage/payments", params);
  const s = res.data?.summary;

  async function markRefunded() {
    if (!refund) return;
    try {
      await adminPut(`/api/orders/${refund.id}`, { status: "refunded", paymentStatus: "refunded" });
      toast({ title: "Marked as refunded", description: `${refund.orderNumber} — remember to refund ${inr(refund.total)} in the Razorpay dashboard.` });
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) { toast({ title: "Could not update", description: errMsg(e), variant: "destructive" }); }
    setRefund(null);
  }

  return (
    <div className="page-enter p-4 sm:p-6 space-y-5">
      <PageHeader eyebrow="Money" title="Payments" description="Online collections, cash to collect on delivery, and refunds you still owe."
        actions={<Button variant="outline" size="sm" className="gap-2" onClick={() => downloadCsv("/api/manage/reports/export", { type: "payments", from: r.from, to: r.to }).catch((e) => toast({ title: "Export failed", description: errMsg(e), variant: "destructive" }))}><Download className="h-4 w-4" />Export</Button>} />
      <DateRange from={r.from} to={r.to} onFrom={(v) => { r.setFrom(v); setPage(1); }} onTo={(v) => { r.setTo(v); setPage(1); }} onPreset={(d) => { r.preset(d); setPage(1); }} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Online collected" value={inr(s?.onlineCollected ?? 0)} icon={CreditCard} loading={res.isLoading} />
        <StatCard label="COD collected" value={inr(s?.codCollected ?? 0)} icon={Banknote} tone="blue" loading={res.isLoading} />
        <StatCard label="COD to collect" value={inr(s?.codToCollect ?? 0)} icon={Wallet} tone="amber" loading={res.isLoading} />
        <StatCard label="Awaiting payment" value={inr(s?.awaitingOnline ?? 0)} icon={Clock} tone="violet" loading={res.isLoading} hint="auto-expires" />
        <StatCard label="Refunds needed" value={inr(s?.refundsNeededAmount ?? 0)} icon={RotateCcw} tone="rose" loading={res.isLoading} hint={`${s?.refundsNeededCount ?? 0} order${s?.refundsNeededCount === 1 ? "" : "s"}`} />
      </div>
      <DashboardCard>
        <div className="flex flex-col lg:flex-row gap-2 mb-3">
          <SearchBar className="flex-1" value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Order no., customer, email or payment id" />
          <FilterDropdown label="Payment status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} className="lg:w-44"
            options={[{ value: "", label: "All statuses" }, { value: "paid", label: "Paid" }, { value: "pending", label: "Pending" }, { value: "failed", label: "Failed" }, { value: "refunded", label: "Refunded" }, { value: "refund_needed", label: "Refund needed" }]} />
          <FilterDropdown label="Method" value={method} onChange={(v) => { setMethod(v); setPage(1); }} className="lg:w-40"
            options={[{ value: "", label: "All methods" }, { value: "razorpay", label: "Online" }, { value: "cod", label: "Cash on delivery" }]} />
        </div>
        {res.isError ? <ErrorState onRetry={() => res.refetch()} /> : (
          <DataTable<Pay> loading={res.isLoading} rows={res.data?.payments ?? []} rowKey={(p) => p.id}
            empty={<EmptyState icon={Wallet} title="No payments in this range" description="Try a wider date range or clear filters." />}
            columns={[
              { key: "no", header: "Order", primary: true, cell: (p) => <div><p className="font-medium">{p.orderNumber}</p><p className="text-xs text-neutral-500 font-normal">{p.customerName}</p></div> },
              { key: "date", header: "Date", cell: (p) => new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) },
              { key: "m", header: "Method", cell: (p) => (p.paymentMethod === "cod" ? "COD" : "Online") },
              { key: "ps", header: "Payment", cell: (p) => <span className={`inline-flex h-5 px-2 items-center rounded-full text-[11px] font-medium ring-1 ring-inset capitalize ${p.refundNeeded ? "bg-rose-50 text-rose-700 ring-rose-200" : tone[p.paymentStatus]}`}>{p.refundNeeded ? "Refund needed" : p.paymentStatus}</span> },
              { key: "id", header: "Gateway ID", hideOnMobile: true, cell: (p) => <span className="font-mono text-xs">{p.razorpayPaymentId ?? "—"}</span> },
              { key: "amt", header: "Amount", align: "right", cell: (p) => (
                <span className="inline-flex items-center gap-2">{inr(p.total)}{p.refundNeeded && <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setRefund(p); }}>Mark refunded</Button>}</span>) },
            ]} />
        )}
        <Pager page={page} totalPages={res.data?.totalPages ?? 1} total={res.data?.total} onPage={setPage} />
      </DashboardCard>
      <ConfirmationDialog open={!!refund} onOpenChange={(v) => !v && setRefund(null)} title="Mark as refunded?"
        description={`Only do this after you have refunded ${refund ? inr(refund.total) : ""} to the customer in the Razorpay dashboard. This records the refund here; it does not move money.`}
        confirmLabel="Yes, mark refunded" onConfirm={markRefunded} />
    </div>
  );
}
