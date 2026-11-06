/**
 * routes/orders.ts — Order endpoints
 *
 * Security model
 * - Prices, shipping, coupon discount and totals are ALWAYS computed here from
 *   the database. Anything price-like sent by the browser is ignored.
 * - Stock is reserved atomically inside the same transaction that creates the
 *   order (UPDATE ... WHERE stock >= qty), so concurrent buyers cannot oversell.
 * - Admin/staff (permission "orders") can list and update orders.
 *   Customers can only read an order by presenting the email used at checkout
 *   (and list their orders with email + phone). Wrong credentials look like 404.
 */
import { Router, type Request } from "express";
import { z } from "zod";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import rateLimit from "express-rate-limit";
import { db, ordersTable, productsTable, couponsTable, ORDER_STATUSES } from "@workspace/db";
import type { Order, OrderStatus } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { orderLimiter } from "../middleware/rate-limit";
import { hasPermission, requirePermission } from "../middleware/admin-auth";
import { getShippingConfig } from "../services/settings-service";
import {
  assertCouponUsable,
  computeDiscountPaise,
  findCouponByCode,
  normalizeCouponCode,
  toPaise,
} from "../services/coupon-service";
import { createGatewayOrder, getRazorpay } from "../services/razorpay-service";
import { logger } from "../lib/logger";

const router = Router();

const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many lookups. Please slow down." },
});

// ── Helpers ────────────────────────────────────────────────────────────────
const digits10 = (v: string) => v.replace(/\D/g, "").slice(-10);
const sameEmail = (a: string, b: unknown) =>
  typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();

type OrderItem = { productId: number; name: string; price: number; quantity: number; imageUrl?: string };

function formatOrder(o: Order) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    shippingAddress: o.shippingAddress,
    shippingCity: o.shippingCity,
    shippingState: o.shippingState,
    shippingPincode: o.shippingPincode,
    items: o.items as OrderItem[],
    subtotal: Number(o.subtotal),
    shippingFee: Number(o.shippingFee),
    discount: Number(o.discount),
    couponCode: o.couponCode,
    total: Number(o.total),
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

const generateOrderNumber = () => `AB${nanoid(10).toUpperCase()}`;

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid request";

// ── Validation ─────────────────────────────────────────────────────────────
const CreateOrderSchema = z.object({
  customerName: z.string().trim().min(2, "Name required").max(100),
  customerEmail: z.string().trim().toLowerCase().email("Invalid email").max(254),
  customerPhone: z
    .string()
    .trim()
    .transform(digits10)
    .refine((p) => /^[6-9]\d{9}$/.test(p), "Enter a valid 10-digit mobile number"),
  shippingAddress: z.string().trim().min(5, "Address required").max(300),
  shippingCity: z.string().trim().min(2, "City required").max(100),
  shippingState: z.string().trim().min(2, "State required").max(100),
  shippingPincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Invalid pincode"),
  // NOTE: any `price` sent by the client is deliberately dropped (z.object strips unknown keys)
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(20, "Maximum 20 per item"),
      }),
    )
    .min(1, "Cart is empty")
    .max(50),
  paymentMethod: z.enum(["cod", "razorpay"]),
  couponCode: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).nullish(),
  sessionId: z.string().max(100).optional(),
});

