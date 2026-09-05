import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import {
  db,
  usersTable,
  userKiosksTable,
  kiosksTable,
  adminInvitationsTable,
} from "@workspace/db";
import {
  createToken,
  verifyPassword,
  hashPassword,
  requireAuth,
  getUserAssignedKiosks,
  ensureSuperAdminSeed,
  type AuthRequest,
} from "../lib/auth";
import { hashInvitationToken } from "../lib/mailer";

const router: IRouter = Router();

router.post("/admin/login", async (req, res): Promise<void> => {
  const { username, password } = req.body || {};

  if (typeof password !== "string" || !password.trim()) {
    res.status(400).json({ error: "La contraseña es requerida" });
    return;
  }

  let cleanUsername = typeof username === "string" && username.trim() ? username.trim().toLowerCase() : "superadmin";
  if (cleanUsername === "superadministrador") {
    cleanUsername = "superadmin";
  }
  const cleanPassword = password.trim();

  try {
    // Ensure SuperAdmin account is seeded in DB if not present yet
    await ensureSuperAdminSeed();

    // Query user by exact username match (usernames are always stored lowercase)
    let [dbUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, cleanUsername))
      .limit(1);

    // Fallback search with sql lower in case username was stored mixed-case in PostgreSQL
    if (!dbUser) {
      const rows = await db
        .select()
        .from(usersTable)
        .where(sql`lower(${usersTable.username}) = ${cleanUsername}`)
        .limit(1);
      dbUser = rows[0];
    }

    // Fallback: If cleanUsername is "admin", "superadmin", or "superadministrador" and not found yet, get the superadmin user
    if (!dbUser && (cleanUsername === "superadmin" || cleanUsername === "admin" || cleanUsername === "superadministrador")) {
      const rows = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.role, "superadmin"))
        .limit(1);
      dbUser = rows[0];
    }

    if (!dbUser) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    if (dbUser.active === false) {
      res.status(403).json({ error: "Cuenta de usuario desactivada. Contacte al SuperAdministrador." });
      return;
    }

    const passwordHash = dbUser.passwordHash || (dbUser as any).password_hash;
    const salt = dbUser.salt;
    const isValidPassword = verifyPassword(cleanPassword, passwordHash, salt);

    if (!isValidPassword) {
      res.status(401).json({ error: "Contraseña incorrecta" });
      return;
    }

    const role = dbUser.role === "superadmin" ? "superadmin" : "admin";
    const userKioskId = dbUser.kioskId || undefined;
    const assignedKiosks = await getUserAssignedKiosks(dbUser.id, role, userKioskId);

    const token = createToken({
      userId: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,
      role,
      kioskId: userKioskId,
      sessionVersion: 1,
    });

    res.json({
      ok: true,
      token,
      user: {
        id: dbUser.id,
        username: dbUser.username,
        name: dbUser.name,
        role,
        kioskId: userKioskId,
        assignedKiosks,
      },
    });
  } catch (e) {
    console.warn("Error querying db users during login:", e);
    res.status(500).json({ error: "Error al procesar el inicio de sesión" });
  }
});


router.get("/admin/verify", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  const assignedKiosks = await getUserAssignedKiosks(
    user.userId,
    user.role,
    user.kioskId
  );
  res.json({
    ok: true,
    user: {
      ...user,
      id: user.userId,
      assignedKiosks,
    },
  });
});

