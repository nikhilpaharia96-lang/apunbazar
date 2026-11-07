/**
 * lib/api.ts — Small fetch helper + the auth token used for privileged API calls.
 * The server enforces every permission; the token only proves who is calling.
 */
import { getAdminToken, isAdminLoggedIn } from "@/lib/admin-auth";
import { getStaffSession } from "@/lib/staff-auth";

/** Admin JWT if the owner is logged in, otherwise the staff member's JWT. */
export function getBestAuthToken(): string | null {
  if (isAdminLoggedIn()) return getAdminToken();
  return getStaffSession()?.token ?? null;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth, headers, ...rest } = init;
  const token = auth ? getBestAuthToken() : null;
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const b = body as { error?: string; code?: string };
    throw new ApiError(b.error ?? "Something went wrong. Please try again.", res.status, b.code);
  }
  return body as T;
}
