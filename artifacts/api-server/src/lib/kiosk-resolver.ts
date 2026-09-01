import type { Request } from "express";
import { eq, or } from "drizzle-orm";
import { db, kiosksTable } from "@workspace/db";

export interface ResolvedKiosk {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  exists: boolean;
}

export async function resolveKioskFromRequest(req: Request): Promise<ResolvedKiosk> {
  // 1. Raw parameter from query or body or headers
  const rawParam =
    (req.query.kiosk as string) ||
    (req.query.kioskId as string) ||
    (req.query.kiosk_id as string) ||
    (req.headers["x-kiosk-id"] as string) ||
    (req.body && typeof req.body === "object" ? req.body.kioskId || req.body.kiosk : undefined);

  let targetIdentifier = typeof rawParam === "string" && rawParam.trim() ? rawParam.trim() : null;

  // 2. Subdomain extraction from Host / X-Forwarded-Host header if no query/body param
  if (!targetIdentifier) {
    const hostHeader = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
    const host = hostHeader.split(":")[0].toLowerCase();
    const parts = host.split(".");
    const isReplitHost =
      host === "replit.dev" ||
      host.endsWith(".replit.dev") ||
      host === "replit.app" ||
      host.endsWith(".replit.app");
    if (parts.length >= 2) {
      const sub = parts[0];
      const ignored = ["www", "app", "dev", "api", "localhost", "127", "0"];
      const isIgnored =
        isReplitHost ||
        ignored.some((ign) => sub === ign || sub.startsWith("ais-dev-") || sub.startsWith("ais-pre-"));
      if (!isIgnored && sub) {
        targetIdentifier = sub;
      }
    }
  }

  try {
    let foundKiosk: typeof kiosksTable.$inferSelect | undefined;

    if (targetIdentifier) {
      const cleanSlug = targetIdentifier
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

      // 1. Direct match by ID
      const [byId] = await db
        .select()
        .from(kiosksTable)
        .where(eq(kiosksTable.id, targetIdentifier))
        .limit(1);
      if (byId) foundKiosk = byId;

      // 2. Direct match by exact slug
      if (!foundKiosk && cleanSlug) {
        const [bySlug] = await db
          .select()
          .from(kiosksTable)
          .where(eq(kiosksTable.slug, cleanSlug))
          .limit(1);
        if (bySlug) foundKiosk = bySlug;
      }

      // 3. Match by raw identifier as slug
      if (!foundKiosk) {
        const [byRawSlug] = await db
          .select()
          .from(kiosksTable)
          .where(eq(kiosksTable.slug, targetIdentifier.toLowerCase()))
          .limit(1);
        if (byRawSlug) foundKiosk = byRawSlug;
      }
    } else {
      // If no identifier provided, pick the first active kiosk in the database
      const [firstActive] = await db
        .select()
        .from(kiosksTable)
        .where(eq(kiosksTable.active, true))
        .limit(1);
      if (firstActive) {
        foundKiosk = firstActive;
      } else {
        const [anyKiosk] = await db
          .select()
          .from(kiosksTable)
          .limit(1);
        if (anyKiosk) foundKiosk = anyKiosk;
      }
    }

    if (foundKiosk) {
      return {
        id: foundKiosk.id,
        name: foundKiosk.name,
        slug: foundKiosk.slug || foundKiosk.id,
        active: foundKiosk.active !== false,
        exists: true,
      };
    }
  } catch (err) {
    console.error("Error resolving kiosk:", err);
  }

  return {
    id: targetIdentifier || "",
    name: targetIdentifier || "",
    slug: targetIdentifier || "",
    active: false,
    exists: false,
  };
}
