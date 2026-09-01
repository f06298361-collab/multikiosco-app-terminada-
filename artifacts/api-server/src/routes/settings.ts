import { Router, type IRouter, type Request, type Response } from "express";
import { eq, or } from "drizzle-orm";
import { db, settingsTable, kiosksTable } from "@workspace/db";
import {
  requireAdmin,
  userCanAccessKiosk,
  verifyToken,
  type AuthRequest,
} from "../lib/auth";
import { resolveKioskFromRequest } from "../lib/kiosk-resolver";

const router: IRouter = Router();

async function canAccessInactiveKiosk(req: Request, kioskId: string): Promise<boolean> {
  const customHeader = req.headers["x-admin-token"];
  const authorization = req.headers.authorization;
  const token =
    typeof customHeader === "string"
      ? customHeader
      : authorization?.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : undefined;
  const user = verifyToken(token);
  return user ? userCanAccessKiosk(user, kioskId) : false;
}

async function rejectInactivePublicKiosk(
  req: Request,
  res: Response,
  kiosk: Awaited<ReturnType<typeof resolveKioskFromRequest>>,
): Promise<boolean> {
  if (
    kiosk.active === false &&
    !(await canAccessInactiveKiosk(req, kiosk.id))
  ) {
    res.status(403).json({
      error: "Este kiosco se encuentra inactivo y no está disponible públicamente.",
    });
    return true;
  }
  return false;
}

const DEFAULT_SETTINGS = {
  shopName: "Kiosco Franco",
  whatsappNumber: "5493437449728",
  mercadoPagoAlias: "franco.mp",
};

export async function ensureSettingsForKiosk(kioskId: string) {
  try {
    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, kioskId));
    if (row) return row;

    let kioskName = "";
    let kioskFound = false;
    try {
      const [kiosk] = await db
        .select()
        .from(kiosksTable)
        .where(or(eq(kiosksTable.id, kioskId), eq(kiosksTable.slug, kioskId)))
        .limit(1);
      if (kiosk) {
        kioskFound = true;
        kioskName = kiosk.name;
      }
    } catch {}

    if (!kioskFound) {
      return null;
    }

    const initialData = {
      id: kioskId,
      shopName: kioskName || "Mi Negocio",
      whatsappNumber: "",
      mercadoPagoAlias: "",
      mercadoPagoQr: null,
      welcomeMessage: `¡Bienvenidos a ${kioskName || "nuestra tienda"}! Realizá tu pedido online.`,
      description: null,
      logoUrl: null,
    };

    const [created] = await db
      .insert(settingsTable)
      .values(initialData)
      .returning();
    if (created) return created;
  } catch (err) {
    console.error("Error in ensureSettingsForKiosk:", err);
  }

  return null;
}

router.get("/settings", async (req, res): Promise<void> => {
  const kiosk = await resolveKioskFromRequest(req);
  if (!kiosk.exists) {
    res.status(404).json({ error: "El kiosco solicitado no existe." });
    return;
  }
  if (await rejectInactivePublicKiosk(req, res, kiosk)) return;
  const row = await ensureSettingsForKiosk(kiosk.id);
  if (!row) {
    res.status(404).json({ error: "El kiosco solicitado no existe." });
    return;
  }

  const resolvedShopName = row.shopName || kiosk.name || "Mi Tienda";

  res.json({
    kioskId: kiosk.id,
    shopName: resolvedShopName,
    whatsappNumber: row.whatsappNumber || "",
    mercadoPagoAlias: row.mercadoPagoAlias || "",
    mercadoPagoQr: row.mercadoPagoQr || null,
    welcomeMessage: (row as any).welcomeMessage || null,
    description: (row as any).description || null,
    logoUrl: (row as any).logoUrl || null,
    themeStyle: (row as any).themeStyle || "modern",
    themeColor: (row as any).themeColor || "sky",
    bannerUrl: (row as any).bannerUrl || null,
    welcomeMsgType: (row as any).welcomeMsgType || "custom",
    instagramUrl: (row as any).instagramUrl || null,
    facebookUrl: (row as any).facebookUrl || null,
    address: (row as any).address || null,
    businessHours: (row as any).businessHours || null,
    deliveryInfo: (row as any).deliveryInfo || null,
    paymentMethods: (row as any).paymentMethods || null,
    name: kiosk.name || resolvedShopName,
    slug: kiosk.slug || "",
    active: kiosk.active,
    exists: kiosk.exists,
  });
});

