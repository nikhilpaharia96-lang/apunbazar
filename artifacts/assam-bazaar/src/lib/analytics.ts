/**
 * lib/analytics.ts — Google Analytics 4 + Microsoft Clarity
 *
 * - Production-only loading (isProd guard)
 * - Non-blocking async script injection (no Core Web Vitals impact)
 * - Wouter router integration via usePageTracking()
 * - Full GA4 e-commerce events: view_item, add_to_cart, remove_from_cart,
 *   add_to_wishlist, begin_checkout, purchase, search, select_promotion
 * - Clarity: session tags for user segments (cart value, order count etc.)
 */

// ── Types ──────────────────────────────────────────────────────────────────
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
    clarity: (method: string, ...args: unknown[]) => void;
  }
}

export interface AnalyticsProduct {
  id: string | number;
  name: string;
  price: number;
  category?: string;
  quantity?: number;
  coupon?: string;
}

const GA_ID      = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
// Fallback to the known production Clarity project ID if the env var isn't
// set on the hosting platform (Vercel/Railway) at build time. Vite inlines
// import.meta.env.* at BUILD time, so a missing env var here means Clarity
// silently never loads — no script tag, no network request, nothing in the
// console. This fallback guarantees the tag still ships even if the deploy
// environment is misconfigured.
const CLARITY_ID =
  (import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined) || "x5540vqjxf";
const isProd     = import.meta.env.PROD;

// ── Script Loaders ─────────────────────────────────────────────────────────
function loadGoogleAnalytics(measurementId: string): void {
  if (document.getElementById("ga-script")) return;

  // dataLayer must exist before the script loads
  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,          // We fire page_view manually on route change
    cookie_flags: "SameSite=None;Secure",
  });

  // Async — does not block rendering or LCP
  const script = document.createElement("script");
  script.id    = "ga-script";
  script.src   = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.async = true;
  document.head.appendChild(script);
}

function loadMicrosoftClarity(projectId: string): void {
  if (document.getElementById("clarity-script")) return;

  // Official Clarity inline snippet — sets up queue before script loads
  (function (c: Window, l: Document, a: string, r: string, i: string) {
    (c as unknown as Record<string, unknown>)[a] =
      (c as unknown as Record<string, unknown>)[a] ||
      function (...args: unknown[]) {
        ((c as unknown as Record<string, unknown[]>)[a + "q"] =
          (c as unknown as Record<string, unknown[]>)[a + "q"] || []).push(args);
      };
    const t      = l.createElement(r) as HTMLScriptElement;
    t.id         = "clarity-script";
    t.async      = true;
    t.src        = "https://www.clarity.ms/tag/" + i;
    const y      = l.getElementsByTagName(r)[0];
    y?.parentNode?.insertBefore(t, y);
  })(window, document, "clarity", "script", projectId);
}

// ── Initialize ─────────────────────────────────────────────────────────────
/** Call once in App.tsx — loads scripts only in production */
export function initAnalytics(): void {
  if (!isProd) return;
  if (GA_ID)      loadGoogleAnalytics(GA_ID);
  if (CLARITY_ID) loadMicrosoftClarity(CLARITY_ID);
}

// ── Own visitor tracking (shown in Admin → Visitors) ───────────────────────
function randomId(): string {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function getId(storage: Storage, key: string): string {
  try {
    let id = storage.getItem(key);
    if (!id) { id = randomId(); storage.setItem(key, id); }
    return id;
  } catch {
    return randomId(); // storage blocked (private mode) — still counts the visit
  }
}

/** Sends one anonymous page-view record to our own API. Fails silently. */
export function trackVisit(path: string): void {
  if (!isProd) return;
  try {
    if (sessionStorage.getItem("apunbazar_admin_token")) return; // don't count the owner
  } catch { /* ignore */ }
  fetch("/api/track/visit", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitorId: getId(localStorage, "ab_visitor_id"),
      sessionId: getId(sessionStorage, "ab_session_id"),
      path,
      referrer: document.referrer || "",
    }),
  }).catch(() => { /* analytics must never break the site */ });
}

