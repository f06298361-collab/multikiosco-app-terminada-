import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const kiosksTable = pgTable("kiosks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  ownerName: text("owner_name"),
  ownerEmail: text("owner_email"),
  ownerPhone: text("owner_phone"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Kiosk = typeof kiosksTable.$inferSelect;
export type InsertKiosk = typeof kiosksTable.$inferInsert;
