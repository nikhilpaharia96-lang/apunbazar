/**
 * services/order-lifecycle.ts — Shared stock/coupon bookkeeping for orders.
 * Every stock change is mirrored into the stock_movements ledger.
 */
import { eq, sql } from "drizzle-orm";
import { db, productsTable, couponsTable, stockMovementsTable, type Order } from "@workspace/db";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type OrderItem = { productId: number; name: string; price: number; quantity: number; imageUrl?: string };

export async function logMovement(
  tx: Tx,
  m: { productId: number; delta: number; reason: string; orderId?: number; note?: string; actor?: string },
): Promise<void> {
  await tx.insert(stockMovementsTable).values({
    productId: m.productId,
    delta: m.delta,
    reason: m.reason,
    orderId: m.orderId ?? null,
    note: m.note ?? null,
    actor: m.actor ?? "system",
  });
}

/** Returns reserved stock to inventory and releases the coupon use. Call once per order. */
export async function restockAndReleaseCoupon(tx: Tx, order: Order, reason: "cancel" | "expiry", actor = "system"): Promise<void> {
  for (const item of order.items as OrderItem[]) {
    await tx
      .update(productsTable)
      .set({ stock: sql`${productsTable.stock} + ${item.quantity}` })
      .where(eq(productsTable.id, item.productId));
    await logMovement(tx, { productId: item.productId, delta: item.quantity, reason, orderId: order.id, actor });
  }
  if (order.couponCode) {
    await tx
      .update(couponsTable)
      .set({ usedCount: sql`GREATEST(${couponsTable.usedCount} - 1, 0)` })
      .where(eq(couponsTable.code, order.couponCode));
  }
}