// GET /auth/invitations/:token - Validate an invitation token before displaying the activation screen
router.get("/auth/invitations/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  if (!token || typeof token !== "string" || !token.trim()) {
    res.status(400).json({ error: "Token de invitación inválido o ausente" });
    return;
  }

  try {
    const tokenHash = hashInvitationToken(token.trim());

    const [invitation] = await db
      .select()
      .from(adminInvitationsTable)
      .where(eq(adminInvitationsTable.tokenHash, tokenHash))
      .limit(1);

    if (!invitation) {
      res.status(404).json({ error: "Invitación no encontrada o enlace inválido" });
      return;
    }

    if (invitation.acceptedAt) {
      res.status(400).json({
        error: "Esta invitación ya fue utilizada previamente. Inicie sesión con su usuario y contraseña.",
        alreadyAccepted: true,
      });
      return;
    }

    const now = new Date();
    if (new Date(invitation.expiresAt) < now) {
      res.status(400).json({
        error: "El enlace de invitación ha expirado. Solicite al SuperAdministrador un nuevo reenvío de invitación.",
        expired: true,
      });
      return;
    }

    // Get kiosk name
    const [kiosk] = await db
      .select({ id: kiosksTable.id, name: kiosksTable.name, slug: kiosksTable.slug })
      .from(kiosksTable)
      .where(eq(kiosksTable.id, invitation.kioskId))
      .limit(1);

    res.json({
      ok: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        kioskId: invitation.kioskId,
        kioskName: kiosk?.name || invitation.kioskId,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (err) {
    console.error("Error validating invitation:", err);
    res.status(500).json({ error: "Error al validar la invitación" });
  }
});

// POST /auth/invitations/accept - Accept invitation, create password, activate account, and link kiosk
router.post("/auth/invitations/accept", async (req, res): Promise<void> => {
  const { token, password, confirmPassword } = req.body || {};

  if (!token || typeof token !== "string" || !token.trim()) {
    res.status(400).json({ error: "Token de invitación obligatorio" });
    return;
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    return;
  }

  if (confirmPassword && password !== confirmPassword) {
    res.status(400).json({ error: "Las contraseñas no coinciden" });
    return;
  }

  try {
    const tokenHash = hashInvitationToken(token.trim());

    const [invitation] = await db
      .select()
      .from(adminInvitationsTable)
      .where(eq(adminInvitationsTable.tokenHash, tokenHash))
      .limit(1);

    if (!invitation) {
      res.status(404).json({ error: "Invitación no encontrada o token inválido" });
      return;
    }

    if (invitation.acceptedAt) {
      res.status(400).json({
        error: "Esta invitación ya fue utilizada previamente. Inicie sesión normalmente.",
        alreadyAccepted: true,
      });
      return;
    }

    const now = new Date();
    if (new Date(invitation.expiresAt) < now) {
      res.status(400).json({
        error: "El enlace de invitación ha expirado. Solicite un nuevo reenvío.",
        expired: true,
      });
      return;
    }

    const cleanEmail = invitation.email.trim().toLowerCase();

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, cleanEmail))
      .limit(1);

    if (existingUser) {
      // If user exists, update password, activate and assign kiosk
      const { hash, salt } = hashPassword(password);
      await db
        .update(usersTable)
        .set({
          passwordHash: hash,
          salt,
          active: true,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existingUser.id));

      await db
        .insert(userKiosksTable)
        .values({ userId: existingUser.id, kioskId: invitation.kioskId })
        .onConflictDoNothing();

      // Mark invitation as accepted and invalidate token
      await db
        .update(adminInvitationsTable)
        .set({
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(adminInvitationsTable.id, invitation.id));

      const assignedKiosks = await getUserAssignedKiosks(existingUser.id, "admin", invitation.kioskId);

      const authToken = createToken({
        userId: existingUser.id,
        username: existingUser.username,
        name: existingUser.name,
        role: "admin",
        kioskId: invitation.kioskId,
        sessionVersion: 1,
      });

      res.json({
        ok: true,
        message: "Cuenta activada con éxito",
        token: authToken,
        user: {
          id: existingUser.id,
          username: existingUser.username,
          name: existingUser.name,
          role: "admin",
          kioskId: invitation.kioskId,
          assignedKiosks,
        },
      });
      return;
    }

    // Create new admin user
    const { hash, salt } = hashPassword(password);
    const userId = "usr_" + Date.now() + Math.random().toString(36).substring(2, 7);

    const [newUser] = await db
      .insert(usersTable)
      .values({
        id: userId,
        username: cleanEmail,
        name: invitation.name,
        passwordHash: hash,
        salt,
        role: "admin",
        kioskId: invitation.kioskId,
        active: true,
      })
      .returning();

    // Link user to the assigned kiosk
    await db
      .insert(userKiosksTable)
      .values({ userId: newUser.id, kioskId: invitation.kioskId })
      .onConflictDoNothing();

    // Mark invitation as accepted
    await db
      .update(adminInvitationsTable)
      .set({
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adminInvitationsTable.id, invitation.id));

    const assignedKiosks = await getUserAssignedKiosks(newUser.id, "admin", invitation.kioskId);

    const authToken = createToken({
      userId: newUser.id,
      username: newUser.username,
      name: newUser.name,
      role: "admin",
      kioskId: invitation.kioskId,
      sessionVersion: 1,
    });

    res.status(201).json({
      ok: true,
      message: "¡Cuenta creada y activada con éxito!",
      token: authToken,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: "admin",
        kioskId: invitation.kioskId,
        assignedKiosks,
      },
    });
  } catch (err) {
    console.error("Error accepting invitation:", err);
    res.status(500).json({ error: "Error al activar la cuenta" });
  }
});

export default router;
