/**
 * routes/payments.ts — Razorpay payment integration
 *
 * Flow
 *   1. POST /api/orders (method=razorpay) creates our order + the Razorpay order
 *      for the server-computed total.
 *   2. Browser pays in the Razorpay modal, then calls POST /api/payments/verify.
 *   3. POST /api/payments/webhook (signed by Razorpay) is the safety net for
 *      customers who pay but close the tab before step 2.
 *
 * A payment is only accepted if the signed razorpay_order_id is the one we
 * stored on THAT order — a valid signature from a cheap order can never be
 * replayed against a different, more expensive order.
 */
import { Router, type Request } from "express";
import crypto from "crypto";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import { createGatewayOrder } from "../services/razorpay-service";
import { toPaise } from "../services/coupon-service";

const router = Router();

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

// ── POST /api/payments/razorpay-order ──────────────────────────────────────
// (Re)opens payment for an existing unpaid order. The amount is read from our
// database; the browser can no longer choose what it pays.
const ResumeSchema = z.object({
  orderId: z.number().int().positive(),
  email: z.string().trim().email(),
});

router.post(
  "/razorpay-order",
  asyncHandler(async (req, res) => {
    const parsed = ResumeSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? "Invalid request", "VALIDATION_ERROR");

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.orderId));
    if (!order || order.customerEmail.toLowerCase() !== parsed.data.email.toLowerCase()) {
      throw new AppError(404, "Order not found", "NOT_FOUND");
    }
    if (order.paymentMethod !== "razorpay") throw new AppError(400, "This order is not an online-payment order.", "VALIDATION_ERROR");
    if (order.paymentStatus === "paid") throw new AppError(409, "This order is already paid.", "ALREADY_PAID");
    if (order.status === "cancelled" || order.status === "refunded") {
      throw new AppError(409, "This order was cancelled. Please place a new order.", "ORDER_CLOSED");
    }

    const gateway = await createGatewayOrder(order);
    res.json({ ...gateway, orderNumber: order.orderNumber });
  }),
);

// ── POST /api/payments/verify ──────────────────────────────────────────────
const VerifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
  orderId: z.number().int().positive(),
});

router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const parsed = VerifySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0]?.message ?? "Invalid request", "VALIDATION_ERROR");
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = parsed.data;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new AppError(503, "Payment gateway not configured.", "PAYMENT_NOT_CONFIGURED");

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) throw new AppError(404, "Order not found for payment verification.", "NOT_FOUND");

    // The signed order id must be the gateway order we created for THIS order
    if (!order.razorpayOrderId || order.razorpayOrderId !== razorpay_order_id) {
      logger.warn({ orderId, razorpay_order_id }, "Payment verification: gateway order mismatch");
      throw new AppError(400, "Payment verification failed.", "PAYMENT_INVALID");
    }

    const expected = crypto.createHmac("sha256", keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (!safeEqualHex(razorpay_signature, expected)) {
      logger.warn({ razorpay_order_id, orderId }, "Razorpay signature verification failed");
      throw new AppError(400, "Payment verification failed. Invalid signature.", "PAYMENT_INVALID");
    }

    // Idempotent: only a not-yet-paid, not-cancelled order is flipped to paid
    const [updated] = await db
      .update(ordersTable)
      .set({ paymentStatus: "paid", status: "confirmed", razorpayPaymentId: razorpay_payment_id })
      .where(and(eq(ordersTable.id, orderId), ne(ordersTable.paymentStatus, "paid"), ne(ordersTable.status, "cancelled")))
      .returning({ id: ordersTable.id, orderNumber: ordersTable.orderNumber });

    if (!updated && order.paymentStatus !== "paid") {
      // Paid after we cancelled/expired the order and released the stock. Record the payment so
      // it shows up in Admin → Payments as "refund needed" (cancelled + paid).
      await db
        .update(ordersTable)
        .set({ paymentStatus: "paid", razorpayPaymentId: razorpay_payment_id })
        .where(eq(ordersTable.id, orderId));
      logger.error({ orderId, razorpay_payment_id }, "Payment received for a cancelled order — refund required");
      throw new AppError(409, "This order had already expired or was cancelled. Your payment will be refunded.", "ORDER_CLOSED");
    }

    logger.info({ orderId, razorpay_payment_id }, "Payment verified");
    res.json({ success: true, orderId, orderNumber: order.orderNumber, paymentId: razorpay_payment_id });
  }),
);

// ── POST /api/payments/webhook ─────────────────────────────────────────────
// Configure in Razorpay Dashboard → Webhooks: events payment.captured + order.paid,
// secret = RAZORPAY_WEBHOOK_SECRET.
router.post(
  "/webhook",
  asyncHandler(async (req: Request & { rawBody?: Buffer }, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new AppError(503, "Webhook not configured", "WEBHOOK_NOT_CONFIGURED");

    const signature = req.get("x-razorpay-signature") ?? "";
    if (!req.rawBody) throw new AppError(400, "Missing body", "VALIDATION_ERROR");
    const expected = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
    if (!safeEqualHex(signature, expected)) {
      logger.warn("Razorpay webhook: invalid signature");
      throw new AppError(400, "Invalid signature", "WEBHOOK_INVALID");
    }

    const event = req.body as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string } } };
    };
    const payment = event.payload?.payment?.entity;

    if ((event.event === "payment.captured" || event.event === "order.paid") && payment?.order_id) {
      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.razorpayOrderId, payment.order_id));
      if (!order) {
        logger.warn({ razorpayOrderId: payment.order_id }, "Webhook for unknown order");
      } else if (payment.amount !== toPaise(order.total)) {
        logger.error({ orderId: order.id, paid: payment.amount, expected: toPaise(order.total) }, "Webhook amount mismatch — not marking paid");
      } else if (order.paymentStatus !== "paid" && order.status !== "cancelled") {
        await db
          .update(ordersTable)
          .set({ paymentStatus: "paid", status: order.status === "pending" ? "confirmed" : order.status, razorpayPaymentId: payment.id ?? null })
          .where(eq(ordersTable.id, order.id));
        logger.info({ orderId: order.id }, "Order marked paid via webhook");
      } else if (order.status === "cancelled" && order.paymentStatus !== "paid") {
        await db
          .update(ordersTable)
          .set({ paymentStatus: "paid", razorpayPaymentId: payment.id ?? null })
          .where(eq(ordersTable.id, order.id));
        logger.error({ orderId: order.id }, "Webhook payment for cancelled order — refund required");
      }
    }
    res.json({ received: true });
  }),
);

export default router;
