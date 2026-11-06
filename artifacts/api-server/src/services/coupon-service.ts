/**
 * services/coupon-service.ts — Server-side coupon validation and discount math.
 * All money maths is done in integer paise to avoid floating point drift.
 */
import { eq } from "drizzle-orm";
import { db, couponsTable, type Coupon } from "@workspace/db";
import { AppError } from "../lib/errors";

export const toPaise = (rupees: number | string): number => Math.round(Number(rupees) * 100);

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Throws a user-friendly AppError if the coupon cannot be applied to this subtotal. */
export function assertCouponUsable(coupon: Coupon | undefined, subtotalPaise: number): asserts coupon is Coupon {
  if (!coupon || !coupon.active) throw new AppError(400, "Invalid or expired coupon", "COUPON_INVALID");
  if (coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, "This coupon has expired", "COUPON_EXPIRED");
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    throw new AppError(400, "This coupon has reached its usage limit", "COUPON_EXHAUSTED");
  }
  const min = toPaise(coupon.minimumOrderValue);
  if (subtotalPaise < min) {
    throw new AppError(400, `Minimum order ₹${min / 100} required for this coupon`, "COUPON_MIN_ORDER");
  }
}

/** Discount in paise — never more than the subtotal. */
export function computeDiscountPaise(coupon: Coupon, subtotalPaise: number): number {
  const value = Number(coupon.discountValue);
  const raw =
    coupon.discountType === "percent"
      ? Math.round((subtotalPaise * Math.min(value, 100)) / 100)
      : toPaise(value);
  return Math.max(0, Math.min(raw, subtotalPaise));
}

export async function findCouponByCode(code: string): Promise<Coupon | undefined> {
  const [coupon] = await db
    .select()
    .from(couponsTable)
    .where(eq(couponsTable.code, normalizeCouponCode(code)))
    .limit(1);
  return coupon;
}
