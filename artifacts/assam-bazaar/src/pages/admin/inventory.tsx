/** pages/admin/inventory.tsx — Inventory management with an auditable stock ledger */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Boxes, AlertTriangle, PackageX, IndianRupee, History } from "lucide-react";
import { PageHeader, DashboardCard, DataTable, SearchBar, EmptyState, ErrorState, StatCard, inr } from "@/components/admin/ui";
import { Pager } from "@/components/admin/Pager";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdminQuery, adminPost, errMsg } from "@/lib/admin-api";

interface Item { id: number; name: string; stock: number; price: number; imageUrl: string; categoryName: string | null; stockValue: number }
interface Inv { products: Item[]; total: number; totalPages: number; threshold: number; summary: { totalProducts: number; outOfStock: number; lowStock: number; stockValue: number; totalUnits: number } }
interface Movement { id: number; delta: number; reason: string; orderId: number | null; note: string | null; actor: string; createdAt: string }

const REASON: Record<string, string> = { order: "Sold", cancel: "Order cancelled", expiry: "Payment expired", manual: "Manual adjustment", product_edit: "Product edited" };
const FILTERS = [{ v: "all", l: "All" }, { v: "low", l: "Low stock" }, { v: "out", l: "Out of stock" }] as const;

export default function AdminInventory() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [threshold, setThreshold] = useState(5);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Item | null>(null);
  const [mode, setMode] = useState<"delta" | "set">("delta");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Item | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const inv = useAdminQuery<Inv>("/api/manage/inventory", { q, filter, threshold, page, limit: 20 });
  const moves = useAdminQuery<Movement[]>(`/api/manage/inventory/${history?.id ?? 0}/movements`, {}, { enabled: !!history });
  const s = inv.data?.summary;

  function openAdjust(p: Item) { setTarget(p); setMode("delta"); setValue(""); setReason(""); }

  async function save() {
    if (!target) return;
    const n = Number(value);
    if (!Number.isInteger(n) || value.trim() === "") { toast({ title: "Enter a whole number", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await adminPost<{ stock: number; previous: number }>(`/api/manage/inventory/${target.id}/adjust`, { mode, value: n, reason });
      toast({ title: "Stock updated", description: `${target.name}: ${r.previous} → ${r.stock}` });
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) { toast({ title: "Could not update stock", description: errMsg(e), variant: "destructive" }); }
    finally { setSaving(false); }
  }

  const stockBadge = (n: number) =>
    n === 0 ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200">Out of stock</span>
    : n <= threshold ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">{n} left</span>
    : <span className="text-neutral-700">{n} in stock</span>;

  return (
    <div className="page-enter p-4 sm:p-6 space-y-5">
      <PageHeader eyebrow="Catalogue" title="Inventory" description="Every change is recorded in the stock ledger: sales, cancellations, expiry and manual edits." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Products" value={s?.totalProducts ?? 0} icon={Boxes} loading={inv.isLoading} hint={`${s?.totalUnits ?? 0} units`} />
        <StatCard label="Low stock" value={s?.lowStock ?? 0} icon={AlertTriangle} tone="amber" loading={inv.isLoading} hint={`≤ ${threshold} units`} />
        <StatCard label="Out of stock" value={s?.outOfStock ?? 0} icon={PackageX} tone="rose" loading={inv.isLoading} />
        <StatCard label="Stock value" value={inr(s?.stockValue ?? 0)} icon={IndianRupee} tone="blue" loading={inv.isLoading} hint="at selling price" />
      </div>

      <DashboardCard>
        <div className="flex flex-col lg:flex-row gap-2 mb-3">
          <SearchBar className="flex-1" value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search products" />
          <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-white" role="group" aria-label="Stock filter">
            {FILTERS.map((f) => (
              <button key={f.v} aria-pressed={filter === f.v} onClick={() => { setFilter(f.v); setPage(1); }}
                className={`h-9 px-3 text-xs font-medium rounded-md ${filter === f.v ? "bg-emerald-800 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>{f.l}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-500">Low ≤
            <input type="number" min={1} max={1000} value={threshold} onChange={(e) => setThreshold(Math.max(1, Number(e.target.value) || 5))}
              className="h-10 w-16 px-2 rounded-lg border border-neutral-200 bg-white text-sm" aria-label="Low stock threshold" />
          </label>
        </div>
        {inv.isError ? <ErrorState onRetry={() => inv.refetch()} /> : (
          <DataTable<Item> loading={inv.isLoading} rows={inv.data?.products ?? []} rowKey={(p) => p.id}
            empty={<EmptyState icon={Boxes} title="No products match" description="Try another filter or search." />}
            columns={[
              { key: "name", header: "Product", primary: true, cell: (p) => <span className="flex items-center gap-2.5"><img src={p.imageUrl} alt="" loading="lazy" width={36} height={36} className="h-9 w-9 rounded-md object-cover bg-neutral-100" /><span className="line-clamp-1">{p.name}</span></span> },
              { key: "cat", header: "Category", cell: (p) => p.categoryName ?? "—" },
              { key: "stock", header: "Stock", cell: (p) => stockBadge(p.stock) },
              { key: "value", header: "Value", hideOnMobile: true, cell: (p) => inr(p.stockValue) },
              { key: "act", header: "", align: "right", cell: (p) => (
                <span className="inline-flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openAdjust(p); }}>Adjust</Button>
                  <Button size="sm" variant="ghost" aria-label={`Stock history for ${p.name}`} onClick={(e) => { e.stopPropagation(); setHistory(p); }}><History className="h-4 w-4" /></Button>
                </span>) },
            ]} />
        )}
        <Pager page={page} totalPages={inv.data?.totalPages ?? 1} total={inv.data?.total} onPage={setPage} />
      </DashboardCard>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock</DialogTitle><DialogDescription>{target?.name} — currently {target?.stock} units</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="inline-flex rounded-lg border border-neutral-200 p-0.5" role="group" aria-label="Adjustment type">
              {(["delta", "set"] as const).map((m) => (
                <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={`h-9 px-3 text-xs font-medium rounded-md ${mode === m ? "bg-emerald-800 text-white" : "text-neutral-600"}`}>{m === "delta" ? "Add / remove" : "Set exact count"}</button>
              ))}
            </div>
            <div><label htmlFor="adj-value" className="text-sm font-medium">{mode === "delta" ? "Change (use − to remove)" : "New stock count"}</label>
              <Input id="adj-value" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder={mode === "delta" ? "e.g. 20 or -3" : "e.g. 50"} /></div>
            <div><label htmlFor="adj-reason" className="text-sm font-medium">Reason</label>
              <Input id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. New batch from supplier" maxLength={200} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!history} onOpenChange={(v) => !v && setHistory(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Stock history</DialogTitle><DialogDescription>{history?.name}</DialogDescription></DialogHeader>
          {moves.isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : !moves.data?.length ? <EmptyState title="No movements yet" compact /> : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {moves.data.map((m) => (
                <li key={m.id} className="py-2 flex items-start justify-between gap-3">
                  <div><p className="font-medium">{REASON[m.reason] ?? m.reason}</p><p className="text-xs text-neutral-500">{new Date(m.createdAt).toLocaleString("en-IN")} · {m.actor}{m.note ? ` · ${m.note}` : ""}</p></div>
                  <span className={`font-semibold tabular-nums ${m.delta < 0 ? "text-rose-600" : "text-emerald-700"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
