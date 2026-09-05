import { Router, type IRouter } from "express";
import { eq, desc, and, or, isNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  kiosksTable,
  settingsTable,
  userKiosksTable,
  productsTable,
  ordersTable,
  adminInvitationsTable,
} from "@workspace/db";
import {
  requireSuperAdmin,
  hashPassword,
  revokeUserSessions,
  getUserAssignedKiosks,
  type AuthRequest,
} from "../lib/auth";
import {
  generateInvitationToken,
  hashInvitationToken,
  sendAdminInvitationEmail,
} from "../lib/mailer";
import { ensureSettingsForKiosk } from "./settings";

const router: IRouter = Router();

// GET /kiosks - Public list of active kiosks for clients
router.get("/kiosks", async (_req, res): Promise<void> => {
  try {
    const kiosks = await db
      .select({
        id: kiosksTable.id,
        name: kiosksTable.name,
        slug: kiosksTable.slug,
        active: kiosksTable.active,
      })
      .from(kiosksTable)
      .where(eq(kiosksTable.active, true))
      .orderBy(desc(kiosksTable.createdAt));

    const seen = new Set<string>();
    const uniqueKiosks = kiosks.filter((k: any) => {
      if (!k.id || seen.has(k.id)) return false;
      seen.add(k.id);
      return true;
    });

    res.json({ ok: true, kiosks: uniqueKiosks });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener lista de kioscos públicos" });
  }
});

// Require Super Admin for all routes below
router.use("/admin", requireSuperAdmin);

// ─── Kiosk / Business Management Routes ──────────────────────────────────────

// GET /admin/kiosks - List all kiosks
router.get("/admin/kiosks", async (_req: AuthRequest, res): Promise<void> => {
  try {
    const kiosks = await db
      .select()
      .from(kiosksTable)
      .orderBy(desc(kiosksTable.createdAt));

    const seen = new Set<string>();
    const uniqueKiosks = kiosks.filter((k: any) => {
      if (!k.id || seen.has(k.id)) return false;
      seen.add(k.id);
      return true;
    });

    res.json({ ok: true, kiosks: uniqueKiosks });
  } catch (err) {
    res.status(500).json({ error: "Error al listar negocios/kioscos" });
  }
});

// POST /admin/kiosks - Create new kiosk
router.post("/admin/kiosks", async (req: AuthRequest, res): Promise<void> => {
  const { name, slug, active, ownerName, ownerEmail, ownerPhone, adminUserId } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "El nombre del negocio es obligatorio" });
    return;
  }

  const cleanName = name.trim();
  const customSlugProvided = typeof slug === "string" && slug.trim().length > 0;

  let baseSlug = (customSlugProvided ? slug.trim() : cleanName)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!baseSlug) {
    baseSlug = "kiosco-" + Date.now().toString(36);
  }

  try {
    if (customSlugProvided) {
      const existingSlug = await db
        .select({ id: kiosksTable.id })
        .from(kiosksTable)
        .where(eq(kiosksTable.slug, baseSlug))
        .limit(1);

      if (existingSlug.length > 0) {
        res.status(400).json({ error: "El slug/identificador especificado ya está en uso por otro negocio" });
        return;
      }
    }

    let finalSlug = baseSlug;
    if (!customSlugProvided) {
      let suffix = 1;
      while (true) {
        const candidate = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
        const existing = await db
          .select({ id: kiosksTable.id })
          .from(kiosksTable)
          .where(eq(kiosksTable.slug, candidate))
          .limit(1);

        if (existing.length === 0) {
          finalSlug = candidate;
          break;
        }
        suffix++;
      }
    }

    let newKiosk: typeof kiosksTable.$inferSelect | null = null;
    let attempts = 0;

    while (attempts < 5 && !newKiosk) {
      attempts++;
      const candidateSlug =
        !customSlugProvided && attempts > 1
          ? `${finalSlug}-${Math.random().toString(36).substring(2, 6)}`
          : finalSlug;

      const kioskId =
        "kiosk_" + Date.now() + Math.random().toString(36).substring(2, 6);

      try {
        const [inserted] = await db
          .insert(kiosksTable)
          .values({
            id: kioskId,
            name: cleanName,
            slug: candidateSlug,
            active: active !== false,
            ownerName: typeof ownerName === "string" ? ownerName.trim() : null,
            ownerEmail: typeof ownerEmail === "string" ? ownerEmail.trim() : null,
            ownerPhone: typeof ownerPhone === "string" ? ownerPhone.trim() : null,
          })
          .returning();
        newKiosk = inserted;
      } catch (insertErr: any) {
        if (customSlugProvided || attempts >= 5) {
          throw insertErr;
        }
      }
    }

    if (!newKiosk) {
      res.status(500).json({ error: "No se pudo generar un slug único para el negocio" });
      return;
    }

    try {
      await ensureSettingsForKiosk(newKiosk.id);
      await db
        .update(settingsTable)
        .set({ shopName: cleanName })
        .where(eq(settingsTable.id, newKiosk.id));
    } catch {}

    let assignedToUserId: string | null = null;
    if (adminUserId && typeof adminUserId === "string") {
      try {
        await db.insert(userKiosksTable).values({
          userId: adminUserId,
          kioskId: newKiosk.id,
        });
        assignedToUserId = adminUserId;
      } catch (assignErr) {
        console.warn("Could not assign kiosk to admin user:", assignErr);
      }
    }

    res.status(201).json({ ok: true, kiosk: newKiosk, assignedToUserId });
  } catch (err) {
    res.status(500).json({ error: "Error al crear el negocio" });
  }
});

