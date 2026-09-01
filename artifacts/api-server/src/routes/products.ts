import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { requireAdmin, verifyToken, userCanAccessKiosk, type AuthRequest } from "../lib/auth";
import { resolveKioskFromRequest } from "../lib/kiosk-resolver";
import {
  ListProductsResponse,
  CreateProductBody,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  DeleteProductParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const token =
    (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : undefined) ||
    (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : undefined);

  const payload = verifyToken(token);

  const hasExplicitKioskParam =
    !!(req.query.kiosk || req.query.kioskId || req.query.kiosk_id || req.headers["x-kiosk-id"]);

  let targetKioskId: string | undefined;
  let resolvedKiosk: Awaited<ReturnType<typeof resolveKioskFromRequest>>;
  if (hasExplicitKioskParam) {
    resolvedKiosk = await resolveKioskFromRequest(req);
    targetKioskId = resolvedKiosk.id;
  } else if (payload && payload.role === "admin" && payload.kioskId) {
    targetKioskId = payload.kioskId;
    resolvedKiosk = await resolveKioskFromRequest(req);
  } else {
    resolvedKiosk = await resolveKioskFromRequest(req);
    targetKioskId = resolvedKiosk.id;
  }

  if (
    resolvedKiosk.active === false &&
    !(
      payload &&
      (!hasExplicitKioskParam ||
        (await userCanAccessKiosk(payload, resolvedKiosk.id)))
    )
  ) {
    res.status(403).json({
      error: "Este kiosco se encuentra inactivo y no está disponible públicamente.",
    });
    return;
  }

  if (payload && payload.role === "admin" && targetKioskId) {
    const allowed = await userCanAccessKiosk(payload, targetKioskId);
    if (!allowed) {
      res.status(403).json({ error: "Acceso denegado. No tiene permisos para ver productos de este kiosco." });
      return;
    }
  }

  const query = db.select().from(productsTable);
  if (targetKioskId) {
    query.where(eq(productsTable.kioskId, targetKioskId));
  }
  const rows = await query.orderBy(productsTable.createdAt);
  const formattedRows = rows.map((r: any) => ({
    ...r,
    kioskId: r.kioskId || targetKioskId || "",
    emoji: r.emoji || "📦",
    available: r.available ?? true,
  }));
  res.json(ListProductsResponse.parse(formattedRows));
});

router.post("/products", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const kioskId =
    (req.body.kioskId as string) ||
    (req.query.kioskId as string) ||
    (req.query.kiosk_id as string) ||
    req.user?.kioskId ||
    (await resolveKioskFromRequest(req)).id;

  const allowed = await userCanAccessKiosk(req.user, kioskId);
  if (!allowed) {
    res.status(403).json({ error: "Acceso denegado. No tiene permisos para este kiosco." });
    return;
  }

  const id = `p${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const [row] = await db
    .insert(productsTable)
    .values({ id, kioskId, ...parsed.data })
    .returning();
  const prodRow = row || {
    id,
    kioskId,
    ...parsed.data,
    emoji: parsed.data.emoji ?? "📦",
    image: parsed.data.image ?? null,
    available: parsed.data.available ?? true,
    description: parsed.data.description ?? null,
    originalPrice: parsed.data.originalPrice ?? null,
    badge: parsed.data.badge ?? null,
    promoTitle: parsed.data.promoTitle ?? null,
    promoEndDate: parsed.data.promoEndDate ?? null,
    createdAt: new Date(),
  };
  res.status(201).json(UpdateProductResponse.parse(prodRow));
});

router.patch("/products/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const allowed = await userCanAccessKiosk(req.user, existing.kioskId);
  if (!allowed) {
    res.status(403).json({ error: "Acceso denegado. No tiene permisos para modificar productos de este kiosco." });
    return;
  }

  const [row] = await db
    .update(productsTable)
    .set(parsed.data)
    .where(eq(productsTable.id, params.data.id))
    .returning();

  res.json(UpdateProductResponse.parse(row || existing));
});

router.delete("/products/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }

  const allowed = await userCanAccessKiosk(req.user, existing.kioskId);
  if (!allowed) {
    res.status(403).json({ error: "Acceso denegado. No tiene permisos para eliminar productos de este kiosco." });
    return;
  }

  await db
    .delete(productsTable)
    .where(eq(productsTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
