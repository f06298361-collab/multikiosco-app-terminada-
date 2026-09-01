import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { Pool } = pg;

export let pool: pg.Pool | null = null;
export let db: any = null;

const DEFAULT_SETTINGS = {
  id: "default",
  shopName: "Kiosco Franco",
  whatsappNumber: "5493437449728",
  mercadoPagoAlias: "franco.mp",
  mercadoPagoQr: null,
};

const DEFAULT_KIOSK = {
  id: "kiosk-franco",
  name: "Kiosco Franco",
  slug: "kiosco-franco",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function getStorageFilePath(): string {
  const rootData = path.resolve(__dirname, "../../../.data/local_db_store.json");
  const cwdData = path.resolve(process.cwd(), ".data/local_db_store.json");
  if (fs.existsSync(rootData)) return rootData;
  if (fs.existsSync(cwdData)) return cwdData;
  return rootData;
}

const storageFilePath = getStorageFilePath();

function loadStoreFromFile(): Record<string, any[]> {
  try {
    if (fs.existsSync(storageFilePath)) {
      const content = fs.readFileSync(storageFilePath, "utf-8");
      if (content.trim()) {
        const parsed = JSON.parse(content);
        return {
          settings: Array.isArray(parsed.settings) ? parsed.settings : [{ ...DEFAULT_SETTINGS }],
          products: Array.isArray(parsed.products) ? parsed.products : [],
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
          kiosks: Array.isArray(parsed.kiosks) ? parsed.kiosks : [{ ...DEFAULT_KIOSK }],
          users: Array.isArray(parsed.users) ? parsed.users : [],
          user_kiosks: Array.isArray(parsed.user_kiosks) ? parsed.user_kiosks : [],
          admin_invitations: Array.isArray(parsed.admin_invitations) ? parsed.admin_invitations : [],
        };
      }
    }
  } catch (err) {
    console.warn("[Local DB] Could not read from storage file:", err);
  }
  return {
    settings: [{ ...DEFAULT_SETTINGS }],
    products: [],
    orders: [],
    kiosks: [{ ...DEFAULT_KIOSK }],
    users: [],
    user_kiosks: [],
    admin_invitations: [],
  };
}

const inMemoryStore: Record<string, any[]> = loadStoreFromFile();

function saveStoreToFile() {
  try {
    const dir = path.dirname(storageFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storageFilePath, JSON.stringify(inMemoryStore, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Local DB] Could not write to storage file:", err);
  }
}

function getTableName(tableObj: any): string {
  if (tableObj && typeof tableObj === "object") {
    if ((tableObj as any)[Symbol.for("drizzle:Name")]) {
      return (tableObj as any)[Symbol.for("drizzle:Name")];
    }
    if ((tableObj as any)[Symbol.for("drizzle:OriginalName")]) {
      return (tableObj as any)[Symbol.for("drizzle:OriginalName")];
    }
    if ((tableObj as any)._?.name) {
      return (tableObj as any)._?.name;
    }
    for (const [key, val] of Object.entries(schema)) {
      if (val === tableObj) {
        if (key === "userKiosksTable") return "user_kiosks";
        if (key === "adminInvitationsTable") return "admin_invitations";
        return key.replace("Table", "");
      }
    }
  }
  return "settings";
}

function extractVal(val: any): any {
  if (val && typeof val === "object" && "value" in val) {
    return val.value;
  }
  return val;
}

function getItemValue(item: any, rawKey: string): any {
  if (!item || typeof item !== "object") return undefined;
  if (item[rawKey] !== undefined) return item[rawKey];
  const camelKey = rawKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  if (item[camelKey] !== undefined) return item[camelKey];
  const snakeKey = rawKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  if (item[snakeKey] !== undefined) return item[snakeKey];
  return undefined;
}

function evaluateSingleCondition(item: any, rawKey: string, expected: any): boolean {
  const actual = getItemValue(item, rawKey);
  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  if (expected === undefined || expected === null) {
    return actual === null || actual === undefined;
  }
  return actual === expected;
}

function matchesCondition(item: any, condition: any): boolean {
  if (!condition) return true;

  if (condition.left && condition.right !== undefined) {
    const rawKey =
      condition.left.name ||
      condition.left.columnName ||
      condition.left.keyAsName ||
      "id";
    const expected = extractVal(condition.right);
    return evaluateSingleCondition(item, rawKey, expected);
  }

  if (Array.isArray(condition.conditions)) {
    return condition.conditions.every((c: any) => matchesCondition(item, c));
  }

  if (condition.queryChunks && Array.isArray(condition.queryChunks)) {
    let col: string | null = null;
    let expected: any = undefined;
    let hasParam = false;
    const subSqls: any[] = [];
    let op = "and";

    for (const chunk of condition.queryChunks) {
      if (!chunk) continue;
      if (chunk.name || chunk.columnName) {
        col = chunk.name || chunk.columnName;
      } else if (chunk.constructor?.name === "Param" || (chunk && typeof chunk === "object" && "value" in chunk && chunk.constructor?.name !== "StringChunk" && chunk.constructor?.name !== "SQL" && !Array.isArray(chunk.value))) {
        expected = chunk.value;
        hasParam = true;
      } else if (chunk.queryChunks) {
        subSqls.push(chunk);
      } else if (chunk.value && Array.isArray(chunk.value)) {
        const text = chunk.value.join(" ");
        if (text.includes(" OR ") || text.includes(" or ")) {
          op = "or";
        }
      }
    }

    if (col && hasParam) {
      return evaluateSingleCondition(item, col, expected);
    }

    if (subSqls.length > 0) {
      if (op === "or") {
        return subSqls.some((sub: any) => matchesCondition(item, sub));
      }
      return subSqls.every((sub: any) => matchesCondition(item, sub));
    }

    return false;
  }

  return false;
}

function createMockDb() {
  return {
    select: (_fields?: any) => {
      let targetTable = "settings";
      let filterFn: ((item: any) => boolean) | null = null;
      let limitNum: number | null = null;

      const chain: any = {
        from: (table: any) => {
          targetTable = getTableName(table);
          return chain;
        },
        where: (condition: any) => {
          if (condition) {
            filterFn = (item: any) => matchesCondition(item, condition);
          }
          return chain;
        },
        orderBy: () => chain,
        limit: (n: number) => {
          limitNum = n;
          return chain;
        },
        then: (resolve: any, reject: any) => {
          try {
            let items = inMemoryStore[targetTable] || [];
            if (filterFn) {
              items = items.filter(filterFn);
            }
            if (limitNum !== null) {
              items = items.slice(0, limitNum);
            }
            resolve(items);
          } catch (e) {
            reject(e);
          }
        },
        catch: (reject: any) => chain.then((x: any) => x, reject),
      };
      return chain;
    },
    insert: (table: any) => {
      const targetTable = getTableName(table);
      let valuesToInsert: any[] = [];

      const chain: any = {
        values: (vals: any) => {
          valuesToInsert = Array.isArray(vals) ? vals : [vals];
          return chain;
        },
        onConflictDoNothing: () => chain,
        onConflictDoUpdate: () => chain,
        returning: () => chain,
        then: (resolve: any) => {
          const tableStore = inMemoryStore[targetTable] || (inMemoryStore[targetTable] = []);
          const added = valuesToInsert.map((v) => ({
            createdAt: new Date(),
            ...v,
          }));
          tableStore.push(...added);
          saveStoreToFile();
          resolve(added);
        },
        catch: (reject: any) => chain.then((x: any) => x, reject),
      };
      return chain;
    },
    update: (table: any) => {
      const targetTable = getTableName(table);
      let updates: any = {};
      let filterFn: ((item: any) => boolean) | null = null;

      const chain: any = {
        set: (vals: any) => {
          updates = vals;
          return chain;
        },
        where: (condition: any) => {
          if (condition) {
            filterFn = (item: any) => matchesCondition(item, condition);
          }
          return chain;
        },
        returning: () => chain,
        then: (resolve: any) => {
          const tableStore = inMemoryStore[targetTable] || [];
          const updated: any[] = [];
          for (let i = 0; i < tableStore.length; i++) {
            if (!filterFn || filterFn(tableStore[i])) {
              tableStore[i] = { ...tableStore[i], ...updates };
              updated.push(tableStore[i]);
            }
          }
          saveStoreToFile();
          resolve(updated);
        },
        catch: (reject: any) => chain.then((x: any) => x, reject),
      };
      return chain;
    },
    delete: (table: any) => {
      const targetTable = getTableName(table);
      let filterFn: ((item: any) => boolean) | null = null;

      const chain: any = {
        where: (condition: any) => {
          if (condition) {
            filterFn = (item: any) => matchesCondition(item, condition);
          }
          return chain;
        },
        returning: () => chain,
        then: (resolve: any) => {
          const tableStore = inMemoryStore[targetTable] || [];
          const deleted: any[] = [];
          inMemoryStore[targetTable] = tableStore.filter((item) => {
            if (!filterFn || filterFn(item)) {
              deleted.push(item);
              return false;
            }
            return true;
          });
          saveStoreToFile();
          resolve(deleted);
        },
        catch: (reject: any) => chain.then((x: any) => x, reject),
      };
      return chain;
    },
  };
}

if (process.env.DATABASE_URL) {
  try {
    const connectionString = process.env.DATABASE_URL;
    const isLocal =
      connectionString.includes("localhost") ||
      connectionString.includes("127.0.0.1") ||
      connectionString.includes("sslmode=disable");

    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
    db = drizzle(pool, { schema });

    // Auto-migrate missing columns for existing tables
    (async () => {
      try {
        const client = await pool.connect();
        try {
          await client.query("BEGIN;");
          await client.query("SELECT pg_advisory_xact_lock(71829312);");
          await client.query(`
            CREATE TABLE IF NOT EXISTS kiosks (
              id text PRIMARY KEY,
              name text NOT NULL,
              slug text UNIQUE,
              owner_name text,
              owner_email text,
              owner_phone text,
              active boolean NOT NULL DEFAULT true,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS settings (
              id text PRIMARY KEY,
              shop_name text NOT NULL,
              whatsapp_number text NOT NULL,
              mercado_pago_alias text NOT NULL DEFAULT '',
              mercado_pago_qr text,
              description text,
              logo_url text,
              welcome_message text,
              theme_style text DEFAULT 'modern',
              theme_color text DEFAULT 'sky',
              banner_url text,
              welcome_msg_type text DEFAULT 'custom',
              instagram_url text,
              facebook_url text,
              address text,
              business_hours text,
              delivery_info text,
              payment_methods text
            );

            CREATE TABLE IF NOT EXISTS products (
              id text PRIMARY KEY,
              kiosk_id text NOT NULL DEFAULT 'kiosk-franco',
              name text NOT NULL,
              price integer NOT NULL,
              category text NOT NULL,
              emoji text NOT NULL DEFAULT '📦',
              image text,
              available boolean NOT NULL DEFAULT true,
              description text,
              original_price integer,
              badge text,
              promo_title text,
              promo_end_date text,
              created_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS orders (
              id text PRIMARY KEY,
              order_number integer NOT NULL DEFAULT 1,
              kiosk_id text NOT NULL DEFAULT 'kiosk-franco',
              customer_name text NOT NULL,
              address text NOT NULL DEFAULT '',
              delivery text NOT NULL,
              payment text NOT NULL,
              items jsonb NOT NULL,
              total integer NOT NULL,
              status text NOT NULL DEFAULT 'nuevo',
              created_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS kiosk_order_counters (
              kiosk_id text PRIMARY KEY,
              last_order_number integer NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS users (
              id text PRIMARY KEY,
              username text NOT NULL UNIQUE,
              name text NOT NULL,
              password_hash text NOT NULL,
              salt text NOT NULL,
              role text NOT NULL DEFAULT 'admin',
              kiosk_id text,
              active boolean NOT NULL DEFAULT true,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS user_kiosks (
              user_id text NOT NULL,
              kiosk_id text NOT NULL,
              created_at timestamptz NOT NULL DEFAULT now(),
              PRIMARY KEY (user_id, kiosk_id)
            );

            CREATE TABLE IF NOT EXISTS admin_invitations (
              id text PRIMARY KEY,
              email text NOT NULL,
              name text NOT NULL,
              kiosk_id text NOT NULL,
              token_hash text NOT NULL,
              expires_at timestamptz NOT NULL,
              accepted_at timestamptz,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );

            ALTER TABLE settings ADD COLUMN IF NOT EXISTS theme_style text DEFAULT 'modern';
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS theme_color text DEFAULT 'sky';
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS banner_url text;
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS welcome_msg_type text DEFAULT 'custom';
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS instagram_url text;
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS facebook_url text;
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS address text;
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS business_hours text;
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS delivery_info text;
            ALTER TABLE settings ADD COLUMN IF NOT EXISTS payment_methods text;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS available boolean DEFAULT true;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS badge text;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price integer;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_title text;
            ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_end_date text;
            ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS slug text;
            ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
            ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS owner_name text;
            ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS owner_email text;
            ALTER TABLE kiosks ADD COLUMN IF NOT EXISTS owner_phone text;
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number integer;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS kiosk_id text;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

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

            INSERT INTO kiosk_order_counters (kiosk_id, last_order_number)
            SELECT kiosk_id, COALESCE(MAX(order_number), 0)
            FROM orders
            GROUP BY kiosk_id
            ON CONFLICT (kiosk_id) DO UPDATE
            SET last_order_number = GREATEST(kiosk_order_counters.last_order_number, EXCLUDED.last_order_number);

            INSERT INTO user_kiosks (user_id, kiosk_id)
            SELECT id, kiosk_id FROM users WHERE role = 'admin' AND kiosk_id IS NOT NULL
            ON CONFLICT (user_id, kiosk_id) DO NOTHING;
          `);
          await client.query("COMMIT;");
        } catch (mErr) {
          await client.query("ROLLBACK;").catch(() => {});
          console.warn("[AI Studio] Schema auto-migration notice:", mErr);
        } finally {
          client.release();
        }
      } catch (poolErr) {
        console.warn("[AI Studio] Auto-migration connection error:", poolErr);
      }
    })();
  } catch (err) {
    console.warn("[AI Studio] Failed to initialize DB pool:", err);
  }
}

if (!db) {
  console.warn("[AI Studio] DATABASE_URL not set or DB offline — using in-memory store fallback");
  db = createMockDb();
}

export * from "./schema";


