import { useState } from "react";
import { useUpdateOrderStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Phone, Mail, User, Package, CreditCard, ChevronRight, StickyNote } from "lucide-react";
import { safeArray } from "@/lib/safe-array";
import { SearchBar, FilterDropdown } from "@/components/admin/ui";
import { useAdminQuery, downloadCsv, errMsg, todayIST } from "@/lib/admin-api";
import { Download } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const ALL_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"] as const;

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  items: unknown[];
  subtotal: number;
  shippingFee: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  notes?: string | null;
  createdAt: string;
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [q, setQ] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Real server-side search + filters (order no., name, email, phone, payment status, date range)
  const { data, isLoading } = useAdminQuery<{ orders: Order[]; total: number; totalPages: number }>(
    "/api/orders",
    { status: statusFilter, paymentStatus: payFilter, q, from, to, page, limit: 15 },
  );

  const updateStatus = useUpdateOrderStatus();

  const orders = safeArray<Order>(
    Array.isArray((data as any)?.orders) ? (data as any).orders : data
  );

  function handleStatusChange(orderId: number, status: string) {
    updateStatus.mutate(
      { id: orderId, data: { status: status as typeof ALL_STATUSES[number] } },
      {
        onSuccess: (updated) => {
          queryClient.invalidateQueries({ queryKey: ["admin"] });
          if (selectedOrder?.id === orderId) {
            setSelectedOrder(updated as Order);
          }
          toast({ title: "Order status updated" });
        },
        onError: (err) => toast({
          title: "Could not update order",
          description: (err as { data?: { error?: string } }).data?.error ?? "Please try again.",
          variant: "destructive",
        }),
      }
    );
  }

  const items = safeArray<{ productId?: number; name?: string; quantity: number; price: number }>(
    selectedOrder?.items
  );

  return (
    <>
      <div className="page-enter p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold">Orders</h1>
            <p className="text-muted-foreground text-sm">{(data as any)?.total ?? 0} orders total</p>
          </div>
          <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-40" data-testid="select-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchBar className="flex-1" value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search order no., name, email or phone" />
          <FilterDropdown label="Payment status" value={payFilter} onChange={(v) => { setPayFilter(v); setPage(1); }} className="lg:w-44"
            options={[{ value: "", label: "All payments" }, { value: "paid", label: "Paid" }, { value: "pending", label: "Payment pending" }, { value: "failed", label: "Failed" }, { value: "refunded", label: "Refunded" }]} />
          <label className="sr-only" htmlFor="ord-from">From date</label>
          <input id="ord-from" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-10 px-2.5 rounded-lg border border-neutral-200 bg-white text-sm" />
          <label className="sr-only" htmlFor="ord-to">To date</label>
          <input id="ord-to" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-10 px-2.5 rounded-lg border border-neutral-200 bg-white text-sm" />
          <Button variant="outline" className="gap-2" onClick={() => downloadCsv("/api/manage/reports/export", { type: "orders", from: from || "2020-01-01", to: to || todayIST() }).catch((e) => toast({ title: "Export failed", description: errMsg(e), variant: "destructive" }))}>
            <Download className="h-4 w-4" />Export
          </Button>
        </div>

        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Order</th>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Address</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Payment</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                        <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-16" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-8 w-32" /></td>
                        <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  : orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                        data-testid={`row-order-${order.id}`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-muted-foreground text-xs">{safeArray(order.items).length} item(s)</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{order.customerName}</p>
                          <p className="text-muted-foreground text-xs">{order.customerEmail}</p>
                          <p className="text-muted-foreground text-xs">{order.customerPhone}</p>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <p className="text-sm text-foreground">{order.shippingCity}, {order.shippingState}</p>
                          <p className="text-muted-foreground text-xs">{order.shippingPincode}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                          {new Date(order.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs capitalize">
                          <Badge variant="outline" className="text-xs font-normal">
                            {order.paymentMethod === "cod" ? "COD" : "Online"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Select value={order.status} onValueChange={(v) => handleStatusChange(order.id, v)}>
                            <SelectTrigger
                              className={`h-7 text-xs w-32 border-0 ${statusColors[order.status] ?? ""}`}
                              data-testid={`select-status-${order.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          ₹{Number(order.total).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        {(data as any)?.totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm">Page {page} of {(data as any).totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === (data as any).totalPages}>
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Order Detail Drawer */}
      <Sheet open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <SheetTitle className="font-serif text-xl">{selectedOrder.orderNumber}</SheetTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {new Date(selectedOrder.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge className={`${statusColors[selectedOrder.status] ?? ""} border-0 capitalize`}>
                    {selectedOrder.status}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Customer</h3>
                  <div className="space-y-3">
                    <InfoRow icon={User} label="Name" value={selectedOrder.customerName} />
                    <InfoRow icon={Mail} label="Email" value={selectedOrder.customerEmail} />
                    <InfoRow icon={Phone} label="Phone" value={selectedOrder.customerPhone} />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Shipping Address</h3>
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-relaxed">{selectedOrder.shippingAddress}</p>
                      <p className="text-sm font-medium">{selectedOrder.shippingCity}, {selectedOrder.shippingState}</p>
                      <p className="text-sm text-muted-foreground">PIN: {selectedOrder.shippingPincode}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Items Ordered</h3>
                  <div className="space-y-2.5">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 bg-muted/40 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Package className="h-3 w-3 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.name ?? `Product #${item.productId}`}</p>
                            <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold flex-shrink-0">
                          ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Payment</h3>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {selectedOrder.paymentMethod === "cod" ? "Cash on Delivery" : "Online (Razorpay)"}
                      </p>
                      <p className={`text-xs font-medium capitalize ${selectedOrder.paymentStatus === "paid" ? "text-green-600" : "text-yellow-600"}`}>
                        {selectedOrder.paymentStatus}
                      </p>
                    </div>
                  </div>
                  <div className="bg-muted/40 rounded-lg px-3 py-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span>₹{Number(selectedOrder.subtotal).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Shipping</span>
                      <span>{selectedOrder.shippingFee === 0 ? "Free" : `₹${selectedOrder.shippingFee}`}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold text-base">
                      <span>Total</span>
                      <span className="text-primary">₹{Number(selectedOrder.total).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Notes</h3>
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{selectedOrder.notes}</p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Update Status</h3>
                  <Select value={selectedOrder.status} onValueChange={(v) => handleStatusChange(selectedOrder.id, v)}>
                    <SelectTrigger className={`w-full ${statusColors[selectedOrder.status] ?? ""} border-0`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}