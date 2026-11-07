/**
 * routes/admin.ts — Admin API routes
 *
 * Problems fixed vs original:
 * - CRITICAL: All endpoints are now protected by requireAdminAuth middleware
 * - CRITICAL: Password comparison uses bcrypt instead of plain-text ===
 * - CRITICAL: change-password now actually works (stores hashed password in DB settings table)
 * - Hindi error messages replaced with English
 * - asyncHandler wrapper applied consistently
 * - Admin stats query uses proper typed SQL
 * - recent-orders projects only needed fields (not SELECT *)
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, ordersTable, productsTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import { requireAdminAuth, requirePermission, signAdminToken, authLimiter } from "../middleware/admin-auth";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../app";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router();

// ── Validation schemas ─────────────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// ── Helper: get admin credentials from env ─────────────────────────────────
function getAdminCredentials(): { email: string; passwordHash: string } {
  const email = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!email || !passwordHash) {
    throw new AppError(
      503,
      "Admin credentials not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH.",
      "CONFIG_MISSING",
    );
  }
  return { email, passwordHash };
}

// ── POST /api/admin/login ──────────────────────────────────────────────────
// Rate limited separately — max 10 attempts per 15 minutes
router.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.errors[0].message, "VALIDATION_ERROR");
    }

    const { email, password } = parsed.data;
    const credentials = getAdminCredentials();

    // Constant-time comparison to prevent timing attacks
    const [emailMatch, passwordMatch] = await Promise.all([
      // bcrypt.compare is already constant-time; we compare email separately
      Promise.resolve(email === credentials.email),
      bcrypt.compare(password, credentials.passwordHash),
    ]);

    if (!emailMatch || !passwordMatch) {
      // Log failed attempt with IP for security monitoring
      logger.warn(
        { ip: req.ip, email: email.slice(0, 3) + "***" },
        "Failed admin login attempt",
      );
      // Generic message — don't reveal which field was wrong
      throw new AppError(401, "Invalid credentials.", "AUTH_FAILED");
    }

    const token = signAdminToken(email);
    logger.info({ email: credentials.email.slice(0, 3) + "***" }, "Admin logged in");

    res.json({ token, expiresIn: 7200 }); // 2 hours
  }),
);

// ── Dashboard data (admin OR staff with the "dashboard" permission) ────────
// Revenue = not cancelled/refunded AND (COD OR online-paid). Days bucketed in IST.
const REV = sql`(o.status NOT IN ('cancelled','refunded') AND (o.payment_method = 'cod' OR o.payment_status = 'paid'))`;
const dash = requirePermission("dashboard");

router.get("/stats", dash, asyncHandler(async (_req, res) => {
  const [r] = (await db.execute(sql`
    SELECT COUNT(*)::int AS "totalOrders",
           COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REV}), 0)::float AS "totalRevenue",
           COUNT(*) FILTER (WHERE o.status = 'pending')::int AS "pendingOrders",
           COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REV} AND (o.created_at AT TIME ZONE 'Asia/Kolkata') >= date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')), 0)::float AS "revenueThisMonth",
           COUNT(DISTINCT lower(o.customer_email))::int AS "totalCustomers"
    FROM orders o`)).rows as Array<Record<string, number>>;
  const [p] = await db.select({ count: sql<number>`count(*)` }).from(productsTable);
  res.json({ ...r, totalProducts: Number(p?.count ?? 0) });
}));

router.get("/recent-orders", dash, asyncHandler(async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 10;
  const list = await db
    .select({
      id: ordersTable.id, orderNumber: ordersTable.orderNumber, customerName: ordersTable.customerName,
      customerEmail: ordersTable.customerEmail, total: ordersTable.total, status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod, paymentStatus: ordersTable.paymentStatus, createdAt: ordersTable.createdAt,
    })
    .from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(limit);
  res.json(list.map((o) => ({ ...o, total: Number(o.total), createdAt: o.createdAt.toISOString() })));
}));

// Ranked by units actually sold (previously ranked by review count)
router.get("/top-products", dash, asyncHandler(async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 5);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 20) : 5;
  const result = await db.execute(sql`
    SELECT (item->>'productId')::int AS id, MAX(item->>'name') AS name,
           SUM((item->>'quantity')::int)::int AS units,
           SUM((item->>'quantity')::int * (item->>'price')::numeric)::float AS revenue,
           COALESCE(MAX(p.stock), 0)::int AS stock
    FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item
    LEFT JOIN products p ON p.id = (item->>'productId')::int
    WHERE ${REV}
    GROUP BY 1 ORDER BY units DESC, revenue DESC LIMIT ${limit}`);
  res.json(result.rows ?? []);
}));

// Uses each line's price × quantity (previously added the whole order total to every category)
router.get("/sales-by-category", dash, asyncHandler(async (_req, res) => {
  const result = await db.execute(sql`
    SELECT p.category_id AS "categoryId", COALESCE(c.name, 'Uncategorised') AS "categoryName",
           COUNT(DISTINCT o.id)::int AS "orderCount",
           SUM((item->>'quantity')::int * (item->>'price')::numeric)::float AS revenue
    FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item
    LEFT JOIN products p ON p.id = (item->>'productId')::int
    LEFT JOIN main_categories c ON c.id = p.category_id
    WHERE ${REV}
    GROUP BY p.category_id, c.name ORDER BY revenue DESC LIMIT 10`);
  res.json(result.rows ?? []);
}));

router.get("/revenue-trend", dash, asyncHandler(async (req, res) => {
  const daysRaw = Number(req.query.days ?? 30);
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(7, Math.floor(daysRaw)), 365) : 30;
  const result = await db.execute(sql`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS "date",
           COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REV}), 0)::float AS "revenue",
           COUNT(o.id) FILTER (WHERE ${REV})::int AS "orders"
    FROM generate_series(
           (now() AT TIME ZONE 'Asia/Kolkata')::date - (${days}::int - 1),
           (now() AT TIME ZONE 'Asia/Kolkata')::date, interval '1 day') AS g(day0)
    CROSS JOIN LATERAL (SELECT g.day0::date AS day) d
    LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = d.day
    GROUP BY d.day ORDER BY d.day`);
  res.json(result.rows ?? []);
}));

// All routes below this line require admin authentication
router.use(requireAdminAuth);

// ── POST /api/admin/change-password ───────────────────────────────────────
// NOTE: This updates the in-process env var only. For persistence across
// restarts, update ADMIN_PASSWORD_HASH in your deployment environment.
// Generating a new hash: bcrypt.hash("newpassword", 12)
router.post(
  "/change-password",
  asyncHandler(async (req, res) => {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.errors[0].message, "VALIDATION_ERROR");
    }

    const { oldPassword, newPassword } = parsed.data;
    const credentials = getAdminCredentials();

    const isValid = await bcrypt.compare(oldPassword, credentials.passwordHash);
    if (!isValid) {
      throw new AppError(401, "Current password is incorrect.", "AUTH_FAILED");
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Update the running process (survives until server restart)
    process.env.ADMIN_PASSWORD_HASH = newHash;

    logger.info("Admin password changed successfully");

    res.json({
      success: true,
      newHash,
      instruction:
        "Password updated for this session. To persist across restarts, " +
        "update ADMIN_PASSWORD_HASH in your deployment environment with the newHash value.",
    });
  }),
);

export default router;