// ── Page View ──────────────────────────────────────────────────────────────
/** Called automatically by usePageTracking() on every route change */
export function trackPageView(path: string, title?: string): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "page_view", {
    page_path:     path,
    page_title:    title || document.title,
    page_location: window.location.href,
  });
}

// ── E-Commerce Events ──────────────────────────────────────────────────────

/** Product detail page viewed */
export function trackViewItem(product: AnalyticsProduct): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "view_item", {
    currency: "INR",
    value:    product.price,
    items:    [formatItem(product)],
  });
  clarityTag("last_viewed_product", product.name);
}

/** Item added to cart */
export function trackAddToCart(product: AnalyticsProduct): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "add_to_cart", {
    currency: "INR",
    value:    product.price * (product.quantity || 1),
    items:    [formatItem(product)],
  });
  clarityEvent("add_to_cart");
}

/** Item removed from cart */
export function trackRemoveFromCart(product: AnalyticsProduct): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "remove_from_cart", {
    currency: "INR",
    value:    product.price * (product.quantity || 1),
    items:    [formatItem(product)],
  });
}

/** Item added to wishlist */
export function trackAddToWishlist(product: AnalyticsProduct): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "add_to_wishlist", {
    currency: "INR",
    value:    product.price,
    items:    [formatItem(product)],
  });
  clarityEvent("add_to_wishlist");
}

/** Checkout page opened */
export function trackBeginCheckout(
  products: AnalyticsProduct[],
  value: number,
  coupon?: string,
): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "begin_checkout", {
    currency: "INR",
    value,
    coupon,
    items: products.map(formatItem),
  });
  clarityTag("checkout_value", String(Math.round(value)));
  clarityEvent("begin_checkout");
}

/** Order placed successfully */
export function trackPurchase(
  orderId: string,
  products: AnalyticsProduct[],
  value: number,
  shipping: number,
  coupon?: string,
): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "purchase", {
    transaction_id: orderId,
    currency:       "INR",
    value,
    shipping,
    coupon,
    items: products.map(formatItem),
  });
  clarityTag("has_purchased", "true");
  clarityTag("order_value",   String(Math.round(value)));
  clarityEvent("purchase");
}

/** Product search */
export function trackSearch(searchTerm: string): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "search", { search_term: searchTerm });
}

/** Coupon applied at checkout */
export function trackCouponApplied(couponCode: string, discount: number): void {
  if (!isProd || !GA_ID) return;
  window.gtag?.("event", "select_promotion", {
    promotion_id:   couponCode,
    promotion_name: couponCode,
    creative_slot:  "checkout",
    discount,
  });
  clarityTag("coupon_used", couponCode);
}

// ── Microsoft Clarity Custom Tags ──────────────────────────────────────────
/** Tag a user session with a key-value pair (appears in Clarity filters) */
export function clarityTag(key: string, value: string): void {
  if (!isProd || !CLARITY_ID) return;
  window.clarity?.("set", key, value);
}

/** Fire a named Clarity custom event */
export function clarityEvent(name: string): void {
  if (!isProd || !CLARITY_ID) return;
  window.clarity?.("event", name);
}

/** Tag the user's cart value bucket for Clarity session filtering */
export function clarityCartValue(total: number): void {
  if (!isProd || !CLARITY_ID) return;
  const bucket =
    total === 0       ? "empty"
    : total < 500     ? "under_500"
    : total < 1000    ? "500_to_1000"
    : total < 2500    ? "1000_to_2500"
    : "above_2500";
  clarityTag("cart_value_bucket", bucket);
}

// ── Helper ─────────────────────────────────────────────────────────────────
function formatItem(p: AnalyticsProduct) {
  return {
    item_id:       String(p.id),
    item_name:     p.name,
    item_category: p.category || "General",
    price:         p.price,
    quantity:      p.quantity || 1,
    currency:      "INR",
    coupon:        p.coupon,
  };
}
