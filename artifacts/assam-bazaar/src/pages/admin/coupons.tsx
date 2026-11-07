import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { apiFetch } from "@/lib/api";

// Coupons live in the database. The server validates them and recomputes every discount at checkout.
interface Coupon {
  id: number; code: string; discountType: "percent" | "flat"; discountValue: number;
  minimumOrderValue: number; maxUses: number | null; usedCount: number; active: boolean; expiresAt: string | null;
}

export default function AdminCoupons() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [type, setType] = useState<"percent" | "flat">("percent");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");

  const fail = (title: string, e: unknown) =>
    toast({ title, description: e instanceof Error ? e.message : "Try again", variant: "destructive" });

  async function load() {
    try { setCoupons(await apiFetch<Coupon[]>("/api/coupons", { auth: true })); }
    catch (e) { fail("Could not load coupons", e); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function addCoupon() {
    if (!code || !discount) {
      toast({ title: "Coupon code and discount are required", variant: "destructive" });
      return;
    }
    try {
      const created = await apiFetch<Coupon>("/api/coupons", {
        method: "POST", auth: true,
        body: JSON.stringify({
          code: code.trim(), discountType: type, discountValue: Number(discount),
          minimumOrderValue: Number(minOrder) || 0, maxUses: maxUses ? Number(maxUses) : null,
        }),
      });
      setCoupons([created, ...coupons]);
      setCode(""); setDiscount(""); setMinOrder(""); setMaxUses(""); setShowForm(false);
      toast({ title: "✅ Coupon created!", description: `${created.code} is now active` });
    } catch (e) { fail("Could not create coupon", e); }
  }

  async function toggleActive(id: number) {
    const current = coupons.find(c => c.id === id);
    if (!current) return;
    try {
      const updated = await apiFetch<Coupon>(`/api/coupons/${id}`, { method: "PATCH", auth: true, body: JSON.stringify({ active: !current.active }) });
      setCoupons(coupons.map(c => c.id === id ? updated : c));
      toast({ title: updated.active ? "Coupon activated" : "Coupon deactivated" });
    } catch (e) { fail("Could not update coupon", e); }
  }

  async function deleteCoupon(id: number) {
    if (!confirm("Delete this coupon?")) return;
    try {
      await apiFetch(`/api/coupons/${id}`, { method: "DELETE", auth: true });
      setCoupons(coupons.filter(c => c.id !== id));
      toast({ title: "Coupon deleted" });
    } catch (e) { fail("Could not delete coupon", e); }
  }

  function copyCode(c: string) {
    navigator.clipboard.writeText(c);
    toast({ title: `Copied: ${c}` });
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">Coupons</h1>
          <p className="text-muted-foreground text-sm">
            {coupons.filter(c => c.active).length} active · {coupons.length} total
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Coupon
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">New Coupon</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Coupon Code</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SAVE20"
                className="uppercase font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Discount Amount</label>
              <Input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "percent" | "flat")}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
              >
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Min Order (₹)</label>
              <Input
                type="number"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                placeholder="500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Max Uses (optional)</label>
              <Input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            {type === "percent" && discount
              ? `₹1000 order pe ₹${Math.round(1000 * Number(discount) / 100)} discount milega`
              : type === "flat" && discount
              ? `Har order pe flat ₹${discount} discount milega`
              : "Discount preview yahan dikhega"}
            {minOrder ? ` · Minimum order: ₹${minOrder}` : ""}
          </div>
          <div className="flex gap-2">
            <Button onClick={addCoupon}>Create Coupon</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Code</th>
              <th className="text-left px-4 py-3 font-medium">Discount</th>
              <th className="text-left px-4 py-3 font-medium">Min Order</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="font-mono font-bold text-base">{c.code}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-primary">
                  {c.discountType === "percent" ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}
                </td>
                <td className="px-4 py-3 text-muted-foreground">₹{c.minimumOrderValue}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={c.active ? "default" : "secondary"}
                    className={`text-xs cursor-pointer ${c.active ? "bg-green-600 hover:bg-green-700" : ""}`}
                    onClick={() => toggleActive(c.id)}
                  >
                    {c.active ? "Active" : "Inactive"}
                  </Badge>
                  <p className="text-[11px] text-muted-foreground mt-1">Used {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ""}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => toggleActive(c.id)}
                      title={c.active ? "Deactivate" : "Activate"}
                    >
                      {c.active
                        ? <ToggleRight className="h-4 w-4 text-green-600" />
                        : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      }
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => copyCode(c.code)} title="Copy code">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteCoupon(c.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && coupons.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No coupons yet. Create one using "Add Coupon"!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-muted/30 rounded-xl p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">💡 Coupon kaise kaam karta hai</p>
        <p>These coupons can be applied at checkout. The discount will be calculated automatically when the customer enters the coupon code.</p>
      </div>
    </div>
  );
}
