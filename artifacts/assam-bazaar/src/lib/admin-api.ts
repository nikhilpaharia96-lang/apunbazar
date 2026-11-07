/**
 * lib/admin-api.ts — Helpers for admin pages: authenticated queries, date ranges, CSV download.
 * Every call hits the real API; the server enforces permissions.
 */
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch, getBestAuthToken, ApiError } from "@/lib/api";

export type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(params: Query): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function useAdminQuery<T>(path: string, params: Query = {}, opts: Partial<UseQueryOptions<T>> = {}) {
  const url = `${path}${qs(params)}`;
  return useQuery<T>({
    queryKey: ["admin", url],
    queryFn: () => apiFetch<T>(url, { auth: true }),
    staleTime: 15_000,
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
    ...opts,
  });
}

export const adminPost = <T,>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "POST", auth: true, body: JSON.stringify(body) });
export const adminPut = <T,>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "PUT", auth: true, body: JSON.stringify(body) });

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

/** Downloads a CSV from an authenticated endpoint (a plain <a href> can't send the bearer token). */
export async function downloadCsv(path: string, params: Query): Promise<void> {
  const token = getBestAuthToken();
  const res = await fetch(`${path}${qs(params)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new ApiError((b as { error?: string }).error ?? "Export failed", res.status);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "export.csv";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Date range (India time) ────────────────────────────────────────────────
const ymd = (d: Date) => d.toISOString().slice(0, 10);
export const todayIST = () => ymd(new Date(Date.now() + 5.5 * 3_600_000));
export const daysAgoIST = (n: number) => ymd(new Date(Date.now() + 5.5 * 3_600_000 - n * 86_400_000));

export function useDateRange(defaultDays = 30) {
  const [from, setFrom] = useState(daysAgoIST(defaultDays - 1));
  const [to, setTo] = useState(todayIST());
  const preset = (days: number) => { setFrom(daysAgoIST(days - 1)); setTo(todayIST()); };
  return { from, to, setFrom, setTo, preset };
}
