/**
 * hooks/use-analytics.ts — Wouter route change tracking
 *
 * Usage: call usePageTracking() once in App.tsx Router component.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { trackPageView, trackVisit } from "@/lib/analytics";

const PAGE_TITLES: Record<string, string> = {
  "/":              "Home — ApunBazar",
  "/products":      "Products — ApunBazar",
  "/cart":          "Cart — ApunBazar",
  "/wishlist":      "Wishlist — ApunBazar",
  "/checkout":      "Checkout — ApunBazar",
  "/orders":        "My Orders — ApunBazar",
  "/about":         "About Us — ApunBazar",
  "/contact":       "Contact Us — ApunBazar",
  "/refund-policy": "Refund Policy — ApunBazar",
  "/privacy-policy":"Privacy Policy — ApunBazar",
  "/terms":         "Terms & Conditions — ApunBazar",
};

export function usePageTracking(): void {
  const [location] = useLocation();

  useEffect(() => {
    // Small delay so document.title updates first
    const timer = setTimeout(() => {
      const title =
        PAGE_TITLES[location] ||
        (location.startsWith("/products/")
          ? "Product Detail — ApunBazar"
          : location.startsWith("/orders/")
            ? "Order Detail — ApunBazar"
            : location.startsWith("/category/")
              ? "Category — ApunBazar"
              : location.startsWith("/admin")
                ? undefined // Skip admin pages
                : location.startsWith("/staff")
                  ? undefined // Skip staff pages
                  : document.title);

      if (title) trackPageView(location, title);
      if (!location.startsWith("/admin") && !location.startsWith("/staff")) trackVisit(location);
    }, 100);

    return () => clearTimeout(timer);
  }, [location]);
}
