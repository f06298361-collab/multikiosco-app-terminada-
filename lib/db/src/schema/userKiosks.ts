import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const userKiosksTable = pgTable(
  "user_kiosks",
  {
    userId: text("user_id").notNull(),
    kioskId: text("kiosk_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.kioskId] }),
  ]
);

export type UserKiosk = typeof userKiosksTable.$inferSelect;
export type InsertUserKiosk = typeof userKiosksTable.$inferInsert;
