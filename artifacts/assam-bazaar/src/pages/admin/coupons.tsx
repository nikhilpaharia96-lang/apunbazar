import { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_COUPONS = [
  { id: 1, code: "ASSAM10", discount: 10, type: "percent", minOrder: 500, active: true },
  { id: 2, code: "WELCOME50", discount: 50, type: "flat", minOrder: 300, active: true },
  { id: 3, code: "TEA20", discount: 20, type: "percent", minOrder: 200, active: false },
];

export type Coupon = typeof DEFAULT_COUPONS[0];

export function loadCoupons(): Coupon[] {
  try {
    const saved = localStorage.getItem("apunbazar_coupons");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_COUPONS;
}

export default function AdminCoupons() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>(DEFAULT_COUPONS);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [type, setType] = useState<"percent" | "flat">("percent");
  const [minOrder, setMinOrder] = useState("");

  // Load from localStorage
  useEffect(() => {
    setCoupons(loadCoupons());
  }, []);

  // Save to localStorage whenever coupons change
  function saveCoupons(updated: Coupon[]) {
    setCoupons(updated);
    localStorage.setItem("apunbazar_coupons", JSON.stringify(updated));
  }

  function addCoupon() {
    if (!code || !discount) {
      toast({ title: "Coupon code and discount are required", variant: "destructive" });
      return;
    }
    const newCoupon: Coupon = {
      id: Date.now(),
      code: code.toUpperCase().trim(),
      discount: Number(discount),
      type,
      minOrder: Number(minOrder) || 0,
      active: true,
    };
    saveCoupons([...coupons, newCoupon]);
    setCode(""); setDiscount(""); setMinOrder(""); setShowForm(false);
    toast({ title: "✅ Coupon created!", description: `${newCoupon.code} is now active` });
  }

  function toggleActive(id: number) {
    const updated = coupons.map(c => c.id === id ? { ...c, active: !c.active } : c);
    saveCoupons(updated);
    const coupon = updated.find(c => c.id === id);
    toast({ title: coupon?.active ? "Coupon activated" : "Coupon deactivated" });
  }

  function deleteCoupon(id: number) {
    if (!confirm("Delete this coupon?")) return;
    saveCoupons(coupons.filter(c => c.id !== id));
    toast({ title: "Coupon deleted" });
  }

  function copyCode(c: string) {
    navigator.clipboard.writeText(c);
    toast({ title: `Copied: ${c}` });
  }

  return (
    <div className="p-3 sm:p-6 space-y-6">
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
                  {c.type === "percent" ? `${c.discount}% OFF` : `₹${c.discount} OFF`}
                </td>
                <td className="px-4 py-3 text-muted-foreground">₹{c.minOrder}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={c.active ? "default" : "secondary"}
                    className={`text-xs cursor-pointer ${c.active ? "bg-green-600 hover:bg-green-700" : ""}`}
                    onClick={() => toggleActive(c.id)}
                  >
                    {c.active ? "Active" : "Inactive"}
                  </Badge>
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
            {coupons.length === 0 && (
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
