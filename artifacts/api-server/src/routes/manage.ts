/**
 * routes/manage.ts — Admin management APIs (all backed by real database queries)
 *   /api/manage/analytics/*   permission: analytics
 *   /api/manage/customers/*   permission: orders
 *   /api/manage/inventory/*   permission: products
 *   /api/manage/payments      permission: orders
 *   /api/manage/reports/*     permission: reports
 *   /api/manage/jobs/*        permission: orders
 *
 * Revenue definition (used everywhere): an order counts as revenue when it is not
 * cancelled/refunded AND (it is Cash-on-Delivery OR its online payment is confirmed paid).
 * Days are bucketed in India time (Asia/Kolkata), not server time.
 */
import { Router, type Request } from "express";
import { z } from "zod";
import { eq, sql, type SQL } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { requirePermission } from "../middleware/admin-auth";
import { logMovement } from "../services/order-lifecycle";
import { expireUnpaidOrders } from "../services/order-expiry";

const router = Router();
const TZ = "Asia/Kolkata";

const REVENUE = sql`(o.status NOT IN ('cancelled','refunded') AND (o.payment_method = 'cod' OR o.payment_status = 'paid'))`;

// ── Helpers ────────────────────────────────────────────────────────────────
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => ymd(new Date(Date.parse(date + "T00:00:00Z") + n * 86_400_000));
const todayIST = () => ymd(new Date(Date.now() + 5.5 * 3_600_000));
const issue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid request";
const rows = <T,>(r: { rows: unknown[] }) => r.rows as T[];

const RangeQ = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function parseRange(req: Request): { from: string; to: string; days: number } {
  const q = RangeQ.safeParse(req.query);
  if (!q.success) throw new AppError(400, "Dates must be YYYY-MM-DD", "VALIDATION_ERROR");
  const to = q.data.to ?? todayIST();
  const from = q.data.from ?? addDays(to, -29);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (Number.isNaN(days) || days < 1) throw new AppError(400, "'from' must not be after 'to'", "VALIDATION_ERROR");
  if (days > 366) throw new AppError(400, "Date range cannot exceed 366 days", "VALIDATION_ERROR");
  return { from, to, days };
}

const startTs = (from: string) => sql`((${from}::date)::timestamp AT TIME ZONE 'Asia/Kolkata')`;
const endTs = (to: string) => sql`(((${to}::date + 1)::timestamp) AT TIME ZONE 'Asia/Kolkata')`;
const inRange = (from: string, to: string) => sql`(o.created_at >= ${startTs(from)} AND o.created_at < ${endTs(to)})`;
const where = (parts: SQL[]) => (parts.length ? sql`WHERE ${sql.join(parts, sql` AND `)}` : sql``);
const likeOf = (s: string) => `%${s.replace(/[%_\\]/g, "\\$&")}%`;

const Paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ═══════════════════════════ ANALYTICS ════════════════════════════════════
const analytics = Router();
analytics.use(requirePermission("analytics"));

async function periodTotals(from: string, to: string) {
  const [r] = rows<{ revenue: number; orders: number; placed: number; cancelled: number }>(
    await db.execute(sql`
      SELECT COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REVENUE}), 0)::float AS revenue,
             COUNT(*) FILTER (WHERE ${REVENUE})::int                              AS orders,
             COUNT(*)::int                                                        AS placed,
             COUNT(*) FILTER (WHERE o.status IN ('cancelled','refunded'))::int    AS cancelled
      FROM orders o WHERE ${inRange(from, to)}`),
  );
  return r;
}

