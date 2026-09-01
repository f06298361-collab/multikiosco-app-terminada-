import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminInvitationsTable = pgTable("admin_invitations", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  kioskId: text("kiosk_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AdminInvitation = typeof adminInvitationsTable.$inferSelect;
export type InsertAdminInvitation = typeof adminInvitationsTable.$inferInsert;
