import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const productsTable = pgTable("products", {
  id: text("id").primaryKey(),
  kioskId: text("kiosk_id").notNull().default("kiosk-franco"),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull(),
  emoji: text("emoji").notNull().default("📦"),
  image: text("image"),
  available: boolean("available").notNull().default(true),
  description: text("description"),
  originalPrice: integer("original_price"),
  badge: text("badge"),
  promoTitle: text("promo_title"),
  promoEndDate: text("promo_end_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Product = typeof productsTable.$inferSelect;
export type InsertProduct = typeof productsTable.$inferInsert;