analytics.get("/overview", asyncHandler(async (req, res) => {
  const { from, to, days } = parseRange(req);
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));

  const [cur, prev, items, cust, mix, status] = await Promise.all([
    periodTotals(from, to),
    periodTotals(prevFrom, prevTo),
    db.execute(sql`
      SELECT COALESCE(SUM((item->>'quantity')::int), 0)::int AS units
      FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item
      WHERE ${REVENUE} AND ${inRange(from, to)}`),
    db.execute(sql`
      WITH first_order AS (
        SELECT lower(o.customer_email) AS e, MIN(o.created_at) AS f FROM orders o WHERE ${REVENUE} GROUP BY 1
      ), active AS (
        SELECT DISTINCT lower(o.customer_email) AS e FROM orders o WHERE ${REVENUE} AND ${inRange(from, to)}
      )
      SELECT COUNT(*) FILTER (WHERE f >= ${startTs(from)})::int AS "newCustomers",
             COUNT(*) FILTER (WHERE f <  ${startTs(from)})::int AS "repeatCustomers"
      FROM active JOIN first_order USING (e)`),
    db.execute(sql`
      SELECT o.payment_method AS method, COUNT(*)::int AS orders, COALESCE(SUM(o.total::numeric),0)::float AS revenue
      FROM orders o WHERE ${REVENUE} AND ${inRange(from, to)} GROUP BY 1 ORDER BY 3 DESC`),
    db.execute(sql`
      SELECT o.status, COUNT(*)::int AS count FROM orders o WHERE ${inRange(from, to)} GROUP BY 1 ORDER BY 2 DESC`),
  ]);

  const c = rows<{ newCustomers: number; repeatCustomers: number }>(cust)[0] ?? { newCustomers: 0, repeatCustomers: 0 };
  res.json({
    range: { from, to, days },
    revenue: cur.revenue,
    orders: cur.orders,
    placedOrders: cur.placed,
    cancelledOrders: cur.cancelled,
    averageOrderValue: cur.orders ? Math.round((cur.revenue / cur.orders) * 100) / 100 : 0,
    unitsSold: rows<{ units: number }>(items)[0]?.units ?? 0,
    ...c,
    previous: { from: prevFrom, to: prevTo, revenue: prev.revenue, orders: prev.orders },
    paymentMix: rows(mix),
    statusBreakdown: rows(status),
  });
}));

analytics.get("/trend", asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req);
  const group = z.enum(["day", "week", "month"]).default("day").parse(req.query.group ?? "day");
  if (group === "day") {
    res.json(rows(await db.execute(sql`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
             COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REVENUE}), 0)::float AS revenue,
             COUNT(o.id) FILTER (WHERE ${REVENUE})::int AS orders
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS g(day0)
      CROSS JOIN LATERAL (SELECT g.day0::date AS day) d
      LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = d.day
      GROUP BY d.day ORDER BY d.day`)));
    return;
  }
  res.json(rows(await db.execute(sql`
    SELECT to_char(date_trunc(${group}, o.created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(o.total::numeric), 0)::float AS revenue, COUNT(*)::int AS orders
    FROM orders o WHERE ${REVENUE} AND ${inRange(from, to)} GROUP BY 1 ORDER BY 1`)));
}));

analytics.get("/top-products", asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req);
  const limit = z.coerce.number().int().min(1).max(50).default(10).parse(req.query.limit ?? 10);
  res.json(rows(await db.execute(sql`
    SELECT (item->>'productId')::int AS id, MAX(item->>'name') AS name,
           SUM((item->>'quantity')::int)::int AS units,
           SUM((item->>'quantity')::int * (item->>'price')::numeric)::float AS revenue
    FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item
    WHERE ${REVENUE} AND ${inRange(from, to)}
    GROUP BY 1 ORDER BY units DESC, revenue DESC LIMIT ${limit}`)));
}));

analytics.get("/categories", asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req);
  res.json(rows(await db.execute(sql`
    SELECT COALESCE(c.name, 'Uncategorised') AS "categoryName",
           COUNT(DISTINCT o.id)::int AS "orderCount",
           SUM((item->>'quantity')::int)::int AS units,
           SUM((item->>'quantity')::int * (item->>'price')::numeric)::float AS revenue
    FROM orders o
    CROSS JOIN LATERAL jsonb_array_elements(o.items) item
    LEFT JOIN products p ON p.id = (item->>'productId')::int
    LEFT JOIN main_categories c ON c.id = p.category_id
    WHERE ${REVENUE} AND ${inRange(from, to)}
    GROUP BY 1 ORDER BY revenue DESC LIMIT 20`)));
}));
router.use("/analytics", analytics);