// PATCH /admin/kiosks/:id - Edit kiosk details
router.patch("/admin/kiosks/:id", async (req: AuthRequest, res): Promise<void> => {
  const { id } = req.params;
  const { name, slug, active, ownerName, ownerEmail, ownerPhone } = req.body || {};

  try {
    const rawId = typeof id === "string" ? decodeURIComponent(id).trim() : "";
    if (!rawId) {
      res.status(400).json({ error: "Identificador de negocio no proporcionado" });
      return;
    }

    // Lookup strictly by internal immutable id first; fallback to slug if needed
    let [targetKiosk] = await db
      .select()
      .from(kiosksTable)
      .where(eq(kiosksTable.id, rawId))
      .limit(1);

    if (!targetKiosk) {
      const [bySlug] = await db
        .select()
        .from(kiosksTable)
        .where(eq(kiosksTable.slug, rawId.toLowerCase()))
        .limit(1);
      targetKiosk = bySlug;
    }

    if (!targetKiosk) {
      res.status(404).json({ error: "Negocio no encontrado" });
      return;
    }

    const realId = targetKiosk.id;
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof slug === "string" && slug.trim()) {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
      if (cleanSlug) {
        const existingSlug = await db
          .select({ id: kiosksTable.id })
          .from(kiosksTable)
          .where(eq(kiosksTable.slug, cleanSlug))
          .limit(1);

        if (existingSlug.length > 0 && existingSlug[0].id !== realId) {
          res.status(400).json({ error: "El slug ya pertenece a otro negocio" });
          return;
        }
        updates.slug = cleanSlug;
      }
    }
    if (typeof active === "boolean") {
      updates.active = active;
    }
    if (ownerName !== undefined) {
      updates.ownerName = typeof ownerName === "string" ? ownerName.trim() : null;
    }
    if (ownerEmail !== undefined) {
      updates.ownerEmail = typeof ownerEmail === "string" ? ownerEmail.trim() : null;
    }
    if (ownerPhone !== undefined) {
      updates.ownerPhone = typeof ownerPhone === "string" ? ownerPhone.trim() : null;
    }

    const [updated] = await db
      .update(kiosksTable)
      .set(updates)
      .where(eq(kiosksTable.id, realId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Negocio no encontrado" });
      return;
    }

    try {
      if (updates.name) {
        await db
          .update(settingsTable)
          .set({ shopName: updates.name })
          .where(eq(settingsTable.id, realId));
        if (realId === "kiosk-franco") {
          await db
            .update(settingsTable)
            .set({ shopName: updates.name })
            .where(eq(settingsTable.id, "default"));
        }
      }
    } catch {}

    res.json({ ok: true, kiosk: updated });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar el negocio" });
  }
});

