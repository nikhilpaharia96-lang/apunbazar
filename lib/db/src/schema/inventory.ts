/**
 * schema/inventory.ts — Stock movement ledger + uploaded product images
 */
import { pgTable, text, serial, integer, timestamp, index, customType } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; default: false }>({
  dataType: () => "bytea",
});

// Every change to products.stock is recorded here (sale, cancel, expiry, manual adjust…)
export const stockMovementsTable = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    delta: integer("delta").notNull(), // negative = stock leaves, positive = stock returns
    reason: text("reason").notNull(), // order | cancel | expiry | manual | product_edit
    orderId: integer("order_id"),
    note: text("note"),
    actor: text("actor").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productIdx: index("stock_movements_product_idx").on(t.productId, t.createdAt),
  }),
);
export type StockMovement = typeof stockMovementsTable.$inferSelect;

// Validated product images stored in Postgres (Render/Railway disks are ephemeral)
export const uploadedImagesTable = pgTable("uploaded_images", {
  id: text("id").primaryKey(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  data: bytea("data").notNull(),
  createdBy: text("created_by").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
