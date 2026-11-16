import { pgTable, text, bigserial, timestamp } from "drizzle-orm/pg-core";

/** One row per page view. IP is stored only as a salted hash (never raw). */
export const siteVisitsTable = pgTable("site_visits", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  visitorId: text("visitor_id").notNull(),
  sessionId: text("session_id").notNull(),
  path: text("path").notNull(),
  referrerHost: text("referrer_host"),
  source: text("source").notNull().default("direct"),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  device: text("device"),
  browser: text("browser"),
  os: text("os"),
  ipHash: text("ip_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteVisit = typeof siteVisitsTable.$inferSelect;
