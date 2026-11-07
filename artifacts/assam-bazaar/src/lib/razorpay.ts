/**
 * lib/razorpay.ts — Razorpay Checkout helper.
 * The amount/order always come from the server; after payment the signature is
 * verified server-side (POST /api/payments/verify) before the order counts as paid.
 */
import { apiFetch } from "@/lib/api";

export interface GatewayParams { orderId: string; keyId: string; amount: number; currency: string }

interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface RazorpayOptions {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}
declare global {
  interface Window { Razorpay: new (options: RazorpayOptions) => { open(): void } }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Re-opens payment for an existing unpaid order (amount is read from the DB). */
export function fetchGatewayParams(orderId: number, email: string): Promise<GatewayParams> {
  return apiFetch<GatewayParams>("/api/payments/razorpay-order", {
    method: "POST",
    body: JSON.stringify({ orderId, email }),
  });
}

export async function openRazorpayCheckout(args: {
  gateway: GatewayParams;
  orderId: number;
  description: string;
  prefill: { name: string; email: string; contact: string };
  onPaid: () => void;
  onDismiss: () => void;
  onError: (message: string) => void;
}): Promise<void> {
  if (!(await loadRazorpayScript())) { args.onError("Payment gateway failed to load. Please check your connection."); return; }
  new window.Razorpay({
    key: args.gateway.keyId,
    amount: args.gateway.amount,
    currency: args.gateway.currency,
    name: "ApunBazar",
    description: args.description,
    order_id: args.gateway.orderId,
    prefill: args.prefill,
    theme: { color: "#1a5c2a" },
    handler: async (r) => {
      try {
        await apiFetch("/api/payments/verify", {
          method: "POST",
          body: JSON.stringify({ ...r, orderId: args.orderId }),
        });
        args.onPaid();
      } catch (e) {
        args.onError(
          (e instanceof Error ? e.message : "Verification failed") +
            " If money was deducted, it will be matched to your order automatically or refunded.",
        );
      }
    },
    modal: { ondismiss: args.onDismiss },
  }).open();
}
