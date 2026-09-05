import { Router, type IRouter } from "express";
import { desc, eq, inArray, and } from "drizzle-orm";
import { db, pool, ordersTable, kiosksTable, productsTable } from "@workspace/db";
import {
  requireAdmin,
  verifyToken,
  userCanAccessKiosk,
  getUserAssignedKiosks,
  type AuthRequest,
} from "../lib/auth";
import { resolveKioskFromRequest } from "../lib/kiosk-resolver";
import {
  ListOrdersResponse,
  CreateOrderBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusBody,
  UpdateOrderStatusResponse,
  DeleteOrderParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serialize(row: typeof ordersTable.$inferSelect) {
  const createdAtDate = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt || Date.now());
  return {
    ...row,
    orderNumber: row.orderNumber != null ? Number(row.orderNumber) : undefined,
    createdAt: createdAtDate.toISOString(),
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  try {
    const token =
      (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : undefined) ||
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : undefined);

    const payload = verifyToken(token);

    const hasExplicitKioskParam =
      !!(req.query.kiosk || req.query.kioskId || req.query.kiosk_id || req.headers["x-kiosk-id"]);

    let targetKioskId: string | undefined;

    if (hasExplicitKioskParam) {
      const resolved = await resolveKioskFromRequest(req);
      targetKioskId = resolved.id;
    } else if (payload && payload.role === "superadmin") {
      // SuperAdmin sin filtro explícito puede consultar todos los pedidos globalmente
      targetKioskId = undefined;
    } else if (payload && payload.role === "admin") {
      // Admin de kiosco: resolver su kiosco asignado
      if (payload.kioskId) {
        targetKioskId = payload.kioskId;
      } else {
        const assigned = await getUserAssignedKiosks(payload.userId, payload.role, payload.kioskId);
        targetKioskId = assigned[0]?.id;
      }
    } else {
      // Cliente público: resolver desde la request o fallback
      const resolved = await resolveKioskFromRequest(req);
      targetKioskId = resolved.id;
    }

    // Validación estricta de autorización para Admin
    if (payload && payload.role === "admin") {
      if (!targetKioskId) {
        const assigned = await getUserAssignedKiosks(payload.userId, payload.role, payload.kioskId);
        targetKioskId = assigned[0]?.id;
        if (!targetKioskId) {
          res.status(403).json({ error: "Acceso denegado. No tiene un kiosco asignado." });
          return;
        }
      }

      const allowed = await userCanAccessKiosk(payload, targetKioskId);
      if (!allowed) {
        res.status(403).json({ error: "Acceso denegado. No tiene permisos para ver pedidos de este kiosco." });
        return;
      }
    } else if (!payload || payload.role !== "superadmin") {
      // Clientes o usuarios sin rol superadmin siempre deben tener un targetKioskId resuelto
      if (!targetKioskId) {
        const resolved = await resolveKioskFromRequest(req);
        targetKioskId = resolved.id;
      }
    }

    const rawOrderId = (req.query.orderId as string) || (req.query.order_id as string);
    const rawOrderIds = (req.query.orderIds as string);
    const customerOrderIds = [
      ...(rawOrderId ? [rawOrderId.trim()] : []),
      ...(rawOrderIds ? rawOrderIds.split(",").map((s) => s.trim()).filter(Boolean) : []),
    ];

    const query = db.select().from(ordersTable);

    if (!payload || (payload.role !== "admin" && payload.role !== "superadmin")) {
      // CLIENTE PÚBLICO:
      // Solo puede consultar sus propios pedidos si provee orderId o orderIds.
      // Jamás puede listar pedidos ajenos de la tienda.
      if (customerOrderIds.length === 0) {
        res.json([]);
        return;
      }
      query.where(
        and(
          eq(ordersTable.kioskId, targetKioskId!),
          inArray(ordersTable.id, customerOrderIds)
        )
      );
    } else if (payload.role === "admin") {
      // ADMINISTRADOR DE KIOSCO:
      // Únicamente ve los pedidos de su kiosco asignado.
      query.where(eq(ordersTable.kioskId, targetKioskId!));
    } else if (payload.role === "superadmin") {
      // SUPERADMIN:
      // Puede ver los pedidos del kiosco filtrado o todos los pedidos globales
      if (targetKioskId) {
        query.where(eq(ordersTable.kioskId, targetKioskId));
      }
    }

    const rows = await query.orderBy(desc(ordersTable.createdAt));
    res.json(ListOrdersResponse.parse(rows.map(serialize)));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error al obtener pedidos" });
  }
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  try {
    const token =
      (typeof req.headers["x-admin-token"] === "string" ? req.headers["x-admin-token"] : undefined) ||
      (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7).trim() : undefined);
    const payload = verifyToken(token);

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, req.params.id))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Pedido no encontrado" });
      return;
    }

    if (payload && payload.role === "admin") {
      const allowed = await userCanAccessKiosk(payload, order.kioskId);
      if (!allowed) {
        res.status(403).json({ error: "Acceso denegado. No tiene permisos para este pedido." });
        return;
      }
    }

    res.json(serialize(order));
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error al obtener el pedido" });
  }
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const resolvedKiosk = await resolveKioskFromRequest(req);
  const kioskId = resolvedKiosk.id;

  if (resolvedKiosk.active === false) {
    res.status(400).json({ error: "Este kiosco se encuentra inactivo y no acepta nuevos pedidos en este momento." });
    return;
  }

  // Validar disponibilidad de productos en backend
  try {
    const productIds = parsed.data.items.map((i: any) => i.productId);
    if (productIds.length > 0) {
      const dbProducts = await db
        .select({ id: productsTable.id, name: productsTable.name, available: productsTable.available, kioskId: productsTable.kioskId })
        .from(productsTable)
        .where(inArray(productsTable.id, productIds));

      const productMap = new Map<string, any>(dbProducts.map((p: any) => [p.id, p]));
      for (const item of parsed.data.items) {
        const prod = productMap.get(item.productId);
        if (prod && prod.available === false) {
          res.status(400).json({
            error: `El producto "${prod.name}" no se encuentra disponible actualmente.`
          });
          return;
        }
      }
    }
  } catch (err) {
    // Si la columna aun no existiera por algun motivo, no bloquea la creacion basica
  }

  const total = parsed.data.items.reduce(
    (sum: number, i: any) => sum + i.price * i.qty,
    0,
  );

  let orderNumber = 1;
  if (pool) {
    try {
      const counterRes = await pool.query<{ last_order_number: number }>(
        `INSERT INTO kiosk_order_counters (kiosk_id, last_order_number)
         VALUES ($1, 1)
         ON CONFLICT (kiosk_id)
         DO UPDATE SET last_order_number = kiosk_order_counters.last_order_number + 1
         RETURNING last_order_number;`,
        [kioskId]
      );
      if (counterRes.rows[0]?.last_order_number != null) {
        orderNumber = Number(counterRes.rows[0].last_order_number);
      }
    } catch (cErr) {
      console.warn("Could not increment kiosk_order_counters, falling back:", cErr);
    }
  }

  const id = `O${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const [row] = await db
    .insert(ordersTable)
    .values({
      id,
      orderNumber,
      kioskId,
      customerName: parsed.data.customerName,
      address: parsed.data.address,
      delivery: parsed.data.delivery,
      payment: parsed.data.payment,
      items: parsed.data.items,
      total,
      status: "nuevo",
    })
    .returning();
  const orderRow = row || {
    id,
    orderNumber,
    kioskId,
    customerName: parsed.data.customerName,
    address: parsed.data.address,
    delivery: parsed.data.delivery,
    payment: parsed.data.payment,
    items: parsed.data.items,
    total,
    status: "nuevo",
    createdAt: new Date(),
  };
  res.status(201).json(UpdateOrderStatusResponse.parse(serialize(orderRow)));
});

router.patch("/orders/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }

  const allowed = await userCanAccessKiosk(req.user, existing.kioskId);
  if (!allowed) {
    res.status(403).json({ error: "Acceso denegado. No tiene permisos para actualizar pedidos de este kiosco." });
    return;
  }

  const updateData: Partial<typeof ordersTable.$inferInsert> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.customerName !== undefined) updateData.customerName = parsed.data.customerName.trim();
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address.trim();
  if (parsed.data.delivery !== undefined) updateData.delivery = parsed.data.delivery;
  if (parsed.data.payment !== undefined) updateData.payment = parsed.data.payment;
  if (parsed.data.items !== undefined) updateData.items = parsed.data.items;
  if (parsed.data.total !== undefined) updateData.total = Math.round(parsed.data.total);

  const [row] = await db
    .update(ordersTable)
    .set(updateData)
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  res.json(UpdateOrderStatusResponse.parse(serialize(row || existing)));
});

router.delete("/orders/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const params = DeleteOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }

  const allowed = await userCanAccessKiosk(req.user, existing.kioskId);
  if (!allowed) {
    res.status(403).json({ error: "Acceso denegado. No tiene permisos para eliminar pedidos de este kiosco." });
    return;
  }

  await db
    .delete(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
