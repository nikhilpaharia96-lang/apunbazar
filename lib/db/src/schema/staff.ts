/**
 * schema/staff.ts — Staff members (server-side, shared across all devices)
 *
 * Pehle staff sirf admin ke browser ke localStorage mein save hota tha, isliye
 * staff apne phone se login nahi kar pata tha. Ab sab kuch database mein hai.
 */
import { pgTable, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const staffTable = pgTable(
  "staff_members",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(), // always stored lowercase + trimmed
    phone: text("phone").notNull().default(""),
    role: text("role").notNull(),
    permissions: text("permissions").notNull().default("[]"), // JSON array
    department: text("department").notNull().default(""),
    whatsappNumber: text("whatsapp_number"),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isBlocked: boolean("is_blocked").notNull().default(false),
    createdBy: text("created_by").notNull().default("admin"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLogin: timestamp("last_login", { withTimezone: true }),
  },
  (t) => ({ emailIdx: uniqueIndex("staff_email_idx").on(t.email) }),
);

export type StaffRow = typeof staffTable.$inferSelect;
