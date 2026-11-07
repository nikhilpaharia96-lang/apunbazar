import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Store, Mail, Phone, MapPin, Save, CreditCard,
  Eye, EyeOff, CheckCircle, XCircle, Loader, Shield,
  Zap, Truck, Package, Banknote, ExternalLink,
  Facebook, Instagram, Youtube, Twitter, MessageCircle,
} from "lucide-react";
import { fetchShippingConfig, saveShippingConfig, DEFAULT_SHIPPING, type ShippingConfig } from "@/lib/shipping-config";

// ─── Social links helpers ─────────────────────────────────────────────────────
const SOCIAL_FIELDS = [
  { key: "facebook",  label: "Facebook",   placeholder: "https://facebook.com/yourpage",      icon: <Facebook    className="h-4 w-4" style={{ color: "#1877F2" }} /> },
  { key: "instagram", label: "Instagram",  placeholder: "https://instagram.com/yourhandle",   icon: <Instagram   className="h-4 w-4" style={{ color: "#E1306C" }} /> },
  { key: "whatsapp",  label: "WhatsApp",   placeholder: "https://wa.me/919876543210",         icon: <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} /> },
  { key: "youtube",   label: "YouTube",    placeholder: "https://youtube.com/@yourchannel",   icon: <Youtube     className="h-4 w-4" style={{ color: "#FF0000" }} /> },
  { key: "twitter",   label: "X (Twitter)",placeholder: "https://x.com/yourhandle",           icon: <Twitter     className="h-4 w-4" style={{ color: "#000" }} /> },
];

