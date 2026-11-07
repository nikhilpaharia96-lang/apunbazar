/**
 * services/order-expiry.ts — Automatic expiry of unpaid online orders.
 *
 * Online orders reserve stock at creation. If the customer never pays, the stock must
 * come back. Rules:
 *   - An order is a candidate after ORDER_PAYMENT_TTL_MINUTES (default 30).
 *   - Before cancelling we ask Razorpay whether a captured payment exists. If yes, the
 *     order is marked paid instead (customer paid but closed the tab).
 *   - If Razorpay cannot be reached we keep waiting, and only cancel after a hard limit
 *     (4 × TTL) so a gateway outage can never trap stock forever, nor cancel a paid order early.
 *   - Safe with several server instances: rows are locked with FOR UPDATE SKIP LOCKED.
 */
import { and, eq, lt, sql } from "drizzle-orm";
import { db, ordersTable, type Order } from "@workspace/db";
import { logger } from "../lib/logger";
import { getRazorpay } from "./razorpay-service";
import { restockAndReleaseCoupon } from "./order-lifecycle";

export interface ExpiryResult { expired: number; recoveredAsPaid: number; deferred: number }

const ttlMinutes = () => Math.max(1, Number(process.env.ORDER_PAYMENT_TTL_MINUTES) || 30);

async function gatewayHasCapturedPayment(order: Order): Promise<boolean | "unknown"> {
  if (!order.razorpayOrderId) return false;
  try {
    const res = await getRazorpay().orders.fetchPayments(order.razorpayOrderId);
    const items = (res as { items?: Array<{ status?: string; id?: string }> }).items ?? [];
    return items.some((p) => p.status === "captured");
  } catch (err) {
    logger.warn({ err, orderId: order.id }, "Expiry: could not reach Razorpay");
    return "unknown";
  }
}

export async function expireUnpaidOrders(): Promise<ExpiryResult> {
  const ttl = ttlMinutes();
  const result: ExpiryResult = { expired: 0, recoveredAsPaid: 0, deferred: 0 };

  const candidates = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.paymentMethod, "razorpay"),
        eq(ordersTable.paymentStatus, "pending"),
        eq(ordersTable.status, "pending"),
        lt(ordersTable.createdAt, sql`now() - (${ttl} * interval '1 minute')`),
      ),
    )
    .orderBy(ordersTable.id)
    .limit(100);

  for (const { id } of candidates) {
    // Gateway lookup happens outside the DB transaction (network call)
    const [peek] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!peek || peek.paymentStatus !== "pending" || peek.status !== "pending") continue;
    const paid = await gatewayHasCapturedPayment(peek);
    const ageMinutes = (Date.now() - peek.createdAt.getTime()) / 60000;

    if (paid === "unknown" && ageMinutes < ttl * 4) { result.deferred++; continue; }

    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .for("update", { skipLocked: true });
      if (!row || row.paymentStatus !== "pending" || row.status !== "pending") return;

      if (paid === true) {
        await tx.update(ordersTable).set({ paymentStatus: "paid", status: "confirmed" }).where(eq(ordersTable.id, id));
        result.recoveredAsPaid++;
        logger.info({ orderId: id }, "Expiry: payment found at gateway — order marked paid");
        return;
      }
      await restockAndReleaseCoupon(tx, row, "expiry");
      await tx
        .update(ordersTable)
        .set({
          status: "cancelled",
          paymentStatus: "failed",
          notes: [row.notes, "Auto-cancelled: payment not completed in time"].filter(Boolean).join(" | "),
        })
        .where(eq(ordersTable.id, id));
      result.expired++;
      logger.info({ orderId: id }, "Expiry: unpaid order cancelled, stock released");
    });
  }
  return result;
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startExpiryJob(): void {
  if (timer || process.env.DISABLE_JOBS === "1") return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await expireUnpaidOrders();
      if (r.expired || r.recoveredAsPaid) logger.info(r, "Order expiry run");
    } catch (err) {
      logger.error({ err }, "Order expiry run failed");
    } finally {
      running = false;
    }
  }, 60_000);
  timer.unref();
}
