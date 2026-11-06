/**
 * schema/orders.ts — Orders table with indexes
 *
 * Problems fixed vs original:
 * - No indexes on customerEmail, status, sessionId — added
 * - status and paymentMethod should use enums for type safety — added
 */

import {
  pgTable,
  text,
  serial,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export const PAYMENT_METHODS = ["cod", "razorpay"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ordersTable = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    shippingAddress: text("shipping_address").notNull(),
    shippingCity: text("shipping_city").notNull(),
    shippingState: text("shipping_state").notNull(),
    shippingPincode: text("shipping_pincode").notNull(),
    items: jsonb("items").notNull(),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    shippingFee: numeric("shipping_fee", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull(),
    paymentStatus: text("payment_status", { enum: PAYMENT_STATUSES })
      .notNull()
      .default("pending"),
    notes: text("notes"),
    sessionId: text("session_id"),
    // Server-computed coupon discount (never trusted from the client)
    couponCode: text("coupon_code"),
    discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
    // Razorpay linkage — lets /payments/verify and the webhook bind a payment to exactly one order
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Critical for customer order lookup (GET /orders?email=X)
    customerEmailIdx: index("orders_customer_email_idx").on(table.customerEmail),
    // Critical for admin order filtering by status
    statusIdx: index("orders_status_idx").on(table.status),
    // Critical for cart-to-order linking and session-based queries
    sessionIdIdx: index("orders_session_id_idx").on(table.sessionId),
    // Supports order timeline / sorting
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
    razorpayOrderIdIdx: index("orders_razorpay_order_id_idx").on(table.razorpayOrderId),
  }),
);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