// PATCH /admin/kiosks/:id/status - Toggle active/inactive status
router.patch("/admin/kiosks/:id/status", async (req: AuthRequest, res): Promise<void> => {
  const { id } = req.params;
  const { active } = req.body || {};

  if (typeof active !== "boolean") {
    res.status(400).json({
      error: "El parámetro active debe ser booleano (true/false)",
    });
    return;
  }

  try {
    const rawId = typeof id === "string" ? decodeURIComponent(id).trim() : "";
    if (!rawId) {
      res.status(400).json({ error: "Identificador de negocio no proporcionado" });
      return;
    }

    // 1. Direct match by primary key id
    let [targetKiosk] = await db
      .select({ id: kiosksTable.id })
      .from(kiosksTable)
      .where(eq(kiosksTable.id, rawId))
      .limit(1);

    // 2. Fallback match by slug
    if (!targetKiosk) {
      const [bySlug] = await db
        .select({ id: kiosksTable.id })
        .from(kiosksTable)
        .where(eq(kiosksTable.slug, rawId.toLowerCase()))
        .limit(1);
      targetKiosk = bySlug;
    }

    if (!targetKiosk) {
      res.status(404).json({ error: "Negocio no encontrado" });
      return;
    }

    const [updated] = await db
      .update(kiosksTable)
      .set({
        active,
        updatedAt: new Date(),
      })
      .where(eq(kiosksTable.id, targetKiosk.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Negocio no encontrado" });
      return;
    }

    res.json({ ok: true, kiosk: updated });
  } catch (err) {
    res.status(500).json({ error: "Error al cambiar el estado del negocio" });
  }
});

// DELETE /admin/kiosks/:id - Delete kiosk completely from system
router.delete("/admin/kiosks/:id", async (req: AuthRequest, res): Promise<void> => {
  const { id } = req.params;

  try {
    const rawId = typeof id === "string" ? decodeURIComponent(id).trim() : "";
    if (!rawId) {
      res.status(400).json({ error: "Identificador de negocio no proporcionado" });
      return;
    }

    // Find target kiosk by ID or Slug
    let [targetKiosk] = await db
      .select({ id: kiosksTable.id, name: kiosksTable.name, slug: kiosksTable.slug })
      .from(kiosksTable)
      .where(or(eq(kiosksTable.id, rawId), eq(kiosksTable.slug, rawId.toLowerCase())))
      .limit(1);

    const realId = targetKiosk ? targetKiosk.id : rawId;
    const kioskName = targetKiosk ? targetKiosk.name : rawId;
    const kioskSlug = targetKiosk?.slug;

    // Clean up all associated resources in database
    await db.delete(adminInvitationsTable).where(eq(adminInvitationsTable.kioskId, realId));
    await db.delete(userKiosksTable).where(eq(userKiosksTable.kioskId, realId));
    await db.update(usersTable).set({ kioskId: null }).where(eq(usersTable.kioskId, realId));
    await db.delete(productsTable).where(eq(productsTable.kioskId, realId));
    await db.delete(ordersTable).where(eq(ordersTable.kioskId, realId));
    await db.delete(settingsTable).where(
      kioskSlug
        ? or(eq(settingsTable.id, realId), eq(settingsTable.id, kioskSlug))
        : eq(settingsTable.id, realId)
    );
    await db.delete(kiosksTable).where(eq(kiosksTable.id, realId));

    res.json({ ok: true, message: `Kiosco '${kioskName}' eliminado permanentemente` });
  } catch (err) {
    console.error("Error deleting kiosk:", err);
    res.status(500).json({ error: "Error al eliminar el negocio del sistema" });
  }
});

// 1. Get list of admin users
router.get("/admin/users", async (_req: AuthRequest, res): Promise<void> => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        role: usersTable.role,
        kioskId: usersTable.kioskId,
        active: usersTable.active,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    const usersWithKiosks = await Promise.all(
      users.map(async (u: any) => {
        const assignedKiosks = await getUserAssignedKiosks(u.id, u.role, u.kioskId ?? undefined);
        return {
          ...u,
          assignedKiosks,
          kioskIds: assignedKiosks.map((k) => k.id),
        };
      })
    );

    res.json({ users: usersWithKiosks });
  } catch (err) {
    res.status(500).json({ error: "Error al listar usuarios administradores" });
  }
});

