/**
 * services/razorpay-service.ts — Razorpay client + gateway-order creation.
 * Amounts always come from our own `orders.total`, never from the browser.
 */
import Razorpay from "razorpay";
import { eq } from "drizzle-orm";
import { db, ordersTable, type Order } from "@workspace/db";
import { AppError } from "../lib/errors";
import { toPaise } from "./coupon-service";

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new AppError(503, "Online payment is not available right now. Please choose Cash on Delivery.", "PAYMENT_NOT_CONFIGURED");
  }
  instance ??= new Razorpay({ key_id: keyId, key_secret: keySecret });
  return instance;
}

export interface GatewayOrder {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
}

/** Creates (or returns the already-created) Razorpay order for one of our orders. */
export async function createGatewayOrder(order: Order): Promise<GatewayOrder> {
  const rz = getRazorpay();
  const keyId = process.env.RAZORPAY_KEY_ID!;
  const amount = toPaise(order.total);

  if (order.razorpayOrderId) {
    return { orderId: order.razorpayOrderId, keyId, amount, currency: "INR" };
  }

  const created = await rz.orders.create({
    amount,
    currency: "INR",
    receipt: order.orderNumber,
    notes: { orderNumber: order.orderNumber },
  });
  await db.update(ordersTable).set({ razorpayOrderId: created.id }).where(eq(ordersTable.id, order.id));
  return { orderId: created.id, keyId, amount, currency: "INR" };
}
