/** pages/admin/customers.tsx — Customer management (derived from real orders, grouped by email) */
import { useState } from "react";
import { Users, IndianRupee, Download } from "lucide-react";
import { PageHeader, DashboardCard, DataTable, SearchBar, FilterDropdown, EmptyState, ErrorState, StatusBadge, inr, StatCard } from "@/components/admin/ui";
import { Pager } from "@/components/admin/Pager";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAdminQuery, downloadCsv, errMsg, todayIST } from "@/lib/admin-api";
import { Link } from "wouter";

interface Customer { email: string; name: string; phone: string; city: string; orders: number; placedOrders: number; spent: number; firstOrder: string; lastOrder: string }
interface CustomerList { customers: Customer[]; total: number; page: number; totalPages: number }
interface Detail extends Customer { address: string; state: string; pincode: string; orderList: { id: number; orderNumber: string; total: number; status: string; paymentMethod: string; paymentStatus: string; createdAt: string }[] }

const date = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function AdminCustomers() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { toast } = useToast();

  const list = useAdminQuery<CustomerList>("/api/manage/customers", { q, sort, page, limit: 20 });
  const detail = useAdminQuery<Detail>("/api/manage/customers/detail", { email: open ?? "" }, { enabled: !!open });

  return (
    <div className="page-enter p-4 sm:p-6 space-y-5">
      <PageHeader eyebrow="People" title="Customers" description="Built from real orders. Spend counts only completed sales (no cancelled or unpaid orders)."
        actions={<Button variant="outline" size="sm" className="gap-2" onClick={() => downloadCsv("/api/manage/reports/export", { type: "customers", from: "2020-01-01", to: todayIST() }).catch((e) => toast({ title: "Export failed", description: errMsg(e), variant: "destructive" }))}><Download className="h-4 w-4" />Export</Button>} />
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <StatCard label="Customers" value={list.data?.total ?? 0} icon={Users} loading={list.isLoading} />
        <StatCard label="This page spent" value={inr((list.data?.customers ?? []).reduce((s, c) => s + c.spent, 0))} icon={IndianRupee} loading={list.isLoading} tone="amber" />
      </div>
      <DashboardCard>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <SearchBar className="flex-1" value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, email or phone" />
          <FilterDropdown label="Sort customers" value={sort} onChange={(v) => { setSort(v); setPage(1); }} className="sm:w-48"
            options={[{ value: "recent", label: "Most recent" }, { value: "spent", label: "Highest spend" }, { value: "orders", label: "Most orders" }, { value: "name", label: "Name A–Z" }]} />
        </div>
        {list.isError ? <ErrorState onRetry={() => list.refetch()} /> : (
          <DataTable<Customer> loading={list.isLoading} rows={list.data?.customers ?? []} rowKey={(c) => c.email} onRowClick={(c) => setOpen(c.email)}
            empty={<EmptyState icon={Users} title="No customers found" description="Customers appear after their first order." />}
            columns={[
              { key: "name", header: "Customer", primary: true, cell: (c) => <div><p className="font-medium">{c.name}</p><p className="text-xs text-neutral-500 font-normal">{c.email}</p></div> },
              { key: "city", header: "City", cell: (c) => c.city },
              { key: "orders", header: "Orders", cell: (c) => `${c.orders} order${c.orders === 1 ? "" : "s"}` },
              { key: "last", header: "Last order", hideOnMobile: true, cell: (c) => date(c.lastOrder) },
              { key: "spent", header: "Spent", align: "right", cell: (c) => inr(c.spent) },
            ]} />
        )}
        <Pager page={page} totalPages={list.data?.totalPages ?? 1} total={list.data?.total} onPage={setPage} />
      </DashboardCard>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail.data?.name ?? "Customer"}</SheetTitle>
            <SheetDescription>{open}</SheetDescription>
          </SheetHeader>
          {detail.isLoading ? <div className="space-y-3 mt-6"><Skeleton className="h-16" /><Skeleton className="h-40" /></div> :
            detail.isError ? <ErrorState onRetry={() => detail.refetch()} /> : detail.data && (
              <div className="mt-5 space-y-5 text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div><dt className="text-xs text-neutral-500">Phone</dt><dd><a className="text-emerald-800 underline" href={`tel:${detail.data.phone}`}>{detail.data.phone}</a></dd></div>
                  <div><dt className="text-xs text-neutral-500">Lifetime spend</dt><dd className="font-semibold">{inr(detail.data.spent)}</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-neutral-500">Latest address</dt><dd>{detail.data.address}, {detail.data.city}, {detail.data.state} {detail.data.pincode}</dd></div>
                  <div><dt className="text-xs text-neutral-500">First order</dt><dd>{date(detail.data.firstOrder)}</dd></div>
                  <div><dt className="text-xs text-neutral-500">Completed orders</dt><dd>{detail.data.orders}</dd></div>
                </dl>
                <div>
                  <h3 className="font-semibold mb-2">Order history</h3>
                  <ul className="divide-y divide-neutral-100">
                    {detail.data.orderList.map((o) => (
                      <li key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <Link href={`/admin/orders?q=${o.orderNumber}`} className="font-medium text-emerald-800 hover:underline">{o.orderNumber}</Link>
                          <p className="text-xs text-neutral-500">{date(o.createdAt)} · {o.paymentMethod === "cod" ? "COD" : "Online"} · {o.paymentStatus}</p>
                        </div>
                        <div className="text-right"><p className="font-semibold">{inr(o.total)}</p><StatusBadge status={o.status} /></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