// 2. Create new admin user
router.post("/admin/users", async (req: AuthRequest, res): Promise<void> => {
  const { username, name, password, role, kioskId, kioskIds } = req.body || {};

  if (!username || typeof username !== "string" || !username.trim()) {
    res.status(400).json({ error: "El nombre de usuario es obligatorio" });
    return;
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "El nombre es obligatorio" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({
      error: "La contraseña es obligatoria y debe tener al menos 6 caracteres",
    });
    return;
  }

  const userRole = role === "superadmin" ? "superadmin" : "admin";
  const cleanUsername = username.trim().toLowerCase();

  if (userRole === "superadmin") {
    const [existingSuperadmin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "superadmin"))
      .limit(1);
    if (existingSuperadmin) {
      res.status(400).json({ error: "Ya existe un Super Administrador global. No se puede crear otro." });
      return;
    }
  }

  const requestedKioskIds: string[] = Array.isArray(kioskIds)
    ? kioskIds
    : kioskId
    ? [kioskId]
    : [];

  const primaryKioskId = requestedKioskIds[0] || null;

  try {
    const existing = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        role: usersTable.role,
        kioskId: usersTable.kioskId,
        active: usersTable.active,
      })
      .from(usersTable)
      .where(eq(usersTable.username, cleanUsername))
      .limit(1);

    if (existing.length > 0) {
      const existingUser = existing[0];
      if (req.body.assignIfExists) {
        for (const kId of requestedKioskIds) {
          try {
            await db.insert(userKiosksTable).values({ userId: existingUser.id, kioskId: kId });
          } catch {}
        }
        const assignedKiosks = await getUserAssignedKiosks(existingUser.id, existingUser.role, existingUser.kioskId);
        res.status(200).json({
          ok: true,
          assignedToExisting: true,
          message: `El kiosco fue asignado correctamente a la cuenta existente @${existingUser.username}`,
          user: {
            ...existingUser,
            assignedKiosks,
            kioskIds: assignedKiosks.map((k) => k.id),
          },
        });
        return;
      }

      res.status(400).json({
        error: `El usuario / email @${cleanUsername} ya está registrado en la plataforma.`,
        userExists: true,
        existingUser,
      });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const userId = "usr_" + Date.now() + Math.random().toString(36).substring(2, 7);

    const [newUser] = await db
      .insert(usersTable)
      .values({
        id: userId,
        username: cleanUsername,
        name: name.trim(),
        passwordHash: hash,
        salt,
        role: userRole,
        kioskId: primaryKioskId,
        active: true,
      })
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        role: usersTable.role,
        kioskId: usersTable.kioskId,
        active: usersTable.active,
        createdAt: usersTable.createdAt,
      });

    for (const kId of requestedKioskIds) {
      try {
        await db.insert(userKiosksTable).values({ userId, kioskId: kId });
      } catch {}
    }

    const assignedKiosks = await getUserAssignedKiosks(userId, userRole, primaryKioskId ?? undefined);

    res.status(201).json({
      ok: true,
      user: {
        ...newUser,
        assignedKiosks,
        kioskIds: assignedKiosks.map((k) => k.id),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Error al crear administrador" });
  }
});