// ── Stock restore (cancel / refund / gateway failure) ──────────────────────
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function restockAndReleaseCoupon(tx: Tx, order: Order): Promise<void> {
  for (const item of order.items as OrderItem[]) {
    await tx
      .update(productsTable)
      .set({ stock: sql`${productsTable.stock} + ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
  }
  if (order.couponCode) {
    await tx
      .update(couponsTable)
      .set({ usedCount: sql`GREATEST(${couponsTable.usedCount} - 1, 0)` })
      .where(eq(couponsTable.code, order.couponCode));
  }
}

// ── GET /api/orders ────────────────────────────────────────────────────────
// Admin/staff: full list with filters. Customer: requires exact email + phone.
router.get(
  "/",
  lookupLimiter,
  asyncHandler(async (req, res) => {
    const privileged = await hasPermission(req, "orders");

    const q = z
      .object({
        email: z.string().trim().max(254).optional(),
        phone: z.string().trim().max(20).optional(),
        status: z.enum(ORDER_STATUSES).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(req.query);
    if (!q.success) throw new AppError(400, firstIssue(q.error), "VALIDATION_ERROR");
    const { email, phone, status, page, limit } = q.data;

    const conditions = [];
    if (privileged) {
      if (email) conditions.push(ilike(ordersTable.customerEmail, `%${email.replace(/[%_\\]/g, "\\$&")}%`));
      if (status) conditions.push(eq(ordersTable.status, status as OrderStatus));
    } else {
      // Public lookup: both factors required, exact match only
      if (!email || !phone || digits10(phone).length !== 10) {
        throw new AppError(400, "Enter the email and mobile number used at checkout.", "VALIDATION_ERROR");
      }
      conditions.push(eq(sql`lower(${ordersTable.customerEmail})`, email.toLowerCase()));
      conditions.push(sql`right(regexp_replace(${ordersTable.customerPhone}, '\D', '', 'g'), 10) = ${digits10(phone)}`);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const pageSize = privileged ? limit : Math.min(limit, 50);

    const [rows, countResult] = await Promise.all([
      db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(where),
    ]);
    const total = Number(countResult[0]?.count ?? 0);
    res.json({ orders: rows.map(formatOrder), total, page, limit: pageSize, totalPages: Math.ceil(total / pageSize) });
  }),
);

// ── POST /api/orders ───────────────────────────────────────────────────────
router.post(
  "/",
  orderLimiter,
  asyncHandler(async (req, res) => {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, firstIssue(parsed.error), "VALIDATION_ERROR");
    const input = parsed.data;

    // Fail before reserving stock if the gateway is not usable
    if (input.paymentMethod === "razorpay") getRazorpay();

    // Merge duplicate lines; sort ids so concurrent orders lock rows in the same order (no deadlocks)
    const wanted = new Map<number, number>();
    for (const i of input.items) wanted.set(i.productId, (wanted.get(i.productId) ?? 0) + i.quantity);
    const ids = [...wanted.keys()].sort((a, b) => a - b);
    for (const q of wanted.values()) if (q > 20) throw new AppError(400, "Maximum 20 per item", "VALIDATION_ERROR");

    const shippingCfg = await getShippingConfig();

    const order = await db.transaction(async (tx) => {
      const products = await tx.select().from(productsTable).where(inArray(productsTable.id, ids));
      const byId = new Map(products.map((p) => [p.id, p]));

      const lines: OrderItem[] = [];
      let subtotalPaise = 0;
      for (const id of ids) {
        const p = byId.get(id);
        if (!p) throw new AppError(400, "One of the products in your cart is no longer available.", "PRODUCT_NOT_FOUND");
        const qty = wanted.get(id)!;
        // Atomic reservation — fails (0 rows) if another buyer took the stock first
        const reserved = await tx
          .update(productsTable)
          .set({ stock: sql`${productsTable.stock} - ${qty}` })
          .where(and(eq(productsTable.id, id), sql`${productsTable.stock} >= ${qty}`))
          .returning({ id: productsTable.id });
        if (!reserved.length) {
          throw new AppError(409, `Sorry, "${p.name}" does not have enough stock for the quantity you selected.`, "OUT_OF_STOCK");
        }
        subtotalPaise += toPaise(p.price) * qty;
        lines.push({ productId: id, name: p.name, price: Number(p.price), quantity: qty, imageUrl: p.imageUrl });
      }

      // Coupon — validated and consumed atomically
      let discountPaise = 0;
      let couponCode: string | null = null;
      if (input.couponCode) {
        const coupon = await findCouponByCode(input.couponCode);
        assertCouponUsable(coupon, subtotalPaise);
        discountPaise = computeDiscountPaise(coupon, subtotalPaise);
        const consumed = await tx
          .update(couponsTable)
          .set({ usedCount: sql`${couponsTable.usedCount} + 1` })
          .where(
            and(
              eq(couponsTable.id, coupon.id),
              eq(couponsTable.active, true),
              sql`(${couponsTable.maxUses} IS NULL OR ${couponsTable.usedCount} < ${couponsTable.maxUses})`,
            ),
          )
          .returning({ id: couponsTable.id });
        if (!consumed.length) throw new AppError(400, "This coupon has reached its usage limit", "COUPON_EXHAUSTED");
        couponCode = normalizeCouponCode(input.couponCode);
      }

      const freeShipping = shippingCfg.freeShippingEnabled && subtotalPaise >= toPaise(shippingCfg.freeShippingAbove);
      const shippingPaise =
        (freeShipping ? 0 : toPaise(shippingCfg.shippingFee)) +
        (input.paymentMethod === "cod" && shippingCfg.codEnabled ? toPaise(shippingCfg.codFee) : 0);
      const totalPaise = subtotalPaise - discountPaise + shippingPaise;
      if (input.paymentMethod === "razorpay" && totalPaise < 100) {
        throw new AppError(400, "Order total is too low for online payment. Please choose Cash on Delivery.", "VALIDATION_ERROR");
      }

      const [created] = await tx
        .insert(ordersTable)
        .values({
          orderNumber: generateOrderNumber(),
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          shippingAddress: input.shippingAddress,
          shippingCity: input.shippingCity,
          shippingState: input.shippingState,
          shippingPincode: input.shippingPincode,
          items: lines,
          subtotal: (subtotalPaise / 100).toFixed(2),
          shippingFee: (shippingPaise / 100).toFixed(2),
          discount: (discountPaise / 100).toFixed(2),
          couponCode,
          total: (totalPaise / 100).toFixed(2),
          status: "pending",
          paymentMethod: input.paymentMethod,
          paymentStatus: "pending",
          notes: input.notes ?? null,
          sessionId: input.sessionId,
        })
        .returning();
      return created;
    });

    // Online payment: create the gateway order for the SERVER-computed total
    if (input.paymentMethod === "razorpay") {
      try {
        const rz = await createGatewayOrder(order);
        res.status(201).json({ ...formatOrder(order), razorpay: rz });
        return;
      } catch (err) {
        logger.error({ err, orderId: order.id }, "Razorpay order creation failed — releasing stock");
        await db.transaction(async (tx) => {
          await restockAndReleaseCoupon(tx, order);
          await tx.update(ordersTable).set({ status: "cancelled", paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
        });
        throw new AppError(502, "Could not start the payment. Please try again.", "PAYMENT_GATEWAY_ERROR");
      }
    }

    res.status(201).json(formatOrder(order));
  }),
);

// ── GET /api/orders/:id ────────────────────────────────────────────────────
// Admin/staff, or the customer presenting the checkout email (?email=)
router.get(
  "/:id",
  lookupLimiter,
  asyncHandler(async (req: Request, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Invalid order ID", "VALIDATION_ERROR");

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    const allowed = order && ((await hasPermission(req, "orders")) || sameEmail(order.customerEmail, req.query.email));
    if (!order || !allowed) throw new AppError(404, "Order not found", "NOT_FOUND");

    res.json(formatOrder(order));
  }),
);

// ── PUT /api/orders/:id ────────────────────────────────────────────────────
const UpdateOrderSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
});
const TERMINAL: OrderStatus[] = ["cancelled", "refunded"];

router.put(
  "/:id",
  requirePermission("orders"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Invalid order ID", "VALIDATION_ERROR");
    const body = UpdateOrderSchema.safeParse(req.body);
    if (!body.success) throw new AppError(400, firstIssue(body.error), "VALIDATION_ERROR");

    const updated = await db.transaction(async (tx) => {
      // Lock the row so two admins cannot restock the same order twice
      const [current] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id)).for("update");
      if (!current) throw new AppError(404, "Order not found", "NOT_FOUND");

      const next = body.data.status;
      const wasTerminal = TERMINAL.includes(current.status);
      if (wasTerminal && next !== current.status) {
        throw new AppError(409, `A ${current.status} order cannot be changed. Ask the customer to place a new order.`, "INVALID_TRANSITION");
      }
      if (!wasTerminal && TERMINAL.includes(next)) await restockAndReleaseCoupon(tx, current);

      let paymentStatus = body.data.paymentStatus;
      // COD is collected on delivery
      if (!paymentStatus && next === "delivered" && current.paymentMethod === "cod") paymentStatus = "paid";

      const [row] = await tx
        .update(ordersTable)
        .set({ status: next, ...(paymentStatus ? { paymentStatus } : {}) })
        .where(eq(ordersTable.id, id))
        .returning();
      return row;
    });

    res.json(formatOrder(updated));
  }),
);

export default router;
