// src/hooks/use-seo.ts — Per-page SEO: title, description, Open Graph/Twitter, robots, canonical, JSON-LD
import { useEffect } from "react";

interface SEOMeta {
  title: string;
  description?: string;
  image?: string;
  type?: "website" | "product";
  /** Keep the page out of search results (cart, checkout, account, order pages…) */
  noindex?: boolean;
  /** schema.org structured data for this page */
  jsonLd?: Record<string, unknown>;
}

const DEFAULT_TITLE = "ApunBazar — Authentic Assamese Products";
const JSONLD_ID = "seo-jsonld";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", content);
}

export function useSEO({ title, description, image, type = "website", noindex = false, jsonLd }: SEOMeta) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : "";
  useEffect(() => {
    const full = `${title} | ApunBazar`;
    document.title = full;
    upsertMeta("property", "og:title", full);
    upsertMeta("name", "twitter:title", full);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:site_name", "ApunBazar");
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");

    if (description) {
      const d = description.replace(/\s+/g, " ").trim().slice(0, 160);
      upsertMeta("name", "description", d);
      upsertMeta("property", "og:description", d);
      upsertMeta("name", "twitter:description", d);
    }
    if (image) {
      const abs = image.startsWith("http") ? image : `${window.location.origin}${image}`;
      upsertMeta("property", "og:image", abs);
      upsertMeta("name", "twitter:image", abs);
    }
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    // Canonical = this page without query string / hash (avoids duplicate-content variants)
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = `${window.location.origin}${window.location.pathname}`;
    upsertMeta("property", "og:url", canonical.href);

    document.getElementById(JSONLD_ID)?.remove();
    if (ld) {
      const s = document.createElement("script");
      s.type = "application/ld+json"; s.id = JSONLD_ID; s.text = ld;
      document.head.appendChild(s);
    }
    return () => {
      document.title = DEFAULT_TITLE;
      document.getElementById(JSONLD_ID)?.remove();
      upsertMeta("name", "robots", "index, follow");
    };
  }, [title, description, image, type, noindex, ld]);
}