// Helper to robustly find an admin user by ID, username, email or display name
async function findAdminUser(identifier: string) {
  if (!identifier || typeof identifier !== "string") return null;
  const decoded = decodeURIComponent(identifier).trim();
  const withoutAt = decoded.startsWith("@") ? decoded.substring(1).trim() : decoded;
  const lowerClean = withoutAt.toLowerCase();

  // 1. Try exact ID match
  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, decoded))
    .limit(1);

  if (user) return user;

  // 2. Try ID without '@'
  if (withoutAt !== decoded) {
    [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, withoutAt))
      .limit(1);
    if (user) return user;
  }

  // 3. Try exact username match (e.g. "juan_kiosco" or "admin.mendoza")
  [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, withoutAt))
    .limit(1);

  if (user) return user;

  // 4. Try lowercase username match
  [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.username}) = ${lowerClean}`)
    .limit(1);

  if (user) return user;

  // 5. Try lowercase ID match
  [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.id}) = ${lowerClean}`)
    .limit(1);

  if (user) return user;

  // 6. Fallback: match by display name (case-insensitive)
  [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.name}) = ${lowerClean}`)
    .limit(1);

  return user || null;
}

// 3. Update admin user (name, email, username, role, kioskId, kioskIds, active)
router.patch("/admin/users/:id", async (req: AuthRequest, res): Promise<void> => {
  const identifier = req.params.id as string;
  const { name, email, username, role, kioskId, kioskIds, active } = req.body || {};

  try {
    const existingUser = await findAdminUser(identifier);

    if (!existingUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const realUserId = existingUser.id;

    if (role === "superadmin") {
      const [existingSuperadmin] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.role, "superadmin"))
        .limit(1);
      if (existingSuperadmin && existingSuperadmin.id !== realUserId) {
        res.status(400).json({ error: "Ya existe un Super Administrador global. No se puede asignar este rol a otro usuario." });
        return;
      }
    }

    const updates: Record<string, any> = { updatedAt: new Date() };

    // Update name
    if (typeof name === "string") {
      const cleanName = name.trim();
      if (!cleanName) {
        res.status(400).json({ error: "El nombre del administrador no puede estar vacío." });
        return;
      }
      updates.name = cleanName;
    }

    // Update email / username
    const rawEmail = email !== undefined ? email : username;
    if (typeof rawEmail === "string") {
      const cleanEmail = rawEmail.trim().toLowerCase();
      if (!cleanEmail) {
        res.status(400).json({ error: "El email del administrador no puede estar vacío." });
        return;
      }

      // If email has changed, check for duplicates in usersTable
      if (cleanEmail !== existingUser.username.toLowerCase()) {
        const [duplicateUser] = await db
          .select({ id: usersTable.id, username: usersTable.username })
          .from(usersTable)
          .where(eq(usersTable.username, cleanEmail))
          .limit(1);

        if (duplicateUser && duplicateUser.id !== realUserId) {
          res.status(400).json({
            error: `El email o usuario '${cleanEmail}' ya pertenece a otro usuario registrado en la plataforma.`,
          });
          return;
        }

        updates.username = cleanEmail;
      }
    }

    if (role === "admin" || role === "superadmin") updates.role = role;
    if (kioskId !== undefined) updates.kioskId = kioskId;
    if (typeof active === "boolean") updates.active = active;

    const [updated] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, realUserId))
      .returning({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        role: usersTable.role,
        kioskId: usersTable.kioskId,
        active: usersTable.active,
        updatedAt: usersTable.updatedAt,
      });

    if (!updated) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (updates.active === false) {
      revokeUserSessions(realUserId);
    }

    if (Array.isArray(kioskIds)) {
      try {
        await db.delete(userKiosksTable).where(eq(userKiosksTable.userId, realUserId));
        for (const kId of kioskIds) {
          await db.insert(userKiosksTable).values({ userId: realUserId, kioskId: kId });
        }
      } catch {}
    } else if (typeof kioskId === "string") {
      try {
        await db.delete(userKiosksTable).where(eq(userKiosksTable.userId, realUserId));
        if (kioskId) {
          await db.insert(userKiosksTable).values({ userId: realUserId, kioskId });
        }
      } catch {}
    }

    const assignedKiosks = await getUserAssignedKiosks(realUserId, updated.role, updated.kioskId ?? undefined);

    res.json({
      ok: true,
      message: "Administrador actualizado correctamente",
      user: {
        ...updated,
        assignedKiosks,
        kioskIds: assignedKiosks.map((k) => k.id),
      },
    });
  } catch (err: any) {
    console.error("Error al actualizar administrador:", err);
    res.status(500).json({ error: err?.message || "Error al actualizar administrador" });
  }
});

// Delete admin user
router.delete("/admin/users/:id", async (req: AuthRequest, res): Promise<void> => {
  const identifier = req.params.id as string;

  try {
    const user = await findAdminUser(identifier);

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (user.role === "superadmin") {
      res.status(400).json({ error: "No se puede eliminar la cuenta principal de Super Administrador." });
      return;
    }

    const realUserId = user.id;

    // Clean up user kiosk assignments
    await db.delete(userKiosksTable).where(eq(userKiosksTable.userId, realUserId));

    // Delete user
    await db.delete(usersTable).where(eq(usersTable.id, realUserId));

    // Revoke any active sessions
    revokeUserSessions(realUserId);

    res.json({
      ok: true,
      message: `Administrador '${user.name}' eliminado permanentemente`,
    });
  } catch (err: any) {
    console.error("Error al eliminar administrador:", err);
    res.status(500).json({ error: "Error al eliminar administrador" });
  }
});

// Assign a kiosk to user
router.post("/admin/users/:id/kiosks", async (req: AuthRequest, res): Promise<void> => {
  const identifier = req.params.id as string;
  const { kioskId } = req.body || {};

  if (!kioskId || typeof kioskId !== "string") {
    res.status(400).json({ error: "El ID del kiosco es obligatorio" });
    return;
  }

  try {
    const user = await findAdminUser(identifier);

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const realUserId = user.id;

    try {
      await db.insert(userKiosksTable).values({
        userId: realUserId,
        kioskId,
      });
      if (!user.kioskId) {
        await db.update(usersTable).set({ kioskId, updatedAt: new Date() }).where(eq(usersTable.id, realUserId));
      }
    } catch {}

    const assignedKiosks = await getUserAssignedKiosks(realUserId, user.role, user.kioskId ?? undefined);

    res.json({
      ok: true,
      message: "Kiosco asignado correctamente",
      assignedKiosks,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al asignar kiosco al usuario" });
  }
});

// Remove a kiosk assignment from user
router.delete("/admin/users/:id/kiosks/:kioskId", async (req: AuthRequest, res): Promise<void> => {
  const identifier = req.params.id as string;
  const kioskId = req.params.kioskId as string;

  try {
    const user = await findAdminUser(identifier);

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const realUserId = user.id;

    await db
      .delete(userKiosksTable)
      .where(
        and(
          eq(userKiosksTable.userId, realUserId),
          eq(userKiosksTable.kioskId, kioskId)
        )
      );

    if (user.kioskId === kioskId) {
      await db
        .update(usersTable)
        .set({ kioskId: null, updatedAt: new Date() })
        .where(eq(usersTable.id, realUserId));
    }

    const assignedKiosks = await getUserAssignedKiosks(realUserId, user.role, user.kioskId ?? undefined);

    res.json({
      ok: true,
      message: "Asignación de kiosco eliminada",
      assignedKiosks,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al desasignar kiosco del usuario" });
  }
});

// 4. Reset admin password
router.post(
  "/admin/users/:id/reset-password",
  async (req: AuthRequest, res): Promise<void> => {
    const identifier = req.params.id as string;
    const { newPassword } = req.body || {};

    if (
      !newPassword ||
      typeof newPassword !== "string" ||
      newPassword.length < 6
    ) {
      res.status(400).json({
        error:
          "La nueva contraseña debe tener al menos 6 caracteres",
      });
      return;
    }

    try {
      const user = await findAdminUser(identifier);

      if (!user) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      const realUserId = user.id;
      const { hash, salt } = hashPassword(newPassword);

      const [updated] = await db
        .update(usersTable)
        .set({
          passwordHash: hash,
          salt,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, realUserId))
        .returning({ id: usersTable.id });

      if (!updated) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      // Also revoke existing sessions for this user
      revokeUserSessions(realUserId);

      res.json({ ok: true, message: "Contraseña restablecida correctamente" });
    } catch (err) {
      res.status(500).json({ error: "Error al restablecer la contraseña" });
    }
  },
);

// 5. Revoke admin sessions
router.post(
  "/admin/users/:id/revoke-sessions",
  async (req: AuthRequest, res): Promise<void> => {
    const identifier = req.params.id as string;
    const user = await findAdminUser(identifier);
    const realUserId = user ? user.id : identifier;
    revokeUserSessions(realUserId);
    res.json({ ok: true, message: "Sesiones revocadas correctamente" });
  },
);

// 6. Invitations Management for SuperAdmin
// GET /admin/invitations - List all invitations with kiosk details
router.get("/admin/invitations", async (_req: AuthRequest, res): Promise<void> => {
  try {
    const invitations = await db
      .select()
      .from(adminInvitationsTable)
      .orderBy(desc(adminInvitationsTable.createdAt));

    const kiosks = await db.select({ id: kiosksTable.id, name: kiosksTable.name, slug: kiosksTable.slug }).from(kiosksTable);
    const kioskMap = new Map<string, any>(kiosks.map((k: any) => [k.id, k]));

    const now = new Date();
    const enriched = invitations.map((inv: any) => {
      const isAccepted = !!inv.acceptedAt;
      const isExpired = !isAccepted && new Date(inv.expiresAt) < now;
      let status: "accepted" | "expired" | "pending" = "pending";
      if (isAccepted) status = "accepted";
      else if (isExpired) status = "expired";

      const kiosk = kioskMap.get(inv.kioskId);
      return {
        id: inv.id,
        email: inv.email,
        name: inv.name,
        kioskId: inv.kioskId,
        kioskName: kiosk?.name || inv.kioskId,
        kioskSlug: kiosk?.slug || inv.kioskId,
        status,
        expiresAt: inv.expiresAt,
        acceptedAt: inv.acceptedAt,
        createdAt: inv.createdAt,
      };
    });

    res.json({ ok: true, invitations: enriched });
  } catch (err) {
    res.status(500).json({ error: "Error al listar invitaciones" });
  }
});

// POST /admin/invitations - Create and dispatch an admin invitation
router.post("/admin/invitations", async (req: AuthRequest, res): Promise<void> => {
  const { name, email, kioskId } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "El nombre del administrador es obligatorio" });
    return;
  }
  if (!email || typeof email !== "string" || !email.trim()) {
    res.status(400).json({ error: "El email del administrador es obligatorio" });
    return;
  }
  if (!kioskId || typeof kioskId !== "string" || !kioskId.trim()) {
    res.status(400).json({ error: "Debe seleccionar el kiosco/negocio a asignar" });
    return;
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanKioskId = kioskId.trim();

  // Basic email format validation
  if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    res.status(400).json({ error: "El formato del email no es válido" });
    return;
  }

  try {
    // 1. Verify target kiosk exists
    let [targetKiosk] = await db
      .select({ id: kiosksTable.id, name: kiosksTable.name, slug: kiosksTable.slug, active: kiosksTable.active })
      .from(kiosksTable)
      .where(eq(kiosksTable.id, cleanKioskId))
      .limit(1);

    if (!targetKiosk) {
      const [bySlug] = await db
        .select({ id: kiosksTable.id, name: kiosksTable.name, slug: kiosksTable.slug, active: kiosksTable.active })
        .from(kiosksTable)
        .where(eq(kiosksTable.slug, cleanKioskId.toLowerCase()))
        .limit(1);
      targetKiosk = bySlug;
    }

    if (!targetKiosk) {
      res.status(404).json({ error: "El kiosco seleccionado no existe" });
      return;
    }

    // 2. Check if email already belongs to an existing user
    const [existingUser] = await db
      .select({ id: usersTable.id, username: usersTable.username, active: usersTable.active })
      .from(usersTable)
      .where(eq(usersTable.username, cleanEmail))
      .limit(1);

    if (existingUser) {
      res.status(400).json({
        error: `El email '${cleanEmail}' ya pertenece a un usuario registrado en la plataforma.`,
        userExists: true,
      });
      return;
    }

    // 3. Generate cryptographically secure token & hash (48 hours expiration)
    const { rawToken, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const invitationId = "inv_" + Date.now() + Math.random().toString(36).substring(2, 7);

    // If an unaccepted invitation exists for this email, delete/supersede it
    await db
      .delete(adminInvitationsTable)
      .where(
        and(
          eq(adminInvitationsTable.email, cleanEmail),
          isNull(adminInvitationsTable.acceptedAt)
        )
      );

    const [newInvitation] = await db
      .insert(adminInvitationsTable)
      .values({
        id: invitationId,
        email: cleanEmail,
        name: cleanName,
        kioskId: targetKiosk.id,
        tokenHash,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 4. Construct invitation URL
    const appUrl =
      process.env.APP_URL ||
      (req.headers.origin as string) ||
      (req.headers.referer ? new URL(req.headers.referer).origin : "") ||
      "http://localhost:3000";

    const cleanAppUrl = appUrl.replace(/\/+$/, "");
    const inviteUrl = `${cleanAppUrl}/?invitation=${encodeURIComponent(rawToken)}`;

    // 5. Send invitation email (o registrar en modo manual)
    const emailResult = await sendAdminInvitationEmail({
      toEmail: cleanEmail,
      adminName: cleanName,
      kioskName: targetKiosk.name,
      inviteUrl,
    });

    const successMessage = emailResult.ok
      ? (emailResult.simulated
          ? `Invitación registrada para ${cleanEmail}. Copia el enlace para enviárselo manualmente.`
          : `Invitación enviada exitosamente por email a ${cleanEmail}`)
      : `Invitación registrada para ${cleanEmail}. (Aviso: no se pudo enviar automáticamente: ${emailResult.error}). Copia el enlace para enviárselo manualmente.`;

    res.status(201).json({
      ok: true,
      message: successMessage,
      invitation: {
        id: newInvitation.id,
        email: newInvitation.email,
        name: newInvitation.name,
        kioskId: newInvitation.kioskId,
        kioskName: targetKiosk.name,
        status: "pending",
        expiresAt: newInvitation.expiresAt,
        createdAt: newInvitation.createdAt,
      },
      inviteUrl,
      emailResult: {
        simulated: emailResult.simulated ?? true,
        inviteUrl,
        error: emailResult.error,
      },
    });
  } catch (err) {
    console.error("Error creating invitation:", err);
    res.status(500).json({ error: "Error al crear la invitación del administrador" });
  }
});

// POST /admin/invitations/:id/resend - Resend an existing invitation with a new token & refreshed expiration
router.post("/admin/invitations/:id/resend", async (req: AuthRequest, res): Promise<void> => {
  const id = req.params.id as string;

  try {
    const [invitation] = await db
      .select()
      .from(adminInvitationsTable)
      .where(eq(adminInvitationsTable.id, id))
      .limit(1);

    if (!invitation) {
      res.status(404).json({ error: "Invitación no encontrada" });
      return;
    }

    if (invitation.acceptedAt) {
      res.status(400).json({ error: "Esta invitación ya fue aceptada por el administrador." });
      return;
    }

    // Lookup kiosk
    const [targetKiosk] = await db
      .select({ id: kiosksTable.id, name: kiosksTable.name })
      .from(kiosksTable)
      .where(eq(kiosksTable.id, invitation.kioskId))
      .limit(1);

    // Refresh token & expiration (48 hours)
    const { rawToken, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const [updated] = await db
      .update(adminInvitationsTable)
      .set({
        tokenHash,
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(adminInvitationsTable.id, id))
      .returning();

    const appUrl =
      process.env.APP_URL ||
      (req.headers.origin as string) ||
      (req.headers.referer ? new URL(req.headers.referer).origin : "") ||
      "http://localhost:3000";

    const cleanAppUrl = appUrl.replace(/\/+$/, "");
    const inviteUrl = `${cleanAppUrl}/?invitation=${encodeURIComponent(rawToken)}`;

    const emailResult = await sendAdminInvitationEmail({
      toEmail: updated.email,
      adminName: updated.name,
      kioskName: targetKiosk?.name || updated.kioskId,
      inviteUrl,
    });

    const resendMessage = emailResult.ok
      ? (emailResult.simulated
          ? `Nuevo enlace de activación generado para ${updated.email}. Copia el enlace para enviárselo manualmente.`
          : `Invitación reenviada exitosamente a ${updated.email}`)
      : `Nuevo enlace generado para ${updated.email}. Copia el enlace para enviárselo manualmente.`;

    res.json({
      ok: true,
      message: resendMessage,
      invitation: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        kioskId: updated.kioskId,
        kioskName: targetKiosk?.name || updated.kioskId,
        status: "pending",
        expiresAt: updated.expiresAt,
      },
      inviteUrl,
      emailResult: {
        simulated: emailResult.simulated ?? true,
        inviteUrl,
        error: emailResult.error,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Error al reenviar la invitación" });
  }
});

// DELETE /admin/invitations/:id - Cancel/revoke a pending invitation
router.delete("/admin/invitations/:id", async (req: AuthRequest, res): Promise<void> => {
  const id = req.params.id as string;

  try {
    const [deleted] = await db
      .delete(adminInvitationsTable)
      .where(eq(adminInvitationsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Invitación no encontrada" });
      return;
    }

    res.json({ ok: true, message: "Invitación cancelada y eliminada correctamente" });
  } catch (err) {
    res.status(500).json({ error: "Error al cancelar la invitación" });
  }
});

// 7. Global system status info for Super Admin Dashboard
router.get("/admin/system-info", async (_req: AuthRequest, res): Promise<void> => {
  res.json({
    ok: true,
    system: {
      status: "online",
      environment: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      rolesConfigured: ["superadmin", "admin", "cliente"],
    },
  });
});

export default router;
