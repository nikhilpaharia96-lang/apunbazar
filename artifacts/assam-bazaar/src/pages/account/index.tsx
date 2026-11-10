import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Package, MapPin, Loader2, ChevronRight } from "lucide-react";
import { useCustomer, customerLogout, fetchMyOrders, updateCustomer, dropSessionIf401 } from "@/lib/customer-auth";
import { useSEO } from "@/hooks/use-seo";

const STATES = ["Assam", "Arunachal Pradesh", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura", "West Bengal", "Bihar", "Delhi", "Gujarat", "Karnataka", "Kerala", "Maharashtra", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Other"];
const STATUS_TONE: Record<string, string> = { pending: "bg-amber-50 text-amber-800", confirmed: "bg-blue-50 text-blue-800", processing: "bg-blue-50 text-blue-800", shipped: "bg-indigo-50 text-indigo-800", delivered: "bg-emerald-50 text-emerald-800", cancelled: "bg-gray-100 text-gray-700", refunded: "bg-gray-100 text-gray-700" };

export default function Account() {
  useSEO({ title: "My Account", noindex: true });
  const customer = useCustomer();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: "", phone: "", address: "", city: "", state: "Assam", pincode: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (!customer) navigate("/login?next=/account"); }, [customer, navigate]);
  useEffect(() => {
    if (customer) setForm({ name: customer.name, phone: customer.phone, address: customer.address ?? "", city: customer.city ?? "", state: customer.state ?? "Assam", pincode: customer.pincode ?? "" });
  }, [customer]);

  const orders = useQuery({ queryKey: ["my-orders-account", customer?.id], enabled: !!customer, queryFn: fetchMyOrders, retry: false });
  useEffect(() => { if (orders.error) dropSessionIf401(orders.error); }, [orders.error]);

  if (!customer) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg(null);
    try { await updateCustomer(form); setMsg({ ok: true, text: "Saved. We’ll use these details at checkout." }); }
    catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save" }); }
    finally { setSaving(false); }
  }
  const input = "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#1a5c2a] focus:ring-2 focus:ring-[#1a5c2a]/15";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="page-enter min-h-screen" style={{ background: "#f8f9fa" }}>
      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900">Hello, {customer.name.split(" ")[0]}</h1>
            <p className="text-sm text-gray-600">{customer.email}</p>
          </div>
          <button onClick={() => { customerLogout(); navigate("/"); }} data-testid="button-logout"
            className="h-10 px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold flex items-center gap-2 hover:bg-gray-50"><LogOut className="h-4 w-4" />Log out</button>
        </div>

        <section aria-labelledby="orders-h" className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
          <h2 id="orders-h" className="font-bold text-gray-900 flex items-center gap-2 mb-3"><Package className="h-5 w-5" style={{ color: "#1a5c2a" }} />My orders</h2>
          {orders.isLoading ? <p className="text-sm text-gray-600 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading your orders…</p>
            : orders.error ? <p className="text-sm text-red-700">Couldn’t load your orders. Please try again.</p>
            : !orders.data?.orders.length ? (
              <div className="text-center py-6"><p className="text-gray-700 font-semibold">No orders yet</p><p className="text-sm text-gray-600 mb-3">Your orders will appear here.</p>
                <Link href="/products" className="inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-white" style={{ background: "#1a5c2a" }}>Start shopping</Link></div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {orders.data.orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="py-3 flex items-center justify-between gap-3 hover:bg-gray-50 -mx-2 px-2 rounded-xl" data-testid={`account-order-${o.id}`}>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900">{o.orderNumber}</p>
                        <p className="text-xs text-gray-600">{new Date(o.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {o.paymentMethod === "cod" ? "Cash on delivery" : "Paid online"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right"><p className="font-bold">₹{o.total.toLocaleString("en-IN")}</p>
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_TONE[o.status] ?? "bg-gray-100 text-gray-700"}`}>{o.status}</span></div>
                        <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section aria-labelledby="addr-h" className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
          <h2 id="addr-h" className="font-bold text-gray-900 flex items-center gap-2 mb-3"><MapPin className="h-5 w-5" style={{ color: "#1a5c2a" }} />Delivery details</h2>
          <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm font-semibold text-gray-700">Full name<input className={input + " mt-1 font-normal"} value={form.name} onChange={set("name")} required minLength={2} /></label>
            <label className="text-sm font-semibold text-gray-700">Mobile<input className={input + " mt-1 font-normal"} type="tel" inputMode="numeric" value={form.phone} onChange={set("phone")} required /></label>
            <label className="text-sm font-semibold text-gray-700 sm:col-span-2">Address<input className={input + " mt-1 font-normal"} value={form.address} onChange={set("address")} placeholder="House no., street, locality" /></label>
            <label className="text-sm font-semibold text-gray-700">City<input className={input + " mt-1 font-normal"} value={form.city} onChange={set("city")} /></label>
            <label className="text-sm font-semibold text-gray-700">State<select className={input + " mt-1 font-normal"} value={form.state} onChange={set("state")}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="text-sm font-semibold text-gray-700">Pincode<input className={input + " mt-1 font-normal"} inputMode="numeric" maxLength={6} value={form.pincode} onChange={set("pincode")} /></label>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button type="submit" disabled={saving} data-testid="button-save-profile" className="h-11 px-6 rounded-xl text-white font-bold disabled:opacity-60" style={{ background: "#1a5c2a" }}>{saving ? "Saving…" : "Save details"}</button>
              {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-800" : "text-red-700"}`}>{msg.text}</p>}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
