/**
 * shipping-config.ts — Shipping settings.
 * Source of truth is the database (GET/PUT /api/settings/shipping); the server uses the
 * same values when it computes an order total. Nothing is stored in localStorage.
 */
import { apiFetch } from "@/lib/api";

export interface ShippingConfig {
  shippingFee: number;
  freeShippingAbove: number;
  codFee: number;
  codEnabled: boolean;
  freeShippingEnabled: boolean;
}

export const DEFAULT_SHIPPING: ShippingConfig = {
  shippingFee: 49,
  freeShippingAbove: 999,
  codFee: 30,
  codEnabled: true,
  freeShippingEnabled: true,
};

export async function fetchShippingConfig(): Promise<ShippingConfig> {
  try {
    return { ...DEFAULT_SHIPPING, ...(await apiFetch<Partial<ShippingConfig>>("/api/settings/shipping")) };
  } catch {
    return DEFAULT_SHIPPING;
  }
}

/** Admin / staff with the "settings" permission only — enforced by the server. */
export function saveShippingConfig(config: ShippingConfig): Promise<ShippingConfig> {
  return apiFetch<ShippingConfig>("/api/settings/shipping", {
    method: "PUT",
    auth: true,
    body: JSON.stringify(config),
  });
}

/** Cart total ke hisaab se shipping calculate karo (display only — server recomputes). */
export function calculateShipping(
  cartTotal: number,
  paymentMethod: "cod" | "razorpay" | "online",
  config: ShippingConfig = DEFAULT_SHIPPING,
): { shipping: number; cod: number; total: number; isFree: boolean } {
  const isFree = config.freeShippingEnabled && cartTotal >= config.freeShippingAbove;
  const shipping = isFree ? 0 : config.shippingFee;
  const cod = paymentMethod === "cod" && config.codEnabled ? config.codFee : 0;
  return { shipping, cod, total: shipping + cod, isFree };
}