// ═══════════════════════════ CUSTOMERS ════════════════════════════════════
const customers = Router();
customers.use(requirePermission("orders"));

const CUSTOMER_SORT: Record<string, string> = { spent: "spent DESC", orders: "orders DESC", recent: '"lastOrder" DESC', name: "name ASC" };

customers.get("/", asyncHandler(async (req, res) => {
  const q = Paging.extend({ q: z.string().trim().max(100).optional(), sort: z.enum(["spent", "orders", "recent", "name"]).default("recent") }).safeParse(req.query);
  if (!q.success) throw new AppError(400, issue(q.error), "VALIDATION_ERROR");
  const { page, limit, sort } = q.data;
  const conds: SQL[] = [];
  if (q.data.q) {
    const l = likeOf(q.data.q);
    conds.push(sql`(o.customer_name ILIKE ${l} OR o.customer_email ILIKE ${l} OR o.customer_phone ILIKE ${l})`);
  }
  const list = await db.execute(sql`
    SELECT lower(o.customer_email) AS email,
           (array_agg(o.customer_name ORDER BY o.created_at DESC))[1]    AS name,
           (array_agg(o.customer_phone ORDER BY o.created_at DESC))[1]   AS phone,
           (array_agg(o.shipping_city ORDER BY o.created_at DESC))[1]    AS city,
           COUNT(*) FILTER (WHERE ${REVENUE})::int                       AS orders,
           COUNT(*)::int                                                 AS "placedOrders",
           COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REVENUE}), 0)::float AS spent,
           MIN(o.created_at) AS "firstOrder", MAX(o.created_at) AS "lastOrder"
    FROM orders o ${where(conds)}
    GROUP BY lower(o.customer_email)
    ORDER BY ${sql.raw(CUSTOMER_SORT[sort])}, email
    LIMIT ${limit} OFFSET ${(page - 1) * limit}`);
  const [count] = rows<{ total: number }>(await db.execute(sql`SELECT COUNT(DISTINCT lower(o.customer_email))::int AS total FROM orders o ${where(conds)}`));
  res.json({ customers: rows(list), total: count.total, page, limit, totalPages: Math.ceil(count.total / limit) });
}));

customers.get("/detail", asyncHandler(async (req, res) => {
  const email = z.string().trim().toLowerCase().email().safeParse(req.query.email);
  if (!email.success) throw new AppError(400, "A valid email is required", "VALIDATION_ERROR");
  const [profile] = rows<Record<string, unknown>>(await db.execute(sql`
    SELECT lower(o.customer_email) AS email,
           (array_agg(o.customer_name ORDER BY o.created_at DESC))[1]  AS name,
           (array_agg(o.customer_phone ORDER BY o.created_at DESC))[1] AS phone,
           (array_agg(o.shipping_address ORDER BY o.created_at DESC))[1] AS address,
           (array_agg(o.shipping_city ORDER BY o.created_at DESC))[1]  AS city,
           (array_agg(o.shipping_state ORDER BY o.created_at DESC))[1] AS state,
           (array_agg(o.shipping_pincode ORDER BY o.created_at DESC))[1] AS pincode,
           COUNT(*) FILTER (WHERE ${REVENUE})::int AS orders,
           COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REVENUE}), 0)::float AS spent,
           MIN(o.created_at) AS "firstOrder", MAX(o.created_at) AS "lastOrder"
    FROM orders o WHERE lower(o.customer_email) = ${email.data} GROUP BY 1`));
  if (!profile) throw new AppError(404, "Customer not found", "NOT_FOUND");
  const orders = rows(await db.execute(sql`
    SELECT o.id, o.order_number AS "orderNumber", o.total::float AS total, o.status,
           o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus", o.created_at AS "createdAt"
    FROM orders o WHERE lower(o.customer_email) = ${email.data} ORDER BY o.created_at DESC LIMIT 100`));
  res.json({ ...profile, orderList: orders });
}));
router.use("/customers", customers);

// ═══════════════════════════ INVENTORY ════════════════════════════════════
const inventory = Router();
inventory.use(requirePermission("products"));

