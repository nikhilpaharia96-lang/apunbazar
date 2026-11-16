/**
 * routes/track.ts — Public visitor tracking (POST /api/track/visit)
 *
 * Records one row per page view: who (anonymous visitor id), where (country/state/city),
 * when, device/browser, traffic source and page. Raw IPs are never stored — only a salted hash.
 * Geo comes from CDN headers (Vercel/Cloudflare) with a cached IP lookup as fallback.
 * The endpoint answers immediately (204) and writes in the background, so it never slows a page.
 */
import { Router, type Request } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const router = Router();

export async function ensureVisitsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_visits (
      id bigserial PRIMARY KEY,
      visitor_id text NOT NULL, session_id text NOT NULL, path text NOT NULL,
      referrer_host text, source text NOT NULL DEFAULT 'direct',
      country text, region text, city text,
      device text, browser text, os text, ip_hash text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS site_visits_created_idx ON site_visits (created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS site_visits_visitor_idx ON site_visits (visitor_id)`);
  // Keep the table small: drop raw visit rows older than 180 days
  await db.execute(sql`DELETE FROM site_visits WHERE created_at < now() - interval '180 days'`);
}

const limiter = rateLimit({
  windowMs: 60_000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests." },
});

const Body = z.object({
  visitorId: z.string().min(8).max(64).regex(/^[\w-]+$/),
  sessionId: z.string().min(8).max(64).regex(/^[\w-]+$/),
  path: z.string().min(1).max(300),
  referrer: z.string().max(500).optional().default(""),
});

// ── Helpers ────────────────────────────────────────────────────────────────
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|preview/i;

function parseUA(ua: string) {
  const device = /ipad|tablet/i.test(ua) ? "tablet" : /mobi|android|iphone/i.test(ua) ? "mobile" : "desktop";
  const browser =
    /edg\//i.test(ua) ? "Edge" : /opr\/|opera/i.test(ua) ? "Opera" : /samsungbrowser/i.test(ua) ? "Samsung Internet" :
    /firefox|fxios/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Other";
  const os =
    /windows/i.test(ua) ? "Windows" : /android/i.test(ua) ? "Android" : /iphone|ipad|ipod/i.test(ua) ? "iOS" :
    /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}

function classifySource(refHost: string, ownHosts: string[]): string {
  if (!refHost || ownHosts.some((h) => refHost === h || refHost.endsWith("." + h))) return "direct";
  if (/google\./.test(refHost)) return "google";
  if (/facebook\.com|fb\.com|fb\.me|l\.facebook/.test(refHost)) return "facebook";
  if (/instagram\.com/.test(refHost)) return "instagram";
  if (/whatsapp\.com|wa\.me/.test(refHost)) return "whatsapp";
  if (/youtube\.com|youtu\.be/.test(refHost)) return "youtube";
  if (/t\.co$|twitter\.com|x\.com/.test(refHost)) return "twitter/x";
  if (/bing\.com|duckduckgo\.com|yahoo\./.test(refHost)) return "search";
  return "other";
}

const clientIp = (req: Request): string => {
  const h = (n: string) => (typeof req.headers[n] === "string" ? (req.headers[n] as string) : "");
  const raw = h("x-vercel-forwarded-for") || h("cf-connecting-ip") || req.ip || "";
  return raw.split(",")[0].trim().replace(/^::ffff:/, "");
};
const isPrivateIp = (ip: string) =>
  !ip || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/i.test(ip);

interface Geo { country?: string; region?: string; city?: string }
const geoCache = new Map<string, Geo>();
const dec = (s?: string) => { try { return s ? decodeURIComponent(s) : undefined; } catch { return s; } };

async function lookupGeo(req: Request, ip: string): Promise<Geo> {
  // 1) CDN headers — free and instant
  const hv = (n: string) => (typeof req.headers[n] === "string" ? (req.headers[n] as string) : undefined);
  const country = hv("x-vercel-ip-country") || hv("cf-ipcountry");
  if (country && country !== "XX") {
    return { country, region: dec(hv("x-vercel-ip-country-region")), city: dec(hv("x-vercel-ip-city")) };
  }
  // 2) Cached IP lookup (HTTPS, free tier) — never blocks or fails the request
  if (isPrivateIp(ip)) return {};
  const cached = geoCache.get(ip);
  if (cached) return cached;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,region,city`, { signal: ctl.signal });
    clearTimeout(t);
    const j = (await r.json()) as { success?: boolean; country?: string; region?: string; city?: string };
    const geo: Geo = j.success ? { country: j.country, region: j.region, city: j.city } : {};
    if (geoCache.size > 5000) geoCache.clear();
    geoCache.set(ip, geo);
    return geo;
  } catch {
    return {};
  }
}

// ── POST /api/track/visit ──────────────────────────────────────────────────
router.post("/visit", limiter, (req, res) => {
  res.status(204).end(); // answer first; record in the background

  void (async () => {
    try {
      const ua = String(req.headers["user-agent"] ?? "");
      if (!ua || BOT.test(ua)) return;
      const b = Body.safeParse(req.body);
      if (!b.success) return;
      const { visitorId, sessionId, path, referrer } = b.data;
      if (!path.startsWith("/") || /^\/(admin|staff)/.test(path)) return;

      let refHost = "";
      try { refHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : ""; } catch { /* ignore */ }
      const ownHosts = (process.env.ALLOWED_ORIGINS ?? "")
        .split(",").map((o) => { try { return new URL(o.trim()).hostname.replace(/^www\./, ""); } catch { return ""; } })
        .filter(Boolean);
      const source = classifySource(refHost, ownHosts);

      const ip = clientIp(req);
      const geo = await lookupGeo(req, ip);
      const salt = process.env.ADMIN_JWT_SECRET ?? "apunbazar";
      const ipHash = ip ? crypto.createHash("sha256").update(salt + ip).digest("hex").slice(0, 24) : null;
      const { device, browser, os } = parseUA(ua);

      await db.execute(sql`
        INSERT INTO site_visits (visitor_id, session_id, path, referrer_host, source, country, region, city, device, browser, os, ip_hash)
        VALUES (${visitorId}, ${sessionId}, ${path.split("?")[0].slice(0, 300)}, ${refHost || null}, ${source},
                ${geo.country ?? null}, ${geo.region ?? null}, ${geo.city ?? null}, ${device}, ${browser}, ${os}, ${ipHash})`);
    } catch (err) {
      logger.warn({ err }, "visit tracking failed");
    }
  })();
});

export default router;
