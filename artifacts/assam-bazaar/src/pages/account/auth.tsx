import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Loader2, Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";
import { customerLogin, customerRegister } from "@/lib/customer-auth";
import { useSEO } from "@/hooks/use-seo";

/** One page for both /login and /register (same layout, same a11y semantics). */
export default function CustomerAuth({ mode }: { mode: "login" | "register" }) {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isLogin = mode === "login";
  useSEO({ title: isLogin ? "Log in" : "Create account", description: "Your ApunBazar account — track orders and check out faster.", noindex: true });

  const next = new URLSearchParams(window.location.search).get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (isLogin) await customerLogin({ email: form.email, password: form.password });
      else await customerRegister(form);
      navigate(dest);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  const field = "w-full h-12 rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#1a5c2a] focus:ring-2 focus:ring-[#1a5c2a]/15";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="page-enter min-h-[70vh] flex items-start sm:items-center justify-center px-4 py-8" style={{ background: "#f8f9fa" }}>
      <main className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <h1 className="font-serif text-2xl font-bold text-gray-900">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-gray-600 mt-1 mb-6">{isLogin ? "Log in to track orders and check out faster." : "Save your details for one-tap checkout and order history."}</p>

        <form onSubmit={submit} className="space-y-3.5" noValidate={false}>
          {!isLogin && (
            <label className="block"><span className="text-sm font-semibold text-gray-700">Full name</span>
              <span className="relative block mt-1"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" aria-hidden />
                <input className={field} name="name" autoComplete="name" required minLength={2} value={form.name} onChange={set("name")} placeholder="Your name" /></span></label>
          )}
          <label className="block"><span className="text-sm font-semibold text-gray-700">Email</span>
            <span className="relative block mt-1"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" aria-hidden />
              <input className={field} type="email" name="email" autoComplete="email" required value={form.email} onChange={set("email")} placeholder="you@example.com" /></span></label>
          {!isLogin && (
            <label className="block"><span className="text-sm font-semibold text-gray-700">Mobile number</span>
              <span className="relative block mt-1"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" aria-hidden />
                <input className={field} type="tel" inputMode="numeric" name="phone" autoComplete="tel" required pattern="[0-9+ ]{10,14}" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile" /></span></label>
          )}
          <label className="block"><span className="text-sm font-semibold text-gray-700">Password</span>
            <span className="relative block mt-1"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" aria-hidden />
              <input className={field + " pr-11"} type={show ? "text" : "password"} name="password" autoComplete={isLogin ? "current-password" : "new-password"} required minLength={isLogin ? 1 : 8} value={form.password} onChange={set("password")} placeholder={isLogin ? "Your password" : "At least 8 characters"} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-gray-500">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>

          {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}

          <button type="submit" disabled={busy} data-testid="button-auth-submit"
            className="w-full h-12 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "#1a5c2a" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{isLogin ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-5 text-center">
          {isLogin ? "New to ApunBazar? " : "Already have an account? "}
          <Link href={(isLogin ? "/register" : "/login") + (next ? `?next=${encodeURIComponent(next)}` : "")} className="font-semibold underline" style={{ color: "#1a5c2a" }}>{isLogin ? "Create an account" : "Log in"}</Link>
        </p>
        <p className="text-xs text-gray-500 mt-3 text-center">You can also <Link href="/checkout" className="underline">check out as a guest</Link> — no account needed.</p>
      </main>
    </div>
  );
}
