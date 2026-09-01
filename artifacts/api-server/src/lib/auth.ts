import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { eq, and, inArray, or } from "drizzle-orm";
import { db, userKiosksTable, kiosksTable, usersTable } from "@workspace/db";

export interface TokenPayload {
  userId: string;
  username: string;
  name: string;
  role: "superadmin" | "admin";
  kioskId?: string;
  assignedKiosks?: KioskInfo[];
  iat: number;
  sessionVersion: number;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

function getAuthSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL DE SEGURIDAD: La variable de entorno JWT_SECRET (o AUTH_SECRET) es obligatoria en entorno de producción."
    );
  }

  return (
    process.env.SUPERADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    "kiosco-franco-secure-secret-key-2026"
  );
}

const userSessionRevocations = new Map<string, number>();

export function revokeUserSessions(userId: string): void {
  userSessionRevocations.set(userId, Date.now());
}

export function hashPassword(
  password: string,
  salt?: string,
): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, actualSalt, 10000, 64, "sha512")
    .toString("hex");
  return { hash, salt: actualSalt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  const calculated = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculated, "hex"),
      Buffer.from(hash, "hex"),
    );
  } catch {
    return false;
  }
}

export function createToken(payload: Omit<TokenPayload, "iat">): string {
  const iat = Date.now();
  const fullPayload: TokenPayload = { ...payload, iat };
  const str = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", getAuthSecret())
    .update(str)
    .digest("base64url");
  return `${str}.${hmac}`;
}

export function verifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encodedPayload, signature] = parts;
  try {
    const expectedHmac = crypto
      .createHmac("sha256", getAuthSecret())
      .update(encodedPayload)
      .digest("base64url");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedHmac),
      )
    ) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );

    // Check revocation timestamp
    const revokedAt = userSessionRevocations.get(payload.userId) || 0;
    if (payload.iat < revokedAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers["x-admin-token"];

  let token: string | undefined;
  if (typeof customHeader === "string") {
    token = customHeader;
  } else if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: "No autorizado. Se requiere autenticación válida.",
    });
    return;
  }

  if (payload.userId) {
    try {
      const [u] = await db
        .select({ active: usersTable.active })
        .from(usersTable)
        .where(eq(usersTable.id, payload.userId))
        .limit(1);

      if (u && u.active === false) {
        res.status(403).json({
          error: "Cuenta de usuario desactivada. Contacte al SuperAdministrador.",
        });
        return;
      }
    } catch {}
  }

  req.user = payload;
  next();
}

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role === "admin" || req.user?.role === "superadmin") {
      next();
    } else {
      res.status(403).json({
        error: "Acceso denegado. Se requiere rol de Administrador o Super Admin.",
      });
    }
  });
}

export async function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role === "superadmin") {
      next();
    } else {
      res.status(403).json({
        error: "Acceso denegado. Operación exclusiva de Super Administrador.",
      });
    }
  });
}

export async function userCanAccessKiosk(
  user: { userId?: string; role?: string; kioskId?: string } | undefined,
  targetKioskId: string
): Promise<boolean> {
  if (!user || !targetKioskId) return false;

  if (user.role === "superadmin") return true;

  if (user.role !== "admin") return false;

  // 1. Direct legacy match
  if (user.kioskId && user.kioskId === targetKioskId) return true;

  // 2. Query user_kiosks table if userId is present
  if (user.userId) {
    try {
      const rows = await db
        .select()
        .from(userKiosksTable)
        .where(
          and(
            eq(userKiosksTable.userId, user.userId),
            eq(userKiosksTable.kioskId, targetKioskId)
          )
        )
        .limit(1);
      if (rows && rows.length > 0) return true;
    } catch (err) {
      console.warn("Error checking user_kiosks table:", err);
    }
  }

  return false;
}

export interface KioskInfo {
  id: string;
  name: string;
  slug: string | null;
  active: boolean;
}

export async function getUserAssignedKiosks(
  userId: string,
  role: string,
  legacyKioskId?: string
): Promise<KioskInfo[]> {
  try {
    if (role === "superadmin") {
      const allKiosks = await db
        .select({
          id: kiosksTable.id,
          name: kiosksTable.name,
          slug: kiosksTable.slug,
          active: kiosksTable.active,
        })
        .from(kiosksTable);
      return allKiosks;
    }

    const assignedIds = new Set<string>();
    if (legacyKioskId) {
      assignedIds.add(legacyKioskId);
    }

    if (userId) {
      const rows = await db
        .select({ kioskId: userKiosksTable.kioskId })
        .from(userKiosksTable)
        .where(eq(userKiosksTable.userId, userId));
      for (const r of rows) {
        if (r.kioskId) assignedIds.add(r.kioskId);
      }
    }

    if (assignedIds.size === 0 && legacyKioskId) {
      assignedIds.add(legacyKioskId);
    }

    if (assignedIds.size === 0) {
      return [];
    }

    const idsArray = Array.from(assignedIds);
    const kiosks = await db
      .select({
        id: kiosksTable.id,
        name: kiosksTable.name,
        slug: kiosksTable.slug,
        active: kiosksTable.active,
      })
      .from(kiosksTable)
      .where(
        idsArray.length === 1
          ? eq(kiosksTable.id, idsArray[0])
          : or(...idsArray.map((id) => eq(kiosksTable.id, id)))
      );

    return kiosks;
  } catch (err) {
    console.error("Error fetching user assigned kiosks:", err);
    return [];
  }
}

export async function ensureSuperAdminSeed(): Promise<void> {
  try {
    const superAdminUsername = (process.env.SUPERADMIN_USERNAME?.trim() || "superadmin").toLowerCase();
    const defaultInitialPassword = process.env.SUPERADMIN_PASSWORD?.trim() || "admin1234";

    const [existingSuperadmin] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "superadmin"))
      .limit(1);

    const { hash, salt } = hashPassword(defaultInitialPassword);

    if (!existingSuperadmin) {
      await db.insert(usersTable).values({
        id: "usr_superadmin",
        username: superAdminUsername,
        name: "Super Administrador",
        passwordHash: hash,
        salt,
        role: "superadmin",
        kioskId: null,
        active: true,
      });
      console.log(`[Auth] SuperAdmin account initialized in database as @${superAdminUsername}`);
    } else {
      // Synchronize password with configured or default initial password (admin1234) and ensure active
      await db
        .update(usersTable)
        .set({
          passwordHash: hash,
          salt,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.role, "superadmin"));
      console.log(`[Auth] SuperAdmin password synchronized successfully for @${existingSuperadmin.username}`);
    }
  } catch (err) {
    console.warn("[Auth] Notice ensuring SuperAdmin seed:", err);
  }
}