inventory.get("/", asyncHandler(async (req, res) => {
  const q = Paging.extend({
    q: z.string().trim().max(100).optional(),
    filter: z.enum(["all", "low", "out"]).default("all"),
    threshold: z.coerce.number().int().min(1).max(1000).default(5),
  }).safeParse(req.query);
  if (!q.success) throw new AppError(400, issue(q.error), "VALIDATION_ERROR");
  const { page, limit, filter, threshold } = q.data;
  const conds: SQL[] = [];
  if (q.data.q) conds.push(sql`p.name ILIKE ${likeOf(q.data.q)}`);
  if (filter === "out") conds.push(sql`p.stock = 0`);
  if (filter === "low") conds.push(sql`(p.stock > 0 AND p.stock <= ${threshold})`);

  const [list, total, summary] = await Promise.all([
    db.execute(sql`
      SELECT p.id, p.name, p.stock, p.price::float AS price, p.image_url AS "imageUrl",
             c.name AS "categoryName", (p.stock * p.price)::float AS "stockValue"
      FROM products p LEFT JOIN main_categories c ON c.id = p.category_id ${where(conds)}
      ORDER BY p.stock ASC, p.name ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    db.execute(sql`SELECT COUNT(*)::int AS total FROM products p ${where(conds)}`),
    db.execute(sql`
      SELECT COUNT(*)::int AS "totalProducts",
             COUNT(*) FILTER (WHERE stock = 0)::int AS "outOfStock",
             COUNT(*) FILTER (WHERE stock > 0 AND stock <= ${threshold})::int AS "lowStock",
             COALESCE(SUM(stock * price), 0)::float AS "stockValue",
             COALESCE(SUM(stock), 0)::int AS "totalUnits"
      FROM products`),
  ]);
  const t = rows<{ total: number }>(total)[0].total;
  res.json({ products: rows(list), total: t, page, limit, totalPages: Math.ceil(t / limit), threshold, summary: rows(summary)[0] });
}));

const AdjustSchema = z.object({
  mode: z.enum(["delta", "set"]),
  value: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.string().trim().min(3, "Please give a short reason").max(200),
});

inventory.post("/:id/adjust", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Invalid product ID", "VALIDATION_ERROR");
  const body = AdjustSchema.safeParse(req.body);
  if (!body.success) throw new AppError(400, issue(body.error), "VALIDATION_ERROR");

  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(productsTable).where(eq(productsTable.id, id)).for("update");
    if (!p) throw new AppError(404, "Product not found", "NOT_FOUND");
    const next = body.data.mode === "set" ? body.data.value : p.stock + body.data.value;
    if (next < 0) throw new AppError(400, `Stock cannot go below zero (current: ${p.stock})`, "VALIDATION_ERROR");
    if (next !== p.stock) {
      await tx.update(productsTable).set({ stock: next }).where(eq(productsTable.id, id));
      await logMovement(tx, { productId: id, delta: next - p.stock, reason: "manual", note: body.data.reason, actor: "admin" });
    }
    return { id, stock: next, previous: p.stock };
  });
  res.json(result);
}));

inventory.get("/:id/movements", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Invalid product ID", "VALIDATION_ERROR");
  res.json(rows(await db.execute(sql`
    SELECT id, delta, reason, order_id AS "orderId", note, actor, created_at AS "createdAt"
    FROM stock_movements WHERE product_id = ${id} ORDER BY created_at DESC, id DESC LIMIT 50`)));
}));
router.use("/inventory", inventory);

// ═══════════════════════════ PAYMENTS ═════════════════════════════════════
router.get("/payments", requirePermission("orders"), asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req);
  const q = Paging.extend({
    status: z.enum(["pending", "paid", "failed", "refunded", "refund_needed"]).optional(),
    method: z.enum(["cod", "razorpay"]).optional(),
    q: z.string().trim().max(100).optional(),
  }).safeParse(req.query);
  if (!q.success) throw new AppError(400, issue(q.error), "VALIDATION_ERROR");
  const { page, limit, status, method } = q.data;

  const conds: SQL[] = [inRange(from, to)];
  if (status === "refund_needed") conds.push(sql`(o.status = 'cancelled' AND o.payment_status = 'paid')`);
  else if (status) conds.push(sql`o.payment_status = ${status}`);
  if (method) conds.push(sql`o.payment_method = ${method}`);
  if (q.data.q) {
    const l = likeOf(q.data.q);
    conds.push(sql`(o.order_number ILIKE ${l} OR o.customer_name ILIKE ${l} OR o.customer_email ILIKE ${l} OR o.razorpay_payment_id ILIKE ${l})`);
  }

  const [list, count, sum] = await Promise.all([
    db.execute(sql`
      SELECT o.id, o.order_number AS "orderNumber", o.customer_name AS "customerName", o.customer_email AS "customerEmail",
             o.total::float AS total, o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus",
             o.status, o.razorpay_payment_id AS "razorpayPaymentId", o.created_at AS "createdAt",
             (o.status = 'cancelled' AND o.payment_status = 'paid') AS "refundNeeded"
      FROM orders o ${where(conds)} ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    db.execute(sql`SELECT COUNT(*)::int AS total FROM orders o ${where(conds)}`),
    db.execute(sql`
      SELECT
        COALESCE(SUM(o.total::numeric) FILTER (WHERE o.payment_method='razorpay' AND o.payment_status='paid' AND o.status NOT IN ('cancelled','refunded')),0)::float AS "onlineCollected",
        COALESCE(SUM(o.total::numeric) FILTER (WHERE o.payment_method='cod' AND o.payment_status='paid' AND o.status NOT IN ('cancelled','refunded')),0)::float AS "codCollected",
        COALESCE(SUM(o.total::numeric) FILTER (WHERE o.payment_method='cod' AND o.payment_status='pending' AND o.status NOT IN ('cancelled','refunded','delivered')),0)::float AS "codToCollect",
        COALESCE(SUM(o.total::numeric) FILTER (WHERE o.payment_method='razorpay' AND o.payment_status='pending' AND o.status='pending'),0)::float AS "awaitingOnline",
        COUNT(*) FILTER (WHERE o.status='cancelled' AND o.payment_status='paid')::int AS "refundsNeededCount",
        COALESCE(SUM(o.total::numeric) FILTER (WHERE o.status='cancelled' AND o.payment_status='paid'),0)::float AS "refundsNeededAmount",
        COALESCE(SUM(o.total::numeric) FILTER (WHERE o.payment_status='refunded'),0)::float AS "refunded"
      FROM orders o WHERE ${inRange(from, to)}`),
  ]);
  const total = rows<{ total: number }>(count)[0].total;
  res.json({ payments: rows(list), total, page, limit, totalPages: Math.ceil(total / limit), summary: rows(sum)[0], range: { from, to } });
}));

// ═══════════════════════════ REPORTS / EXPORTS ════════════════════════════
const reports = Router();
reports.use(requirePermission("reports"));

type Cell = string | number | boolean | Date | null | undefined;
function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formula injection (customer-controlled text like names/addresses)
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (cols: string[], data: Record<string, Cell>[]) =>
  "\ufeff" + [cols.join(","), ...data.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\r\n") + "\r\n";

reports.get("/export", asyncHandler(async (req, res) => {
  const type = z.enum(["orders", "customers", "inventory", "payments", "sales"]).safeParse(req.query.type);
  if (!type.success) throw new AppError(400, "type must be orders, customers, inventory, payments or sales", "VALIDATION_ERROR");
  const { from, to } = parseRange(req);
  let cols: string[]; let data: Record<string, Cell>[];

  if (type.data === "orders") {
    cols = ["orderNumber", "date", "customer", "email", "phone", "city", "state", "pincode", "items", "subtotal", "discount", "coupon", "shipping", "total", "status", "paymentMethod", "paymentStatus"];
    data = rows<Record<string, Cell>>(await db.execute(sql`
      SELECT o.order_number AS "orderNumber", to_char(o.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI') AS date,
             o.customer_name AS customer, o.customer_email AS email, o.customer_phone AS phone,
             o.shipping_city AS city, o.shipping_state AS state, o.shipping_pincode AS pincode,
             (SELECT string_agg((i->>'name') || ' x' || (i->>'quantity'), '; ') FROM jsonb_array_elements(o.items) i) AS items,
             o.subtotal::float AS subtotal, o.discount::float AS discount, o.coupon_code AS coupon, o.shipping_fee::float AS shipping,
             o.total::float AS total, o.status, o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus"
      FROM orders o WHERE ${inRange(from, to)} ORDER BY o.created_at DESC LIMIT 50000`));
  } else if (type.data === "customers") {
    cols = ["email", "name", "phone", "city", "orders", "spent", "firstOrder", "lastOrder"];
    data = rows<Record<string, Cell>>(await db.execute(sql`
      SELECT lower(o.customer_email) AS email, (array_agg(o.customer_name ORDER BY o.created_at DESC))[1] AS name,
             (array_agg(o.customer_phone ORDER BY o.created_at DESC))[1] AS phone,
             (array_agg(o.shipping_city ORDER BY o.created_at DESC))[1] AS city,
             COUNT(*) FILTER (WHERE ${REVENUE})::int AS orders,
             COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REVENUE}),0)::float AS spent,
             to_char(MIN(o.created_at) AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS "firstOrder",
             to_char(MAX(o.created_at) AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS "lastOrder"
      FROM orders o WHERE ${inRange(from, to)} GROUP BY lower(o.customer_email) ORDER BY spent DESC LIMIT 50000`));
  } else if (type.data === "inventory") {
    cols = ["id", "name", "category", "price", "stock", "stockValue"];
    data = rows<Record<string, Cell>>(await db.execute(sql`
      SELECT p.id, p.name, c.name AS category, p.price::float AS price, p.stock, (p.stock * p.price)::float AS "stockValue"
      FROM products p LEFT JOIN main_categories c ON c.id = p.category_id ORDER BY p.name`));
  } else if (type.data === "payments") {
    cols = ["orderNumber", "date", "customer", "email", "method", "paymentStatus", "orderStatus", "amount", "razorpayPaymentId", "refundNeeded"];
    data = rows<Record<string, Cell>>(await db.execute(sql`
      SELECT o.order_number AS "orderNumber", to_char(o.created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD HH24:MI') AS date,
             o.customer_name AS customer, o.customer_email AS email, o.payment_method AS method,
             o.payment_status AS "paymentStatus", o.status AS "orderStatus", o.total::float AS amount,
             o.razorpay_payment_id AS "razorpayPaymentId",
             CASE WHEN o.status='cancelled' AND o.payment_status='paid' THEN 'YES' ELSE '' END AS "refundNeeded"
      FROM orders o WHERE ${inRange(from, to)} ORDER BY o.created_at DESC LIMIT 50000`));
  } else {
    cols = ["date", "orders", "revenue", "averageOrderValue"];
    data = rows<Record<string, Cell>>(await db.execute(sql`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
             COUNT(o.id) FILTER (WHERE ${REVENUE})::int AS orders,
             COALESCE(SUM(o.total::numeric) FILTER (WHERE ${REVENUE}),0)::float AS revenue,
             COALESCE(ROUND(AVG(o.total::numeric) FILTER (WHERE ${REVENUE}),2),0)::float AS "averageOrderValue"
      FROM generate_series(${from}::date, ${to}::date, interval '1 day') AS g(day0)
      CROSS JOIN LATERAL (SELECT g.day0::date AS day) d
      LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Asia/Kolkata')::date = d.day
      GROUP BY d.day ORDER BY d.day`));
  }
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="apunbazar-${type.data}-${from}_to_${to}.csv"`,
    "Cache-Control": "no-store",
  });
  res.send(toCsv(cols, data));
}));
router.use("/reports", reports);

// ═══════════════════════════ JOBS ═════════════════════════════════════════
router.post("/jobs/expire-unpaid", requirePermission("orders"), asyncHandler(async (_req, res) => {
  res.json(await expireUnpaidOrders());
}));

export default router;
