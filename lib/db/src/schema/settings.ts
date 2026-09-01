import { pgTable, text } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: text("id").primaryKey(),
  shopName: text("shop_name").notNull(),
  whatsappNumber: text("whatsapp_number").notNull(),
  mercadoPagoAlias: text("mercado_pago_alias").notNull().default(""),
  mercadoPagoQr: text("mercado_pago_qr"),
  description: text("description"),
  logoUrl: text("logo_url"),
  welcomeMessage: text("welcome_message"),
  themeStyle: text("theme_style").default("modern"),
  themeColor: text("theme_color").default("sky"),
  bannerUrl: text("banner_url"),
  welcomeMsgType: text("welcome_msg_type").default("custom"),
  instagramUrl: text("instagram_url"),
  facebookUrl: text("facebook_url"),
  address: text("address"),
  businessHours: text("business_hours"),
  deliveryInfo: text("delivery_info"),
  paymentMethods: text("payment_methods"),
});

export type Settings = typeof settingsTable.$inferSelect;

