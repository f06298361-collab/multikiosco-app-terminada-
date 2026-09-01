import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Users,
  ShieldCheck,
  Server,
  UserPlus,
  RotateCcw,
  LogOut,
  KeyRound,
  CheckCircle2,
  XCircle,
  Activity,
  Lock,
  Cpu,
  Store,
  Plus,
  Trash2,
  Edit2,
  Power,
  X,
} from "lucide-react";
import { store, type AdminUser } from "../store";

export function SuperAdminPanel({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "users" | "security" | "system"
  >("dashboard");

  // State for Users tab
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");

  // Create user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "superadmin">("admin");
  const [newKioskId, setNewKioskId] = useState<string>("");
  const [kiosksList, setKiosksList] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [creating, setCreating] = useState(false);

  // Manage kiosks modal
  const [managingKiosksUser, setManagingKiosksUser] = useState<AdminUser | null>(null);
  const [selectedKioskToAdd, setSelectedKioskToAdd] = useState<string>("");

  // Multi-select for creation
  const [selectedKioskIdsForNewUser, setSelectedKioskIdsForNewUser] = useState<string[]>([]);

  // Reset password state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordText, setResetPasswordText] = useState("");
  const [resetting, setResetting] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingError, setEditingError] = useState("");

  // Delete user state
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleOpenEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.username);
    setEditingError("");
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim()) {
      setEditingError("El nombre es obligatorio.");
      return;
    }
    if (!editEmail.trim()) {
      setEditingError("El email es obligatorio.");
      return;
    }

    setEditingLoading(true);
    setEditingError("");

    const res = await store.updateAdminUser(editingUser.id, {
      name: editName.trim(),
      email: editEmail.trim().toLowerCase(),
    });
    setEditingLoading(false);

    if (res.ok) {
      setEditingUser(null);
      setUserSuccess(`Administrador "${editName.trim()}" actualizado correctamente.`);
      void loadUsers();
    } else {
      setEditingError(res.error || "Error al actualizar administrador.");
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    setDeleteError("");

    const res = await store.deleteAdminUser(userToDelete.id);
    setDeletingUser(false);

    if (res.ok) {
      const deletedName = userToDelete.name;
      setUserToDelete(null);
      setUserSuccess(`Administrador "${deletedName}" eliminado correctamente.`);
      void loadUsers();
    } else {
      setDeleteError(res.error || "Error al eliminar administrador.");
    }
  };

  const handleAssignKiosk = async (userId: string, kioskId: string) => {
    if (!kioskId) return;
    setUserError("");
    setUserSuccess("");
    const res = await store.assignKioskToUser(userId, kioskId);
    if (res.ok) {
      setUserSuccess("Tienda asignada correctamente.");
      void loadUsers();
      if (managingKiosksUser) {
        setManagingKiosksUser((prev) =>
          prev ? { ...prev, assignedKiosks: res.assignedKiosks } : null
        );
      }
    } else {
      setUserError(res.error || "Error al asignar tienda.");
    }
  };

  const handleUnassignKiosk = async (userId: string, kioskId: string) => {
    setUserError("");
    setUserSuccess("");
    const res = await store.unassignKioskFromUser(userId, kioskId);
    if (res.ok) {
      setUserSuccess("Tienda desasignada correctamente.");
      void loadUsers();
      if (managingKiosksUser) {
        setManagingKiosksUser((prev) =>
          prev ? { ...prev, assignedKiosks: res.assignedKiosks } : null
        );
      }
    } else {
      setUserError(res.error || "Error al desasignar tienda.");
    }
  };

  // System info
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loadingSystem, setLoadingSystem] = useState(false);

  const currentUser = store.getAdminUser();

  const loadUsers = async () => {
    setLoadingUsers(true);
    setUserError("");
    try {
      const [list, kioskRes] = await Promise.all([
        store.fetchAdminUsers(),
        store.fetchKiosks(),
      ]);
      setUsers(list);
      if (kioskRes.ok && kioskRes.kiosks) {
        setKiosksList(kioskRes.kiosks);
        if (kioskRes.kiosks.length > 0) {
          const firstKiosk = kioskRes.kiosks[0];
          if (firstKiosk?.id) {
            setNewKioskId((prev) => prev || firstKiosk.id);
          }
        }
      }
    } catch (e: any) {
      setUserError("Error al cargar la lista de administradores.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadSystem = async () => {
    setLoadingSystem(true);
    try {
      const info = await store.fetchSystemInfo();
      setSystemInfo(info);
    } catch {
      // fallback
    } finally {
      setLoadingSystem(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      void loadUsers();
    } else if (activeTab === "system") {
      void loadSystem();
    }
  }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newName || !newPassword) return;
    setCreating(true);
    setUserError("");
    setUserSuccess("");

    const kioskIds = newRole === "admin"
      ? (selectedKioskIdsForNewUser.length > 0 ? selectedKioskIdsForNewUser : [newKioskId])
      : [];

    const res = await store.createAdminUser({
      username: newUsername,
      name: newName,
      password: newPassword,
      role: newRole,
      kioskId: newRole === "admin" ? (kioskIds[0] || newKioskId) : null,
      kioskIds: newRole === "admin" ? kioskIds : [],
    });

    setCreating(false);
    if (res.ok) {
      setUserSuccess(`Administrador "${newName}" creado correctamente.`);
      setShowCreateModal(false);
      setNewUsername("");
      setNewName("");
      setNewPassword("");
      setNewRole("admin");
      setSelectedKioskIdsForNewUser([]);
      void loadUsers();
    } else {
      setUserError(res.error || "Error al crear administrador");
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    setUserError("");
    setUserSuccess("");
    const res = await store.updateAdminUser(user.id, { active: !user.active });
    if (res.ok) {
      setUserSuccess(
        `Estado de "${user.name}" cambiado a ${!user.active ? "Activo" : "Inactivo"}.`,
      );
      void loadUsers();
    } else {
      setUserError(res.error || "Error al cambiar estado.");
    }
  };

  const handleRoleChange = async (
    user: AdminUser,
    role: "admin" | "superadmin",
  ) => {
    setUserError("");
    setUserSuccess("");
    const res = await store.updateAdminUser(user.id, { role });
    if (res.ok) {
      setUserSuccess(`Rol de "${user.name}" actualizado a ${role}.`);
      void loadUsers();
    } else {
      setUserError(res.error || "Error al actualizar rol.");
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPasswordText) return;
    setResetting(true);
    setUserError("");
    setUserSuccess("");

    const res = await store.resetAdminPassword(resetUserId, resetPasswordText);
    setResetting(false);
    if (res.ok) {
      setUserSuccess("Contraseña restablecida y sesiones revocadas correctamente.");
      setResetUserId(null);
      setResetPasswordText("");
    } else {
      setUserError(res.error || "Error al restablecer la contraseña.");
    }
  };

  const handleRevokeSessions = async (user: AdminUser) => {
    if (
      !window.confirm(
        `¿Seguro que deseas revocar todas las sesiones activas de "${user.name}"?`,
      )
    ) {
      return;
    }
    setUserError("");
    setUserSuccess("");
    const res = await store.revokeAdminSessions(user.id);
    if (res.ok) {
      setUserSuccess(`Sesiones de "${user.name}" revocadas.`);
    } else {
      setUserError(res.error || "Error al revocar sesiones.");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-5xl mx-auto w-full">
      {/* Header Panel Super Admin */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">
                Panel Super Administrador
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                GLOBAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sesión activa:{" "}
              <span className="text-slate-200 font-medium">
                {currentUser?.name || currentUser?.username || "Super Admin"}
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition active:scale-95 border border-slate-700 self-start md:self-auto"
        >
          <LogOut className="h-4 w-4" /> Cerrar Sesión
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border/60 pb-2">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition ${
            activeTab === "dashboard"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          <Activity className="h-4 w-4" /> Dashboard
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition ${
            activeTab === "users"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          <Users className="h-4 w-4" /> Administradores
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition ${
            activeTab === "security"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          <ShieldCheck className="h-4 w-4" /> Seguridad
        </button>
        <button
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition ${
            activeTab === "system"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          <Server className="h-4 w-4" /> Sistema
        </button>
      </div>

      {/* Global feedback messages */}
      {userError && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          <XCircle className="h-4 w-4 shrink-0" />
          <span>{userError}</span>
        </div>
      )}
      {userSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{userSuccess}</span>
        </div>
      )}

      {/* ── Tab 1: DASHBOARD ── */}
      {activeTab === "dashboard" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Rol de Usuario
                </p>
                <h3 className="text-lg font-bold text-foreground">
                  Super Admin
                </h3>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Estado de Seguridad
                </p>
                <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  Protegido (HMAC)
                </h3>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Plataforma
                </p>
                <h3 className="text-lg font-bold text-foreground">
                  Servidor On
                </h3>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm flex flex-col gap-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Atribuciones del Super
              Administrador
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50">
                <p className="font-semibold text-foreground mb-1">
                  👥 Gestión de Administradores
                </p>
                <p className="text-xs">
                  Alta de nuevos administradores, activación/desactivación de cuentas y
                  asignación de roles.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50">
                <p className="font-semibold text-foreground mb-1">
                  🔑 Control de Contraseñas y Sesiones
                </p>
                <p className="text-xs">
                  Restablecimiento seguro de claves y revocación inmediata de tokens de
                  sesión.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50">
                <p className="font-semibold text-foreground mb-1">
                  ⚙️ Información de Sistema
                </p>
                <p className="text-xs">
                  Acceso a métricas del servidor backend, estado del runtime y
                  tiempos de actividad.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/50">
                <p className="font-semibold text-foreground mb-1">
                  🌐 Preparado para Multikiosco
                </p>
                <p className="text-xs">
                  Estructura centralizada para incorporar administración global de kioscos
                  en fases futuras.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: ADMINISTRADORES ── */}
      {activeTab === "users" && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Usuarios Administradores</h2>
              <p className="text-xs text-muted-foreground">
                Crea, activa o modifica permisos de los administradores.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm shadow-sm transition hover:opacity-90 active:scale-95"
            >
              <UserPlus className="h-4 w-4" /> Crear Administrador
            </button>
          </div>

          {/* List Users */}
          {loadingUsers ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Cargando administradores...
            </p>
          ) : users.length === 0 ? (
            <div className="p-8 rounded-3xl border border-dashed border-border text-center flex flex-col items-center gap-2">
              <Users className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm font-semibold">No hay usuarios creados en la DB</p>
              <p className="text-xs text-muted-foreground max-w-md">
                Nota: La autenticación mediante la variable de entorno{" "}
                <code className="text-primary font-mono">ADMIN_PASSWORD</code> o{" "}
                <code className="text-primary font-mono">SUPERADMIN_PASSWORD</code>{" "}
                sigue estando activa de forma predeterminada. Podés crear usuarios específicos en la DB abajo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold ${
                        u.role === "superadmin"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {u.role === "superadmin" ? "SUPER" : "ADMIN"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          {u.name}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          (@{u.username})
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            u.active
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-destructive/15 text-destructive"
                          }`}
                        >
                          {u.active ? "ACTIVO" : "INACTIVO"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">
                          Rol: {u.role === "superadmin" ? "Super Admin (Global)" : "Admin"}
                        </span>
                        {u.role === "admin" && (
                          <div className="flex flex-wrap items-center gap-1 ml-1">
                            {u.assignedKiosks && u.assignedKiosks.length > 0 ? (
                              u.assignedKiosks.map((k) => (
                                <span
                                  key={k.id}
                                  className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                >
                                  {k.name}
                                </span>
                              ))
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-muted text-muted-foreground">
                                {kiosksList.find((k) => k.id === u.kioskId)?.name || u.kioskId || "Sin tienda"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Edit button */}
                    <button
                      onClick={() => handleOpenEditUser(u)}
                      className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-semibold hover:bg-muted transition flex items-center gap-1 text-foreground"
                      title="Editar nombre y email"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-primary" /> Editar
                    </button>

                    {/* Manage Kiosks button for Admins */}
                    {u.role === "admin" && (
                      <button
                        onClick={() => {
                          setManagingKiosksUser(u);
                          setSelectedKioskToAdd("");
                        }}
                        className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition flex items-center gap-1"
                        title="Asignar o desasignar tiendas"
                      >
                        <Store className="h-3.5 w-3.5" /> Tiendas ({u.assignedKiosks?.length || (u.kioskId ? 1 : 0)})
                      </button>
                    )}

                    {/* Active toggle */}
                    <button
                      onClick={() => void handleToggleActive(u)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition flex items-center gap-1 ${
                        u.active
                          ? "border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                          : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {u.active ? "Desactivar" : "Activar"}
                    </button>

                    {/* Delete button (non-superadmin) */}
                    {u.role !== "superadmin" && (
                      <button
                        onClick={() => {
                          setDeleteError("");
                          setUserToDelete(u);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold hover:bg-destructive/10 transition flex items-center gap-1"
                        title="Eliminar administrador"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </button>
                    )}

                    {/* Role toggle */}
                    <button
                      onClick={() =>
                        void handleRoleChange(
                          u,
                          u.role === "superadmin" ? "admin" : "superadmin",
                        )
                      }
                      className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-medium hover:bg-muted transition"
                      title="Cambiar rol"
                    >
                      Hacer {u.role === "superadmin" ? "Admin" : "SuperAdmin"}
                    </button>

                    {/* Reset password */}
                    <button
                      onClick={() => {
                        setResetUserId(u.id);
                        setResetPasswordText("");
                      }}
                      className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-medium hover:bg-muted transition flex items-center gap-1"
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Clave
                    </button>

                    {/* Revoke sessions */}
                    <button
                      onClick={() => void handleRevokeSessions(u)}
                      className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-medium hover:bg-destructive/10 hover:text-destructive transition flex items-center gap-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Revocar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal Crear Administrador */}
          {showCreateModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-card p-6 rounded-3xl border border-border shadow-2xl flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold">Crear Nuevo Administrador</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Asigná un email/identificador y una contraseña propia para el panel de la tienda.
                  </p>
                </div>
                <form onSubmit={(e) => void handleCreateUser(e)} className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Email / Identificador de acceso
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Ej: admin-mendoza@gmail.com"
                      required
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Nombre del Administrador / Alias
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ej: Juan Pérez - Kiosco Mendoza"
                      required
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Contraseña para el panel (mín. 6 caracteres)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                      ⚠️ Esta contraseña es propia para ingresar a la plataforma. Nunca utilices la contraseña real del correo personal del cliente.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Rol de Usuario
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) =>
                        setNewRole(e.target.value as "admin" | "superadmin")
                      }
                      className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                    >
                      <option value="admin">Administrador (Kiosco Específico)</option>
                      <option value="superadmin">Super Administrador (Acceso Global)</option>
                    </select>
                  </div>

                  {newRole === "admin" && (
                    <div>
                      <label className="text-xs font-semibold text-foreground">
                        Tienda / Kiosco Asignado
                      </label>
                      <select
                        value={newKioskId}
                        onChange={(e) => setNewKioskId(e.target.value)}
                        className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                      >
                        {kiosksList.length > 0 ? (
                          kiosksList.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.name} ({k.slug})
                            </option>
                          ))
                        ) : (
                          <option value="">(No hay kioscos creados)</option>
                        )}
                      </select>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                        🔒 Este usuario solo podrá ver y gestionar productos, pedidos y configuraciones de esta tienda.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
                    >
                      {creating ? "Guardando..." : "Crear Administrador"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Restablecer Contraseña */}
          {resetUserId && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-card p-6 rounded-3xl border border-border shadow-2xl flex flex-col gap-4">
                <h3 className="text-lg font-bold">Restablecer Contraseña</h3>
                <p className="text-xs text-muted-foreground">
                  Ingresá la nueva clave. La clave anterior se reemplazará y no
                  se mostrará nunca.
                </p>
                <input
                  type="password"
                  value={resetPasswordText}
                  onChange={(e) => setResetPasswordText(e.target.value)}
                  placeholder="Nueva contraseña (mín 6 car.)"
                  minLength={6}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResetUserId(null)}
                    className="px-4 py-2 rounded-xl border border-border text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={resetting || resetPasswordText.length < 6}
                    onClick={() => void handleResetPassword()}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {resetting ? "Guardando..." : "Restablecer"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Gestionar Tiendas Asignadas */}
          {managingKiosksUser && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-card p-6 rounded-3xl border border-border shadow-2xl flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Store className="h-5 w-5 text-amber-500" />
                    Tiendas de {managingKiosksUser.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Un administrador puede gestionar una o múltiples tiendas con las mismas credenciales.
                  </p>
                </div>

                {/* Tiendas actualmente asignadas */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-foreground">Tiendas asignadas actualmente:</span>
                  {managingKiosksUser.assignedKiosks && managingKiosksUser.assignedKiosks.length > 0 ? (
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {managingKiosksUser.assignedKiosks.map((k) => (
                        <div
                          key={k.id}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/40 text-xs"
                        >
                          <span className="font-semibold text-foreground">{k.name} ({k.slug})</span>
                          <button
                            type="button"
                            onClick={() => void handleUnassignKiosk(managingKiosksUser.id, k.id)}
                            className="p-1 rounded-lg text-destructive hover:bg-destructive/10 transition"
                            title="Desasignar tienda"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-2">
                      Sin tiendas asignadas específicamente.
                    </p>
                  )}
                </div>

                {/* Asignar nueva tienda */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <span className="text-xs font-bold text-foreground">Asignar nueva tienda:</span>
                  <div className="flex gap-2">
                    <select
                      value={selectedKioskToAdd}
                      onChange={(e) => setSelectedKioskToAdd(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs outline-none focus:border-primary"
                    >
                      <option value="">-- Seleccionar tienda --</option>
                      {kiosksList
                        .filter(
                          (k) =>
                            !managingKiosksUser.assignedKiosks?.some(
                              (ak) => ak.id === k.id
                            )
                        )
                        .map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name} ({k.slug})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedKioskToAdd}
                      onClick={() => void handleAssignKiosk(managingKiosksUser.id, selectedKioskToAdd)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Asignar
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setManagingKiosksUser(null)}
                    className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Editar Administrador */}
          {editingUser && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-card p-6 rounded-3xl border border-border shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Edit2 className="h-5 w-5 text-primary" /> Editar Administrador
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingLoading) setEditingUser(null);
                    }}
                    className="p-1 rounded-xl text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {editingError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-2xl">
                    {editingError}
                  </div>
                )}

                <form onSubmit={(e) => void handleEditUserSubmit(e)} className="flex flex-col gap-3.5">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Ej: Laura Gómez"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Email / Usuario de acceso *
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Ej: laura@negocio.com"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      El userId, contraseñas y permisos del administrador se mantendrán intactos.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border/40">
                    <button
                      type="button"
                      disabled={editingLoading}
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={editingLoading}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition disabled:opacity-50"
                    >
                      {editingLoading ? "Guardando..." : "Guardar Cambios"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Confirmar Eliminación */}
          {userToDelete && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-card p-6 rounded-3xl border border-border shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between text-destructive">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
                      <Trash2 className="h-5 w-5 text-destructive" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">Eliminar Administrador</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!deletingUser) setUserToDelete(null);
                    }}
                    className="p-1 rounded-xl text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-muted-foreground">
                    ¿Estás seguro de que deseas eliminar permanentemente a{" "}
                    <strong className="text-foreground font-bold">{userToDelete.name}</strong> (@{userToDelete.username})?
                  </p>

                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-[11px] rounded-xl font-medium">
                    ⚠️ El usuario perderá inmediatamente el acceso a la plataforma y todas sus sesiones activas serán invalidadas.
                  </div>

                  {deleteError && (
                    <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-xl">
                      {deleteError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                    <button
                      type="button"
                      disabled={deletingUser}
                      onClick={() => setUserToDelete(null)}
                      className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={deletingUser}
                      onClick={() => void handleDeleteUserConfirm()}
                      className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {deletingUser ? "Eliminando..." : "Eliminar Definitivamente"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: SEGURIDAD ── */}
      {activeTab === "security" && (
        <div className="flex flex-col gap-5">
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm flex flex-col gap-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Lock className="h-5 w-5 text-emerald-600" /> Políticas de Seguridad
              y Autenticación
            </h2>

            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60">
                <p className="font-semibold text-foreground">
                  🛡️ Autenticación mediante Tokens Firmados
                </p>
                <p className="text-xs mt-1">
                  Se generan tokens firmados digitalmente mediante HMAC SHA-256. El backend
                  valida la firma en cada petición privilegiada.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60">
                <p className="font-semibold text-foreground">
                  🚫 Protección estricta en el Backend
                </p>
                <p className="text-xs mt-1">
                  Las operaciones administrativas requieren el middleware{" "}
                  <code className="text-primary font-mono">requireAdmin</code> o{" "}
                  <code className="text-primary font-mono">requireSuperAdmin</code>.
                  El rol enviado por el cliente es ignorado por completo si no está firmado en el token.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border/60">
                <p className="font-semibold text-foreground">
                  🔑 Almacenamiento seguro de claves
                </p>
                <p className="text-xs mt-1">
                  Las contraseñas creadas en la base de datos se almacenan con salt aleatorio
                  y hash de derivación PBKDF2 (SHA-512) con 10,000 iteraciones. Nunca quedan en texto plano.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: SISTEMA ── */}
      {activeTab === "system" && (
        <div className="flex flex-col gap-5">
          <div className="p-6 rounded-3xl border border-border bg-card shadow-sm flex flex-col gap-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" /> Información del Servidor Backend
            </h2>

            {loadingSystem ? (
              <p className="text-sm text-muted-foreground py-4">
                Consultando estado del servidor...
              </p>
            ) : systemInfo?.system ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 capitalize">
                    {systemInfo.system.status}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground">Entorno</span>
                  <p className="font-bold text-foreground">
                    {systemInfo.system.environment}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground">
                    Tiempo de actividad (Uptime)
                  </span>
                  <p className="font-bold text-foreground">
                    {systemInfo.system.uptimeSeconds} segundos
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-xs text-muted-foreground">Versión</span>
                  <p className="font-bold text-foreground">
                    {systemInfo.system.version}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Servidor activo sin métricas adicionales.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
