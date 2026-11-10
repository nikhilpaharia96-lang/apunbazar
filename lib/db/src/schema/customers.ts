/**
 * schema/customers.ts — Customer accounts (guest checkout still works without one)
 */
import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const customersTable = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(), // always stored lower-case
    name: text("name").notNull(),
    phone: text("phone").notNull(), // 10-digit Indian mobile
    passwordHash: text("password_hash").notNull(),
    // Saved delivery details for one-tap checkout
    address: text("address"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => ({ emailIdx: uniqueIndex("customers_email_idx").on(t.email) }),
);
export type Customer = typeof customersTable.$inferSelect;
