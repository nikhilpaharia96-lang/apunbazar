/**
 * routes/coupons.ts — Database-backed coupons
 *   GET    /api/coupons/validate?code=&subtotal=   public (rate limited) — preview only
 *   GET    /api/coupons                             permission: coupons
 *   POST   /api/coupons                             permission: coupons
 *   PATCH  /api/coupons/:id                         permission: coupons
 *   DELETE /api/coupons/:id                         permission: coupons
 * The discount actually charged is always recomputed inside POST /api/orders.
 */
import { Router } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { db, couponsTable, type Coupon } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { requirePermission } from "../middleware/admin-auth";
import { assertCouponUsable, computeDiscountPaise, findCouponByCode, normalizeCouponCode, toPaise } from "../services/coupon-service";

const router = Router();
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15, // slows coupon-code guessing
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a minute." },
});

const fmt = (c: Coupon) => ({
  id: c.id,
  code: c.code,
  discountType: c.discountType,
  discountValue: Number(c.discountValue),
  minimumOrderValue: Number(c.minimumOrderValue),
  maxUses: c.maxUses,
  usedCount: c.usedCount,
  active: c.active,
  expiresAt: c.expiresAt?.toISOString() ?? null,
  createdAt: c.createdAt.toISOString(),
});
const issue = (e: z.ZodError) => e.issues[0]?.message ?? "Invalid request";

router.get(
  "/validate",
  validateLimiter,
  asyncHandler(async (req, res) => {
    const q = z.object({ code: z.string().trim().min(1).max(40), subtotal: z.coerce.number().min(0).max(10_000_000) }).safeParse(req.query);
    if (!q.success) throw new AppError(400, issue(q.error), "VALIDATION_ERROR");
    const coupon = await findCouponByCode(q.data.code);
    const subtotalPaise = toPaise(q.data.subtotal);
    assertCouponUsable(coupon, subtotalPaise);
    res.json({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discount: computeDiscountPaise(coupon, subtotalPaise) / 100,
    });
  }),
);

const CouponBody = z.object({
  code: z.string().trim().transform(normalizeCouponCode).pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/, "Code must be 3–30 letters/numbers")),
  discountType: z.enum(["percent", "flat"]),
  discountValue: z.number().positive("Discount must be greater than 0"),
  minimumOrderValue: z.number().min(0).default(0),
  maxUses: z.number().int().min(1).nullable().optional(),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().nullable().optional(),
}).refine((c) => c.discountType !== "percent" || c.discountValue <= 100, { message: "Percent discount cannot exceed 100", path: ["discountValue"] });

router.get("/", requirePermission("coupons"), asyncHandler(async (_req, res) => {
  const rows = await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt));
  res.json(rows.map(fmt));
}));

router.post("/", requirePermission("coupons"), asyncHandler(async (req, res) => {
  const body = CouponBody.safeParse(req.body);
  if (!body.success) throw new AppError(400, issue(body.error), "VALIDATION_ERROR");
  if (await findCouponByCode(body.data.code)) throw new AppError(409, "A coupon with this code already exists", "DUPLICATE");
  const d = body.data;
  const [row] = await db.insert(couponsTable).values({
    code: d.code,
    discountType: d.discountType,
    discountValue: String(d.discountValue),
    minimumOrderValue: String(d.minimumOrderValue),
    maxUses: d.maxUses ?? null,
    active: d.active,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
  }).returning();
  res.status(201).json(fmt(row));
}));

router.patch("/:id", requirePermission("coupons"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Invalid coupon ID", "VALIDATION_ERROR");
  const body = z.object({ active: z.boolean().optional(), maxUses: z.number().int().min(1).nullable().optional(), expiresAt: z.string().datetime().nullable().optional() }).safeParse(req.body);
  if (!body.success) throw new AppError(400, issue(body.error), "VALIDATION_ERROR");
  const set: Partial<typeof couponsTable.$inferInsert> = {};
  if (body.data.active !== undefined) set.active = body.data.active;
  if (body.data.maxUses !== undefined) set.maxUses = body.data.maxUses;
  if (body.data.expiresAt !== undefined) set.expiresAt = body.data.expiresAt ? new Date(body.data.expiresAt) : null;
  if (!Object.keys(set).length) throw new AppError(400, "Nothing to update", "VALIDATION_ERROR");
  const [row] = await db.update(couponsTable).set(set).where(eq(couponsTable.id, id)).returning();
  if (!row) throw new AppError(404, "Coupon not found", "NOT_FOUND");
  res.json(fmt(row));
}));

router.delete("/:id", requirePermission("coupons"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "Invalid coupon ID", "VALIDATION_ERROR");
  const deleted = await db.delete(couponsTable).where(eq(couponsTable.id, id)).returning({ id: couponsTable.id });
  if (!deleted.length) throw new AppError(404, "Coupon not found", "NOT_FOUND");
  res.status(204).send();
}));

export default router;
