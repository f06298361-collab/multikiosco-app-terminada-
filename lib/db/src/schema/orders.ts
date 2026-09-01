import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
};

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: integer("order_number").notNull().default(1),
  kioskId: text("kiosk_id").notNull().default("kiosk-franco"),
  customerName: text("customer_name").notNull(),
  address: text("address").notNull().default(""),
  delivery: text("delivery").notNull(),
  payment: text("payment").notNull(),
  items: jsonb("items").$type<OrderItem[]>().notNull(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("nuevo"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;