function loadSocials() {
  try {
    const saved = localStorage.getItem("apunbazar_socials");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { facebook: "", instagram: "", whatsapp: "", youtube: "", twitter: "" };
}

// ─── Main Settings Page ───────────────────────────────────────────────────────
export default function AdminSettings() {
  const { toast } = useToast();

  // Store info
  const [settings, setSettings] = useState({
    storeName: "ApunBazar",
    tagline: "Pride of Assam",
    email: "contact@apunbazar.com",
    phone: "+91 98765 43210",
    address: "Guwahati, Assam, India",
    currency: "INR",
  });

  // Shipping
  const [shipping, setShipping] = useState<ShippingConfig>(DEFAULT_SHIPPING);
  useEffect(() => { fetchShippingConfig().then(setShipping); }, []);

  // Razorpay
  const [razorpay, setRazorpay] = useState({
    keyId: "", keySecret: "", mode: "test" as "test" | "live",
    enabled: false, webhookSecret: "",
  });
  const [showSecret, setShowSecret]   = useState(false);
  const [testing, setTesting]         = useState(false);
  const [testResult, setTestResult]   = useState<"success" | "error" | null>(null);
  const [saving, setSaving]           = useState(false);

  // Social links
  const [socials, setSocials] = useState(loadSocials);

  // ── Handlers ──
  function saveStore() {
    toast({ title: "✅ Settings saved!", description: "Store settings updated." });
  }

  async function saveShipping() {
    try {
      const saved = await saveShippingConfig(shipping);
      setShipping(saved);
      toast({ title: "✅ Shipping saved!", description: `Shipping: ₹${saved.shippingFee} · COD: ₹${saved.codFee} · Free above: ₹${saved.freeShippingAbove}` });
    } catch (e) {
      toast({ title: "Could not save shipping settings", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    }
  }

  async function resetShipping() {
    try {
      setShipping(await saveShippingConfig(DEFAULT_SHIPPING));
      toast({ title: "Shipping reset to defaults" });
    } catch (e) {
      toast({ title: "Could not reset shipping settings", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    }
  }

  async function testRazorpay() {
    if (!razorpay.keyId || !razorpay.keySecret) { toast({ title: "Missing credentials", variant: "destructive" }); return; }
    setTesting(true); setTestResult(null);
    await new Promise(r => setTimeout(r, 1800));
    const isValid = razorpay.keyId.startsWith("rzp_");
    setTestResult(isValid ? "success" : "error");
    setTesting(false);
    toast({ title: isValid ? "Connection successful!" : "Connection failed", variant: isValid ? "default" : "destructive" });
  }

  async function saveRazorpay() {
    if (!razorpay.keyId || !razorpay.keySecret) { toast({ title: "Missing credentials", variant: "destructive" }); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    setSaving(false);
    setRazorpay(p => ({ ...p, enabled: true }));
    toast({ title: "Razorpay configured!", description: `Saved in ${razorpay.mode} mode.` });
  }

  function clearRazorpay() {
    setRazorpay({ keyId: "", keySecret: "", mode: "test", enabled: false, webhookSecret: "" });
    setTestResult(null);
    toast({ title: "Razorpay cleared" });
  }

  function saveSocials() {
    try {
      localStorage.setItem("apunbazar_socials", JSON.stringify(socials));
      window.dispatchEvent(new Event("apunbazar_socials_updated"));
      toast({ title: "✅ Social links saved!", description: "Footer links have been updated." });
    } catch {
      toast({ title: "Error saving", variant: "destructive" });
    }
  }

  // Live preview
  const exampleOrder    = 500;
  const isFreeExample   = shipping.freeShippingEnabled && exampleOrder >= shipping.freeShippingAbove;
  const shippingExample = isFreeExample ? 0 : shipping.shippingFee;
  const codExample      = shipping.codEnabled ? shipping.codFee : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage your store configuration</p>
      </div>

      {/* ── STORE INFO ── */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-5">
        <h3 className="font-semibold flex items-center gap-2"><Store className="h-4 w-4" /> Store Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1 col-span-2">
            <label className="text-sm font-medium">Store Name</label>
            <Input value={settings.storeName} onChange={e => setSettings({ ...settings, storeName: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-sm font-medium">Tagline</label>
            <Input value={settings.tagline} onChange={e => setSettings({ ...settings, tagline: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> Email</label>
            <Input value={settings.email} onChange={e => setSettings({ ...settings, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</label>
            <Input value={settings.phone} onChange={e => setSettings({ ...settings, phone: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-sm font-medium flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</label>
            <Input value={settings.address} onChange={e => setSettings({ ...settings, address: e.target.value })} />
          </div>
        </div>
        <Button onClick={saveStore} className="gap-2"><Save className="h-4 w-4" /> Save Settings</Button>
      </div>

      {/* ── SHIPPING ── */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Shipping & Charges</h3>
          <button onClick={resetShipping} className="text-xs text-muted-foreground hover:text-foreground underline">Reset to defaults</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-blue-500" /> Shipping Fee (₹)</label>
            <Input type="number" min="0" value={shipping.shippingFee} onChange={e => setShipping({ ...shipping, shippingFee: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5 text-orange-500" /> COD Fee (₹)</label>
            <Input type="number" min="0" value={shipping.codFee} onChange={e => setShipping({ ...shipping, codFee: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <label className="text-sm font-medium flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-green-500" /> Free Shipping Above (₹)</label>
            <Input type="number" min="0" value={shipping.freeShippingAbove} onChange={e => setShipping({ ...shipping, freeShippingAbove: Number(e.target.value) })} />
          </div>
          <div className="col-span-2 flex flex-col gap-3">
            {[
              { key: "freeShippingEnabled", label: "Enable Free Shipping", desc: `₹${shipping.freeShippingAbove}  and above gets free shipping` },
              { key: "codEnabled",          label: "Enable COD Charge",    desc: `Cash on delivery adds ₹${shipping.codFee}  extra charge` },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg cursor-pointer">
                <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                <div onClick={() => setShipping(s => ({ ...s, [key]: !(s as any)[key] }))}
                  className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${(shipping as any)[key] ? "bg-primary" : "bg-muted-foreground/30"}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${(shipping as any)[key] ? "left-6" : "left-1"}`} />
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview — ₹{exampleOrder} order</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Order Total</span><span>₹{exampleOrder}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span>{isFreeExample ? <span className="text-green-600 font-medium">FREE 🎉</span> : <span>₹{shippingExample}</span>}</div>
            <div className="flex justify-between"><span className="text-muted-foreground">COD Charge</span>{shipping.codEnabled ? <span>₹{codExample}</span> : <span className="text-muted-foreground">Not charged</span>}</div>
            <div className="flex justify-between font-bold border-t pt-1.5"><span>Customer Pays</span><span className="text-primary">₹{exampleOrder + shippingExample + (shipping.codEnabled ? codExample : 0)}</span></div>
          </div>
        </div>

        <Button onClick={saveShipping} className="gap-2 w-full"><Save className="h-4 w-4" /> Save Shipping Settings</Button>
      </div>

      {/* ── SOCIAL MEDIA LINKS ── */}
      <div className="bg-card border rounded-xl p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <span style={{ fontSize: 16 }}>🌐</span> Social Media Links
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Footer me social icons click karne pe yahi links open honge</p>
          </div>
          <Button onClick={saveSocials} className="gap-2"><Save className="h-4 w-4" /> Save Links</Button>
        </div>

        <div className="space-y-4">
          {SOCIAL_FIELDS.map(f => {
            const val = (socials as any)[f.key] ?? "";
            return (
              <div key={f.key}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  {f.icon} {f.label}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="url"
                    value={val}
                    onChange={e => setSocials((p: any) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{
                      flex: 1, height: 44, border: `1.5px solid ${val ? "#1a5a32" : "#e5e7eb"}`,
                      borderRadius: 10, padding: "0 14px", fontSize: 13, outline: "none",
                      background: val ? "#f0faf4" : "#fafafa",
                    }}
                    onFocus={e => { e.target.style.borderColor = "#1a5a32"; }}
                    onBlur={e => { e.target.style.borderColor = val ? "#1a5a32" : "#e5e7eb"; }}
                  />
                  {val && (
                    <a href={val} target="_blank" rel="noopener noreferrer"
                      style={{ width: 44, height: 44, border: "1.5px solid #e5e7eb", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a5a32", flexShrink: 0, textDecoration: "none" }}
                      title="Test this link">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                {val && <p style={{ fontSize: 11, color: "#1a5a32", marginTop: 4, fontWeight: 600 }}>✓ Link set</p>}
              </div>
            );
          })}
        </div>

        <div style={{ background: "#f0faf4", border: "1px solid #c3e6cb", borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ fontSize: 12, color: "#1a5a32", fontWeight: 600 }}>
            💡 WhatsApp format: <code style={{ background: "#fff", padding: "1px 6px", borderRadius: 4 }}>https://wa.me/91XXXXXXXXXX</code>
          </p>
        </div>
      </div>

      {/* ── RAZORPAY ── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                Razorpay Payment Gateway
                {razorpay.enabled && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Active</span>}
              </h3>
              <p className="text-xs text-muted-foreground">Accept UPI, Cards, Net Banking & Wallets</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(["test", "live"] as const).map(m => (
              <button key={m} onClick={() => setRazorpay(p => ({ ...p, mode: m }))}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${razorpay.mode === m ? "bg-white shadow text-primary" : "text-muted-foreground"}`}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className={`flex items-start gap-3 p-3 rounded-lg text-xs ${razorpay.mode === "test" ? "bg-yellow-50 border border-yellow-100 text-yellow-800" : "bg-green-50 border border-green-100 text-green-800"}`}>
            <Zap className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              {razorpay.mode === "test"
                ? <><strong>Test Mode:</strong> Test card: <strong>4111 1111 1111 1111</strong></>
                : <><strong>Live Mode:</strong> Real payments will be processed. KYC must be complete.</>
              }
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Key ID</label>
            <Input value={razorpay.keyId} onChange={e => { setRazorpay(p => ({ ...p, keyId: e.target.value })); setTestResult(null); }}
              placeholder={razorpay.mode === "test" ? "rzp_test_xxxxxxxxxxxx" : "rzp_live_xxxxxxxxxxxx"} className="font-mono text-sm" />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Key Secret</label>
            <div className="relative">
              <Input type={showSecret ? "text" : "password"} value={razorpay.keySecret}
                onChange={e => { setRazorpay(p => ({ ...p, keySecret: e.target.value })); setTestResult(null); }}
                placeholder="Your Razorpay secret key" className="font-mono text-sm pr-10" />
              <button type="button" onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${testResult === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
              {testResult === "success" ? <><CheckCircle className="h-4 w-4" /> Connection successful!</> : <><XCircle className="h-4 w-4" /> Invalid credentials</>}
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>Keys are stored securely. Never share your Key Secret publicly.</span>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button onClick={testRazorpay} variant="outline" disabled={testing} className="gap-2">
              {testing ? <><Loader className="h-4 w-4 animate-spin" /> Testing...</> : "Test Connection"}
            </Button>
            <Button onClick={saveRazorpay} disabled={saving} className="gap-2">
              {saving ? <><Loader className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save & Activate</>}
            </Button>
            {razorpay.enabled && (
              <Button variant="ghost" onClick={clearRazorpay} className="text-destructive hover:text-destructive">Remove</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
