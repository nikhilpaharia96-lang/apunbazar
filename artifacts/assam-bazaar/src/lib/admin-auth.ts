/**
 * lib/admin-auth.ts — Frontend admin authentication
 *
 * Problems fixed vs original:
 * - Original stored only { email, lastActivity } in sessionStorage after login
 *   The API server had NO corresponding token validation — admin was completely unprotected
 * - New approach: server returns a JWT, stored in sessionStorage
 *   All subsequent admin API calls include Authorization: Bearer <token>
 * - Token expiry checked client-side for UX (server always validates too)
 * - Provides getAuthHeaders() for use in API calls
 */

const TOKEN_KEY = "apunbazar_admin_token";

interface DecodedToken {
  sub: string; // email
  exp: number; // Unix timestamp
  iat: number;
}

function decodeTokenPayload(token: string): DecodedToken | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export async function adminLogin(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
   const apiUrl = import.meta.env.VITE_API_URL || '';
const res = await fetch(`${apiUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const { token } = (await res.json()) as { token: string };
      sessionStorage.setItem(TOKEN_KEY, token);
      return { success: true };
    }

    const body = (await res.json()) as { error?: string };
    return { success: false, error: body.error ?? "Invalid credentials." };
  } catch {
    return {
      success: false,
      error: "Could not connect to server. Is the API server running?",
    };
  }
}

export function adminLogout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function isAdminLoggedIn(): boolean {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return false;

    const decoded = decodeTokenPayload(token);
    if (!decoded) return false;

    // Check expiry with 30s buffer to avoid edge cases
    const isExpired = Date.now() / 1000 > decoded.exp - 30;
    if (isExpired) {
      adminLogout();
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function getAdminEmail(): string {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return "";
    return decodeTokenPayload(token)?.sub ?? "";
  } catch {
    return "";
  }
}

/** Returns headers to include in authenticated admin API calls */
export function getAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
