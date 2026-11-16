/**
 * routes/visitors.ts — Admin visitor analytics (permission: analytics)
 *   GET /api/manage/visitors/summary?from&to   totals, trend, hour-of-day, location, devices, sources, pages
 *   GET /api/manage/visitors/recent?page&limit latest visits (who/where/when/what)
 * All "days" and "hours" are India time (Asia/Kolkata).
 */
import { Router } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { requirePermission } from "../middleware/admin-auth";

const router = Router();
router.use(requirePermission("analytics"));

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => ymd(new Date(Date.parse(date + "T00:00:00Z") + n * 86_400_000));
const todayIST = () => ymd(new Date(Date.now() + 5.5 * 3_600_000));
const rows = <T,>(r: { rows: unknown[] }) => r.rows as T[];

const RangeQ = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function parseRange(query: unknown) {
  const q = RangeQ.safeParse(query);
  if (!q.success) throw new AppError(400, "Dates must be YYYY-MM-DD", "VALIDATION_ERROR");
  const to = q.data.to ?? todayIST();
  const from = q.data.from ?? addDays(to, -29);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (Number.isNaN(days) || days < 1) throw new AppError(400, "'from' must not be after 'to'", "VALIDATION_ERROR");
  if (days > 366) throw new AppError(400, "Date range cannot exceed 366 days", "VALIDATION_ERROR");
  return { from, to };
}

const startTs = (from: string) => sql`((${from}::date)::timestamp AT TIME ZONE 'Asia/Kolkata')`;
const endTs = (to: string) => sql`(((${to}::date + 1)::timestamp) AT TIME ZONE 'Asia/Kolkata')`;
const inRange = (from: string, to: string) => sql`(v.created_at >= ${startTs(from)} AND v.created_at < ${endTs(to)})`;

router.get("/summary", asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const R = inRange(from, to);

  const [totals, live, today, trend, hours, countries, regions, cities, devices, browsers, sources, pages] = await Promise.all([
    db.execute(sql`SELECT COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors, COUNT(DISTINCT session_id)::int AS sessions
                   FROM site_visits v WHERE ${R}`),
    db.execute(sql`SELECT COUNT(DISTINCT visitor_id)::int AS n FROM site_visits WHERE created_at > now() - interval '5 minutes'`),
    db.execute(sql`SELECT COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors FROM site_visits
                   WHERE created_at >= ((now() AT TIME ZONE 'Asia/Kolkata')::date::timestamp AT TIME ZONE 'Asia/Kolkata')`),
    db.execute(sql`SELECT to_char(v.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS date,
                          COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors
                   FROM site_visits v WHERE ${R} GROUP BY 1 ORDER BY 1`),
    db.execute(sql`SELECT EXTRACT(HOUR FROM v.created_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
                          COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors
                   FROM site_visits v WHERE ${R} GROUP BY 1 ORDER BY 1`),
    db.execute(sql`SELECT COALESCE(country,'Unknown') AS name, COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors
                   FROM site_visits v WHERE ${R} GROUP BY 1 ORDER BY 3 DESC, 2 DESC LIMIT 15`),
    db.execute(sql`SELECT COALESCE(region,'Unknown') AS name, COALESCE(country,'') AS country, COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors
                   FROM site_visits v WHERE ${R} GROUP BY 1, 2 ORDER BY 4 DESC, 3 DESC LIMIT 20`),
    db.execute(sql`SELECT COALESCE(city,'Unknown') AS name, COALESCE(region,'') AS region, COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors
                   FROM site_visits v WHERE ${R} GROUP BY 1, 2 ORDER BY 4 DESC, 3 DESC LIMIT 20`),
    db.execute(sql`SELECT COALESCE(device,'unknown') AS name, COUNT(DISTINCT visitor_id)::int AS visitors FROM site_visits v WHERE ${R} GROUP BY 1 ORDER BY 2 DESC`),
    db.execute(sql`SELECT COALESCE(browser,'Other') AS name, COUNT(DISTINCT visitor_id)::int AS visitors FROM site_visits v WHERE ${R} GROUP BY 1 ORDER BY 2 DESC LIMIT 6`),
    db.execute(sql`SELECT source AS name, COUNT(DISTINCT visitor_id)::int AS visitors FROM site_visits v WHERE ${R} GROUP BY 1 ORDER BY 2 DESC`),
    db.execute(sql`SELECT path AS name, COUNT(*)::int AS visits, COUNT(DISTINCT visitor_id)::int AS visitors
                   FROM site_visits v WHERE ${R} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
  ]);

  // Fill all 24 hours so the chart has no gaps
  const byHour = new Map(rows<{ hour: number; visits: number; visitors: number }>(hours).map((h) => [h.hour, h]));
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, "0")}:00`,
    visits: byHour.get(h)?.visits ?? 0,
    visitors: byHour.get(h)?.visitors ?? 0,
  }));

  res.json({
    range: { from, to },
    totals: rows(totals)[0] ?? { visits: 0, visitors: 0, sessions: 0 },
    liveNow: rows<{ n: number }>(live)[0]?.n ?? 0,
    today: rows(today)[0] ?? { visits: 0, visitors: 0 },
    trend: rows(trend),
    hourly,
    countries: rows(countries),
    regions: rows(regions),
    cities: rows(cities),
    devices: rows(devices),
    browsers: rows(browsers),
    sources: rows(sources),
    pages: rows(pages),
  });
}));

router.get("/recent", asyncHandler(async (req, res) => {
  const q = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  }).safeParse(req.query);
  if (!q.success) throw new AppError(400, "Invalid paging", "VALIDATION_ERROR");
  const { page, limit } = q.data;

  const [items, total] = await Promise.all([
    db.execute(sql`SELECT id, created_at AS "at", path, source, country, region, city, device, browser, os,
                          left(visitor_id, 6) AS "visitor"
                   FROM site_visits ORDER BY created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM site_visits`),
  ]);
  res.json({ items: rows(items), total: rows<{ n: number }>(total)[0]?.n ?? 0, page, limit });
}));

export default router;
