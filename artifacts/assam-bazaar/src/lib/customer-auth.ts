/**
 * lib/customer-auth.ts — Customer session (guest checkout keeps working without one).
 * The JWT lives in localStorage; the server validates it on every call to /api/customers/me*.
 */
import { useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api";

export interface CustomerProfile {
  id: number; email: string; name: string; phone: string;
  address: string | null; city: string | null; state: string | null; pincode: string | null;
}
interface Session { token: string; customer: CustomerProfile }

const KEY = "apunbazar_customer";
const EVT = "apunbazar:customer";

function read(): Session | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Session) : null; } catch { return null; }
}
let cache: Session | null = read();
function write(s: Session | null) {
  cache = s;
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event(EVT));
}

const subscribe = (cb: () => void) => { window.addEventListener(EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); }; };
export const useCustomer = (): CustomerProfile | null => useSyncExternalStore(subscribe, () => cache, () => null)?.customer ?? null;
export const getCustomerToken = () => cache?.token ?? null;

function remember(c: CustomerProfile) {
  // Lets order tracking / order pages work straight away for this customer
  try { localStorage.setItem("apunbazar_last_email", c.email); localStorage.setItem("apunbazar_last_phone", c.phone); } catch {}
}

export async function customerRegister(input: { name: string; email: string; phone: string; password: string }) {
  const s = await apiFetch<Session>("/api/customers/register", { method: "POST", body: JSON.stringify(input) });
  write(s); remember(s.customer); return s.customer;
}
export async function customerLogin(input: { email: string; password: string }) {
  const s = await apiFetch<Session>("/api/customers/login", { method: "POST", body: JSON.stringify(input) });
  write(s); remember(s.customer); return s.customer;
}
export function customerLogout() { write(null); }

const authed = <T,>(path: string, init: RequestInit = {}) =>
  apiFetch<T>(path, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${cache?.token ?? ""}` } });

export async function updateCustomer(patch: Partial<Omit<CustomerProfile, "id" | "email">>) {
  const c = await authed<CustomerProfile>("/api/customers/me", { method: "PATCH", body: JSON.stringify(patch) });
  if (cache) write({ ...cache, customer: c });
  return c;
}
export const fetchMyOrders = () => authed<{ orders: { id: number; orderNumber: string; total: number; status: string; paymentMethod: string; paymentStatus: string; createdAt: string; itemCount: number }[] }>("/api/customers/me/orders");

/** Called when the server says the session is no longer valid. */
export const dropSessionIf401 = (e: unknown) => { if ((e as { status?: number })?.status === 401) customerLogout(); };
