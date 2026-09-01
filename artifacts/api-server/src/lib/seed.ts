import { eq, or } from "drizzle-orm";
import { db, pool, productsTable, settingsTable, kiosksTable, usersTable } from "@workspace/db";
import { logger } from "./logger";
import { hashPassword } from "./auth";

const DEFAULT_PRODUCTS = [
  { id: "p1", kioskId: "kiosk-franco", name: "Coca Cola 1.5L", price: 2200, category: "Bebidas", emoji: "🥤" },
  { id: "p2", kioskId: "kiosk-franco", name: "Agua Mineral 500ml", price: 800, category: "Bebidas", emoji: "💧" },
  { id: "p3", kioskId: "kiosk-franco", name: "Cerveza Quilmes 1L", price: 2800, category: "Bebidas", emoji: "🍺" },
  { id: "p4", kioskId: "kiosk-franco", name: "Fernet Branca 750ml", price: 9500, category: "Bebidas", emoji: "🥃" },
  { id: "p5", kioskId: "kiosk-franco", name: "Papas Lays 150g", price: 1800, category: "Snacks", emoji: "🍟" },
  { id: "p6", kioskId: "kiosk-franco", name: "Doritos 100g", price: 1500, category: "Snacks", emoji: "🌽" },
  { id: "p7", kioskId: "kiosk-franco", name: "Chocolate Milka", price: 2100, category: "Golosinas", emoji: "🍫" },
  { id: "p8", kioskId: "kiosk-franco", name: "Alfajor Jorgito", price: 600, category: "Golosinas", emoji: "🍪" },
  { id: "p9", kioskId: "kiosk-franco", name: "Chicles Beldent", price: 450, category: "Golosinas", emoji: "🍬" },
  { id: "p10", kioskId: "kiosk-franco", name: "Cigarrillos Marlboro", price: 3500, category: "Cigarrillos", emoji: "🚬" },
  { id: "p11", kioskId: "kiosk-franco", name: "Pan Lactal Bimbo", price: 2400, category: "Almacén", emoji: "🍞" },
  { id: "p12", kioskId: "kiosk-franco", name: "Helado Frigor 1L", price: 5200, category: "Helados", emoji: "🍦" },
];

const DEFAULT_KIOSK = {
  id: "kiosk-franco",
  name: "Kiosco Franco",
  slug: "kiosco-franco",
  active: true,
};

const DEFAULT_SETTINGS = {
  id: "default",
  shopName: "Kiosco Franco",
  whatsappNumber: "5493437449728",
  mercadoPagoAlias: "franco.mp",
};

export async function ensureSeedData(): Promise<void> {
  if (pool) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS kiosks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE,
          active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE products ADD COLUMN IF NOT EXISTS kiosk_id TEXT NOT NULL DEFAULT 'kiosk-franco';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS available BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price INTEGER;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_title TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_end_date TEXT;

        ALTER TABLE orders ADD COLUMN IF NOT EXISTS kiosk_id TEXT NOT NULL DEFAULT 'kiosk-franco';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INTEGER;

        CREATE TABLE IF NOT EXISTS kiosk_order_counters (
          kiosk_id TEXT PRIMARY KEY,
          last_order_number INTEGER NOT NULL DEFAULT 0
        );

        -- Backfill existing orders with sequential order numbers if needed
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM orders WHERE order_number IS NULL) THEN
            WITH numbered AS (
              SELECT id, ROW_NUMBER() OVER (PARTITION BY kiosk_id ORDER BY created_at ASC) as rn
              FROM orders
              WHERE order_number IS NULL
            )
            UPDATE orders
            SET order_number = numbered.rn
            FROM numbered
            WHERE orders.id = numbered.id;
          END IF;
        END $$;

        -- Initialize counters with current max order numbers per kiosk
        INSERT INTO kiosk_order_counters (kiosk_id, last_order_number)
        SELECT kiosk_id, COALESCE(MAX(order_number), 0)
        FROM orders
        GROUP BY kiosk_id
        ON CONFLICT (kiosk_id) DO UPDATE
        SET last_order_number = GREATEST(kiosk_order_counters.last_order_number, EXCLUDED.last_order_number);

        ALTER TABLE users ADD COLUMN IF NOT EXISTS kiosk_id TEXT;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS welcome_message TEXT;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS theme_style TEXT DEFAULT 'modern';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'sky';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS banner_url TEXT;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS welcome_msg_type TEXT DEFAULT 'custom';
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS instagram_url TEXT;
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS facebook_url TEXT;
      `);
      logger.info("Executed multikiosk table & column migrations safely");
    } catch (e) {
      logger.warn({ err: e }, "Failed to auto-create multikiosk tables or migration columns");
    }
  }

  // Products table verification without seeding dummy demo data
  logger.info("Database structure verified");

  const existingSuperadmin = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "superadmin"))
    .limit(1);

  if (existingSuperadmin.length === 0) {
    const superadminPass = process.env.SUPERADMIN_PASSWORD?.trim() || "admin1234";
    const superadminUsername = process.env.SUPERADMIN_USERNAME?.trim() || "superadmin";
    const { hash, salt } = hashPassword(superadminPass);
    await db.insert(usersTable).values({
      id: "usr-superadmin-init",
      username: superadminUsername,
      name: "Super Administrador",
      passwordHash: hash,
      salt: salt,
      role: "superadmin",
      active: true,
    });
    logger.info("Seeded default superadmin user into database");
  }
}