router.get(["/manifest.json"], async (req, res): Promise<void> => {
  const kiosk = await resolveKioskFromRequest(req);
  if (!kiosk.exists) {
    res.status(404).json({ error: "El kiosco solicitado no existe." });
    return;
  }
  if (await rejectInactivePublicKiosk(req, res, kiosk)) return;
  const row = await ensureSettingsForKiosk(kiosk.id);
  if (!row) {
    res.status(404).json({ error: "El kiosco solicitado no existe." });
    return;
  }
  const shopName = row.shopName || kiosk.name || DEFAULT_SETTINGS.shopName;
  const description = (row as any).description || "Pedidos online y catálogo de productos";
  const slug = kiosk.slug || kiosk.id;

  res.setHeader("Content-Type", "application/manifest+json");
  res.json({
    name: shopName,
    short_name: shopName.length > 15 ? shopName.slice(0, 15) : shopName,
    description,
    id: `/?kiosk=${encodeURIComponent(slug)}`,
    start_url: `/?kiosk=${encodeURIComponent(slug)}`,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0284c7",
    icons: [
      {
        src: `/api/kiosk-icon?kiosk=${encodeURIComponent(slug)}&size=192`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: `/api/kiosk-icon?kiosk=${encodeURIComponent(slug)}&size=512`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  });
});

router.get("/kiosk-icon", async (req, res): Promise<void> => {
  const kiosk = await resolveKioskFromRequest(req);
  if (!kiosk.exists) {
    res.status(404).json({ error: "El kiosco solicitado no existe." });
    return;
  }
  if (await rejectInactivePublicKiosk(req, res, kiosk)) return;
  const row = await ensureSettingsForKiosk(kiosk.id);
  if (!row) {
    res.status(404).json({ error: "El kiosco solicitado no existe." });
    return;
  }
  const logoUrl = (row as any).logoUrl;

  if (logoUrl && typeof logoUrl === "string" && logoUrl.startsWith("data:image/")) {
    try {
      const match = logoUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        const imgBuffer = Buffer.from(base64Data, "base64");
        res.setHeader("Content-Type", mimeType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.send(imgBuffer);
        return;
      }
    } catch {}
  }

  const name = row.shopName || kiosk.name || "Kiosco";
  const initial = name.trim().charAt(0).toUpperCase() || "K";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#0284c7" />
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="220" font-weight="bold">${initial}</text>
  <text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle" fill="#e0f2fe" font-family="sans-serif" font-size="42" font-weight="600">KIOSCO</text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(svg);
});

router.put("/settings", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const explicitBodyId = typeof req.body?.kioskId === "string" && req.body.kioskId.trim() ? req.body.kioskId.trim() : null;
  const explicitQueryId = (req.query.kiosk as string) || (req.query.kioskId as string) || (req.headers["x-kiosk-id"] as string) || null;

  let targetKioskId: string;
  if (explicitBodyId) {
    targetKioskId = explicitBodyId;
  } else if (explicitQueryId) {
    targetKioskId = explicitQueryId;
  } else {
    const userPrimaryKiosk = req.user?.kioskId || (req.user?.assignedKiosks?.[0]?.id);
    if (userPrimaryKiosk) {
      targetKioskId = userPrimaryKiosk;
    } else {
      const resolvedKiosk = await resolveKioskFromRequest(req);
      targetKioskId = resolvedKiosk.id;
    }
  }

  const [existingKiosk] = await db
    .select()
    .from(kiosksTable)
    .where(or(eq(kiosksTable.id, targetKioskId), eq(kiosksTable.slug, targetKioskId)))
    .limit(1);

  if (!existingKiosk) {
    res.status(404).json({ error: "El kiosco especificado no existe." });
    return;
  }

  const allowed = await userCanAccessKiosk(req.user, targetKioskId);
  if (!allowed) {
    res.status(403).json({
      error: "Acceso denegado. No tiene permisos para modificar la configuración de este kiosco.",
    });
    return;
  }

  const {
    shopName,
    whatsappNumber,
    mercadoPagoAlias,
    mercadoPagoQr,
    welcomeMessage,
    description,
    logoUrl,
    themeStyle,
    themeColor,
    bannerUrl,
    welcomeMsgType,
    instagramUrl,
    facebookUrl,
    address,
    businessHours,
    deliveryInfo,
    paymentMethods,
    name,
    slug,
    active,
  } = req.body || {};

  await ensureSettingsForKiosk(targetKioskId);

  const settingsDataToUpdate: Record<string, any> = {};
  if (typeof shopName === "string" && shopName.trim()) {
    settingsDataToUpdate.shopName = shopName.trim();
  } else if (typeof name === "string" && name.trim()) {
    settingsDataToUpdate.shopName = name.trim();
  }
  if (typeof whatsappNumber === "string") {
    settingsDataToUpdate.whatsappNumber = whatsappNumber.trim();
  }
  if (typeof mercadoPagoAlias === "string") {
    settingsDataToUpdate.mercadoPagoAlias = mercadoPagoAlias.trim();
  }
  if (typeof mercadoPagoQr === "string" || mercadoPagoQr === null) {
    settingsDataToUpdate.mercadoPagoQr = mercadoPagoQr;
  }
  if (typeof welcomeMessage === "string" || welcomeMessage === null) {
    settingsDataToUpdate.welcomeMessage = welcomeMessage;
  }
  if (typeof description === "string" || description === null) {
    settingsDataToUpdate.description = description;
  }
  if (typeof logoUrl === "string" || logoUrl === null) {
    settingsDataToUpdate.logoUrl = logoUrl;
  }
  if (typeof themeStyle === "string") {
    settingsDataToUpdate.themeStyle = themeStyle;
  }
  if (typeof themeColor === "string") {
    settingsDataToUpdate.themeColor = themeColor;
  }
  if (typeof bannerUrl === "string" || bannerUrl === null) {
    settingsDataToUpdate.bannerUrl = bannerUrl;
  }
  if (typeof welcomeMsgType === "string") {
    settingsDataToUpdate.welcomeMsgType = welcomeMsgType;
  }
  if (typeof instagramUrl === "string" || instagramUrl === null) {
    settingsDataToUpdate.instagramUrl = instagramUrl;
  }
  if (typeof facebookUrl === "string" || facebookUrl === null) {
    settingsDataToUpdate.facebookUrl = facebookUrl;
  }
  if (typeof address === "string" || address === null) {
    settingsDataToUpdate.address = address;
  }
  if (typeof businessHours === "string" || businessHours === null) {
    settingsDataToUpdate.businessHours = businessHours;
  }
  if (typeof deliveryInfo === "string" || deliveryInfo === null) {
    settingsDataToUpdate.deliveryInfo = deliveryInfo;
  }
  if (typeof paymentMethods === "string" || paymentMethods === null) {
    settingsDataToUpdate.paymentMethods = paymentMethods;
  }

  try {
    if (Object.keys(settingsDataToUpdate).length > 0) {
      await db
        .update(settingsTable)
        .set(settingsDataToUpdate)
        .where(eq(settingsTable.id, targetKioskId));

      if (targetKioskId === "kiosk-franco") {
        try {
          await db
            .update(settingsTable)
            .set(settingsDataToUpdate)
            .where(eq(settingsTable.id, "default"));
        } catch {}
      }
    }
  } catch (err) {
    console.error("Error updating settingsTable:", err);
  }

  const kioskDataToUpdate: Record<string, any> = { updatedAt: new Date() };
  if (typeof name === "string" && name.trim()) {
    kioskDataToUpdate.name = name.trim();
  } else if (typeof shopName === "string" && shopName.trim()) {
    kioskDataToUpdate.name = shopName.trim();
  }
  if (typeof slug === "string" && slug.trim()) {
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    try {
      const existing = await db
        .select({ id: kiosksTable.id })
        .from(kiosksTable)
        .where(eq(kiosksTable.slug, cleanSlug))
        .limit(1);
      if (existing.length === 0 || existing[0].id === targetKioskId) {
        kioskDataToUpdate.slug = cleanSlug;
      }
    } catch {}
  }
  if (typeof active === "boolean") {
    kioskDataToUpdate.active = active;
  }

  let updatedKiosk;
  try {
    if (Object.keys(kioskDataToUpdate).length > 1) {
      const [kRes] = await db
        .update(kiosksTable)
        .set(kioskDataToUpdate)
        .where(eq(kiosksTable.id, targetKioskId))
        .returning();
      updatedKiosk = kRes;
    }
  } catch (err) {
    console.error("Error updating kiosksTable:", err);
  }

  const finalSettings = (await ensureSettingsForKiosk(targetKioskId)) || {
    id: targetKioskId,
    shopName: updatedKiosk?.name || "Kiosco",
    whatsappNumber: "",
    mercadoPagoAlias: "",
    mercadoPagoQr: null,
    welcomeMessage: null,
  };

  res.json({
    ok: true,
    kioskId: targetKioskId,
    shopName: finalSettings.shopName,
    whatsappNumber: finalSettings.whatsappNumber,
    mercadoPagoAlias: finalSettings.mercadoPagoAlias,
    mercadoPagoQr: finalSettings.mercadoPagoQr || null,
    welcomeMessage: (finalSettings as any).welcomeMessage || null,
    description: (finalSettings as any).description || null,
    logoUrl: (finalSettings as any).logoUrl || null,
    themeStyle: (finalSettings as any).themeStyle || "modern",
    themeColor: (finalSettings as any).themeColor || "sky",
    bannerUrl: (finalSettings as any).bannerUrl || null,
    welcomeMsgType: (finalSettings as any).welcomeMsgType || "custom",
    instagramUrl: (finalSettings as any).instagramUrl || null,
    facebookUrl: (finalSettings as any).facebookUrl || null,
    address: (finalSettings as any).address || null,
    businessHours: (finalSettings as any).businessHours || null,
    deliveryInfo: (finalSettings as any).deliveryInfo || null,
    paymentMethods: (finalSettings as any).paymentMethods || null,
    name: updatedKiosk?.name || finalSettings.shopName,
    slug: updatedKiosk?.slug || "",
    active: updatedKiosk?.active ?? true,
  });
});

export default router;

