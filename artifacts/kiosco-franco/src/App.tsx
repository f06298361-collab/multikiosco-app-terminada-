/**
 * Kiosco Franco – App principal
 *
 * Arquitectura escalable (multi-negocio / multi-tenant):
 * -------------------------------------------------------
 * - Roles: "cliente" | "admin" | "superadmin"
 * - Cada negocio tiene su propio tenantId (hoy: "kiosco-franco")
 * - SuperAdmin puede gestionar todos los negocios de la plataforma
 * - Admin gestiona su propio negocio (productos, pedidos, configuración)
 * - Cliente ve la tienda y hace pedidos
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingCart,
  Store,
  Receipt,
  Lock,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  Check,
  ExternalLink,
  Package,
  Pencil,
  X,
  Settings2,
  LayoutGrid,
  Users,
  ChevronRight,
  Copy,
  QrCode,
  CreditCard,
  Banknote,
  ZoomIn,
  ImageOff,
  ClipboardCheck,
  SlidersHorizontal,
  Download,
  Smartphone,
  Share2,
  Flame,
  Megaphone,
  BarChart3,
  Palette,
  Sparkles,
  Eye,
  MapPin,
  Clock,
  LogIn,
  LogOut,
  Truck,
  ShieldCheck,
  Search,
  Bell,
  BellOff,
  CheckCheck,
  HelpCircle,
  MessageCircle,
  Mail,
  Send,
  CheckCircle2,
  RefreshCw,
  Power,
  Edit2,
  Volume2,
  Calendar,
  DollarSign,
} from "lucide-react";
import {
  store,
  useStore,
  formatPrice,
  buildWhatsappUrl,
  type Order,
  type OrderStatus,
  type Product,
  type Kiosk,
  type NotificationItem,
  type AdminInvitation,
  type AdminUser,
} from "./store";
import { AcceptInvitationScreen } from "./AcceptInvitationScreen";

// ─── Tipos y constantes ──────────────────────────────────────────────────────

type Screen =
  | "products"
  | "cart"
  | "checkout"
  | "payment"
  | "confirmation"
  | "admin"
  | "superadmin"
  | "accept-invitation";
type Role = "cliente" | "admin" | "superadmin";

const STATUS_LABEL: Record<OrderStatus, string> = {
  nuevo: "Nuevo",
  preparacion: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  nuevo: "bg-rose-50 text-rose-700 border border-rose-200",
  preparacion: "bg-amber-50 text-amber-700 border border-amber-200",
  listo: "bg-sky-50 text-sky-700 border border-sky-200",
  entregado: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

// ─── Visor de imágenes ────────────────────────────────────────────────────────

function ImageViewer({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Gesture start state
  const startRef = useRef<{
    scale: number;
    x: number;
    y: number;
    t1: { x: number; y: number };
    t2?: { x: number; y: number };
    dist: number;
  } | null>(null);

  // Prevent body scroll while viewer is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const resetToFit = useCallback(() => {
    setAnimating(true);
    setTransform({ scale: 1, x: 0, y: 0 });
    setTimeout(() => setAnimating(false), 280);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const cur = transformRef.current;
    const t = e.touches;
    const t1 = { x: t[0].clientX, y: t[0].clientY };
    if (t.length >= 2) {
      const t2 = { x: t[1].clientX, y: t[1].clientY };
      const dist = Math.hypot(t2.x - t1.x, t2.y - t1.y);
      startRef.current = { scale: cur.scale, x: cur.x, y: cur.y, t1, t2, dist };
    } else {
      startRef.current = { scale: cur.scale, x: cur.x, y: cur.y, t1, dist: 0 };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const g = startRef.current;
    if (!g) return;
    const t = e.touches;

    if (t.length >= 2 && g.t2 && g.dist > 0) {
      // Pinch-to-zoom
      const cur1 = { x: t[0].clientX, y: t[0].clientY };
      const cur2 = { x: t[1].clientX, y: t[1].clientY };
      const curDist = Math.hypot(cur2.x - cur1.x, cur2.y - cur1.y);
      const newScale = Math.max(1, Math.min(6, g.scale * (curDist / g.dist)));

      // Pan from midpoint shift
      const startMidX = (g.t1.x + g.t2.x) / 2;
      const startMidY = (g.t1.y + g.t2.y) / 2;
      const curMidX = (cur1.x + cur2.x) / 2;
      const curMidY = (cur1.y + cur2.y) / 2;

      setAnimating(false);
      setTransform({
        scale: newScale,
        x: g.x + (curMidX - startMidX),
        y: g.y + (curMidY - startMidY),
      });
    } else if (t.length === 1 && g.scale > 1) {
      // Pan when zoomed
      const dx = t[0].clientX - g.t1.x;
      const dy = t[0].clientY - g.t1.y;
      setAnimating(false);
      setTransform({ scale: g.scale, x: g.x + dx, y: g.y + dy });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const cur = transformRef.current;
    if (e.touches.length === 0) {
      startRef.current = null;
      if (cur.scale <= 1.05) resetToFit();
    } else {
      // Re-anchor for remaining touches
      const t = e.touches;
      const t1 = { x: t[0].clientX, y: t[0].clientY };
      startRef.current = { scale: cur.scale, x: cur.x, y: cur.y, t1, dist: 0 };
    }
  };

  const { scale, x, y } = transform;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{ touchAction: "none" }}
      onClick={() => scale <= 1 && onClose()}
    >
      {/* Header bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-safe pb-3 pt-4">
        <p className="line-clamp-1 text-sm font-medium text-white/70">{alt}</p>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm active:bg-white/20"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Image container */}
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: "none" }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{
            transform: `translate(${x}px, ${y}px) scale(${scale})`,
            transition: animating ? "transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)" : "none",
            willChange: "transform",
          }}
        />
      </div>

      {/* Hint when at normal scale */}
      {scale <= 1 && (
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/40 select-none">
          Pellizca para hacer zoom · Toca fuera para cerrar
        </p>
      )}
    </div>
  );
}

// ─── Componente ToastContainer y Centro de Notificaciones ────────────────────

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Hace un momento";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Hace ${diffDays} d`;
}

function NotificationCenterModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const notifications = useStore((s) => s.notifications || []);
  const view = useStore((s) => s.view);
  const selectedKioskId = useStore((s) => s.selectedKioskId);

  if (!isOpen) return null;

  const isAdminView = view === "admin" || view === "superadmin";
  const lastOrderId = typeof window !== "undefined" ? localStorage.getItem("kiosco-franco-last-order-v1") : null;

  const scopedNotifications = notifications.filter((n) => {
    if (isAdminView) {
      return n.forAdmin === true && (!n.kioskId || n.kioskId === selectedKioskId);
    } else {
      return n.forAdmin !== true && (!n.kioskId || n.kioskId === selectedKioskId || (lastOrderId && n.orderId === lastOrderId));
    }
  });

  const unreadCount = scopedNotifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    store.markAllNotificationsAsRead(isAdminView, selectedKioskId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-md max-h-[80vh] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-tight">
                Notificaciones
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} no leída${unreadCount > 1 ? "s" : ""}` : "Todas leídas"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Marcar leídas</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
              aria-label="Cerrar"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-border/40">
          {scopedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                <BellOff className="h-6 w-6" />
              </div>
              <h4 className="text-xs font-semibold text-foreground">Sin notificaciones</h4>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
                Te avisaremos aquí sobre las novedades y el estado de tus pedidos.
              </p>
            </div>
          ) : (
            scopedNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => store.markNotificationAsRead(n.id)}
                className={`flex items-start gap-3 p-3 transition rounded-xl cursor-pointer ${
                  !n.read ? "bg-primary/5 font-medium hover:bg-primary/10" : "hover:bg-muted/40"
                }`}
                title="Hacé clic para marcar como atendida"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-card border border-border shadow-2xs mt-0.5">
                  {n.type === "order" ? (
                    <Megaphone className="h-4 w-4 text-primary" />
                  ) : n.type === "success" ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-sky-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-foreground leading-snug truncate">
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatTimeAgo(n.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words">
                    {n.message}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      store.markNotificationAsRead(n.id);
                    }}
                    className="p-1 text-primary hover:bg-primary/10 rounded-lg transition"
                    title="Marcar como atendida"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      store.deleteNotification(n.id);
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition"
                    title="Eliminar notificación"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationBellButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const notifications = useStore((s) => s.notifications || []);
  const view = useStore((s) => s.view);
  const selectedKioskId = useStore((s) => s.selectedKioskId);

  const isAdminView = view === "admin" || view === "superadmin";
  const lastOrderId = typeof window !== "undefined" ? localStorage.getItem("kiosco-franco-last-order-v1") : null;

  const scopedNotifications = notifications.filter((n) => {
    if (isAdminView) {
      return n.forAdmin === true && (!n.kioskId || n.kioskId === selectedKioskId);
    } else {
      return n.forAdmin !== true && (!n.kioskId || n.kioskId === selectedKioskId || (lastOrderId && n.orderId === lastOrderId));
    }
  });

  const unreadCount = scopedNotifications.filter((n) => !n.read).length;

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
        title="Ver notificaciones"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-xs border border-white/40 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function ToastContainer() {
  const toasts = useStore((s) => s.toasts || []);
  const selectedKioskId = useStore((s) => s.selectedKioskId);

  const scopedToasts = toasts.filter((t) => !t.kioskId || t.kioskId === selectedKioskId);

  if (!scopedToasts || scopedToasts.length === 0) return null;

  return (
    <div className="fixed bottom-16 right-4 z-[100] flex max-w-sm w-full flex-col gap-2.5 px-3 pointer-events-none transition-all">
      {scopedToasts.map((t) => (
        <div
          key={t.id}
          onClick={() => {
            store.removeToast(t.id);
            const notif = store.getState().notifications.find((n) => n.title === t.title && n.message === t.message);
            if (notif) {
              store.markNotificationAsRead(notif.id);
            }
          }}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-border/80 bg-card p-3.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 cursor-pointer"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {t.type === "order" ? (
              <Megaphone className="h-5 w-5 text-primary" />
            ) : t.type === "success" ? (
              <Check className="h-5 w-5 text-emerald-600" />
            ) : (
              <Sparkles className="h-5 w-5 text-sky-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-foreground leading-snug">{t.title}</h4>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed break-words">{t.message}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              store.removeToast(t.id);
              const notif = store.getState().notifications.find((n) => n.title === t.title && n.message === t.message);
              if (notif) {
                store.markNotificationAsRead(notif.id);
              }
            }}
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── App raíz ────────────────────────────────────────────────────────────────

export default function App() {
  const [invitationToken, setInvitationToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const inv = params.get("invitation") || params.get("invite");
      if (inv) return inv.trim();
    }
    return null;
  });

  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("invitation") || params.get("invite")) return "accept-invitation";
      if (params.get("view") === "admin") return "admin";
      if (params.get("view") === "superadmin") return "superadmin";
    }
    if (store.hasAdminAuth()) {
      const r = store.getAdminRole();
      if (r === "superadmin") return "superadmin";
      if (r === "admin") return "admin";
    }
    return "products";
  });
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [adminAuthed, setAdminAuthed] = useState(() => store.hasAdminAuth());
  const [role, setRole] = useState<Role>(() => store.getAdminRole() || "cliente");

  const cartCount = useStore((s) =>
    s.cart.reduce((sum, i) => sum + i.qty, 0),
  );
  const orders = useStore((s) => s.orders);

  // Sincronización continua y persistente del último pedido realizado por el cliente
  useEffect(() => {
    if (!lastOrder) {
      const lastId = typeof window !== "undefined" ? localStorage.getItem("kiosco-franco-last-order-v1") : null;
      if (lastId) {
        const found = orders.find((o) => o.id === lastId);
        if (found) {
          setLastOrder(found);
        }
      }
    } else {
      const updated = orders.find((o) => o.id === lastOrder.id);
      if (updated && (updated.status !== lastOrder.status || updated.total !== lastOrder.total)) {
        setLastOrder(updated);
      }
    }
  }, [orders, lastOrder]);

  useEffect(() => {
    if (adminAuthed) {
      const u = store.getAdminUser();
      if (u?.role === "admin" && u?.kioskId && u.kioskId !== store.getState().selectedKioskId) {
        store.selectKiosk(u.kioskId);
      }
    }
  }, [adminAuthed, screen]);

  const handleLogout = () => {
    store.logoutAdmin();
    setAdminAuthed(false);
    setRole("cliente");
    setScreen("admin");
  };

  const handleAuthSuccess = (authedRole?: Role) => {
    const finalRole = authedRole || store.getAdminRole() || "admin";
    setAdminAuthed(true);
    setRole(finalRole);
    const u = store.getAdminUser();
    if (finalRole === "admin") {
      const targetKiosk = u?.assignedKiosks?.[0]?.id || u?.kioskId;
      if (targetKiosk) {
        store.selectKiosk(targetKiosk);
      }
      setScreen("admin");
    } else if (finalRole === "superadmin") {
      setScreen("superadmin");
    } else {
      setScreen("admin");
    }
  };

  const handleGoAdmin = () => {
    setScreen("admin");
  };

  const handleSelectScreen = (s: Screen) => {
    setScreen(s);
  };

  const handleConfirmed = (order: Order) => {
    setLastOrder(order);
    if (order.payment === "mercadopago") {
      setScreen("payment");
    } else {
      setScreen("confirmation");
    }
  };

  const handlePaymentDone = () => {
    setScreen("confirmation");
  };

  return (
    <>
      <TopViewSwitcher
        currentScreen={screen}
        onSelectScreen={handleSelectScreen}
      />
      <ToastContainer />

      <div
        className="mx-auto flex h-full w-full max-w-7xl flex-col bg-background transition-all"
        style={{ paddingTop: 44 }}
      >
        {screen !== "superadmin" && (screen !== "admin" || adminAuthed) && <Header currentScreen={screen} />}

        <main className="flex-1 overflow-y-auto pb-24">
          {screen === "products" && (
            <ProductsScreen onGoToCart={() => setScreen("cart")} />
          )}

          {screen === "cart" && (
            <CartScreen
              onBack={() => setScreen("products")}
              onCheckout={() => setScreen("checkout")}
            />
          )}

          {screen === "checkout" && (
            <CheckoutScreen
              onBack={() => setScreen("cart")}
              onConfirmed={handleConfirmed}
            />
          )}

          {screen === "payment" && lastOrder && (
            <MercadoPagoPaymentScreen
              order={lastOrder}
              onDone={handlePaymentDone}
            />
          )}

          {screen === "confirmation" && lastOrder && (
            <ConfirmationScreen
              order={lastOrder}
              onDone={() => setScreen("products")}
            />
          )}

          {screen === "admin" && (
            adminAuthed
              ? <AdminPanel onLogout={handleLogout} />
              : <AdminLogin
                  onAuth={handleAuthSuccess}
                  title="Acceso al panel"
                  subtitle="Ingresá las credenciales de administración"
                />
          )}

          {screen === "superadmin" && (
            (adminAuthed && store.getAdminRole() === "superadmin") ? (
              <SuperAdminPanel
                onLogout={handleLogout}
                onGoToBusiness={() => {
                  setScreen("admin");
                }}
              />
            ) : (
              <div className="p-4 flex flex-col items-center">
                <div className="w-full my-3 rounded-2xl bg-amber-50 border border-amber-200/80 p-4 text-xs text-amber-900 shadow-xs flex items-start gap-3">
                  <Lock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-amber-950">Acceso a Administración Central</p>
                    <p className="mt-1 text-amber-800 leading-relaxed">
                      Inicie sesión con su usuario de <strong>SuperAdmin</strong> para acceder a las herramientas administrativas globales de la plataforma.
                    </p>
                  </div>
                </div>
                <div className="w-full">
                  <AdminLogin
                    onAuth={handleAuthSuccess}
                    title="Acceso a Plataforma"
                    subtitle="Credenciales de SuperAdmin"
                  />
                </div>
              </div>
            )
          )}

          {screen === "accept-invitation" && (
            <AcceptInvitationScreen
              token={invitationToken || ""}
              onSuccess={() => {
                setAdminAuthed(true);
                const r = store.getAdminRole() || "admin";
                setRole(r);
                setInvitationToken(null);
                setScreen(r === "superadmin" ? "superadmin" : "admin");
              }}
              onCancel={() => {
                setInvitationToken(null);
                setScreen("products");
              }}
            />
          )}
        </main>

        <BottomNav
          current={screen}
          role={role}
          cartCount={cartCount}
          onChange={(s) => {
            if (s === "admin") handleGoAdmin();
            else setScreen(s);
          }}
        />
      </div>
    </>
  );
}

// ─── Barra de Selector de Vista Superior ──────────────────────────────────────

function TopViewSwitcher({
  currentScreen,
  onSelectScreen,
}: {
  currentScreen: Screen;
  onSelectScreen: (s: Screen) => void;
}) {
  const isClientView = [
    "products",
    "cart",
    "checkout",
    "payment",
    "confirmation",
  ].includes(currentScreen);
  const isAdminView = currentScreen === "admin";
  const isSuperAdminView = currentScreen === "superadmin";
  const isSuperAdminRole = store.hasAdminAuth() && store.getAdminRole() === "superadmin";

  const getBtnClass = (active: boolean) =>
    `px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
      active
        ? "bg-slate-800 text-white shadow-xs border border-slate-700"
        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
    }`;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] flex h-10 items-center justify-center bg-slate-950 px-3 sm:px-6 border-b border-slate-900 text-white shadow-sm">
      <div className="flex items-center justify-between gap-1 overflow-x-auto py-1 no-scrollbar max-w-7xl w-full">
        <div className="flex items-center gap-1">
          <button
            className={getBtnClass(isClientView)}
            onClick={() => onSelectScreen("products")}
          >
            Tienda
          </button>
          <button
            className={getBtnClass(isAdminView)}
            onClick={() => onSelectScreen("admin")}
          >
            Admin
          </button>
          {isSuperAdminRole && (
            <button
              className={getBtnClass(isSuperAdminView)}
              onClick={() => onSelectScreen("superadmin")}
            >
              SuperAdmin
            </button>
          )}
        </div>
        <span className="text-[10px] font-semibold text-slate-500 tracking-wider select-none">
          FerrApp
        </span>
      </div>
    </div>
  );
}

// ─── Header principal ─────────────────────────────────────────────────────────

function Header({ currentScreen }: { currentScreen?: Screen }) {
  const publicKiosks = useStore((s) => s.publicKiosks);
  const selectedKioskId = useStore((s) => s.selectedKioskId);
  const view = useStore((s) => s.view);
  const cart = useStore((s) => s.cart);
  const settings = useStore((s) => s.settings);
  const urlKioskNotice = useStore((s) => s.urlKioskNotice);
  const currentKiosk = useStore((s) => s.currentKiosk);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [pendingKiosk, setPendingKiosk] = useState<Kiosk | null>(null);

  const adminUser = store.getAdminUser();
  const isAdmin = adminUser?.role === "admin";
  const assignedKiosks = adminUser?.assignedKiosks || [];

  const showKioskSelectorButton = useMemo(() => {
    if (!adminUser) return false;
    if (view === "client") return false;
    if (adminUser.role === "superadmin") return true;
    if (adminUser.role === "admin") {
      const count = assignedKiosks.length > 0 ? assignedKiosks.length : (adminUser.kioskId ? 1 : 0);
      return count > 1;
    }
    return false;
  }, [adminUser, view, assignedKiosks]);

  const availableKiosksForModal = useMemo(() => {
    let list: Kiosk[] = [];
    if (isAdmin) {
      if (assignedKiosks.length > 0) {
        const publicMap = new Map(publicKiosks.map((k) => [k.id, k]));
        list = assignedKiosks.map((ak) => {
          const pub = publicMap.get(ak.id);
          return pub || {
            id: ak.id,
            name: ak.name,
            slug: ak.slug || ak.id,
            active: ak.active !== false,
            createdAt: "",
            updatedAt: "",
          };
        });
      } else if (adminUser?.kioskId) {
        list = publicKiosks.filter((k) => k.id === adminUser.kioskId);
      }
    } else {
      list = publicKiosks;
    }
    const seen = new Set<string>();
    return list.filter((k) => {
      if (!k.id || seen.has(k.id)) return false;
      seen.add(k.id);
      return true;
    });
  }, [publicKiosks, isAdmin, assignedKiosks, adminUser]);

  const isClientView = !currentScreen || ["products", "cart", "checkout", "payment", "confirmation"].includes(currentScreen);

  // Estado PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(!!standalone);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsStandalone(true);
      }
      setDeferredPrompt(null);
    } else {
      setInstallModalOpen(true);
    }
  };

  // Actualización dinámica de título y metadatos Open Graph para compartir por WhatsApp / redes
  useEffect(() => {
    const shopName = settings.shopName || currentKiosk.name || "Tienda Online";
    document.title = `${shopName} — Tienda Online`;

    const metaOgTitle = document.querySelector('meta[property="og:title"]');
    if (metaOgTitle) metaOgTitle.setAttribute("content", `${shopName} — Tienda Online`);

    const metaOgDesc = document.querySelector('meta[property="og:description"]');
    if (metaOgDesc) metaOgDesc.setAttribute("content", settings.description || `Hacé tu pedido online en ${shopName}`);

    if (settings.logoUrl) {
      const metaOgImg = document.querySelector('meta[property="og:image"]');
      if (metaOgImg) metaOgImg.setAttribute("content", settings.logoUrl);
    }
  }, [settings.shopName, settings.description, settings.logoUrl, currentKiosk.name]);

  const handleSelectKioskClick = (targetKiosk: Kiosk) => {
    if (targetKiosk.id === selectedKioskId) {
      setSelectorOpen(false);
      return;
    }
    if (isClientView && cart.length > 0) {
      setPendingKiosk(targetKiosk);
    } else {
      store.selectKiosk(targetKiosk.id);
      setSelectorOpen(false);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingKiosk) {
      store.clearCart();
      store.selectKiosk(pendingKiosk.id);
      setPendingKiosk(null);
      setSelectorOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border/60 bg-primary px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.shopName || currentKiosk.name}
                className="h-9 w-9 rounded-xl object-cover border border-white/20 bg-white/15 flex-shrink-0"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 flex-shrink-0">
                <Store className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold leading-tight text-white truncate">
                  {settings.shopName || currentKiosk.name}
                </h1>
                {currentKiosk.active !== false ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-400/30 flex-shrink-0">
                    Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-rose-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-200 border border-rose-400/30 flex-shrink-0">
                    Inactivo
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-tight text-white/80 line-clamp-1">
                {settings.description || "Pedidos online"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <NotificationBellButton />

            {!isStandalone && (
              <button
                onClick={handleInstallClick}
                title="Instalar aplicación en el dispositivo"
                className="flex items-center gap-1 rounded-xl bg-emerald-500/80 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 active:scale-95 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Instalar</span>
              </button>
            )}

            {showKioskSelectorButton && (
              <button
                onClick={() => setSelectorOpen(true)}
                className="flex items-center gap-1 rounded-xl bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/25 active:scale-95"
              >
                <span>Cambiar</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {isClientView && urlKioskNotice && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-950 flex items-center justify-between gap-2 shadow-inner">
          <p className="font-medium flex-1 leading-snug">
            ⚠️ {urlKioskNotice.message}
          </p>
          <button
            onClick={() => {
              store.dismissNotice();
              if (publicKiosks.length > 0 && selectedKioskId !== publicKiosks[0].id) {
                store.selectKiosk(publicKiosks[0].id);
              }
            }}
            className="bg-amber-600 text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0 hover:bg-amber-700 active:scale-95 transition"
          >
            Ir a tienda principal
          </button>
        </div>
      )}

      {/* Modal / Sheet para seleccionar Kiosco */}
      {selectorOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-card border border-border p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Store className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Seleccionar Kiosco / Negocio</h3>
                  <p className="text-xs text-muted-foreground">Elija el negocio donde realizar su pedido</p>
                </div>
              </div>
              <button
                onClick={() => setSelectorOpen(false)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {availableKiosksForModal.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Cargando kioscos disponibles...
                </div>
              ) : (
                availableKiosksForModal.map((k) => {
                  const isSelected = k.id === selectedKioskId;
                  return (
                    <button
                      key={k.id}
                      onClick={() => handleSelectKioskClick(k)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center justify-between ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-xs"
                          : "border-border/80 bg-background hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{k.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Disponible / Activo
                            </span>
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmación para cambiar de kiosco si hay productos en el carrito */}
      {isClientView && pendingKiosk && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border p-5 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">¿Cambiar de negocio?</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Tiene productos en su carrito. Si cambia a <strong>{pendingKiosk.name}</strong>, su carrito actual se vaciará para no mezclar productos de distintos kioscos.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPendingKiosk(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSwitch}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Sí, vaciar y cambiar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Navegación inferior ──────────────────────────────────────────────────────

function BottomNav({
  current,
  role,
  cartCount,
  onChange,
}: {
  current: Screen;
  role: Role;
  cartCount: number;
  onChange: (s: Screen) => void;
}) {
  const items: { id: Screen; label: string; icon: typeof Store; badge?: number }[] = [
    { id: "products", label: "Productos", icon: Store },
    { id: "cart", label: "Carrito", icon: ShoppingCart, badge: cartCount },
    { id: "checkout", label: "Pedido", icon: Receipt },
    { id: "admin", label: "Admin", icon: Lock },
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md sm:max-w-xl md:max-w-2xl -translate-x-1/2 border-t border-border/60 bg-card/95 backdrop-blur-sm sm:border-x sm:rounded-t-2xl sm:shadow-lg">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((it) => {
          const active =
            current === it.id ||
            (it.id === "checkout" && (current === "confirmation" || current === "payment")) ||
            (it.id === "admin" && (current === "admin" || current === "superadmin"));
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={`relative flex flex-col items-center justify-center py-2 transition ${
                active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {it.badge && it.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {it.badge > 99 ? "99+" : it.badge}
                  </span>
                ) : null}
              </div>
              <span className="mt-1 text-[10px]">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Pantalla: Productos ──────────────────────────────────────────────────────

function ProductsScreen({ onGoToCart }: { onGoToCart: () => void }) {
  const products = useStore((s) => s.products);
  const cart = useStore((s) => s.cart);
  const settings = useStore((s) => s.settings);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCat, setActiveCat] = useState("Todos");
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choiceResult = await installPrompt.userChoice;
    if (choiceResult && choiceResult.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, i) => {
        const p = products.find((p) => p.id === i.productId);
        return sum + (p?.price ?? 0) * i.qty;
      }, 0),
    [cart, products],
  );

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["Todos", ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCat === "Todos" || p.category === activeCat;
      const matchQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [products, activeCat, searchQuery]);

  const WELCOME_PRESETS: Record<string, string> = {
    default: "¡Bienvenidos! Realizá tu pedido online y retiralo en el acto.",
    offers: "¡Aprovechá nuestras ofertas exclusivas del día!",
    delivery: "Envíos rápidos a domicilio. ¡Hacé tu pedido!",
  };

  const welcomeText =
    settings.welcomeMsgType && settings.welcomeMsgType !== "none"
      ? WELCOME_PRESETS[settings.welcomeMsgType] || settings.welcomeMessage
      : settings.welcomeMessage;

  return (
    <div className="pb-24">
      {/* Banner de Kiosco Inactivo / Pausado */}
      {settings.active === false && (
        <div className="bg-amber-500 text-amber-950 px-4 py-3 text-xs font-bold flex items-center gap-2 border-b border-amber-600 shadow-2xs">
          <span className="flex h-2.5 w-2.5 rounded-full bg-amber-900 animate-pulse shrink-0" />
          <span>Este negocio se encuentra pausado / inactivo temporalmente. No se aceptan nuevos pedidos.</span>
        </div>
      )}

      {/* Banner Promocional Imagen (si está configurado) */}
      {settings.bannerUrl && (
        <div className="w-full h-32 overflow-hidden bg-muted relative border-b border-border">
          <img src={settings.bannerUrl} alt="Banner Promocional" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Banner de Bienvenida / Descripción del Negocio */}
      {(welcomeText || settings.description) && (
        <div className="bg-card border-b border-border/60 px-4 py-3 flex items-center gap-3">
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt="Logo"
              className="h-11 w-11 rounded-2xl object-cover flex-shrink-0 border border-border/60 bg-background shadow-2xs"
            />
          )}
          <div className="min-w-0 flex-1">
            {welcomeText && (
              <p className="text-xs font-bold text-foreground leading-snug">
                {welcomeText}
              </p>
            )}
            {settings.description && (
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
                {settings.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Badges de Información del Comercio */}
      {(settings.address || settings.businessHours || settings.deliveryInfo || settings.paymentMethods) && (
        <div className="bg-card border-b border-border/60 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar text-[11px] text-muted-foreground">
          {settings.address && (
            <span className="flex items-center gap-1 font-medium whitespace-nowrap bg-muted/70 px-2.5 py-1 rounded-lg border border-border/40">
              📍 {settings.address}
            </span>
          )}
          {settings.businessHours && (
            <span className="flex items-center gap-1 font-medium whitespace-nowrap bg-muted/70 px-2.5 py-1 rounded-lg border border-border/40">
              🕒 {settings.businessHours}
            </span>
          )}
          {settings.deliveryInfo && (
            <span className="flex items-center gap-1 font-medium whitespace-nowrap bg-muted/70 px-2.5 py-1 rounded-lg border border-border/40">
              🚚 {settings.deliveryInfo}
            </span>
          )}
          {settings.paymentMethods && (
            <span className="flex items-center gap-1 font-medium whitespace-nowrap bg-muted/70 px-2.5 py-1 rounded-lg border border-border/40">
              💳 {settings.paymentMethods}
            </span>
          )}
          {installPrompt && (
            <button
              onClick={handleInstallApp}
              className="flex items-center gap-1.5 font-semibold text-xs whitespace-nowrap bg-primary text-primary-foreground px-3 py-1 rounded-lg shadow-xs hover:opacity-90 active:scale-95 transition"
            >
              📲 Instalar App
            </button>
          )}
        </div>
      )}

      {/* Barra de búsqueda y navegación horizontal de categorías */}
      <div className="sticky top-0 z-[10] border-b border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur space-y-2.5 shadow-2xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar productos en la tienda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-muted/80 pl-9 pr-8 py-2 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => {
                setActiveCat(c);
                if (c !== "Todos") {
                  const el = document.getElementById(`cat-section-${c}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeCat === c
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Muestra mensaje si la tienda no tiene productos, o el catálogo si tiene */}
      {products.length === 0 ? (
        <div className="mx-4 my-8 flex flex-col items-center justify-center rounded-3xl border border-border/60 bg-card p-8 text-center space-y-3.5 shadow-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-3xl shadow-inner">
            🛍️
          </div>
          <div className="max-w-xs space-y-1">
            <h3 className="text-base font-bold text-foreground">
              Estamos preparando esta tienda
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Este negocio todavía está preparando su catálogo de productos. Volvé pronto para ver las novedades.
            </p>
          </div>
        </div>
      ) : activeCat === "Todos" && !searchQuery.trim() ? (
        <div className="space-y-6 py-3">
          {categories.filter((c) => c !== "Todos").map((catName) => {
            const catProducts = products.filter((p) => p.category === catName);
            if (catProducts.length === 0) return null;
            return (
              <section key={catName} id={`cat-section-${catName}`} className="space-y-2.5">
                <div className="px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold tracking-tight text-foreground uppercase">{catName}</h3>
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {catProducts.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveCat(catName)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                  >
                    Ver todo <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Fila con scroll horizontal deslizable */}
                <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x scroll-smooth px-4 pb-2">
                  {catProducts.map((p) => (
                    <div key={p.id} className="w-40 sm:w-48 flex-shrink-0 snap-start">
                      <ProductCard product={p} />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Vista en grilla cuando se filtra por categoría o término de búsqueda */
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {searchQuery ? `Resultados para "${searchQuery}"` : `Categoría: ${activeCat}`}
            </span>
            <span className="font-semibold text-foreground">{filtered.length} productos</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-muted-foreground" />}
              title="No se encontraron productos"
              description="Intente con otro nombre de producto o elija otra categoría."
              action={{
                label: "Ver todos los productos",
                onClick: () => {
                  setActiveCat("Todos");
                  setSearchQuery("");
                },
              }}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Firma de marca discreta */}
      <footer className="mt-8 pt-4 pb-4 text-center select-none space-y-2">
        {installPrompt && (
          <div>
            <button
              onClick={handleInstallApp}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-muted hover:bg-accent border border-border/70 text-foreground shadow-2xs transition active:scale-95"
            >
              📲 Instalar aplicación en tu pantalla de inicio
            </button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground/60 tracking-wide font-medium">
          by <span className="font-semibold text-muted-foreground/80">FerrApp</span>
        </p>
      </footer>

      {cart.length > 0 && (
        <div className="fixed bottom-[68px] left-1/2 z-10 w-full max-w-md -translate-x-1/2 px-4">
          <button
            onClick={onGoToCart}
            className="flex w-full items-center justify-between rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98]"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <span className="font-semibold">Ver pedido</span>
            </div>
            <span className="font-bold">{formatPrice(cartTotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de producto ──────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  const qty = useStore(
    (s) => s.cart.find((i) => i.productId === product.id)?.qty ?? 0,
  );
  const settings = useStore((s) => s.settings);
  const [viewerOpen, setViewerOpen] = useState(false);
  const isAvailable = product.available !== false;
  const isStoreActive = settings.active !== false;

  const BADGE_MAP: Record<string, { label: string; bg: string }> = {
    oferta: { label: "🔥 Oferta", bg: "bg-rose-600 text-white" },
    destacado: { label: "⭐ Destacado", bg: "bg-amber-500 text-white" },
    promocion: { label: "⚡ Promoción", bg: "bg-indigo-600 text-white" },
    ultimas_unidades: { label: "🏷️ Últimas u.", bg: "bg-orange-600 text-white" },
  };

  const badgeObj = product.badge ? BADGE_MAP[product.badge] : null;

  return (
    <>
      <div
        className={`flex flex-col h-full overflow-hidden rounded-2xl border bg-card shadow-2xs transition hover:shadow-md ${
          !isAvailable ? "opacity-75 border-border/40" : "border-border/60"
        }`}
      >
        {/* Imagen / Emoji Container */}
        <div
          className="relative flex h-36 items-center justify-center overflow-hidden bg-muted"
          onClick={() => isAvailable && product.image && setViewerOpen(true)}
          style={{ cursor: isAvailable && product.image ? "zoom-in" : "default" }}
        >
          {product.image ? (
            <>
              <img
                src={product.image}
                alt={product.name}
                className={`h-full w-full object-cover transition duration-300 ${
                  !isAvailable ? "grayscale contrast-75" : ""
                }`}
              />
              {isAvailable && (
                <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-2xs">
                  <ZoomIn className="h-3 w-3" />
                </div>
              )}
            </>
          ) : (
            <div className={`text-4xl ${!isAvailable ? "opacity-50" : ""}`}>{product.emoji || "📦"}</div>
          )}

          {/* Badges profesionales */}
          {!isAvailable ? (
            <div className="absolute left-2 top-2 rounded-full bg-slate-800/90 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-2xs backdrop-blur-xs">
              🔴 Agotado
            </div>
          ) : badgeObj ? (
            <div
              className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-2xs ${badgeObj.bg}`}
            >
              {badgeObj.label}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between flex-1 gap-2 p-3">
          <div>
            <p className="text-xs font-semibold leading-snug text-foreground line-clamp-2 h-8">
              {product.name}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-muted-foreground truncate">
              {product.category}
            </p>
          </div>

          <div className="space-y-2 pt-1 border-t border-border/40">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-primary">
                {formatPrice(product.price)}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-[11px] text-muted-foreground line-through font-normal">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>

            {!isStoreActive ? (
              <button
                disabled
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted/80 py-2 text-xs font-medium text-muted-foreground/80 cursor-not-allowed border border-border/40"
              >
                No disponible
              </button>
            ) : !isAvailable ? (
              <button
                disabled
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted py-2 text-xs font-medium text-muted-foreground cursor-not-allowed border border-border/40"
              >
                Sin stock
              </button>
            ) : qty === 0 ? (
              <button
                onClick={() => store.addToCart(product.id)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground transition active:scale-95 hover:bg-primary/90 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-0.5">
                <button
                  onClick={() => store.decrementCart(product.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10 active:scale-95"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-bold text-primary">{qty}</span>
                <button
                  onClick={() => store.addToCart(product.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10 active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewerOpen && product.image && (
        <ImageViewer
          src={product.image}
          alt={product.name}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

// ─── Pantalla: Carrito ────────────────────────────────────────────────────────

function CartScreen({
  onBack,
  onCheckout,
}: {
  onBack: () => void;
  onCheckout: () => void;
}) {
  const cart = useStore((s) => s.cart);
  const products = useStore((s) => s.products);
  const settings = useStore((s) => s.settings);

  const items = useMemo(
    () =>
      cart
        .map((c) => {
          const p = products.find((p) => p.id === c.productId);
          return p ? { ...p, qty: c.qty } : null;
        })
        .filter((x): x is Product & { qty: number } => x !== null),
    [cart, products],
  );

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.qty, 0),
    [items],
  );

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Tu carrito" onBack={onBack} />

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-10 w-10" />}
          title="Carrito vacío"
          description="Agregá productos para empezar tu pedido."
          action={{ label: "Ver productos", onClick: onBack }}
        />
      ) : (
        <>
          {settings.active === false && (
            <div className="mx-4 mt-3 rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>Este negocio se encuentra pausado y no está aceptando pedidos en este momento.</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 items-start">
            <div className="lg:col-span-2 flex flex-col gap-2.5">
              {items.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
                >
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {i.image ? (
                      <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl">{i.emoji || "📦"}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{i.name}</p>
                    <p className="text-xs font-medium text-muted-foreground">
                      {formatPrice(i.price)} c/u
                    </p>
                    <p className="text-sm font-bold text-primary mt-0.5">
                      {formatPrice(i.price * i.qty)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => store.removeFromCart(i.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background">
                      <button
                        onClick={() => store.decrementCart(i.id)}
                        className="flex h-7 w-7 items-center justify-center text-foreground"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{i.qty}</span>
                      <button
                        onClick={() => store.addToCart(i.id)}
                        className="flex h-7 w-7 items-center justify-center text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-1 rounded-2xl border border-border/60 bg-card p-4 shadow-sm lg:sticky lg:top-14">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-muted-foreground">
                  {items.reduce((s, i) => s + i.qty, 0)} productos
                </span>
                <span className="text-2xl font-bold text-foreground">{formatPrice(total)}</span>
              </div>
              <button
                onClick={onCheckout}
                disabled={settings.active === false}
                className="mt-3 w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {settings.active === false ? "Negocio en pausa (no disponible)" : "Continuar pedido"}
              </button>
            </div>
          </div>

          <footer className="mt-6 pb-2 text-center select-none">
            <p className="text-[11px] text-muted-foreground/60 tracking-wide font-medium">
              by <span className="font-semibold text-muted-foreground/80">FerrApp</span>
            </p>
          </footer>
        </>
      )}
    </div>
  );
}

// ─── Pantalla: Checkout ───────────────────────────────────────────────────────

function CheckoutScreen({
  onBack,
  onConfirmed,
}: {
  onBack: () => void;
  onConfirmed: (order: Order) => void;
}) {
  const cart = useStore((s) => s.cart);
  const products = useStore((s) => s.products);
  const settings = useStore((s) => s.settings);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [delivery, setDelivery] = useState<"retiro" | "envio">("retiro");
  const [payment, setPayment] = useState<"efectivo" | "mercadopago">("efectivo");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const items = useMemo(
    () =>
      cart
        .map((c) => {
          const p = products.find((p) => p.id === c.productId);
          return p ? { ...p, qty: c.qty } : null;
        })
        .filter((x): x is Product & { qty: number } => x !== null),
    [cart, products],
  );

  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.qty, 0),
    [items],
  );

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (settings.active === false) {
      setError("Este negocio se encuentra pausado y no está aceptando pedidos.");
      return;
    }
    if (!name.trim()) { setError("Ingresá tu nombre"); return; }
    if (delivery === "envio" && !address.trim()) { setError("Ingresá la dirección de envío"); return; }
    if (items.length === 0) { setError("El carrito está vacío"); return; }

    setIsSubmitting(true);
    setError("");
    try {
      const order = await store.createOrder({
        customerName: name.trim(),
        address: address.trim(),
        delivery,
        payment,
      });
      onConfirmed(order);
    } catch (err: any) {
      setError(err?.message || "Error al procesar el pedido. Por favor intentá nuevamente.");
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div>
        <ScreenHeader title="Confirmar pedido" onBack={onBack} />
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="Sin productos"
          description="Volvé al carrito para agregar productos."
        />
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Confirmar pedido" onBack={onBack} />

      {settings.active === false && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span>Este negocio se encuentra pausado y no está aceptando nuevos pedidos.</span>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl flex flex-col gap-3.5 p-4">
        {/* Resumen del pedido */}
        <SectionCard title="Resumen">
          <div className="flex flex-col gap-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="truncate text-muted-foreground">
                  {i.qty} × {i.name}
                </span>
                <span className="ml-2 font-semibold">{formatPrice(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-2.5">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold text-primary">{formatPrice(total)}</span>
            </div>
          </div>
        </SectionCard>

        {/* Modalidad */}
        <SectionCard title="Modalidad de entrega">
          <div className="grid grid-cols-2 gap-2">
            {(["retiro", "envio"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDelivery(d)}
                className={`rounded-xl border-2 p-3 text-sm font-medium transition ${
                  delivery === d
                    ? "border-primary bg-primary/8 text-primary"
                    : "border-border/60 bg-background text-muted-foreground"
                }`}
              >
                {d === "retiro" ? "🏪 Retiro en local" : "🛵 Envío a domicilio"}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Forma de pago */}
        <SectionCard title="Forma de pago">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPayment("efectivo")}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition ${
                payment === "efectivo"
                  ? "border-primary bg-primary/8"
                  : "border-border/60 bg-background"
              }`}
            >
              <Banknote className={`h-5 w-5 ${payment === "efectivo" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${payment === "efectivo" ? "text-primary" : "text-muted-foreground"}`}>
                Efectivo
              </span>
            </button>
            <button
              onClick={() => setPayment("mercadopago")}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition ${
                payment === "mercadopago"
                  ? "border-primary bg-primary/8"
                  : "border-border/60 bg-background"
              }`}
            >
              <CreditCard className={`h-5 w-5 ${payment === "mercadopago" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${payment === "mercadopago" ? "text-primary" : "text-muted-foreground"}`}>
                Mercado Pago
              </span>
            </button>
          </div>
        </SectionCard>

        {/* Datos del cliente */}
        <SectionCard title="Tus datos">
          <div className="flex flex-col gap-3">
            <Field label="Nombre">
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="Tu nombre y apellido"
                className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </Field>
            <Field
              label={`Dirección${delivery === "retiro" ? " (opcional)" : ""}`}
            >
              <input
                value={address}
                onChange={(e) => { setAddress(e.target.value); setError(""); }}
                placeholder={delivery === "envio" ? "Calle, número, piso" : "No requerida para retiro"}
                className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </Field>
          </div>
        </SectionCard>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/8 px-3.5 py-3 text-sm text-destructive">
            <X className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={settings.active === false || isSubmitting}
          className="w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {settings.active === false
            ? "Negocio en pausa (no disponible)"
            : isSubmitting
            ? "Procesando pedido..."
            : payment === "mercadopago"
            ? "Confirmar y ver cómo pagar"
            : "Confirmar pedido"}
        </button>

        <footer className="mt-3 pb-2 text-center select-none">
          <p className="text-[11px] text-muted-foreground/60 tracking-wide font-medium">
            by <span className="font-semibold text-muted-foreground/80">FerrApp</span>
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── Pantalla: Pago Mercado Pago ──────────────────────────────────────────────

function MercadoPagoPaymentScreen({
  order,
  onDone,
}: {
  order: Order;
  onDone: () => void;
}) {
  const settings = useStore((s) => s.settings);
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const copyAlias = () => {
    navigator.clipboard?.writeText(settings.mercadoPagoAlias).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const url = buildWhatsappUrl(order, settings);

  const handleWhatsApp = () => {
    window.open(url, "_blank");
    onDone();
  };

  return (
    <div className="flex flex-col p-4 gap-4">
      {/* Encabezado */}
      <div className="flex flex-col items-center gap-2 pt-3 pb-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100">
          <CreditCard className="h-7 w-7 text-sky-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Pagá con Mercado Pago</h2>
        <p className="text-center text-sm text-muted-foreground leading-snug">
          Transferí{" "}
          <span className="font-bold text-foreground">{formatPrice(order.total)}</span>{" "}
          al alias y enviá el comprobante por WhatsApp.
        </p>
      </div>

      {/* Alias + copiar */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sky-600">
          Alias de transferencia
        </p>
        <div className="flex items-center gap-2">
          <p className="flex-1 text-xl font-bold tracking-wide text-foreground">
            {settings.mercadoPagoAlias}
          </p>
          <button
            onClick={copyAlias}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              copied
                ? "bg-emerald-100 text-emerald-700"
                : "bg-sky-100 text-sky-700 active:scale-95"
            }`}
          >
            {copied ? (
              <>
                <ClipboardCheck className="h-3.5 w-3.5" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </>
            )}
          </button>
        </div>
      </div>

      {/* QR (si está cargado) */}
      {settings.mercadoPagoQr && (
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Código QR</p>
          </div>
          <div
            className="flex cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-white p-3"
            onClick={() => setQrOpen(true)}
          >
            <img
              src={settings.mercadoPagoQr}
              alt="QR Mercado Pago"
              className="w-full max-w-[220px] object-contain"
            />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Escaneá con la app de Mercado Pago · Toca para ampliar
          </p>
        </div>
      )}

      {/* Resumen pedido */}
      <div className="rounded-2xl border border-border/60 bg-card p-3.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Pedido #{order.orderNumber != null ? order.orderNumber : order.id.slice(-6)}</span>
          <span className="font-bold text-foreground">{formatPrice(order.total)}</span>
        </div>
      </div>

      <button
        onClick={handleWhatsApp}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-semibold text-white shadow-sm transition active:scale-[0.98]"
      >
        <ExternalLink className="h-5 w-5" />
        Listo, enviar por WhatsApp
      </button>

      {qrOpen && settings.mercadoPagoQr && (
        <ImageViewer
          src={settings.mercadoPagoQr}
          alt="QR Mercado Pago"
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Pantalla: Confirmación ───────────────────────────────────────────────────

function ConfirmationScreen({
  order,
  onDone,
}: {
  order: Order;
  onDone: () => void;
}) {
  const settings = useStore((s) => s.settings);
  const url = buildWhatsappUrl(order, settings);

  // Para pagos en efectivo, abrir WhatsApp automáticamente
  useEffect(() => {
    if (order.payment === "mercadopago") return;
    const timer = setTimeout(() => window.open(url, "_blank"), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto w-full max-w-xl flex flex-col p-4 gap-4">
      {/* Éxito */}
      <div className="flex flex-col items-center gap-2.5 py-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-9 w-9 text-emerald-600" strokeWidth={2.5} />
        </div>
        <h2 className="text-xl font-bold">¡Pedido {order.orderNumber != null ? `#${order.orderNumber} ` : ""}confirmado!</h2>
        <p className="text-center text-sm text-muted-foreground leading-snug">
          {order.payment === "mercadopago"
            ? "Tu pedido fue registrado. Recordá enviar el comprobante de pago."
            : "Te abrimos WhatsApp para que envíes el pedido al kiosco."}
        </p>
      </div>

      {/* Detalle del pedido */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <span className="text-xs font-semibold text-foreground">
            Pedido #{order.orderNumber != null ? order.orderNumber : order.id.slice(-6)}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[order.status]}`}>
            {STATUS_LABEL[order.status]}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3 text-sm">
          <InfoRow label="Cliente" value={order.customerName} />
          <InfoRow label="Modalidad" value={order.delivery === "retiro" ? "Retiro en local" : "Envío a domicilio"} />
          <InfoRow label="Pago" value={order.payment === "mercadopago" ? "Mercado Pago" : "Efectivo"} />
          {order.delivery === "envio" && order.address && (
            <InfoRow label="Dirección" value={order.address} />
          )}
        </div>
        <div className="border-t border-border/60 px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Productos</p>
          <div className="flex flex-col gap-1 text-sm">
            {order.items.map((i) => (
              <div key={i.productId} className="flex justify-between">
                <span className="text-muted-foreground">{i.qty} × {i.name}</span>
                <span className="font-medium">{formatPrice(i.price * i.qty)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold text-primary">{formatPrice(order.total)}</span>
        </div>
      </div>

      {/* Pago en efectivo info */}
      {order.payment === "efectivo" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Banknote className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Pago en efectivo</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Tené listos <strong>{formatPrice(order.total)}</strong> al recibir tu pedido.
            </p>
          </div>
        </div>
      )}

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-semibold text-white shadow-sm transition active:scale-[0.98]"
      >
        <ExternalLink className="h-5 w-5" />
        Abrir WhatsApp
      </a>

      <button
        onClick={onDone}
        className="w-full rounded-2xl border border-border/70 bg-card py-3.5 text-sm font-medium text-foreground transition active:bg-muted"
      >
        Volver al inicio
      </button>

      <footer className="mt-3 pb-2 text-center select-none">
        <p className="text-[11px] text-muted-foreground/60 tracking-wide font-medium">
          by <span className="font-semibold text-muted-foreground/80">FerrApp</span>
        </p>
      </footer>
    </div>
  );
}

// ─── Admin: Login ─────────────────────────────────────────────────────────────

function AdminLogin({
  onAuth,
  title = "Acceso al panel",
  subtitle = "Ingresá con el email y la contraseña asignada a tu negocio",
}: {
  onAuth: (role?: "superadmin" | "admin") => void;
  title?: string;
  subtitle?: string;
}) {
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const attempt = async () => {
    if (!pwd || loading) return;
    setLoading(true);
    setErr("");
    const res = await store.loginAdmin(pwd, username.trim() || undefined);
    setLoading(false);
    if (res.ok && res.user) {
      onAuth(res.user.role);
    } else {
      setErr(res.error || "Credenciales incorrectas");
      setPwd("");
    }
  };

  return (
    <div className="flex flex-col p-4">
      <div className="mt-8 flex flex-col items-center gap-5 px-4 max-w-sm mx-auto w-full">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className="w-full space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Email o usuario del Administrador
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErr("");
              }}
              placeholder="Ej: admin-franco@gmail.com"
              className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              onKeyDown={(e) => {
                if (e.key === "Enter") void attempt();
              }}
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Contraseña de acceso
            </label>
            <input
              type="password"
              value={pwd}
              onChange={(e) => {
                setPwd(e.target.value);
                setErr("");
              }}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              onKeyDown={(e) => {
                if (e.key === "Enter") void attempt();
              }}
              disabled={loading}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
              Ingresá la contraseña configurada para esta cuenta (no la clave de tu correo personal).
            </p>
          </div>
        </div>

        {err && (
          <div className="w-full p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <button
          onClick={() => void attempt()}
          disabled={loading || !pwd.trim()}
          className="w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-50 mt-1"
        >
          {loading ? "Verificando..." : "Ingresar al Panel"}
        </button>

        <div className="pt-4 border-t border-border/40 text-center select-none">
          <p className="text-xs text-muted-foreground/75 font-medium flex items-center justify-center gap-1.5">
            <span className="font-semibold text-foreground/80">FerrApp</span>
            <span>·</span>
            <span>Plataforma de gestión</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Admin: Panel principal ───────────────────────────────────────────────────

// ─── Modal Ficha de Entrega de Kiosco ───────────────────────────────────────

function HandoverSheetModal({
  kiosk,
  ownerName,
  ownerEmail,
  ownerPhone,
  adminUsername,
  initialPassword,
  onClose,
}: {
  kiosk: Kiosk;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  adminUsername?: string | null;
  initialPassword?: string | null;
  onClose: () => void;
}) {
  const [copiedText, setCopiedText] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const slug = kiosk.slug || kiosk.id;
  const storeUrl = `${origin}/?kiosk=${encodeURIComponent(slug)}`;
  const adminUrl = `${origin}/?kiosk=${encodeURIComponent(slug)}&view=admin`;

  const handoverText = `🏪 *FICHA DE ENTREGA DE NEGOCIO*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 *Comercio:* ${kiosk.name}
👤 *Responsable:* ${ownerName || kiosk.ownerName || "Sin definir"}
📧 *Email / Usuario:* ${adminUsername || ownerEmail || kiosk.ownerEmail || "Sin definir"}
🟢 *Estado:* ${kiosk.active ? "ACTIVO" : "INACTIVO"}

🌐 *Tienda Web Pública:*
${storeUrl}

🔑 *Acceso al Panel Administrador:*
${adminUrl}

${initialPassword ? `🔒 *Contraseña Inicial Plataforma:* ${initialPassword}\n(Nota: Guarde esta contraseña de forma segura)` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📲 ¡Tu tienda ya está lista para recibir pedidos directo a tu WhatsApp!`;

  const handleCopy = () => {
    navigator.clipboard.writeText(handoverText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(handoverText);
    const phone = (ownerPhone || kiosk.ownerPhone || "").replace(/\D/g, "");
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${text}`, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-border/80 bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 font-bold">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Ficha de Entrega del Negocio</h3>
              <p className="text-[11px] text-muted-foreground">{kiosk.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {initialPassword && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 font-medium space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-800">
              <Lock className="h-4 w-4 text-amber-600" />
              Contraseña de Acceso Creada
            </p>
            <p className="text-[11px] opacity-90">
              Contraseña generada: <strong className="font-mono bg-background px-1.5 py-0.5 rounded border border-amber-300">{initialPassword}</strong>
            </p>
            <p className="text-[10px] text-amber-700 italic">
              Por razones de seguridad, esta contraseña es exclusivamente para ingresar a la plataforma y no se guardará en texto plano ni se volverá a mostrar.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs font-mono whitespace-pre-wrap leading-relaxed select-all">
          {handoverText}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-bold text-foreground hover:bg-accent transition active:scale-95 shadow-2xs"
          >
            {copiedText ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            <span>{copiedText ? "¡Ficha Copiada!" : "Copiar Ficha"}</span>
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white transition active:scale-95 shadow-2xs"
          >
            <Share2 className="h-4 w-4" />
            <span>Enviar por WhatsApp</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
          <a
            href={storeUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            <span>Abrir Tienda</span>
          </a>

          <a
            href={adminUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Abrir Panel Admin</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Indicador de Progreso e Inicio Rápido Admin ──────────────────────────────

function AdminSetupProgressCard({
  setTab,
  onStartTutorial,
}: {
  setTab?: (tab: "orders" | "products" | "promotions" | "marketing" | "stats" | "design" | "settings") => void;
  onStartTutorial?: () => void;
}) {
  const settings = useStore((s) => s.settings);
  const products = useStore((s) => s.products);

  const [expanded, setExpanded] = useState(false);

  const hasName = Boolean(settings.shopName && settings.shopName.trim().length > 0);
  const hasWhatsapp = Boolean(settings.whatsappNumber && settings.whatsappNumber.trim().length > 0);
  const hasProducts = products.length > 0;
  const hasPayment = Boolean(settings.mercadoPagoAlias || settings.paymentMethods);
  const hasLogo = Boolean(settings.logoUrl && settings.logoUrl.trim().length > 0);
  const hasHours = Boolean(settings.businessHours && settings.businessHours.trim().length > 0);

  const items = [
    { label: "Configurar nombre y datos del negocio", done: hasName, targetTab: "settings" as const, targetId: "section-business-data" },
    { label: "Cargar WhatsApp para recibir pedidos", done: hasWhatsapp, targetTab: "settings" as const, targetId: "section-whatsapp" },
    { label: "Agregar al menos 1 producto al catálogo", done: hasProducts, targetTab: "products" as const, targetId: "" },
    { label: "Subir logo o imagen de portada", done: hasLogo, targetTab: "settings" as const, targetId: "section-logo" },
    { label: "Configurar horarios de atención", done: hasHours, targetTab: "settings" as const, targetId: "section-hours" },
    { label: "Definir medio de cobro o Alias Mercado Pago", done: hasPayment, targetTab: "settings" as const, targetId: "section-payment" },
  ];

  const handleItemClick = (item: (typeof items)[number]) => {
    setTab?.(item.targetTab);
    if (item.targetId) {
      const tryScroll = (attemptsLeft: number) => {
        const el = document.getElementById(item.targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "ring-offset-2", "transition-all");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
          }, 2000);
        } else if (attemptsLeft > 0) {
          setTimeout(() => tryScroll(attemptsLeft - 1), 80);
        }
      };
      setTimeout(() => tryScroll(4), 100);
    }
  };

  const completedCount = items.filter((i) => i.done).length;
  const percent = Math.round((completedCount / items.length) * 100);
  const isFullyReady = completedCount >= 5;

  return (
    <div
      className={`mx-3.5 my-2.5 rounded-2xl border p-3.5 transition shadow-2xs ${
        isFullyReady
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
          : "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold shrink-0 ${
              isFullyReady ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
            }`}
          >
            {isFullyReady ? <Check className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate">
              {isFullyReady
                ? "🎉 ¡Tu tienda está lista para recibir pedidos!"
                : `Prepará tu tienda — ${percent}% completado`}
            </h4>
            <p className="text-[11px] opacity-80 mt-0.5">
              {completedCount} de {items.length} tareas listas · Clic para completar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onStartTutorial && (
            <button
              type="button"
              onClick={onStartTutorial}
              className="rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition"
            >
              Ver tutorial
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-xl border border-border/60 bg-background px-2.5 py-1 text-xs font-bold text-foreground hover:bg-accent transition"
          >
            {expanded ? "Ocultar checklist" : "Ver checklist"}
          </button>
        </div>
      </div>

      <div className="w-full bg-background/60 rounded-full h-2 mt-2.5 overflow-hidden border border-border/30">
        <div
          className={`h-full transition-all duration-500 ${isFullyReady ? "bg-emerald-600" : "bg-amber-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5 text-xs">
          <p className="font-bold text-[11px] uppercase tracking-wider opacity-80 mb-1">
            Checklist de activación ({completedCount}/{items.length}):
          </p>
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleItemClick(item)}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-background/80 hover:bg-background border border-border/40 transition text-left group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    item.done
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-foreground border border-border"
                  }`}
                >
                  {item.done ? "✓" : idx + 1}
                </span>
                <span
                  className={`text-xs ${
                    item.done
                      ? "line-through opacity-70 font-medium"
                      : "font-semibold text-foreground group-hover:text-primary"
                  }`}
                >
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-primary shrink-0">
                <span>{item.done ? "Ver" : "Configurar"}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente Tutorial Onboarding Guiado ──────────────────────────────────

function AdminTutorialModal({
  isOpen,
  onClose,
  setAdminTab,
}: {
  isOpen: boolean;
  onClose: () => void;
  setAdminTab: (tab: "orders" | "products" | "promotions" | "marketing" | "stats" | "design" | "settings") => void;
}) {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      stepNumber: 1,
      title: "Agregá tus productos",
      subtitle: "Paso 1 de 4 — Catálogo",
      icon: <Package className="h-6 w-6 text-primary" />,
      targetTab: "products" as const,
      description:
        "Desde acá podés crear productos, definir precios, categorías, stock y elegir su imagen o emoji para armar tu catálogo online.",
      badge: "📦 Sección Productos",
    },
    {
      stepNumber: 2,
      title: "Organizá tu catálogo",
      subtitle: "Paso 2 de 4 — Categorías",
      icon: <SlidersHorizontal className="h-6 w-6 text-emerald-600" />,
      targetTab: "products" as const,
      description:
        "Usá categorías (Bebidas, Snacks, Golosinas, Almacén) para que tus clientes encuentren rápidamente lo que buscan en tu tienda.",
      badge: "🏷️ Categorías",
    },
    {
      stepNumber: 3,
      title: "Administrá tus pedidos",
      subtitle: "Paso 3 de 4 — Ventas",
      icon: <Receipt className="h-6 w-6 text-amber-600" />,
      targetTab: "orders" as const,
      description:
        "Acá vas a recibir los pedidos de tus clientes en tiempo real, cambiar su estado (Pendiente, En preparación, Entregado) y gestionar tus ventas.",
      badge: "📋 Panel de Pedidos",
    },
    {
      stepNumber: 4,
      title: "Configurá tu negocio",
      subtitle: "Paso 4 de 4 — Ajustes",
      icon: <Settings2 className="h-6 w-6 text-sky-600" />,
      targetTab: "settings" as const,
      description:
        "Completá los datos de tu kiosco, número de WhatsApp para recibir pedidos, Alias de Mercado Pago, medios de pago y horarios de atención.",
      badge: "⚙️ Datos del Kiosco",
    },
  ];

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      setAdminTab(steps[nextStep].targetTab);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      setAdminTab(steps[prevStep].targetTab);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl space-y-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background border border-border/80 shadow-xs">
              {currentStep.icon}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {currentStep.subtitle}
              </span>
              <h3 className="text-base font-bold text-foreground">
                {currentStep.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            title="Cerrar tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
            {currentStep.badge}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>

          {/* Acciones directas para el Paso 4 (Ajustes) */}
          {step === 3 && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Ir directo a configurar:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setAdminTab("settings");
                    setTimeout(() => {
                      const el = document.getElementById("section-logo");
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      el?.classList.add("ring-2", "ring-primary", "ring-offset-2");
                      setTimeout(() => el?.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
                    }, 120);
                  }}
                  className="flex items-center gap-1.5 p-2 rounded-xl bg-background border border-border/70 hover:border-primary text-xs font-medium text-foreground hover:text-primary transition active:scale-95 text-left"
                >
                  <Store className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">Subir logo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setAdminTab("settings");
                    setTimeout(() => {
                      const el = document.getElementById("section-whatsapp");
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      el?.classList.add("ring-2", "ring-primary", "ring-offset-2");
                      setTimeout(() => el?.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
                    }, 120);
                  }}
                  className="flex items-center gap-1.5 p-2 rounded-xl bg-background border border-border/70 hover:border-primary text-xs font-medium text-foreground hover:text-primary transition active:scale-95 text-left"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Configurar WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setAdminTab("settings");
                    setTimeout(() => {
                      const el = document.getElementById("section-hours");
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      el?.classList.add("ring-2", "ring-primary", "ring-offset-2");
                      setTimeout(() => el?.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
                    }, 120);
                  }}
                  className="flex items-center gap-1.5 p-2 rounded-xl bg-background border border-border/70 hover:border-primary text-xs font-medium text-foreground hover:text-primary transition active:scale-95 text-left"
                >
                  <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">Configurar horarios</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setAdminTab("settings");
                    setTimeout(() => {
                      const el = document.getElementById("section-payment");
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      el?.classList.add("ring-2", "ring-primary", "ring-offset-2");
                      setTimeout(() => el?.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
                    }, 120);
                  }}
                  className="flex items-center gap-1.5 p-2 rounded-xl bg-background border border-border/70 hover:border-primary text-xs font-medium text-foreground hover:text-primary transition active:scale-95 text-left"
                >
                  <CreditCard className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                  <span className="truncate">Configurar Mercado Pago</span>
                </button>
              </div>
            </div>
          )}

          {/* Stepper Dots */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {steps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setStep(idx);
                  setAdminTab(s.targetTab);
                }}
                className={`h-2 rounded-full transition-all ${
                  idx === step ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                title={`Ir al paso ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-5 py-4">
          <button
            onClick={handlePrev}
            disabled={step === 0}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent transition"
          >
            Anterior
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            >
              Saltar
            </button>
            <button
              onClick={handleNext}
              className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs flex items-center gap-1.5"
            >
              <span>{step === steps.length - 1 ? "¡Entendido! Comenzar" : "Siguiente"}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Panel Principal ───────────────────────────────────────────────────

function AdminPanel({ onLogout }: { onLogout?: () => void } = {}) {
  const [tab, setTab] = useState<"orders" | "sales" | "products" | "promotions" | "marketing" | "stats" | "design" | "settings">("orders");
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const currentKiosk = useStore((s) => s.currentKiosk);
  const settings = useStore((s) => s.settings);
  const publicKiosks = useStore((s) => s.publicKiosks);
  const adminUser = store.getAdminUser();
  const assignedKiosks = adminUser?.role === "superadmin"
    ? publicKiosks
    : (adminUser?.assignedKiosks && adminUser.assignedKiosks.length > 0
        ? adminUser.assignedKiosks
        : publicKiosks.filter((k) => k.id === (adminUser?.kioskId || currentKiosk.id)));
  const [copiedLink, setCopiedLink] = useState(false);

  const tutorialKey = `kiosco_tutorial_completed_${adminUser?.id || "admin"}_${currentKiosk?.id || "default"}`;
  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(tutorialKey);
  });

  const handleCloseTutorial = () => {
    setShowTutorial(false);
    try {
      localStorage.setItem(tutorialKey, "true");
    } catch {}
  };

  const handleStartTutorial = () => {
    setShowTutorial(true);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const kioskSlug = settings.slug || settings.kioskId || currentKiosk.slug || currentKiosk.id;
  const storeUrl = `${origin}/?kiosk=${kioskSlug}`;

  const handleCopyStoreUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareStoreUrl = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: settings.shopName || currentKiosk.name || "Mi Tienda Online",
          text: `¡Hacé tu pedido online en ${settings.shopName || currentKiosk.name}!`,
          url: storeUrl,
        });
      } catch {}
    } else {
      handleCopyStoreUrl();
    }
  };

  const tabs = [
    { id: "orders" as const, label: "Pedidos", icon: Receipt },
    { id: "sales" as const, label: "Ventas de Hoy", icon: Banknote },
    { id: "products" as const, label: "Productos", icon: Package },
    { id: "promotions" as const, label: "Promos", icon: Flame },
    { id: "marketing" as const, label: "Difusión", icon: Megaphone },
    { id: "stats" as const, label: "Métricas", icon: BarChart3 },
    { id: "design" as const, label: "Estilo", icon: Palette },
    { id: "settings" as const, label: "Ajustes", icon: Settings2 },
  ];

  return (
    <div>
      <AdminTutorialModal
        isOpen={showTutorial}
        onClose={handleCloseTutorial}
        setAdminTab={setTab}
      />

      {/* Selector de tienda para admins con múltiples kioscos asignados */}
      {assignedKiosks.length > 1 && (
        <div className="bg-slate-900 text-white px-3.5 py-2 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Store className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-xs font-medium text-slate-300 shrink-0">
              Tienda en gestión:
            </span>
            <select
              value={currentKiosk.id}
              onChange={(e) => store.selectKiosk(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg px-2.5 py-1 outline-none focus:border-amber-400 cursor-pointer"
            >
              {assignedKiosks.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[10px] text-amber-400 font-semibold bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full shrink-0">
            {assignedKiosks.length} tiendas asignadas
          </span>
        </div>
      )}

      {/* Cabecera del Negocio & Enlace Público */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-border/60 p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.shopName || currentKiosk.name}
                className="h-10 w-10 rounded-2xl object-cover border border-border/60 bg-card shadow-2xs shrink-0"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary shrink-0 font-bold text-lg">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground truncate">
                  {settings.shopName || currentKiosk.name}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Activa
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Panel de gestión de {settings.shopName || currentKiosk.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStartTutorial}
              className="flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition active:scale-95"
              title="Abrir tutorial guiado"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ayuda / Tutorial</span>
              <span className="sm:hidden">Ayuda</span>
            </button>

            <button
              type="button"
              onClick={() => store.setView("client")}
              className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-background hover:bg-accent px-3 py-1.5 text-xs font-bold text-primary transition shadow-2xs flex-shrink-0"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ver tienda cliente</span>
              <span className="sm:hidden">Ver</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-background hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition shadow-2xs flex-shrink-0"
                title="Cerrar sesión de administrador"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>

        {/* Tarjeta rápida con el enlace público de la tienda */}
        <div className="rounded-xl border border-border/70 bg-card/80 p-2.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-xs font-mono text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 overflow-x-auto select-all flex-1">
            <span className="font-semibold text-foreground truncate">{storeUrl}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleCopyStoreUrl}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-accent transition active:scale-95"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copiar</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Copiar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleShareStoreUrl()}
              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-accent transition active:scale-95"
            >
              <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Compartir</span>
            </button>

            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 transition active:scale-95"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir</span>
            </a>
          </div>
        </div>
      </div>

      {/* Indicador de Progreso e Inicio Rápido */}
      <AdminSetupProgressCard setTab={setTab} onStartTutorial={handleStartTutorial} />

      <div className="border-b border-border/60 bg-card overflow-x-auto no-scrollbar">
        <div className="flex min-w-max">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                  tab === t.id ? "text-primary bg-primary/5 font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={tab === t.id ? 2.5 : 2} />
                <span>{t.label}</span>
                {tab === t.id && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "orders" && <AdminOrders onEditOrder={(order) => setEditingOrder(order)} />}
      {tab === "sales" && <AdminDailySales onEditOrder={(order) => setEditingOrder(order)} />}
      {tab === "products" && <AdminProducts onStartTutorial={handleStartTutorial} />}
      {tab === "promotions" && <AdminPromotions />}
      {tab === "marketing" && <AdminMarketing />}
      {tab === "stats" && <AdminStats />}
      {tab === "design" && <AdminDesign />}
      {tab === "settings" && <AdminSettings />}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={(updated) => {
            setEditingOrder(null);
            store.addToast({
              title: "Pedido actualizado",
              message: `El pedido #${updated.orderNumber != null ? updated.orderNumber : updated.id.slice(-4)} se guardó con éxito.`,
              type: "success",
            });
          }}
        />
      )}

      {/* Footer discreto de plataforma en panel de administración */}
      <footer className="mt-8 mb-4 pt-4 border-t border-border/40 text-center select-none">
        <p className="text-xs text-muted-foreground/75 font-medium flex items-center justify-center gap-1.5">
          <span className="font-semibold text-foreground/80">FerrApp</span>
          <span>·</span>
          <span>Plataforma de gestión</span>
        </p>
      </footer>
    </div>
  );
}

// ─── Modal de Edición Manual de Pedido ────────────────────────────────────────

function EditOrderModal({
  order,
  onClose,
  onSaved,
}: {
  order: Order;
  onClose: () => void;
  onSaved: (updated: Order) => void;
}) {
  const products = useStore((s) => s.products);
  const currentKiosk = useStore((s) => s.currentKiosk);
  const [customerName, setCustomerName] = useState(order.customerName || "");
  const [delivery, setDelivery] = useState<"retiro" | "envio">(order.delivery || "retiro");
  const [address, setAddress] = useState(order.address || "");
  const [payment, setPayment] = useState<PaymentMethod>(order.payment || "efectivo");
  const [status, setStatus] = useState<OrderStatus>(order.status || "nuevo");
  const [items, setItems] = useState<{ productId: string; name: string; price: number; qty: number }[]>(
    () => (order.items || []).map((i) => ({ ...i })),
  );

  const computedItemsSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
  }, [items]);

  const [total, setTotal] = useState<number>(order.total);
  const [isManualTotal, setIsManualTotal] = useState<boolean>(() => order.total !== computedItemsSubtotal);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState<string>("");
  const [customItemQty, setCustomItemQty] = useState<string>("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQtyChange = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const newQty = (next[index].qty || 0) + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        next[index] = { ...next[index], qty: newQty };
      }
      if (!isManualTotal) {
        const nextSubtotal = next.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
        setTotal(nextSubtotal);
      }
      return next;
    });
  };

  const handlePriceChange = (index: number, newPrice: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], price: Math.max(0, newPrice) };
      if (!isManualTotal) {
        const nextSubtotal = next.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
        setTotal(nextSubtotal);
      }
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (!isManualTotal) {
        const nextSubtotal = next.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
        setTotal(nextSubtotal);
      }
      return next;
    });
  };

  const handleAddCatalogProduct = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === prod.id);
      let next;
      if (existingIdx >= 0) {
        next = [...prev];
        next[existingIdx] = { ...next[existingIdx], qty: next[existingIdx].qty + 1 };
      } else {
        next = [...prev, { productId: prod.id, name: prod.name, price: prod.price, qty: 1 }];
      }
      if (!isManualTotal) {
        const nextSubtotal = next.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
        setTotal(nextSubtotal);
      }
      return next;
    });
    setSelectedProductId("");
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) return;
    const p = Math.max(0, parseFloat(customItemPrice) || 0);
    const q = Math.max(1, parseInt(customItemQty, 10) || 1);
    setItems((prev) => {
      const next = [
        ...prev,
        {
          productId: `custom_${Date.now()}`,
          name: customItemName.trim(),
          price: p,
          qty: q,
        },
      ];
      if (!isManualTotal) {
        const nextSubtotal = next.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
        setTotal(nextSubtotal);
      }
      return next;
    });
    setCustomItemName("");
    setCustomItemPrice("");
    setCustomItemQty("1");
    setShowCustomItem(false);
  };

  const handleRecalculateTotal = () => {
    setTotal(computedItemsSubtotal);
    setIsManualTotal(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError("El nombre del cliente no puede estar vacío.");
      return;
    }
    if (items.length === 0) {
      setError("El pedido debe contener al menos un producto.");
      return;
    }
    if (total < 0) {
      setError("El total no puede ser negativo.");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await store.updateOrder(order.id, {
      customerName: customerName.trim(),
      delivery,
      address: delivery === "envio" ? address.trim() : "",
      payment,
      status,
      items,
      total: Math.round(total),
    });

    setSaving(false);
    if (res.ok && res.order) {
      onSaved(res.order);
    } else {
      setError(res.error || "No se pudo guardar la modificación del pedido.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3.5">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              Editar Pedido #{order.orderNumber != null ? order.orderNumber : order.id.slice(-5)}
            </h3>
            <p className="text-xs text-muted-foreground">
              {new Date(order.createdAt).toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Datos del Cliente y Entrega */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Datos del Cliente y Entrega
            </h4>
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">
                Nombre del Cliente
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">
                  Tipo de Entrega
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1 border border-border/60">
                  <button
                    type="button"
                    onClick={() => setDelivery("retiro")}
                    className={`rounded-lg py-1.5 text-xs font-bold transition ${
                      delivery === "retiro"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Retiro
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelivery("envio")}
                    className={`rounded-lg py-1.5 text-xs font-bold transition ${
                      delivery === "envio"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Envío
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1 border border-border/60">
                  <button
                    type="button"
                    onClick={() => setPayment("efectivo")}
                    className={`rounded-lg py-1.5 text-xs font-bold transition ${
                      payment === "efectivo"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Efectivo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayment("mercadopago")}
                    className={`rounded-lg py-1.5 text-xs font-bold transition ${
                      payment === "mercadopago"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    MP / Transf.
                  </button>
                </div>
              </div>
            </div>

            {delivery === "envio" && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">
                  Dirección de Envío
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número, piso o referencias"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">
                Estado del Pedido
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(["nuevo", "preparacion", "listo", "entregado"] as OrderStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`rounded-xl border py-2 px-2 text-xs font-bold transition text-center ${
                      status === st
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border/60 bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {STATUS_LABEL[st]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Productos / Ítems del Pedido */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Productos del Pedido ({items.length})
              </h4>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={`${item.productId}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border/70 bg-card p-2.5 text-xs shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-foreground block truncate">{item.name}</span>
                    <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
                      <span>Precio unitario:</span>
                      <input
                        type="number"
                        min="0"
                        value={item.price}
                        onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-20 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5 border border-border/60">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(idx, -1)}
                        className="h-6 w-6 rounded flex items-center justify-center text-foreground hover:bg-card"
                        title="Restar cantidad"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center font-bold">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(idx, 1)}
                        className="h-6 w-6 rounded flex items-center justify-center text-foreground hover:bg-card"
                        title="Sumar cantidad"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <span className="font-bold text-foreground min-w-[70px] text-right">
                      {formatPrice(item.price * item.qty)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 rounded text-destructive hover:bg-destructive/10 transition"
                      title="Quitar ítem"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Agregar más productos */}
            <div className="pt-2 border-t border-border/60 space-y-2">
              <label className="block text-xs font-semibold text-foreground">
                Agregar producto del catálogo de {currentKiosk.name}
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">Seleccionar un producto para agregar...</option>
                  {products
                    .filter((p) => p.active !== false)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatPrice(p.price)}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedProductId}
                  onClick={handleAddCatalogProduct}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition shrink-0 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar
                </button>
              </div>

              {!showCustomItem ? (
                <button
                  type="button"
                  onClick={() => setShowCustomItem(true)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 pt-1"
                >
                  <Plus className="h-3 w-3" />
                  + Agregar concepto / ítem libre (ej: extra, envío manual)
                </button>
              ) : (
                <div className="rounded-xl border border-border/80 bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Concepto personalizado</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomItem(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Descripción del ítem"
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      className="sm:col-span-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="Precio $"
                        min="0"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        className="w-full rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomItem}
                        className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground shrink-0"
                      >
                        Sumar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Total y Corrección Manual */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Suma automática de ítems:</span>
              <span className="font-semibold text-foreground">{formatPrice(computedItemsSubtotal)}</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
              <div>
                <label className="block text-xs font-bold text-foreground">
                  Total Final a Cobrar ($)
                </label>
                {isManualTotal && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    * Modificado manualmente
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={total}
                  onChange={(e) => {
                    setTotal(Math.max(0, parseFloat(e.target.value) || 0));
                    setIsManualTotal(true);
                  }}
                  className="w-32 rounded-xl border border-border bg-card px-3 py-2 text-base font-extrabold text-foreground text-right focus:border-primary focus:outline-none shadow-xs"
                />
                {isManualTotal && (
                  <button
                    type="button"
                    onClick={handleRecalculateTotal}
                    className="text-[11px] font-bold text-primary hover:underline shrink-0"
                    title="Recalcular con la suma de los productos"
                  >
                    Recalcular
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-border/80 bg-muted/40 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Admin: Resumen / Ventas del Día ──────────────────────────────────────────

function AdminDailySales({ onEditOrder }: { onEditOrder?: (order: Order) => void }) {
  const currentKiosk = useStore((s) => s.currentKiosk);
  const orders = useStore((s) => s.orders);
  const settings = useStore((s) => s.settings);

  const getTodayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayString);
  const todayStr = getTodayString();
  const isToday = selectedDate === todayStr;

  // Filtrar exclusivamente pedidos de ESTE kiosco asignado/gestionado (Aislamiento de negocio)
  const kioskOrders = useMemo(() => {
    return orders.filter((o) => (o.kioskId || currentKiosk.id) === currentKiosk.id);
  }, [orders, currentKiosk.id]);

  // Filtrar pedidos según la fecha seleccionada en horario local
  const dayOrders = useMemo(() => {
    return kioskOrders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      if (isNaN(orderDate.getTime())) return false;
      const dateStr = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}-${String(orderDate.getDate()).padStart(2, "0")}`;
      return dateStr === selectedDate;
    });
  }, [kioskOrders, selectedDate]);

  // Calcular métricas del día
  const metrics = useMemo(() => {
    let totalSales = 0;
    let completedSales = 0;
    let completedCount = 0;
    let totalProductsQty = 0;
    let cashSales = 0;
    let cashCount = 0;
    let mpSales = 0;
    let mpCount = 0;
    let pickupCount = 0;
    let pickupSales = 0;
    let deliveryCount = 0;
    let deliverySales = 0;

    const productMap = new Map<string, { name: string; qty: number; total: number }>();

    for (const o of dayOrders) {
      totalSales += o.total;
      if (o.status === "entregado") {
        completedCount++;
        completedSales += o.total;
      }
      if (o.payment === "efectivo") {
        cashSales += o.total;
        cashCount++;
      } else {
        mpSales += o.total;
        mpCount++;
      }
      if (o.delivery === "retiro") {
        pickupCount++;
        pickupSales += o.total;
      } else {
        deliveryCount++;
        deliverySales += o.total;
      }

      for (const item of o.items || []) {
        totalProductsQty += item.qty;
        const key = item.productId || item.name;
        const existing = productMap.get(key) || { name: item.name, qty: 0, total: 0 };
        existing.qty += item.qty;
        existing.total += item.price * item.qty;
        productMap.set(key, existing);
      }
    }

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalOrders: dayOrders.length,
      totalSales,
      completedCount,
      completedSales,
      totalProductsQty,
      cashSales,
      cashCount,
      mpSales,
      mpCount,
      pickupCount,
      pickupSales,
      deliveryCount,
      deliverySales,
      topProducts,
    };
  }, [dayOrders]);

  const readableDate = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="p-3 space-y-4">
      {/* Barra superior de control de fecha y negocio */}
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {isToday ? "Ventas y Resumen de Hoy" : "Resumen de Ventas del Día"}
            </h2>
            <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-bold text-primary truncate max-w-[160px]">
              {currentKiosk.name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {readableDate}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground focus:border-primary focus:outline-none cursor-pointer"
          />

          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition flex items-center gap-1"
            >
              <Calendar className="h-3.5 w-3.5" />
              Ver Hoy
            </button>
          )}

          <button
            type="button"
            onClick={() => store.refreshOrders()}
            className="rounded-xl border border-border/80 bg-muted/40 p-1.5 text-muted-foreground hover:text-foreground transition"
            title="Actualizar datos"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 4 Métricas Principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Total Vendido */}
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Vendido</span>
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-foreground">
            {formatPrice(metrics.totalSales)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Entregados: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatPrice(metrics.completedSales)}</span>
          </p>
        </div>

        {/* Pedidos Realizados */}
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Pedidos Totales</span>
            <Receipt className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-foreground">
            {metrics.totalOrders}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Completados: <span className="font-semibold text-foreground">{metrics.completedCount}</span>
          </p>
        </div>

        {/* Total Productos / Unidades Vendidas */}
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Unidades Vendidas</span>
            <Package className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-foreground">
            {metrics.totalProductsQty}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Artículos en {metrics.totalOrders} {metrics.totalOrders === 1 ? "pedido" : "pedidos"}
          </p>
        </div>

        {/* Ticket Promedio */}
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Ticket Promedio</span>
            <BarChart3 className="h-4 w-4 text-violet-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-foreground">
            {formatPrice(metrics.totalOrders > 0 ? Math.round(metrics.totalSales / metrics.totalOrders) : 0)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Promedio por compra
          </p>
        </div>
      </div>

      {/* Desglose de Ventas por Método de Pago y Tipo de Entrega */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Métodos de Pago */}
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-primary" />
            Desglose por Método de Pago
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">💵 Efectivo</span>
              <p className="text-base font-bold text-foreground mt-0.5">
                {formatPrice(metrics.cashSales)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {metrics.cashCount} {metrics.cashCount === 1 ? "pedido" : "pedidos"}
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">📱 Mercado Pago</span>
              <p className="text-base font-bold text-foreground mt-0.5">
                {formatPrice(metrics.mpSales)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {metrics.mpCount} {metrics.mpCount === 1 ? "pedido" : "pedidos"}
              </span>
            </div>
          </div>
        </div>

        {/* Modalidad de Entrega */}
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Truck className="h-4 w-4 text-primary" />
            Desglose por Modalidad de Entrega
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">🏪 Retiro en Local</span>
              <p className="text-base font-bold text-foreground mt-0.5">
                {formatPrice(metrics.pickupSales)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {metrics.pickupCount} {metrics.pickupCount === 1 ? "pedido" : "pedidos"}
              </span>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[11px] font-semibold text-muted-foreground block">🛵 Envío a Domicilio</span>
              <p className="text-base font-bold text-foreground mt-0.5">
                {formatPrice(metrics.deliverySales)}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {metrics.deliveryCount} {metrics.deliveryCount === 1 ? "pedido" : "pedidos"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ranking de Productos Más Vendidos del Día */}
      {metrics.topProducts.length > 0 && (
        <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-amber-500" />
            Productos con Mayor Salida Hoy
          </h3>
          <div className="space-y-1.5">
            {metrics.topProducts.map((p, idx) => {
              const maxQty = metrics.topProducts[0]?.qty || 1;
              const pct = Math.round((p.qty / maxQty) * 100);
              return (
                <div
                  key={`${p.name}-${idx}`}
                  className="rounded-xl border border-border/50 bg-muted/15 p-2 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground truncate">{p.name}</span>
                      <span className="font-bold text-foreground shrink-0">{p.qty} u. ({formatPrice(p.total)})</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detalle y Listado de Pedidos del Día */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Receipt className="h-4 w-4 text-primary" />
            Detalle de Pedidos del Día ({dayOrders.length})
          </h3>
          <span className="text-xs font-bold text-foreground">
            Total acumulado: {formatPrice(metrics.totalSales)}
          </span>
        </div>

        {dayOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground space-y-2">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-semibold">No se registraron pedidos para esta fecha</p>
            <p className="text-xs text-muted-foreground/80">
              {isToday
                ? `Los nuevos pedidos que ingresen hoy en ${currentKiosk.name} aparecerán aquí automáticamente.`
                : "Probá seleccionando el día de hoy para ver las ventas activas."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {dayOrders.map((order) => {
              const orderTime = new Date(order.createdAt).toLocaleTimeString("es-AR", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          #{order.orderNumber != null ? order.orderNumber : order.id.slice(-5)} · {order.customerName}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[order.status]}`}
                        >
                          {STATUS_LABEL[order.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Hora: {orderTime} · {order.delivery === "retiro" ? "Retiro en local" : "Envío a domicilio"} · Pago con {order.payment === "mercadopago" ? "Mercado Pago" : "Efectivo"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-foreground block">
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* Listado de ítems del pedido */}
                  <div className="rounded-xl bg-muted/20 border border-border/40 p-2 text-xs space-y-1">
                    {(order.items || []).map((it, idx) => (
                      <div key={`${it.productId}-${idx}`} className="flex justify-between text-muted-foreground">
                        <span>{it.qty} × {it.name}</span>
                        <span className="font-medium text-foreground">{formatPrice(it.price * it.qty)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Botones de acción del pedido */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      {(["nuevo", "preparacion", "listo", "entregado"] as OrderStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => store.updateOrderStatus(order.id, st)}
                          className={`rounded-lg px-2 py-1 text-[11px] font-bold transition whitespace-nowrap ${
                            order.status === st
                              ? "bg-primary text-primary-foreground shadow-2xs"
                              : "bg-muted/50 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {STATUS_LABEL[st]}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onEditOrder && (
                        <button
                          type="button"
                          onClick={() => onEditOrder(order)}
                          className="flex items-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition"
                          title="Editar pedido manualmente"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                      )}

                      <a
                        href={buildWhatsappUrl(order, settings)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 transition flex items-center gap-1"
                        title="Abrir chat en WhatsApp"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin: Pedidos ───────────────────────────────────────────────────────────

function AdminOrders({ onEditOrder }: { onEditOrder?: (order: Order) => void } = {}) {
  const orders = useStore((s) => s.orders);
  const [filter, setFilter] = useState<"todos" | OrderStatus>("todos");
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = useMemo(
    () => orders.filter((o) => filter === "todos" || o.status === filter),
    [orders, filter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const filterButtons = [
    { id: "todos" as const, label: "Todos" },
    { id: "nuevo" as const, label: "Nuevos" },
    { id: "preparacion" as const, label: "Preparación" },
    { id: "listo" as const, label: "Listos" },
    { id: "entregado" as const, label: "Entregados" },
  ];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto px-3 py-2.5 no-scrollbar">
        {filterButtons.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label} {counts[f.id] != null ? `(${counts[f.id]})` : ""}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="Sin pedidos"
          description="Los pedidos de los clientes aparecerán aquí."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 px-3 pb-4">
          {visible.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              expanded={openId === o.id}
              onToggle={() => setOpenId(openId === o.id ? null : o.id)}
              onEdit={onEditOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Admin: Tarjeta de pedido ─────────────────────────────────────────────────

function OrderCard({
  order,
  expanded,
  onToggle,
  onEdit,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onEdit?: (order: Order) => void;
}) {
  const settings = useStore((s) => s.settings);

  const time = new Date(order.createdAt).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{order.customerName}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[order.status]}`}>
              {STATUS_LABEL[order.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            #{order.orderNumber != null ? order.orderNumber : order.id.slice(-6)} · {time} ·{" "}
            {order.delivery === "retiro" ? "Retiro" : "Envío"} ·{" "}
            {order.payment === "mercadopago" ? "MP" : "Efectivo"}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className="font-bold">{formatPrice(order.total)}</span>
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/30 p-3.5">
          {order.delivery === "envio" && (
            <p className="mb-2.5 text-xs">
              <span className="font-semibold">Dirección: </span>
              {order.address || "(no indicada)"}
            </p>
          )}

          <div className="mb-3 flex flex-col gap-1 text-sm">
            {order.items.map((i) => (
              <div key={i.productId} className="flex justify-between">
                <span className="text-muted-foreground">{i.qty} × {i.name}</span>
                <span className="font-medium">{formatPrice(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-border/60 pt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-primary">{formatPrice(order.total)}</span>
            </div>
          </div>

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cambiar estado
          </p>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {(["nuevo", "preparacion", "listo", "entregado"] as OrderStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => store.updateOrderStatus(order.id, s)}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                  order.status === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/60 bg-card text-muted-foreground"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(order)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar</span>
              </button>
            )}
            <a
              href={buildWhatsappUrl(order, settings)}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              WhatsApp
            </a>
            <button
              onClick={() => {
                if (confirm("¿Eliminar este pedido?")) store.deleteOrder(order.id);
              }}
              className="flex items-center justify-center gap-1 rounded-xl border border-border/60 px-4 py-2.5 text-xs text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin: Productos ─────────────────────────────────────────────────────────

function AdminProducts({ onStartTutorial }: { onStartTutorial?: () => void }) {
  const products = useStore((s) => s.products);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="p-3">
      {products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/20 p-6 text-center space-y-4 my-2 shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl shadow-inner">
            🎉
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-foreground">
              ¡Tu tienda está lista para comenzar!
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Agregá tus primeros productos para preparar tu catálogo y empezar a recibir pedidos.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            <button
              onClick={() => setAdding(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>＋ Crear mi primer producto</span>
            </button>
            {onStartTutorial && (
              <button
                onClick={onStartTutorial}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition"
              >
                <HelpCircle className="h-4 w-4 text-primary" />
                <span>Ver tutorial</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border/70 py-3.5 text-sm font-semibold text-muted-foreground transition hover:border-primary hover:text-primary active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {products.map((p) => {
            const isAvail = p.available !== false;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-xs transition ${
                  !isAvail ? "border-dashed border-border/60 bg-muted/20 opacity-80" : "border-border/60"
                }`}
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted relative">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className={`h-full w-full object-cover ${!isAvail ? "grayscale" : ""}`} />
                  ) : (
                    <span className="text-2xl">{p.emoji || "📦"}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    {p.badge && (
                      <span className="rounded-md bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 uppercase">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.category} · <span className="font-bold text-primary">{formatPrice(p.price)}</span>
                    {p.originalPrice && (
                      <span className="ml-1 text-[11px] line-through text-muted-foreground">{formatPrice(p.originalPrice)}</span>
                    )}
                  </p>
                </div>

                {/* Botón rápido Disponible / No disponible */}
                <button
                  type="button"
                  onClick={() => store.toggleProductAvailability(p.id)}
                  title="Tocar para cambiar disponibilidad"
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition ${
                    isAvail
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  }`}
                >
                  {isAvail ? "🟢 Disponible" : "🔴 Pausado"}
                </button>

                <button
                  onClick={() => setEditing(p)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`¿Eliminar "${p.name}"?`)) store.deleteProduct(p.id);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {(adding || editing) && (
        <ProductForm
          product={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ─── Admin: Formulario de producto ────────────────────────────────────────────

function ProductForm({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(String(product?.price ?? ""));
  const [originalPrice, setOriginalPrice] = useState(product?.originalPrice ? String(product.originalPrice) : "");
  const [category, setCategory] = useState(product?.category ?? "Almacén");
  const [emoji, setEmoji] = useState(product?.emoji ?? "📦");
  const [image, setImage] = useState(product?.image ?? "");
  const [available, setAvailable] = useState(product?.available !== false);
  const [description, setDescription] = useState(product?.description ?? "");
  const [badge, setBadge] = useState<string>(product?.badge ?? "");
  const [promoTitle, setPromoTitle] = useState(product?.promoTitle ?? "");

  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const priceNum = Number(price);
    if (!name.trim() || isNaN(priceNum) || priceNum < 0) return;

    const origPriceNum = originalPrice.trim() ? Number(originalPrice) : null;

    const base = {
      name: name.trim(),
      price: priceNum,
      originalPrice: origPriceNum && !isNaN(origPriceNum) ? origPriceNum : null,
      category: category.trim() || "Otros",
      emoji: emoji || "📦",
      available,
      description: description.trim() || null,
      badge: (badge as any) || null,
      promoTitle: promoTitle.trim() || null,
    };

    if (product) {
      const existingImage = product.image ?? null;
      const newImage = image || null;
      const patch =
        newImage !== existingImage
          ? { ...base, image: newImage ?? undefined }
          : base;
      store.updateProduct(product.id, patch);
    } else {
      store.addProduct({ ...base, image: image || undefined, kioskId: store.getState().selectedKioskId });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">
            {product ? "Editar producto" : "Nuevo producto"}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Disponibilidad toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/40 p-3">
            <div>
              <p className="text-xs font-bold text-foreground">Disponibilidad en tienda</p>
              <p className="text-[11px] text-muted-foreground">Si se desactiva, los clientes verán "No disponible"</p>
            </div>
            <button
              type="button"
              onClick={() => setAvailable(!available)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                available ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
              }`}
            >
              {available ? "🟢 Disponible" : "🔴 No disponible"}
            </button>
          </div>

          <Field label="Nombre del producto *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Coca Cola 1.5L"
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio de venta ($) *">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                placeholder="0"
                className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition font-bold"
              />
            </Field>
            <Field label="Precio tachado / normal ($)">
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                min={0}
                placeholder="Opcional para oferta"
                className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej: Bebidas"
                className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </Field>
            <Field label="Insignia / Badge">
              <select
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary transition"
              >
                <option value="">Sin insignia</option>
                <option value="oferta">🔴 Oferta</option>
                <option value="destacado">⭐ Destacado</option>
                <option value="promocion">⚡ Promoción</option>
                <option value="ultimas_unidades">🏷️ Últimas unidades</option>
              </select>
            </Field>
          </div>

          <Field label="Descripción breve (opcional)">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles, sabor, cantidad, etc."
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>

          {/* Imagen / Emoji */}
          <Field label="Imagen o emoji">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-16 w-16 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border/70 bg-muted transition hover:border-primary"
                title="Tocar para cambiar imagen"
              >
                {image ? (
                  <img src={image} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl">{emoji || "📦"}</span>
                )}
              </button>

              <div className="flex flex-1 flex-col gap-2">
                {!image && (
                  <Field label="Emoji">
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="📦"
                      value={emoji}
                      onChange={(e) => setEmoji(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:border-primary transition"
                    />
                  </Field>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl border border-border/70 bg-background px-3 py-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {image ? "Cambiar imagen" : "Subir imagen"}
                </button>
                {image && (
                  <button
                    type="button"
                    onClick={() => setImage("")}
                    className="flex items-center gap-1 text-xs text-destructive"
                  >
                    <ImageOff className="h-3 w-3" />
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                const objectUrl = URL.createObjectURL(file);
                const img = new window.Image();
                img.onload = () => {
                  const MAX = 400;
                  let { width, height } = img;
                  if (width > MAX || height > MAX) {
                    if (width >= height) { height = Math.round(height * (MAX / width)); width = MAX; }
                    else { width = Math.round(width * (MAX / height)); height = MAX; }
                  }
                  const canvas = document.createElement("canvas");
                  canvas.width = width; canvas.height = height;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) { URL.revokeObjectURL(objectUrl); return; }
                  ctx.drawImage(img, 0, 0, width, height);
                  setImage(canvas.toDataURL("image/jpeg", 0.72));
                  URL.revokeObjectURL(objectUrl);
                };
                img.onerror = () => URL.revokeObjectURL(objectUrl);
                img.src = objectUrl;
              }}
            />
          </Field>

          <button
            onClick={save}
            className="mt-1 w-full rounded-2xl bg-primary py-3.5 font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98]"
          >
            {product ? "Guardar cambios" : "Agregar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin: Ajustes ───────────────────────────────────────────────────────────

function AdminSettings() {
  const settings = useStore((s) => s.settings);
  const currentKiosk = useStore((s) => s.currentKiosk);
  const [shopName, setShopName] = useState(settings.shopName || currentKiosk.name || "");
  const [whatsapp, setWhatsapp] = useState(settings.whatsappNumber);
  const [mpAlias, setMpAlias] = useState(settings.mercadoPagoAlias);
  const [mpQr, setMpQr] = useState(settings.mercadoPagoQr ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(settings.welcomeMessage ?? "");
  const [description, setDescription] = useState(settings.description ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [businessHours, setBusinessHours] = useState(settings.businessHours ?? "");
  const [deliveryInfo, setDeliveryInfo] = useState(settings.deliveryInfo ?? "");
  const [paymentMethods, setPaymentMethods] = useState(settings.paymentMethods ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const qrFileRef = useRef<HTMLInputElement>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const kioskSlug = settings.slug || settings.kioskId || "";
  const storeUrl = `${origin}/?kiosk=${kioskSlug}`;

  const handleCopyStoreUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareStoreUrl = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shopName || "Mi Tienda Online",
          text: `¡Hacé tu pedido online en ${shopName || "mi tienda"}!`,
          url: storeUrl,
        });
      } catch {}
    } else {
      handleCopyStoreUrl();
    }
  };

  useEffect(() => {
    setShopName(settings.shopName || currentKiosk.name || "");
    setWhatsapp(settings.whatsappNumber || "");
    setMpAlias(settings.mercadoPagoAlias || "");
    setMpQr(settings.mercadoPagoQr ?? "");
    setWelcomeMessage(settings.welcomeMessage ?? "");
    setDescription(settings.description ?? "");
    setLogoUrl(settings.logoUrl ?? "");
    setAddress(settings.address ?? "");
    setBusinessHours(settings.businessHours ?? "");
    setDeliveryInfo(settings.deliveryInfo ?? "");
    setPaymentMethods(settings.paymentMethods ?? "");
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await store.updateSettings({
        shopName,
        whatsappNumber: whatsapp,
        mercadoPagoAlias: mpAlias,
        mercadoPagoQr: mpQr || null,
        welcomeMessage: welcomeMessage || null,
        description: description || null,
        logoUrl: logoUrl || null,
        address: address || null,
        businessHours: businessHours || null,
        deliveryInfo: deliveryInfo || null,
        paymentMethods: paymentMethods || null,
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 p-4">
      {/* Enlace de la tienda */}
      <SectionCard title="Enlace de la tienda">
        <div className="flex flex-col gap-2.5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Este es el enlace público directo a tu tienda online. Compartilo con tus clientes por WhatsApp o redes sociales para que puedan ingresar y realizar sus pedidos directamente.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/50 p-3 font-mono text-xs overflow-x-auto select-all">
            <span className="truncate flex-1 text-foreground font-semibold">{storeUrl}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyStoreUrl}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition active:scale-95"
            >
              {copiedLink ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  <span>Copiar</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleShareStoreUrl()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition active:scale-95"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
              <span>Compartir</span>
            </button>
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition active:scale-95"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Abrir</span>
            </a>
          </div>
        </div>
      </SectionCard>
      <SectionCard id="section-business-data" title="Datos del negocio">
        <div className="flex flex-col gap-3">
          <Field label="Nombre del kiosco">
            <input
              value={shopName}
              onChange={(e) => { setShopName(e.target.value); setSaved(false); }}
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>
          <Field label="Descripción breve del negocio">
            <input
              value={description}
              onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
              placeholder="Bebidas, snacks, golosinas y cigarrillos 24hs"
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>

          {/* Logo del negocio */}
          <div id="section-logo" className="flex flex-col gap-1.5 scroll-mt-20">
            <span className="text-xs font-semibold text-muted-foreground">
              Logo o imagen del negocio <span className="text-muted-foreground/60">(opcional)</span>
            </span>
            {logoUrl ? (
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted">
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setSaved(false); logoFileRef.current?.click(); }}
                    className="rounded-xl border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    Cambiar logo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl("");
                      setSaved(false);
                      if (logoFileRef.current) logoFileRef.current.value = "";
                    }}
                    className="flex items-center gap-1 text-xs text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Quitar logo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <Store className="h-4 w-4" />
                Subir logo o imagen
              </button>
            )}
            <input
              ref={logoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (readerEvent) => {
                  const dataUrl = readerEvent.target?.result as string;
                  if (!dataUrl) return;
                  const img = new window.Image();
                  img.onload = () => {
                    const MAX = 400;
                    let { width, height } = img;
                    if (width > MAX || height > MAX) {
                      if (width >= height) {
                        height = Math.round(height * (MAX / width));
                        width = MAX;
                      } else {
                        width = Math.round(width * (MAX / height));
                        height = MAX;
                      }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                      setLogoUrl(dataUrl);
                      setSaved(false);
                      return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    setLogoUrl(canvas.toDataURL("image/jpeg", 0.85));
                    setSaved(false);
                  };
                  img.onerror = () => {
                    setLogoUrl(dataUrl);
                    setSaved(false);
                  };
                  img.src = dataUrl;
                };
                reader.readAsDataURL(file);
                if (logoFileRef.current) {
                  logoFileRef.current.value = "";
                }
              }}
            />
          </div>

          <div id="section-whatsapp" className="scroll-mt-20">
            <Field
              label="Número de WhatsApp"
              hint="Con código de país, sin espacios. Ej: 5491123456789"
            >
              <input
                value={whatsapp}
                onChange={(e) => { setWhatsapp(e.target.value); setSaved(false); }}
                className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
              />
            </Field>
          </div>
          <Field label="Mensaje de bienvenida">
            <input
              value={welcomeMessage}
              onChange={(e) => { setWelcomeMessage(e.target.value); setSaved(false); }}
              placeholder="¡Bienvenidos! Realizá tu pedido online."
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Información de Confianza del Local */}
      <SectionCard id="section-hours" title="Confianza del Comercio (Mostrado al Cliente)">
        <div className="flex flex-col gap-3">
          <Field label="Ubicación / Dirección del local" hint="Ayuda al cliente a saber dónde queda tu comercio">
            <input
              value={address}
              onChange={(e) => { setAddress(e.target.value); setSaved(false); }}
              placeholder="Ej: Av. San Martín 1234, Mendoza"
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>

          <Field label="Horarios de atención">
            <input
              value={businessHours}
              onChange={(e) => { setBusinessHours(e.target.value); setSaved(false); }}
              placeholder="Ej: Lun a Sáb 08:00 a 22:00 hs"
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>

          <Field label="Opciones de retiro / envío">
            <input
              value={deliveryInfo}
              onChange={(e) => { setDeliveryInfo(e.target.value); setSaved(false); }}
              placeholder="Ej: Retiro por mostrador / Envíos en la zona"
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>

          <Field label="Medios de pago aceptados">
            <input
              value={paymentMethods}
              onChange={(e) => { setPaymentMethods(e.target.value); setSaved(false); }}
              placeholder="Ej: Efectivo, Mercado Pago, Transferencia"
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>
        </div>
      </SectionCard>

      {/* Mercado Pago */}
      <SectionCard id="section-payment" title="Mercado Pago">
        <div className="flex flex-col gap-4">
          <Field label="Alias de transferencia">
            <input
              value={mpAlias}
              onChange={(e) => { setMpAlias(e.target.value); setSaved(false); }}
              placeholder="tu.alias.mp"
              className="w-full rounded-xl border border-border/70 bg-background px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
            />
          </Field>

          {/* QR de Mercado Pago */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              QR de cobro <span className="text-muted-foreground/60">(opcional)</span>
            </span>

            {mpQr ? (
              <div className="flex items-start gap-3">
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white p-1">
                  <img src={mpQr} alt="QR MP" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => { setSaved(false); qrFileRef.current?.click(); }}
                    className="rounded-xl border border-border/70 bg-background px-3 py-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
                  >
                    Reemplazar QR
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMpQr(""); setSaved(false); }}
                    className="flex items-center gap-1 text-xs text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Quitar QR
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => qrFileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 py-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <QrCode className="h-5 w-5" />
                Subir imagen del QR
              </button>
            )}

            <input
              ref={qrFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                // QR: PNG 500×500 (sin pérdida para preservar el patrón del código)
                const objectUrl = URL.createObjectURL(file);
                const img = new window.Image();
                img.onload = () => {
                  const MAX = 500;
                  let { width, height } = img;
                  if (width > MAX || height > MAX) {
                    if (width >= height) { height = Math.round(height * (MAX / width)); width = MAX; }
                    else { width = Math.round(width * (MAX / height)); height = MAX; }
                  }
                  const canvas = document.createElement("canvas");
                  canvas.width = width; canvas.height = height;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) { URL.revokeObjectURL(objectUrl); return; }
                  ctx.drawImage(img, 0, 0, width, height);
                  setMpQr(canvas.toDataURL("image/png"));
                  setSaved(false);
                  URL.revokeObjectURL(objectUrl);
                };
                img.onerror = () => URL.revokeObjectURL(objectUrl);
                img.src = objectUrl;
              }}
            />

            <p className="text-[11px] text-muted-foreground">
              El QR se muestra a los clientes cuando pagan con Mercado Pago.
              Usá el QR de cobro de tu cuenta de MP.
            </p>
          </div>
        </div>
      </SectionCard>

      <button
        onClick={handleSave}
        className={`w-full rounded-2xl py-3.5 font-semibold shadow-sm transition active:scale-[0.98] ${
          saved
            ? "bg-emerald-600 text-white"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {saved ? (
          <span className="flex items-center justify-center gap-2">
            <Check className="h-4 w-4" />
            Cambios guardados
          </span>
        ) : (
          "Guardar cambios"
        )}
      </button>

      <div className="rounded-2xl border border-border/60 bg-card p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">Información</p>
        <p className="mt-1.5 leading-relaxed">
          Los datos del negocio y pedidos se guardan en el servidor.
          El carrito se guarda localmente en el dispositivo del cliente.
        </p>
      </div>
    </div>
  );
}

// ─── Admin: Promociones y Ofertas ─────────────────────────────────────────────

function AdminPromotions() {
  const products = useStore((s) => s.products);

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
        <Flame className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Sección de Ofertas y Destacados</p>
          <p className="mt-0.5 opacity-90">
            Asigná insignias visuales (Oferta, Destacado, Promoción) y precios de descuento a tus productos para captar la atención de tus clientes en la tienda.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {products.map((p) => {
          const hasPromo = Boolean(p.badge || (p.originalPrice && p.originalPrice > p.price));
          return (
            <div key={p.id} className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl">{p.emoji || "📦"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category} · Actual: <span className="font-bold text-primary">{formatPrice(p.price)}</span></p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (hasPromo) {
                      store.updateProduct(p.id, { badge: null, originalPrice: null });
                    } else {
                      store.updateProduct(p.id, {
                        badge: "oferta",
                        originalPrice: Math.round(p.price * 1.2),
                      });
                    }
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-bold border transition ${
                    hasPromo
                      ? "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                      : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                  }`}
                >
                  {hasPromo ? "🔥 Quitar Promo" : "⚡ Crear Promo"}
                </button>
              </div>

              {/* Ajustes de la promoción */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-border/40 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Insignia / Badge</label>
                  <select
                    value={p.badge || ""}
                    onChange={(e) => store.updateProduct(p.id, { badge: (e.target.value as any) || null })}
                    className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                  >
                    <option value="">Sin Badge</option>
                    <option value="oferta">🔴 Oferta</option>
                    <option value="destacado">⭐ Destacado</option>
                    <option value="promocion">⚡ Promoción</option>
                    <option value="ultimas_unidades">🏷️ Últimas u.</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Precio Anterior ($)</label>
                  <input
                    type="number"
                    value={p.originalPrice ?? ""}
                    placeholder="Ej: 1500"
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      store.updateProduct(p.id, { originalPrice: val });
                    }}
                    className="w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Admin: Marketing y Difusión ─────────────────────────────────────────────

function AdminMarketing() {
  const currentKiosk = useStore((s) => s.currentKiosk);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const storeUrl = `${origin}/?kiosk=${currentKiosk.slug || currentKiosk.id}`;

  const copyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsapp = () => {
    const text = `¡Hola! 👋 Te invito a conocer la tienda online de ${currentKiosk.name}. Mirá nuestros productos y realizá tu pedido directamente acá:\n${storeUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(storeUrl)}`;

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Difusión y Marketing de tu Tienda</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Compartí tu enlace público con tus clientes por WhatsApp, redes sociales o imprimí tu código QR para ponerlo en tu local.
        </p>

        {/* Link box */}
        <div className="rounded-xl border border-border bg-muted/40 p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Enlace público de tu kiosco</p>
            <p className="text-xs font-mono font-bold text-foreground truncate mt-0.5">{storeUrl}</p>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground flex items-center gap-1.5 transition active:scale-95 flex-shrink-0"
          >
            {copied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        </div>

        {/* Botón compartir WhatsApp */}
        <button
          type="button"
          onClick={shareWhatsapp}
          className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3 text-xs font-bold text-white flex items-center justify-center gap-2 transition shadow-xs"
        >
          <Share2 className="h-4 w-4" />
          Compartir Tienda por WhatsApp
        </button>
      </div>

      {/* Código QR */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 text-center">
        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Código QR de tu Negocio</h4>
        <div className="flex justify-center py-2">
          <div className="p-3 bg-white rounded-2xl border border-border shadow-xs">
            <img src={qrApiUrl} alt="QR Tienda" className="h-44 w-44 object-contain" />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Los clientes pueden escanear este QR con la cámara de su celular para abrir tu tienda al instante.
        </p>
        <a
          href={qrApiUrl}
          download={`QR_${currentKiosk.slug || "tienda"}.png`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-muted hover:bg-accent px-4 py-2 text-xs font-bold text-foreground transition"
        >
          <Download className="h-3.5 w-3.5" />
          Descargar QR en Alta Calidad
        </a>
      </div>
    </div>
  );
}

// ─── Admin: Métricas e Indicadores ────────────────────────────────────────────

function AdminStats() {
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);

  const totalSales = useMemo(() => {
    return orders
      .filter((o) => o.status === "entregado")
      .reduce((sum, o) => sum + o.total, 0);
  }, [orders]);

  const pendingOrders = useMemo(() => {
    return orders.filter((o) => o.status === "nuevo" || o.status === "preparacion").length;
  }, [orders]);

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Banknote className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-foreground">{formatPrice(totalSales)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Ventas Acumuladas</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Receipt className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-foreground">{orders.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pedidos Totales</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Package className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-foreground">{pendingOrders}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pedidos Pendientes</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
          <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <p className="text-2xl font-bold text-foreground">{products.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Productos en Catálogo</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Desglose de Pedidos por Estado</h4>
        <div className="space-y-2 text-xs">
          {(["nuevo", "preparacion", "listo", "entregado"] as OrderStatus[]).map((st) => {
            const count = orders.filter((o) => o.status === st).length;
            return (
              <div key={st} className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="capitalize text-muted-foreground">{STATUS_LABEL[st]}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLOR[st]}`}>
                  {count} pedidos
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Admin: Personalización Estética del Negocio ─────────────────────────────

function AdminDesign() {
  const settings = useStore((s) => s.settings);
  const [themeStyle, setThemeStyle] = useState(settings.themeStyle || "modern");
  const [themeColor, setThemeColor] = useState(settings.themeColor || "sky");
  const [bannerUrl, setBannerUrl] = useState(settings.bannerUrl || "");
  const [welcomeMsgType, setWelcomeMsgType] = useState(settings.welcomeMsgType || "default");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveDesign = async () => {
    setSaving(true);
    await store.updateSettings({
      themeStyle,
      themeColor,
      bannerUrl,
      welcomeMsgType,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const THEME_COLORS = [
    { id: "sky", name: "Azul Creador", bg: "bg-sky-500" },
    { id: "emerald", name: "Esmeralda Fresco", bg: "bg-emerald-500" },
    { id: "violet", name: "Púrpura Elegante", bg: "bg-purple-600" },
    { id: "amber", name: "Cálido Naranja", bg: "bg-amber-500" },
    { id: "rose", name: "Rosa Vibrante", bg: "bg-rose-500" },
    { id: "slate", name: "Gris Clásico", bg: "bg-slate-700" },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Personalización Visual del Negocio</h3>
        </div>

        {/* Estilos generales */}
        <Field label="Estilo visual de la tienda">
          <div className="grid grid-cols-3 gap-2 mt-1">
            {[
              { id: "modern", name: "Moderno", desc: "Minimalista y limpio" },
              { id: "classic", name: "Clásico", desc: "Elegante e institucional" },
              { id: "vibrant", name: "Vibrante", desc: "Dinámico y colorido" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setThemeStyle(st.id as "modern" | "classic" | "vibrant")}
                className={`p-2.5 rounded-xl border text-left transition ${
                  themeStyle === st.id
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <p className="text-xs">{st.name}</p>
                <p className="text-[9px] opacity-80 mt-0.5">{st.desc}</p>
              </button>
            ))}
          </div>
        </Field>

        {/* Paletas de color predefinidas */}
        <Field label="Paleta de color principal">
          <div className="grid grid-cols-2 gap-2 mt-1">
            {THEME_COLORS.map((tc) => (
              <button
                key={tc.id}
                type="button"
                onClick={() => setThemeColor(tc.id as "sky" | "emerald" | "violet" | "amber" | "rose" | "slate")}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition ${
                  themeColor === tc.id
                    ? "border-primary bg-primary/10 font-bold"
                    : "border-border bg-background"
                }`}
              >
                <span className={`h-4 w-4 rounded-full ${tc.bg}`} />
                <span className="text-xs truncate">{tc.name}</span>
              </button>
            ))}
          </div>
        </Field>

        {/* Mensaje de bienvenida / diario */}
        <Field label="Mensaje de bienvenida para tus clientes">
          <select
            value={welcomeMsgType}
            onChange={(e) => setWelcomeMsgType(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs outline-none focus:border-primary"
          >
            <option value="default">☀️ "¡Bienvenidos! Hacé tu pedido online y retiralo en el acto."</option>
            <option value="offers">🔥 "¡Aprovechá nuestras ofertas del día!"</option>
            <option value="delivery">🛵 "Hacemos envíos a domicilio. ¡Pedí ahora!"</option>
            <option value="none">Sin mensaje superior</option>
          </select>
        </Field>

        {/* Banner promocional top */}
        <Field label="URL del banner superior (Opcional)">
          <input
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://ejemplo.com/banner-promocional.jpg"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary"
          />
        </Field>

        <button
          type="button"
          onClick={saveDesign}
          disabled={saving}
          className="w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-foreground shadow-xs transition active:scale-[0.98]"
        >
          {saving ? "Guardando estilo..." : saved ? "¡Estilo Guardado! ✨" : "Guardar Personalización"}
        </button>
      </div>
    </div>
  );
}

// ─── SuperAdmin: Configuración Individual por Kiosco ─────────────────────────

function KioskBusinessConfigCard({
  kiosk,
  onKioskUpdated,
}: {
  kiosk: Kiosk;
  onKioskUpdated: (updated: Kiosk) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [name, setName] = useState(kiosk.name);
  const [slug, setSlug] = useState(kiosk.slug || "");
  const [active, setActive] = useState(kiosk.active);
  const [shopName, setShopName] = useState(kiosk.name);
  const [whatsapp, setWhatsapp] = useState("");
  const [mpAlias, setMpAlias] = useState("");
  const [mpQr, setMpQr] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [copiedKioskLink, setCopiedKioskLink] = useState(false);

  const logoFileRef = useRef<HTMLInputElement>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);

  const [copiedHandover, setCopiedHandover] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const currentSlug = slug.trim() || kiosk.slug || kiosk.id;
  const storeUrl = `${origin}/?kiosk=${currentSlug}`;

  const handoverText = `🏪 *¡BIENVENIDO A TU TIENDA ONLINE MULTIKIOSCO!*

📍 *Comercio:* ${name || kiosk.name}
🌐 *Tu Tienda Web Pública:* ${storeUrl}

🔐 *Acceso a tu Panel de Control Administrador:*
1. Ingresá a tu tienda desde el enlace arriba.
2. Tocá el ícono ⚙️ "Admin" en la barra de navegación inferior.
3. Iniciá sesión con tus credenciales de Administrador.

📲 *¡Tu negocio ya está activo para recibir pedidos directo a tu WhatsApp!*`;

  const handleCopyHandover = () => {
    navigator.clipboard.writeText(handoverText);
    setCopiedHandover(true);
    setTimeout(() => setCopiedHandover(false), 2000);
  };

  const handleCopyKioskLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopiedKioskLink(true);
    setTimeout(() => setCopiedKioskLink(false), 2000);
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const s = await store.fetchKioskSettings(kiosk.id);
      setName(kiosk.name);
      setSlug(kiosk.slug || "");
      setActive(kiosk.active);
      setShopName(s.shopName || kiosk.name);
      setWhatsapp(s.whatsappNumber || "");
      setMpAlias(s.mercadoPagoAlias || "");
      setMpQr(s.mercadoPagoQr || "");
      setWelcomeMessage(s.welcomeMessage || "");
      setDescription(s.description || "");
      setLogoUrl(s.logoUrl || "");
    } catch (err) {
      console.error("Error cargando configuración del kiosco", err);
    } finally {
      setLoading(false);
    }
  }, [kiosk]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("El nombre del negocio es obligatorio.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await store.updateSettings({
        kioskId: kiosk.id,
        name: name.trim(),
        slug: slug.trim(),
        active,
        shopName: shopName.trim() || name.trim(),
        whatsappNumber: whatsapp.trim(),
        mercadoPagoAlias: mpAlias.trim(),
        mercadoPagoQr: mpQr || null,
        welcomeMessage: welcomeMessage.trim() || null,
        description: description.trim() || null,
        logoUrl: logoUrl || null,
      });

      setSaving(false);
      setSuccessMsg("¡Configuración guardada exitosamente!");
      setTimeout(() => setSuccessMsg(""), 3500);

      onKioskUpdated({
        ...kiosk,
        name: name.trim(),
        slug: slug.trim(),
        active,
      });
    } catch (err: any) {
      setSaving(false);
      setErrorMsg(err.message || "Error al guardar la configuración.");
    }
  };

  const handleCancel = () => {
    void loadSettings();
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-5 text-center text-xs text-muted-foreground shadow-xs">
        Cargando configuración del negocio...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Settings2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Configuración del negocio
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Ajustes individuales de <strong>{kiosk.name}</strong>
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-semibold flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium flex items-center gap-2">
          <X className="h-4 w-4 text-destructive flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* ESTADO DE PREPARACIÓN Y FICHA DE ENTREGA */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Preparación para Entrega
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-2xs ${active && whatsapp ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}>
              {active && whatsapp ? "🟢 LISTO PARA ENTREGAR" : "🟡 PENDIENTE"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className={`p-2 rounded-xl border flex flex-col items-center text-center ${active ? "bg-emerald-100/60 border-emerald-300 text-emerald-900 font-medium" : "bg-muted border-border text-muted-foreground"}`}>
              <span>{active ? "🟢 Activo" : "🔴 Inactivo"}</span>
              <span className="text-[10px] opacity-80 mt-0.5">Tienda web</span>
            </div>
            <div className={`p-2 rounded-xl border flex flex-col items-center text-center ${whatsapp ? "bg-emerald-100/60 border-emerald-300 text-emerald-900 font-medium" : "bg-amber-100/60 border-amber-300 text-amber-900 font-medium"}`}>
              <span>{whatsapp ? "🟢 WhatsApp" : "⚠️ Faltante"}</span>
              <span className="text-[10px] opacity-80 mt-0.5">Notificaciones</span>
            </div>
            <div className={`p-2 rounded-xl border flex flex-col items-center text-center ${mpAlias || mpQr ? "bg-emerald-100/60 border-emerald-300 text-emerald-900 font-medium" : "bg-muted border-border text-muted-foreground"}`}>
              <span>{mpAlias || mpQr ? "🟢 Mercado Pago" : "⚪ Opcional MP"}</span>
              <span className="text-[10px] opacity-80 mt-0.5">Cobro Digital</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyHandover}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition active:scale-98 shadow-2xs"
          >
            {copiedHandover ? (
              <>
                <Check className="h-4 w-4" />
                <span>¡Ficha de entrega copiada para enviar por WhatsApp!</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span>Copiar Ficha de Entrega para el cliente</span>
              </>
            )}
          </button>
        </div>

        {/* ENLACE DIRECTO DE LA TIENDA */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h5 className="text-[11px] font-bold uppercase text-primary tracking-wider flex items-center gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              Enlace de la tienda
            </h5>
            <span className="text-[10px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded-md border border-border/60">
              ?kiosk={currentSlug}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            URL única para que los clientes ingresen directamente a la tienda de <strong>{name || kiosk.name}</strong>:
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-background p-2.5 font-mono text-xs overflow-x-auto select-all">
            <span className="truncate flex-1 text-foreground font-semibold">{storeUrl}</span>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={handleCopyKioskLink}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2 text-xs font-semibold text-foreground hover:bg-muted transition active:scale-95 shadow-2xs"
            >
              {copiedKioskLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Copiar enlace</span>
                </>
              )}
            </button>
            <a
              href={storeUrl}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition active:scale-95 shadow-2xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir tienda</span>
            </a>
          </div>
        </div>

        {/* 1. INFORMACIÓN DEL NEGOCIO */}
        <div className="rounded-xl bg-muted/40 border border-border/60 p-3.5 space-y-3">
          <h5 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-primary" />
            1. Información del Negocio
          </h5>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Nombre del negocio *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSuccessMsg(""); }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Slug / Identificador público URL *
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSuccessMsg(""); }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono text-xs"
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Identificador único seguro para la ruta web pública.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Descripción breve del negocio
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setSuccessMsg(""); }}
              placeholder="Bebidas, snacks, golosinas y cigarrillos 24hs"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Logo del negocio */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground block">
              Logo o imagen del negocio <span className="text-muted-foreground/60">(opcional)</span>
            </label>
            {logoUrl ? (
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted">
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setSuccessMsg(""); logoFileRef.current?.click(); }}
                    className="rounded-xl border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-foreground"
                  >
                    Cambiar logo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl("");
                      setSuccessMsg("");
                      if (logoFileRef.current) logoFileRef.current.value = "";
                    }}
                    className="flex items-center gap-1 text-xs text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Quitar logo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <Store className="h-4 w-4" />
                Subir logo o imagen
              </button>
            )}
            <input
              ref={logoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (readerEvent) => {
                  const dataUrl = readerEvent.target?.result as string;
                  if (!dataUrl) return;
                  const img = new window.Image();
                  img.onload = () => {
                    const MAX = 400;
                    let { width, height } = img;
                    if (width > MAX || height > MAX) {
                      if (width >= height) {
                        height = Math.round(height * (MAX / width));
                        width = MAX;
                      } else {
                        width = Math.round(width * (MAX / height));
                        height = MAX;
                      }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                      setLogoUrl(dataUrl);
                      setSuccessMsg("");
                      return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    setLogoUrl(canvas.toDataURL("image/jpeg", 0.85));
                    setSuccessMsg("");
                  };
                  img.onerror = () => {
                    setLogoUrl(dataUrl);
                    setSuccessMsg("");
                  };
                  img.src = dataUrl;
                };
                reader.readAsDataURL(file);
                if (logoFileRef.current) {
                  logoFileRef.current.value = "";
                }
              }}
            />
          </div>

          <div className="pt-1">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Visibilidad / Estado del kiosco
            </label>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-background p-2.5">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    active ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                <span className="text-xs font-bold">
                  {active ? "Visible para clientes (Activo)" : "Inactivo (Oculto)"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setActive(!active); setSuccessMsg(""); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition ${
                  active
                    ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                }`}
              >
                {active ? "Desactivar kiosco" : "Activar kiosco"}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
              {active
                ? "🟢 El kiosco se muestra en el selector público y puede recibir nuevos pedidos."
                : "🔴 Si está inactivo, no aparecerá en el selector público ni aceptará nuevos pedidos."}
            </p>
          </div>
        </div>

        {/* 2. INFORMACIÓN DE CONTACTO Y COBRO */}
        <div className="rounded-xl bg-muted/40 border border-border/60 p-3.5 space-y-3">
          <h5 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-primary" />
            2. Información de Contacto y Cobro
          </h5>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Número de WhatsApp
            </label>
            <input
              type="text"
              value={whatsapp}
              onChange={(e) => { setWhatsapp(e.target.value); setSuccessMsg(""); }}
              placeholder="5493437449728"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Sin el signo +, con código de país. Utilizado para recibir notificaciones de pedidos.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Alias de Mercado Pago
            </label>
            <input
              type="text"
              value={mpAlias}
              onChange={(e) => { setMpAlias(e.target.value); setSuccessMsg(""); }}
              placeholder="alias.mercadopago"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* QR MP */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground block">
              QR de cobro de Mercado Pago <span className="text-muted-foreground/60">(opcional)</span>
            </label>

            {mpQr ? (
              <div className="flex items-start gap-3">
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-white p-1">
                  <img src={mpQr} alt="QR MP" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => { setSuccessMsg(""); qrFileRef.current?.click(); }}
                    className="rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
                  >
                    Reemplazar QR
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMpQr(""); setSuccessMsg(""); }}
                    className="flex items-center gap-1 text-xs text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    Quitar QR
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => qrFileRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <QrCode className="h-4 w-4" />
                Subir imagen del QR
              </button>
            )}

            <input
              ref={qrFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                e.target.value = "";
                const objectUrl = URL.createObjectURL(file);
                const img = new window.Image();
                img.onload = () => {
                  const MAX = 500;
                  let { width, height } = img;
                  if (width > MAX || height > MAX) {
                    if (width >= height) { height = Math.round(height * (MAX / width)); width = MAX; }
                    else { width = Math.round(width * (MAX / height)); height = MAX; }
                  }
                  const canvas = document.createElement("canvas");
                  canvas.width = width; canvas.height = height;
                  const ctx = canvas.getContext("2d");
                  if (!ctx) { URL.revokeObjectURL(objectUrl); return; }
                  ctx.drawImage(img, 0, 0, width, height);
                  setMpQr(canvas.toDataURL("image/png"));
                  setSuccessMsg("");
                  URL.revokeObjectURL(objectUrl);
                };
                img.onerror = () => URL.revokeObjectURL(objectUrl);
                img.src = objectUrl;
              }}
            />
          </div>
        </div>

        {/* 3. CONFIGURACIÓN DE LA TIENDA */}
        <div className="rounded-xl bg-muted/40 border border-border/60 p-3.5 space-y-3">
          <h5 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            3. Configuración de la Tienda
          </h5>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Nombre mostrado al cliente
            </label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => { setShopName(e.target.value); setSuccessMsg(""); }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Mensaje de bienvenida
            </label>
            <input
              type="text"
              value={welcomeMessage}
              onChange={(e) => { setWelcomeMessage(e.target.value); setSuccessMsg(""); }}
              placeholder="¡Bienvenidos! Realizá tu pedido online."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs disabled:opacity-50"
          >
            {saving ? (
              <span>Guardando...</span>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Guardar cambios</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── SuperAdmin: Panel de plataforma ─────────────────────────────────────────

function SuperAdminTestsSection({
  kiosks,
  selectedKioskId,
}: {
  kiosks: Kiosk[];
  selectedKioskId: string;
}) {
  const isSuperAdmin = store.getAdminRole() === "superadmin" && store.hasAdminAuth();
  if (!isSuperAdmin) {
    return (
      <div className="p-4 text-xs text-destructive bg-destructive/10 rounded-xl">
        Acceso restringido: Esta sección requiere rol SuperAdmin autenticado.
      </div>
    );
  }

  const [testKioskId, setTestKioskId] = useState<string>(selectedKioskId || kiosks[0]?.id || "");
  const [audioStatus, setAudioStatus] = useState<string>(store.getAudioStatus());
  const [feedback, setFeedback] = useState<string>("");

  const refreshAudioStatus = () => {
    setAudioStatus(store.getAudioStatus());
  };

  const handleUnlockAudio = async () => {
    if (store.getAdminRole() !== "superadmin") return;
    const ok = await store.unlockAudioPipeline();
    refreshAudioStatus();
    if (ok) {
      await store.playNotificationSound("listo");
      setFeedback("✅ Web Audio activo y verificado con tono de prueba.");
    } else {
      setFeedback("⚠️ El navegador requiere un toque o clic adicional para desbloquear el audio.");
    }
    setTimeout(() => setFeedback(""), 4000);
  };

  const handleTestEvent = async (
    type: "new_order" | "preparacion" | "listo" | "en_camino" | "entregado",
    label: string
  ) => {
    if (store.getAdminRole() !== "superadmin") return;
    store.simulateTestNotification(type, testKioskId);
    refreshAudioStatus();
    setFeedback(`🔔 Evento emitido: "${label}" para el negocio seleccionado.`);
    setTimeout(() => setFeedback(""), 3500);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header explicativo */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧪</span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Consola de Pruebas: Notificaciones y Sonidos
              </h3>
              <p className="text-xs text-muted-foreground">
                Exclusivo para rol SuperAdmin. Permite verificar los 5 eventos y el aislamiento por negocio.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 border border-amber-200 uppercase">
            SuperAdmin Only
          </span>
        </div>

        {feedback && (
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-xs text-primary font-medium animate-in fade-in">
            {feedback}
          </div>
        )}
      </div>

      {/* 1. Diagnóstico y desbloqueo de AudioContext */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          1. Estado de Web Audio API
        </h4>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 rounded-xl p-3 border border-border/40">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Estado del AudioContext:</span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                  audioStatus === "running"
                    ? "bg-emerald-100 text-emerald-700"
                    : audioStatus === "suspended"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {audioStatus}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {audioStatus === "running"
                ? "El canal de sonido está listo para reproducir alertas."
                : "El navegador suspendió el audio esperando una interacción del usuario."}
            </p>
          </div>

          <button
            type="button"
            onClick={handleUnlockAudio}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
          >
            <Volume2 className="h-4 w-4" />
            Probar / Desbloquear Sonido
          </button>
        </div>
      </div>

      {/* 2. Selector de negocio para verificar aislamiento */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-2">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          2. Negocio Destino (Aislamiento por KioskId)
        </h4>
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={testKioskId}
            onChange={(e) => setTestKioskId(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {kiosks.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({k.slug})
              </option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          La notificación solo se emitirá y mostrará para usuarios asociados a este kiosco.
        </p>
      </div>

      {/* 3. Botones de prueba para los 5 eventos */}
      <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          3. Simulación de Eventos de Pedido
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Evento 1: Nuevo Pedido */}
          <button
            type="button"
            onClick={() => handleTestEvent("new_order", "Nuevo pedido")}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-left hover:border-primary/50 hover:bg-muted/40 transition group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
              🔔
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary">
                Nuevo Pedido (Admin)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Avisa al administrador del negocio con tono doble ascendente (D5 → A5).
              </p>
            </div>
          </button>

          {/* Evento 2: En preparación */}
          <button
            type="button"
            onClick={() => handleTestEvent("preparacion", "Pedido en preparación")}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-left hover:border-primary/50 hover:bg-muted/40 transition group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 font-bold">
              👨‍🍳
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary">
                En Preparación (Cliente)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Avisa al cliente que su pedido se está preparando con tono armónico (C5 → E5).
              </p>
            </div>
          </button>

          {/* Evento 3: Listo para retirar */}
          <button
            type="button"
            onClick={() => handleTestEvent("listo", "Listo para retirar")}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-left hover:border-primary/50 hover:bg-muted/40 transition group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold">
              🎉
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary">
                Listo para Retiro (Cliente)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Avisa que puede retirar en el local con campana tríada alegre (C5 → E5 → G5).
              </p>
            </div>
          </button>

          {/* Evento 4: En camino / Envío */}
          <button
            type="button"
            onClick={() => handleTestEvent("en_camino", "En camino a domicilio")}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-left hover:border-primary/50 hover:bg-muted/40 transition group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold">
              🛵
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary">
                En Camino / Envío (Cliente)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Avisa reparto en camino con tono dinámico ascendente (F5 → A5 → C6).
              </p>
            </div>
          </button>

          {/* Evento 5: Entregado */}
          <button
            type="button"
            onClick={() => handleTestEvent("entregado", "Pedido entregado")}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-3 text-left hover:border-primary/50 hover:bg-muted/40 transition group sm:col-span-2"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 font-bold">
              ✅
            </div>
            <div>
              <div className="text-xs font-bold text-foreground group-hover:text-primary">
                Pedido Entregado (Cliente)
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Confirma finalización exitosa del pedido con acorde cálido (E5 → A5).
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Documentación técnica de comportamiento en navegadores */}
      <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <span>ℹ️</span> Comportamiento de Sonido y Segundo Plano en Navegadores Web
        </h4>
        <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
          <li>
            <strong className="text-foreground">Primer plano (Pestaña activa):</strong> Los sonidos se reproducen instantáneamente mediante Web Audio API sintetizado una vez que el usuario ha tocado la pantalla al menos una vez (Autoplay Policy del navegador).
          </li>
          <li>
            <strong className="text-foreground">Segundo plano / Pantalla apagada:</strong> Los navegadores móviles (Chrome Android, Safari iOS) suspenden la ejecución de timers de audio para ahorro de batería. Al volver a abrir o tocar la pestaña, el sistema se reactiva automáticamente y sincroniza el estado.
          </li>
          <li>
            <strong className="text-foreground">Deduplicación estricta:</strong> Cada notificación y sonido se ejecuta exactamente una vez por evento (`new_id` o `status_id_estado`), impidiendo repeticiones sonoras en re-renderizados o consultas periódicas.
          </li>
        </ul>
      </div>
    </div>
  );
}

function SuperAdminPanel({
  onGoToBusiness,
  onLogout,
}: {
  onGoToBusiness: () => void;
  onLogout?: () => void;
}) {
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const settings = useStore((s) => s.settings);
  const selectedKioskId = useStore((s) => s.selectedKioskId);

  const [activeTab, setActiveTab] = useState<"kiosks" | "users" | "stats" | "tests">("kiosks");

  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newActive, setNewActive] = useState(true);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  // Handover Sheet Modal State
  const [handoverModalData, setHandoverModalData] = useState<{
    kiosk: Kiosk;
    ownerName?: string | null;
    ownerEmail?: string | null;
    ownerPhone?: string | null;
    adminUsername?: string | null;
    initialPassword?: string | null;
  } | null>(null);

  // Edit Kiosk State
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null);
  const [editKioskName, setEditKioskName] = useState("");
  const [editKioskSlug, setEditKioskSlug] = useState("");
  const [editKioskLoading, setEditKioskLoading] = useState(false);
  const [editKioskError, setEditKioskError] = useState("");

  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteKioskId, setInviteKioskId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccessData, setInviteSuccessData] = useState<{
    invitation: AdminInvitation;
    message: string;
    inviteUrl?: string;
    emailResult?: { simulated: boolean; inviteUrl?: string; error?: string };
  } | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);

  // Assign Existing Admin Modal State
  const [showAssignExistingAdminModal, setShowAssignExistingAdminModal] = useState(false);
  const [selectedAdminToAssign, setSelectedAdminToAssign] = useState("");
  const [assigningAdmin, setAssigningAdmin] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [newPassVal, setNewPassVal] = useState("");
  const [resetConfirmPassVal, setResetConfirmPassVal] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  // Edit Admin User State
  const [editingAdminUser, setEditingAdminUser] = useState<AdminUser | null>(null);
  const [editAdminName, setEditAdminName] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminKioskId, setEditAdminKioskId] = useState("");
  const [editingAdminLoading, setEditingAdminLoading] = useState(false);
  const [editingAdminError, setEditingAdminError] = useState("");

  // Delete Admin User State
  const [adminUserToDelete, setAdminUserToDelete] = useState<AdminUser | null>(null);
  const [deletingAdminUser, setDeletingAdminUser] = useState(false);
  const [deleteAdminUserError, setDeleteAdminUserError] = useState("");

  // Individual Kiosk Control Center State
  const [selectedKioskDetail, setSelectedKioskDetail] = useState<Kiosk | null>(null);
  const [kioskProductsDetail, setKioskProductsDetail] = useState<Product[]>([]);
  const [kioskOrdersDetail, setKioskOrdersDetail] = useState<Order[]>([]);
  const [loadingKioskDetail, setLoadingKioskDetail] = useState(false);
  const [kioskToDelete, setKioskToDelete] = useState<Kiosk | null>(null);
  const [deletingKiosk, setDeletingKiosk] = useState(false);
  const [deleteKioskError, setDeleteKioskError] = useState("");

  const handleOpenKioskDetail = useCallback(async (k: Kiosk) => {
    setSelectedKioskDetail(k);
    setLoadingKioskDetail(true);
    try {
      const [pRes, oRes] = await Promise.all([
        store.api<Product[]>(`/products?kioskId=${encodeURIComponent(k.id)}`),
        store.api<Order[]>(`/orders?kioskId=${encodeURIComponent(k.id)}`),
      ]);
      setKioskProductsDetail(Array.isArray(pRes) ? pRes : []);
      const allOrders = Array.isArray(oRes) ? oRes : [];
      setKioskOrdersDetail(allOrders.filter((o) => (o.kioskId || k.id) === k.id));
    } catch (err) {
      console.error("Error loading kiosk detail stats", err);
    } finally {
      setLoadingKioskDetail(false);
    }
  }, []);

  const loadKiosks = useCallback(async () => {
    const res = await store.fetchKiosks();
    if (res.ok && res.kiosks) {
      const seen = new Set<string>();
      const deduped = res.kiosks.filter((k) => {
        if (!k.id || seen.has(k.id)) return false;
        seen.add(k.id);
        return true;
      });
      setKiosks(deduped);
    } else {
      setKiosks([]);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (store.getAdminRole() !== "superadmin") return;
    try {
      const uList = await store.fetchAdminUsers();
      setUsers(uList);
    } catch {
      // Ignorar errores de autorización
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    if (store.getAdminRole() !== "superadmin") return;
    try {
      const res = await store.fetchInvitations();
      if (res.ok && res.invitations) {
        setInvitations(res.invitations);
      }
    } catch {
      // Ignorar errores
    }
  }, []);

  useEffect(() => {
    loadKiosks();
    loadUsers();
    loadInvitations();
  }, [loadKiosks, loadUsers, loadInvitations]);

  const activeKiosksCount = useMemo(() => {
    return kiosks.filter((k) => k.active).length;
  }, [kiosks]);

  const stats = useMemo(() => ({
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === "nuevo" || o.status === "preparacion").length,
    totalRevenue: orders.filter((o) => o.status !== "entregado").reduce((sum, o) => sum + o.total, 0),
    totalProducts: products.length,
  }), [orders, products]);

  const handleCreateKiosk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError("El nombre del negocio es obligatorio");
      return;
    }
    setCreating(true);
    setFormError("");
    const res = await store.createKiosk({
      name: newName.trim(),
      slug: newSlug.trim() || undefined,
      active: newActive,
      ownerName: newOwnerName.trim() || undefined,
      ownerEmail: newOwnerEmail.trim() || undefined,
      ownerPhone: newOwnerPhone.trim() || undefined,
    });
    setCreating(false);
    if (res.ok && res.kiosk) {
      setShowAddModal(false);
      setHandoverModalData({
        kiosk: res.kiosk,
        ownerName: newOwnerName.trim() || res.kiosk.ownerName,
        ownerEmail: newOwnerEmail.trim() || res.kiosk.ownerEmail,
        ownerPhone: newOwnerPhone.trim() || res.kiosk.ownerPhone,
      });
      setNewName("");
      setNewSlug("");
      setNewOwnerName("");
      setNewOwnerEmail("");
      setNewOwnerPhone("");
      setNewActive(true);
      await loadKiosks();
    } else {
      setFormError(res.error || "Error al crear el negocio");
    }
  };

  const handleUpdateKioskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKiosk || !editKioskName.trim()) {
      setEditKioskError("El nombre es obligatorio");
      return;
    }
    setEditKioskLoading(true);
    setEditKioskError("");

    const res = await store.updateKiosk(editingKiosk.id, {
      name: editKioskName.trim(),
      slug: editKioskSlug.trim() || undefined,
    });
    setEditKioskLoading(false);

    if (res.ok && res.kiosk) {
      setKiosks((prev) =>
        prev.map((k) => (k.id === editingKiosk.id ? res.kiosk! : k))
      );
      if (selectedKioskDetail && selectedKioskDetail.id === editingKiosk.id) {
        setSelectedKioskDetail(res.kiosk);
      }
      setEditingKiosk(null);
      await loadKiosks();
      await store.refreshSettings();
    } else {
      setEditKioskError(res.error || "Error al actualizar negocio");
    }
  };

  const handleToggleStatus = async (id: string, currentActive: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newActive = !currentActive;
    const res = await store.toggleKioskStatus(id, newActive);
    if (res.ok && res.kiosk) {
      const updatedActive = res.kiosk.active;
      const kioskRealId = res.kiosk.id;
      setKiosks((prev) =>
        prev.map((k) => (k.id === id || k.id === kioskRealId || k.slug === id ? { ...k, active: updatedActive } : k))
      );
      setSelectedKioskDetail((prev) =>
        prev && (prev.id === id || prev.id === kioskRealId) ? { ...prev, active: updatedActive } : prev
      );
      store.addToast({
        title: updatedActive ? "Negocio activado" : "Negocio pausado",
        message: `${res.kiosk.name || "El negocio"} ahora está ${updatedActive ? "activo y recibiendo pedidos" : "inactivo / pausado"}.`,
        type: "success",
      });
    } else {
      store.addToast({
        title: "Error",
        message: res.error || "No se pudo cambiar el estado del negocio",
        type: "warning",
      });
    }
  };

  const handleDeleteKioskConfirm = async () => {
    if (!kioskToDelete) return;
    setDeletingKiosk(true);
    setDeleteKioskError("");

    const res = await store.deleteKiosk(kioskToDelete.id);
    setDeletingKiosk(false);

    if (res.ok) {
      setKiosks((prev) => prev.filter((k) => k.id !== kioskToDelete.id));
      if (selectedKioskDetail && selectedKioskDetail.id === kioskToDelete.id) {
        setSelectedKioskDetail(null);
      }
      setKioskToDelete(null);
      await loadKiosks();
      await loadUsers();
      store.addToast({
        title: "Kiosco eliminado",
        message: res.message || "El negocio y sus datos han sido eliminados correctamente.",
        type: "success",
      });
    } else {
      setDeleteKioskError(res.error || "Error al eliminar el negocio.");
    }
  };

  // User & Invitation Management Handlers
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError("El nombre y el email son obligatorios");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(inviteEmail.trim())) {
      setInviteError("Ingrese un correo electrónico válido");
      return;
    }

    setInviting(true);
    setInviteError("");

    const targetKioskId = selectedKioskDetail?.id || inviteKioskId || kiosks[0]?.id || "";
    const res = await store.createInvitation({
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      kioskId: targetKioskId,
    });

    setInviting(false);

    if (res.ok && res.invitation) {
      setShowInviteModal(false);
      setInviteName("");
      setInviteEmail("");
      const resolvedInviteUrl = res.inviteUrl || res.emailResult?.inviteUrl;
      setCopiedInviteUrl(false);
      setInviteSuccessData({
        invitation: res.invitation,
        message: res.message || "Invitación registrada con éxito. Copia el enlace para enviárselo manualmente.",
        inviteUrl: resolvedInviteUrl,
        emailResult: res.emailResult || (resolvedInviteUrl ? { simulated: true, inviteUrl: resolvedInviteUrl } : undefined),
      });
      loadInvitations();
      loadUsers();
      store.addToast({
        title: "Invitación registrada",
        message: `Enlace de activación generado para ${res.invitation.email}`,
        type: "success",
      });
    } else {
      setInviteError(res.error || "Error al generar invitación");
    }
  };

  const handleResendInvitation = async (invId: string) => {
    const res = await store.resendInvitation(invId);
    if (res.ok) {
      loadInvitations();
      const resolvedInviteUrl = res.inviteUrl || res.emailResult?.inviteUrl;
      if (res.invitation && resolvedInviteUrl) {
        setCopiedInviteUrl(false);
        setInviteSuccessData({
          invitation: res.invitation,
          message: res.message || "Nuevo enlace de activación generado.",
          inviteUrl: resolvedInviteUrl,
          emailResult: {
            simulated: true,
            inviteUrl: resolvedInviteUrl,
          },
        });
      }
      store.addToast({
        title: "Enlace generado",
        message: res.message || "Enlace de activación listo para copiar",
        type: "success",
      });
    } else {
      store.addToast({
        title: "Error al generar enlace",
        message: res.error || "No se pudo generar el enlace de invitación",
        type: "warning",
      });
    }
  };

  const handleCancelInvitation = async (invId: string) => {
    const res = await store.cancelInvitation(invId);
    if (res.ok) {
      loadInvitations();
      store.addToast({
        title: "Invitación cancelada",
        message: "La invitación pendiente ha sido eliminada.",
        type: "success",
      });
    } else {
      store.addToast({
        title: "Error",
        message: res.error || "No se pudo cancelar la invitación",
        type: "warning",
      });
    }
  };

  const handleToggleUserActive = async (user: AdminUser) => {
    const nextState = user.active === false ? true : false;
    const res = await store.updateAdminUser(user.id, { active: nextState });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, active: nextState } : u))
      );
      loadUsers();
      store.addToast({
        title: nextState ? "Usuario activado" : "Usuario desactivado",
        message: `La cuenta @${user.username} ha sido ${nextState ? "activada" : "desactivada y sus sesiones revocadas"}.`,
        type: "success",
      });
    } else {
      store.addToast({
        title: "Error",
        message: res.error || "No se pudo cambiar el estado del usuario",
        type: "warning",
      });
    }
  };

  const handleReassignKiosk = async (userId: string, newKioskId: string) => {
    const res = await store.updateAdminUser(userId, { kioskId: newKioskId });
    if (res.ok) {
      loadUsers();
    }
  };

  const handleOpenEditAdminUser = (u: AdminUser) => {
    setEditingAdminUser(u);
    setEditAdminName(u.name);
    setEditAdminEmail(u.username);
    setEditAdminKioskId(u.kioskId || kiosks[0]?.id || "");
    setEditingAdminError("");
  };

  const handleEditAdminUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdminUser) return;
    if (!editAdminName.trim()) {
      setEditingAdminError("El nombre del administrador es obligatorio.");
      return;
    }
    if (!editAdminEmail.trim()) {
      setEditingAdminError("El email del administrador es obligatorio.");
      return;
    }

    setEditingAdminLoading(true);
    setEditingAdminError("");

    const updatePayload: { name: string; email: string; kioskId?: string } = {
      name: editAdminName.trim(),
      email: editAdminEmail.trim().toLowerCase(),
    };

    if (editingAdminUser.role !== "superadmin" && editAdminKioskId) {
      updatePayload.kioskId = editAdminKioskId;
    }

    const res = await store.updateAdminUser(editingAdminUser.id, updatePayload);
    setEditingAdminLoading(false);

    if (res.ok) {
      setEditingAdminUser(null);
      await loadUsers();
      store.addToast({
        title: "Administrador actualizado",
        message: `Los datos de "${editAdminName.trim()}" han sido guardados en la base de datos.`,
        type: "success",
      });
    } else {
      setEditingAdminError(res.error || "No se pudo actualizar el administrador.");
    }
  };

  const handleDeleteAdminUserConfirm = async () => {
    if (!adminUserToDelete) return;
    setDeletingAdminUser(true);
    setDeleteAdminUserError("");

    const res = await store.deleteAdminUser(adminUserToDelete.id);
    setDeletingAdminUser(false);

    if (res.ok) {
      const deletedName = adminUserToDelete.name;
      setAdminUserToDelete(null);
      await loadUsers();
      store.addToast({
        title: "Administrador eliminado",
        message: `El administrador "${deletedName}" ha sido eliminado permanentemente.`,
        type: "success",
      });
    } else {
      setDeleteAdminUserError(res.error || "Error al eliminar el administrador.");
    }
  };

  const handleAssignExistingAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKioskDetail || !selectedAdminToAssign) {
      setAssignError("Seleccione un administrador");
      return;
    }
    setAssigningAdmin(true);
    setAssignError("");
    const res = await store.assignKioskToUser(selectedAdminToAssign, selectedKioskDetail.id);
    setAssigningAdmin(false);
    if (res.ok) {
      setShowAssignExistingAdminModal(false);
      setSelectedAdminToAssign("");
      await loadUsers();
    } else {
      setAssignError(res.error || "Error al asignar kiosco");
    }
  };

  const handleUnassignKioskFromDetail = async (userId: string, kioskId: string) => {
    const res = await store.unassignKioskFromUser(userId, kioskId);
    if (res.ok) {
      await loadUsers();
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !newPassVal || newPassVal.length < 6) {
      setResetError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassVal !== resetConfirmPassVal) {
      setResetError("Las contraseñas no coinciden");
      return;
    }
    setResetLoading(true);
    setResetError("");

    const res = await store.resetAdminPassword(resetUser.id, newPassVal);
    setResetLoading(false);

    if (res.ok) {
      setResetUser(null);
      setNewPassVal("");
      setResetConfirmPassVal("");
    } else {
      setResetError(res.error || "Error al restablecer la contraseña");
    }
  };

  return (
    <div>
      {/* Banner Encabezado */}
      <div className="border-b border-border/60 bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3.5 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white leading-none">Panel SuperAdmin</h2>
            <p className="text-[11px] text-slate-300 mt-0.5">Administración Central de Plataforma Global</p>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/50 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition shadow-2xs shrink-0"
            title="Cerrar sesión de SuperAdmin"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cerrar sesión</span>
            <span className="sm:hidden">Salir</span>
          </button>
        )}
      </div>

      {selectedKioskDetail ? (
        /* 🚨 PANEL DE CONTROL INDIVIDUAL DEL KIOSCO 🚨 */
        <div className="p-4 space-y-4 animate-in fade-in zoom-in-95">
          {/* Breadcrumb & Volver */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <button
              type="button"
              onClick={() => setSelectedKioskDetail(null)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a Gestión Multinegocio
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingKiosk(selectedKioskDetail);
                  setEditKioskName(selectedKioskDetail.name);
                  setEditKioskSlug(selectedKioskDetail.slug);
                  setEditKioskError("");
                }}
                className="flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteKioskError("");
                  setKioskToDelete(selectedKioskDetail);
                }}
                className="flex items-center gap-1 rounded-xl border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10"
                title="Eliminar este negocio permanentemente"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
              <button
                type="button"
                onClick={(e) => handleToggleStatus(selectedKioskDetail.id, selectedKioskDetail.active, e)}
                title={selectedKioskDetail.active ? "Desactivar kiosco" : "Activar kiosco"}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold border transition ${
                  selectedKioskDetail.active
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                }`}
              >
                {selectedKioskDetail.active ? "● Activo" : "○ Inactivo"}
              </button>
            </div>
          </div>

          {/* 1. INFORMACIÓN DEL NEGOCIO */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold">
                <Store className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground truncate">{selectedKioskDetail.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      selectedKioskDetail.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {selectedKioskDetail.active ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">slug: {selectedKioskDetail.slug}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2.5 text-xs border-t border-border/40">
              <div>
                <span className="text-muted-foreground block text-[11px]">ID del Kiosco:</span>
                <span className="font-mono font-semibold text-foreground text-xs">{selectedKioskDetail.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Visibilidad Pública:</span>
                <span className={`font-semibold text-xs ${selectedKioskDetail.active ? "text-emerald-600" : "text-slate-500"}`}>
                  {selectedKioskDetail.active ? "● Visible en selector" : "○ Oculto"}
                </span>
              </div>
            </div>
          </div>

          {/* 2. RESUMEN Y ESTADÍSTICAS DEL NEGOCIO */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Resumen del Negocio
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="text-xs font-semibold">Productos</span>
                </div>
                <p className="text-2xl font-bold">{loadingKioskDetail ? "..." : kioskProductsDetail.length}</p>
                <p className="text-[11px] text-muted-foreground">catálogo asignado</p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-sky-600 mb-1">
                  <Receipt className="h-4 w-4" />
                  <span className="text-xs font-semibold">Pedidos Totales</span>
                </div>
                <p className="text-2xl font-bold">{loadingKioskDetail ? "..." : kioskOrdersDetail.length}</p>
                <p className="text-[11px] text-muted-foreground">historial completo</p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-semibold">Pedidos Activos</span>
                </div>
                <p className="text-2xl font-bold">
                  {loadingKioskDetail
                    ? "..."
                    : kioskOrdersDetail.filter((o) => o.status === "nuevo" || o.status === "preparacion").length}
                </p>
                <p className="text-[11px] text-muted-foreground">en proceso</p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
                <div className="flex items-center gap-1.5 text-violet-600 mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-semibold">Administradores</span>
                </div>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.kioskId === selectedKioskDetail.id).length}
                </p>
                <p className="text-[11px] text-muted-foreground">cuentas asignadas</p>
              </div>
            </div>
          </div>

          {/* CONFIGURACIÓN DEL NEGOCIO */}
          <KioskBusinessConfigCard
            kiosk={selectedKioskDetail}
            onKioskUpdated={(updated) => {
              setSelectedKioskDetail(updated);
              setKiosks((prev) =>
                prev.map((k) => (k.id === updated.id ? updated : k))
              );
            }}
          />

          {/* 3. ADMINISTRADORES DEL KIOSCO */}
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Administradores del Kiosco ({users.filter((u) => u.kioskId === selectedKioskDetail.id || u.kioskIds?.includes(selectedKioskDetail.id)).length})
                </h4>
                <p className="text-[11px] text-muted-foreground">Cuentas con permisos de administración sobre este negocio</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAdminToAssign("");
                    setAssignError("");
                    setShowAssignExistingAdminModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 transition shadow-2xs border border-border/60"
                >
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>Asignar existente</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setInviteError("");
                    setInviteName("");
                    setInviteEmail("");
                    setInviteKioskId(selectedKioskDetail.id);
                    setInviteSuccessData(null);
                    setShowInviteModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Invitar administrador</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50/70 border border-blue-200/60 p-2.5 text-[11px] text-blue-900 flex items-start gap-2">
              <Lock className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">¿El administrador olvidó su contraseña?</span> Utilice la opción <strong>Restablecer contraseña</strong> para fijar una clave nueva de forma segura. Las contraseñas se almacenan encriptadas.
              </div>
            </div>

            {users.filter((u) => u.kioskId === selectedKioskDetail.id || u.kioskIds?.includes(selectedKioskDetail.id)).length === 0 ? (
              <div className="py-4 text-center border border-dashed border-border/60 rounded-xl space-y-2">
                <p className="text-xs text-muted-foreground italic">
                  No hay administradores asignados específicamente a este kiosco.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAdminToAssign("");
                      setAssignError("");
                      setShowAssignExistingAdminModal(true);
                    }}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    + Asignar administrador existente
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {users
                  .filter((u) => u.kioskId === selectedKioskDetail.id || u.kioskIds?.includes(selectedKioskDetail.id))
                  .map((u) => {
                    const isInactive = u.active === false;
                    return (
                      <div
                        key={u.id}
                        className={`rounded-xl border bg-background p-3 shadow-2xs transition ${
                          isInactive ? "border-dashed border-border/80 opacity-75" : "border-border/60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs text-foreground truncate">{u.name}</p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold border uppercase ${
                                  u.role === "superadmin"
                                    ? "bg-violet-100 text-violet-700 border-violet-200"
                                    : "bg-blue-100 text-blue-700 border-blue-200"
                                }`}
                              >
                                {u.role === "superadmin" ? "SuperAdmin" : "Admin"}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">@{u.username}</p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition ${
                                !isInactive
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200"
                                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                              }`}
                            >
                              {!isInactive ? "DESACTIVAR CUENTA" : "ACTIVAR CUENTA"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                            <Store className="h-3.5 w-3.5 flex-shrink-0" />
                            <select
                              value={u.kioskId || selectedKioskDetail.id}
                              onChange={(e) => handleReassignKiosk(u.id, e.target.value)}
                              className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[130px] truncate"
                              title="Reasignar Kiosco Principal"
                            >
                              {kiosks.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.name}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleUnassignKioskFromDetail(u.id, selectedKioskDetail.id)}
                              className="text-[10px] font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                              title="Desasignar de este kiosco"
                            >
                              Desasignar
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setResetUser(u);
                              setNewPassVal("");
                              setResetConfirmPassVal("");
                              setResetError("");
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1"
                          >
                            <Lock className="h-3 w-3" />
                            Restablecer clave
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* 4. PRODUCTOS & 5. PEDIDOS — ACCESO DIRECTO */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Acceso a Administración
            </h4>

            <button
              type="button"
              onClick={() => {
                store.selectKiosk(selectedKioskDetail.id);
                onGoToBusiness();
              }}
              className="w-full flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/5 p-3.5 text-left text-xs transition hover:bg-primary/10 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                  <LayoutGrid className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">Productos de {selectedKioskDetail.name}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {kioskProductsDetail.length} productos registrados · Abrir panel de productos
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-primary" />
            </button>

            <button
              type="button"
              onClick={() => {
                store.selectKiosk(selectedKioskDetail.id);
                onGoToBusiness();
              }}
              className="w-full flex items-center justify-between rounded-2xl border border-border bg-card p-3.5 text-left text-xs transition hover:bg-accent shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground font-bold">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-sm">Pedidos de {selectedKioskDetail.name}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {kioskOrdersDetail.length} pedidos totales · Abrir gestión de pedidos
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Botón de volver */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setSelectedKioskDetail(null)}
              className="w-full rounded-2xl border border-border bg-card py-3 text-xs font-bold text-muted-foreground hover:text-foreground transition hover:bg-accent flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a Gestión Multinegocio
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 🛡️ SECCIÓN ADMINISTRACIÓN CENTRAL */}
          <div className="p-4 border-b border-border/60 bg-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🛡️</span>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                  ADMINISTRACIÓN
                </h3>
              </div>
              <span className="rounded-full bg-violet-100 text-violet-700 px-2.5 py-0.5 text-[10px] font-bold border border-violet-200">
                Global
              </span>
            </div>

            {/* Tabs de Navegación de Administración */}
            <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("kiosks")}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition whitespace-nowrap ${
                  activeTab === "kiosks"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🏪 Kioscos ({kiosks.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition whitespace-nowrap ${
                  activeTab === "users"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                👥 Usuarios ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("stats")}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition whitespace-nowrap ${
                  activeTab === "stats"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                📊 Estado General
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tests")}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition whitespace-nowrap ${
                  activeTab === "tests"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🧪 Pruebas
              </button>
            </div>
          </div>

          {/* 🏪 TAB 1: GESTIÓN DE KIOSCOS / NEGOCIOS */}
          {activeTab === "kiosks" && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Negocios registrados</h3>
                  <p className="text-[11px] text-muted-foreground">Toca cualquier kiosco para seleccionarlo como activo para las vistas.</p>
                </div>
                <button
                  onClick={() => {
                    setFormError("");
                    setNewName("");
                    setNewSlug("");
                    setShowAddModal(true);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear kiosco
                </button>
              </div>

              {kiosks.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-card/50 p-8 text-center my-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                    <Store className="h-7 w-7" />
                  </div>
                  <h4 className="text-base font-bold text-foreground">No hay negocios registrados</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5">
                    Actualmente no existen kioscos en la base de datos de la plataforma.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormError("");
                      setNewName("");
                      setNewSlug("");
                      setShowAddModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ Agregar kiosco</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {kiosks.map((b) => {
                  const isSelected = selectedKioskId === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        store.selectKiosk(b.id);
                      }}
                      className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-xs transition cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border/60 bg-card hover:border-primary/40"
                      }`}
                    >
                      {/* Header: Logo/Icon + Name/Slug + Badge & Status Toggle */}
                      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                            <Store className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-sm text-foreground truncate">{b.name}</p>
                              {isSelected && (
                                <span className="rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-bold">
                                  ✓ Seleccionado para Vistas
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                                  b.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {b.active ? "ACTIVO" : "INACTIVO"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">slug: {b.slug || b.id}</p>
                          </div>
                        </div>

                        {/* Botón Activo/Inactivo siempre visible arriba a la derecha */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleStatus(b.id, b.active, e)}
                          title={b.active ? "Desactivar kiosco" : "Activar kiosco"}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold border transition ${
                            b.active
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {b.active ? "● Activo" : "○ Inactivo"}
                        </button>
                      </div>

                      {/* Botón Principal: Administrar kiosco */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          store.selectKiosk(b.id);
                          onGoToBusiness();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs"
                        title="Entrar al panel de administración de este kiosco"
                      >
                        <LogIn className="h-4 w-4" />
                        <span>Administrar {b.name}</span>
                      </button>

                      {/* Fila Secundaria de Herramientas: Ficha, Editar, Entrega, Tienda Pública */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenKioskDetail(b);
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition"
                            title="Ver ficha técnica, estadísticas y administradores del kiosco"
                          >
                            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                            <span>Ficha</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingKiosk(b);
                              setEditKioskName(b.name);
                              setEditKioskSlug(b.slug);
                              setEditKioskError("");
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition"
                            title="Editar nombre comercial y slug"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteKioskError("");
                              setKioskToDelete(b);
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition"
                            title="Eliminar este negocio permanentemente"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHandoverModalData({
                                kiosk: b,
                                ownerName: b.ownerName,
                                ownerEmail: b.ownerEmail,
                                ownerPhone: b.ownerPhone,
                              });
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                            title="Ver Ficha de Entrega para el cliente"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            <span>Entrega</span>
                          </button>
                        </div>

                        <a
                          href={`${typeof window !== "undefined" ? window.location.origin : ""}/?kiosk=${b.slug || b.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition"
                          title="Abrir tienda pública en nueva pestaña"
                        >
                          <span>Ver Tienda</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          {/* 📊 TAB 2: ESTADO GENERAL DE LA PLATAFORMA */}
          {activeTab === "stats" && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Negocios activos", value: activeKiosksCount, icon: Store, color: "bg-violet-50 text-violet-600 border-violet-200" },
                  { label: "Pedidos totales", value: stats.totalOrders, icon: Receipt, color: "bg-sky-50 text-sky-600 border-sky-200" },
                  { label: "Pedidos activos", value: stats.pendingOrders, icon: Package, color: "bg-amber-50 text-amber-600 border-amber-200" },
                  { label: "Productos", value: stats.totalProducts, icon: LayoutGrid, color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs">
                    <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl border ${stat.color}`}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Estado del Sistema PostgreSQL
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Base de Datos:</span>
                    <span className="font-semibold text-emerald-600">Conectada (PostgreSQL)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Kioscos Registrados:</span>
                    <span className="font-semibold">{kiosks.length}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Administradores Activos:</span>
                    <span className="font-semibold">{users.filter((u) => u.active !== false).length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 👥 TAB 3: GESTIÓN DE USUARIOS E INVITACIONES */}
          {activeTab === "users" && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Administradores e Invitaciones</h3>
                </div>
                <button
                  onClick={() => {
                    setInviteError("");
                    setInviteName("");
                    setInviteEmail("");
                    setInviteKioskId(kiosks[0]?.id || "");
                    setInviteSuccessData(null);
                    setShowInviteModal(true);
                  }}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Invitar administrador
                </button>
              </div>

              {/* SECCIÓN INVITACIONES PENDIENTES */}
              {invitations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-amber-500" />
                      Invitaciones Pendientes ({invitations.filter((i) => i.status === "pending").length})
                    </h4>
                  </div>

                  <div className="flex flex-col gap-2">
                    {invitations.map((inv) => {
                      const isPending = inv.status === "pending";
                      return (
                        <div
                          key={inv.id}
                          className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3 shadow-2xs space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-xs text-foreground truncate">{inv.name}</p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${
                                    isPending
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : inv.status === "accepted"
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : "bg-slate-100 text-slate-700 border-slate-300"
                                  }`}
                                >
                                  {isPending ? "Pendiente" : inv.status === "accepted" ? "Aceptada" : "Expirada"}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{inv.email}</p>
                            </div>

                            {isPending && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleResendInvitation(inv.id)}
                                  className="rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900 hover:bg-amber-200 transition flex items-center gap-1"
                                  title="Generar y copiar enlace de activación"
                                >
                                  <Copy className="h-3 w-3" />
                                  <span>Copiar enlace</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelInvitation(inv.id)}
                                  className="rounded-lg border border-border/80 bg-background px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 transition"
                                  title="Cancelar invitación"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-amber-200/50 pt-1.5">
                            <span className="flex items-center gap-1">
                              <Store className="h-3 w-3 text-amber-600" />
                              Asignado: <strong className="text-foreground">{inv.kioskName || inv.kioskId}</strong>
                            </span>
                            <span>Expira: {new Date(inv.expiresAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECCIÓN ADMINISTRADORES ACTIVOS */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Cuentas Activas ({users.length})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {users.map((u) => {
                    const isInactive = u.active === false;

                    return (
                      <div
                        key={u.id}
                        className={`rounded-2xl border bg-card p-3.5 shadow-xs transition ${
                          isInactive ? "border-dashed border-border/80 opacity-75" : "border-border/60"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl font-bold text-xs ${
                                u.role === "superadmin"
                                  ? "bg-violet-100 text-violet-700 border border-violet-200"
                                  : "bg-blue-100 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {u.role === "superadmin" ? "SA" : "ADM"}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm truncate">{u.name}</p>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                    u.role === "superadmin"
                                      ? "bg-violet-50 text-violet-700 border-violet-200"
                                      : "bg-blue-50 text-blue-700 border-blue-200"
                                  }`}
                                >
                                  {u.role === "superadmin" ? "SuperAdmin" : "Admin"}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${
                                    !isInactive
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : "bg-slate-100 text-slate-700 border-slate-300"
                                  }`}
                                >
                                  {!isInactive ? "Activo" : "Inactivo"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 font-mono">@{u.username}</p>
                            </div>
                          </div>

                          {/* Botones de acción principales: Editar | Desactivar/Reactivar | Eliminar */}
                          <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditAdminUser(u)}
                              className="flex items-center gap-1 rounded-lg border border-border/80 bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition"
                              title="Editar nombre y email del administrador"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-primary" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              title={isInactive ? "Reactivar cuenta de usuario" : "Desactivar cuenta y revocar sesiones"}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                                !isInactive
                                  ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              }`}
                            >
                              <Power className="h-3.5 w-3.5" />
                              <span>{!isInactive ? "Desactivar" : "Reactivar"}</span>
                            </button>

                            {u.role !== "superadmin" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteAdminUserError("");
                                  setAdminUserToDelete(u);
                                }}
                                className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 transition"
                                title="Eliminar administrador permanentemente"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Eliminar</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 text-xs flex-wrap">
                          <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                            <Store className="h-3.5 w-3.5 flex-shrink-0" />
                            {u.role === "superadmin" ? (
                              <span className="italic font-medium text-violet-600">Global (Todos los kioscos)</span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground">Kiosco:</span>
                                <select
                                  value={u.kioskId || kiosks[0]?.id || ""}
                                  onChange={(e) => handleReassignKiosk(u.id, e.target.value)}
                                  className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[170px] truncate"
                                >
                                  {kiosks.map((k) => (
                                    <option key={k.id} value={k.id}>
                                      {k.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setResetUser(u);
                              setNewPassVal("");
                              setResetError("");
                            }}
                            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                          >
                            <Lock className="h-3 w-3" />
                            Restablecer clave
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 🧪 TAB 4: PRUEBAS DE NOTIFICACIONES Y SONIDOS (EXCLUSIVO SUPERADMIN) */}
          {activeTab === "tests" && (
            <SuperAdminTestsSection kiosks={kiosks} selectedKioskId={selectedKioskId} />
          )}
        </>
      )}

      {/* Modal Editar Kiosco */}
      {editingKiosk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">Editar Negocio</h3>
              <button
                type="button"
                onClick={() => setEditingKiosk(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateKioskSubmit} className="flex flex-col gap-3.5">
              {editKioskError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                  {editKioskError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Nombre del negocio *
                </label>
                <input
                  type="text"
                  value={editKioskName}
                  onChange={(e) => setEditKioskName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Slug / Identificador *
                </label>
                <input
                  type="text"
                  value={editKioskSlug}
                  onChange={(e) => setEditKioskSlug(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setEditingKiosk(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editKioskLoading}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {editKioskLoading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha de Entrega (Handover Sheet) */}
      {handoverModalData && (
        <HandoverSheetModal
          kiosk={handoverModalData.kiosk}
          ownerName={handoverModalData.ownerName}
          ownerEmail={handoverModalData.ownerEmail}
          ownerPhone={handoverModalData.ownerPhone}
          adminUsername={handoverModalData.adminUsername}
          initialPassword={handoverModalData.initialPassword}
          onClose={() => setHandoverModalData(null)}
        />
      )}

      {/* Modal Confirmar Eliminación de Kiosco */}
      {kioskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3 text-destructive">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="text-base font-bold text-foreground">Eliminar Negocio</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!deletingKiosk) setKioskToDelete(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                ¿Estás completamente seguro de que deseas eliminar permanentemente el negocio{" "}
                <strong className="text-foreground font-bold">{kioskToDelete.name}</strong>?
              </p>

              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-destructive text-[11px] leading-snug">
                <strong className="block font-bold mb-1">⚠️ Acción irreversible</strong>
                Se eliminarán de la base de datos todos los productos, pedidos, configuraciones y accesos asignados a este kiosco.
              </div>

              {deleteKioskError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
                  {deleteKioskError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  disabled={deletingKiosk}
                  onClick={() => setKioskToDelete(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deletingKiosk}
                  onClick={handleDeleteKioskConfirm}
                  className="rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deletingKiosk ? "Eliminando..." : "Eliminar Definitivamente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear Negocio */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">Agregar nuevo negocio</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateKiosk} className="flex flex-col gap-3">
              {formError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                  {formError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Nombre comercial del negocio *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Kiosco Belgrano"
                  value={newName}
                  onChange={(e) => {
                    const nameVal = e.target.value;
                    setNewName(nameVal);
                    setNewSlug(nameVal.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  }}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Slug / Identificador URL *
                </label>
                <input
                  type="text"
                  placeholder="Ej: kiosco-belgrano"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div className="pt-1 border-t border-border/40 space-y-2.5">
                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                  Datos del Responsable / Cliente:
                </p>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Nombre del Responsable *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Carlos Gómez"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Email del Responsable *
                  </label>
                  <input
                    type="email"
                    placeholder="carlos@ejemplo.com"
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Teléfono / WhatsApp (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: +5491112345678"
                    value={newOwnerPhone}
                    onChange={(e) => setNewOwnerPhone(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newActiveCheck"
                  checked={newActive}
                  onChange={(e) => setNewActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="newActiveCheck" className="text-xs font-semibold cursor-pointer select-none">
                  Activar negocio inmediatamente
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {creating ? "Guardando..." : "Crear Negocio y Ver Ficha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Invitar Administrador */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Invitar Administrador
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteError("");
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 rounded-xl bg-blue-50/80 border border-blue-200/60 p-2.5 text-xs text-blue-900 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-snug">
                <strong>Invitación segura:</strong> Se enviará un enlace de un solo uso para que el nuevo administrador cree su propia contraseña personal y confidencial.
              </div>
            </div>

            {selectedKioskDetail && (
              <div className="mb-3 rounded-xl bg-violet-50 border border-violet-200 p-2 text-xs text-violet-800 flex items-center gap-1.5">
                <Store className="h-4 w-4 text-violet-600 flex-shrink-0" />
                <span>
                  Asignando a <strong>{selectedKioskDetail.name}</strong>
                </span>
              </div>
            )}

            <form onSubmit={handleSendInvitation} className="flex flex-col gap-3">
              {inviteError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
                  {inviteError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Nombre del responsable *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Laura Gómez"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Correo electrónico del destinatario *
                </label>
                <input
                  type="email"
                  placeholder="Ej: laura@negocio.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              {!selectedKioskDetail && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Kiosco Asignado *
                  </label>
                  <select
                    value={inviteKioskId}
                    onChange={(e) => setInviteKioskId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {kiosks.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {inviting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Enviar invitación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Resultado de Invitación Registrada (Modo Manual / Directo) */}
      {inviteSuccessData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 shadow-xl animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="text-base font-bold">¡Invitación Registrada!</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInviteSuccessData(null);
                  setShowInviteModal(false);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1">
                <p className="font-semibold">Modo manual activo (envío propio):</p>
                <p className="text-[11px] leading-relaxed">
                  Copia el enlace único a continuación y envíaselo por correo (Gmail u otro) al administrador para que cree su contraseña.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 border border-border/60 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destinatario:</span>
                <span className="font-semibold">{inviteSuccessData.invitation.name}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px]">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-semibold">{inviteSuccessData.invitation.email}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Kiosco asignado:</span>
                <span className="font-semibold">{inviteSuccessData.invitation.kioskName || inviteSuccessData.invitation.kioskId}</span>
              </div>
            </div>

            {(inviteSuccessData.inviteUrl || inviteSuccessData.emailResult?.inviteUrl) && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Enlace único de activación
                </label>
                <div className="relative">
                  <textarea
                    readOnly
                    rows={2}
                    value={inviteSuccessData.inviteUrl || inviteSuccessData.emailResult?.inviteUrl || ""}
                    className="w-full rounded-xl border border-border bg-muted/50 p-2.5 text-[11px] font-mono select-all focus:outline-none focus:ring-1 focus:ring-primary break-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const url = inviteSuccessData.inviteUrl || inviteSuccessData.emailResult?.inviteUrl;
                    if (url) {
                      if (navigator?.clipboard?.writeText) {
                        navigator.clipboard.writeText(url).then(
                          () => {
                            setCopiedInviteUrl(true);
                            setTimeout(() => setCopiedInviteUrl(false), 3000);
                            store.addToast({
                              title: "¡Enlace copiado!",
                              message: "Pegalo en tu Gmail para enviarlo al nuevo administrador.",
                              type: "success",
                            });
                          },
                          () => {
                            setCopiedInviteUrl(true);
                            store.addToast({
                              title: "Enlace listo",
                              message: "Seleccioná y copiá el texto del enlace.",
                              type: "info",
                            });
                          }
                        );
                      } else {
                        setCopiedInviteUrl(true);
                        store.addToast({
                          title: "Enlace listo",
                          message: "Seleccioná y copiá el texto del enlace.",
                          type: "info",
                        });
                      }
                    }
                  }}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold transition shadow-xs ${
                    copiedInviteUrl
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {copiedInviteUrl ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>¡Enlace copiado al portapapeles!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copiar enlace de invitación</span>
                    </>
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setInviteSuccessData(null);
                setShowInviteModal(false);
              }}
              className="w-full rounded-xl border border-border/80 bg-background py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Restablecer Contraseña */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">Restablecer Contraseña</h3>
              <button
                type="button"
                onClick={() => setResetUser(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 rounded-xl bg-blue-50/80 border border-blue-200/60 p-2.5 text-xs text-blue-900">
              <p className="font-bold text-[11px] mb-1">💡 ¿El administrador olvidó su contraseña?</p>
              <p className="text-[11px] text-blue-800 leading-snug">
                Establezca una nueva contraseña para <strong>{resetUser.name}</strong> (@{resetUser.username}). Las sesiones activas anteriores serán revocadas automáticamente.
              </p>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-3">
              {resetError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
                  {resetError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Nueva contraseña *
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassVal}
                  onChange={(e) => setNewPassVal(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Confirmar nueva contraseña *
                </label>
                <input
                  type="password"
                  placeholder="Repita la nueva contraseña"
                  value={resetConfirmPassVal}
                  onChange={(e) => setResetConfirmPassVal(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {resetLoading ? "Guardando..." : "Cambiar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Asignar Administrador Existente */}
      {showAssignExistingAdminModal && selectedKioskDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold">Asignar Administrador Existente</h3>
              <button
                type="button"
                onClick={() => setShowAssignExistingAdminModal(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 rounded-xl bg-violet-50 border border-violet-200 p-2 text-xs text-violet-800 flex items-center gap-1.5">
              <Store className="h-4 w-4 text-violet-600 flex-shrink-0" />
              <span>
                Asignando acceso a <strong>{selectedKioskDetail.name}</strong>
              </span>
            </div>

            <form onSubmit={handleAssignExistingAdminSubmit} className="flex flex-col gap-3">
              {assignError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                  {assignError}
                </div>
              )}

              {users.filter((u) => u.role !== "superadmin" && u.kioskId !== selectedKioskDetail.id && !u.kioskIds?.includes(selectedKioskDetail.id)).length === 0 ? (
                <div className="py-4 text-center space-y-3">
                  <p className="text-xs text-muted-foreground italic">
                    No hay administradores disponibles que no estén ya asignados a este kiosco.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignExistingAdminModal(false);
                      setInviteKioskId(selectedKioskDetail.id);
                      setInviteName("");
                      setInviteEmail("");
                      setInviteError("");
                      setShowInviteModal(true);
                    }}
                    className="w-full rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                  >
                    + Invitar nuevo administrador
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      Seleccionar Administrador *
                    </label>
                    <select
                      value={selectedAdminToAssign}
                      onChange={(e) => setSelectedAdminToAssign(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    >
                      <option value="">-- Seleccionar usuario --</option>
                      {users
                        .filter((u) => u.role !== "superadmin" && u.kioskId !== selectedKioskDetail.id && !u.kioskIds?.includes(selectedKioskDetail.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} (@{u.username})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowAssignExistingAdminModal(false)}
                      className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={assigningAdmin || !selectedAdminToAssign}
                      className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {assigningAdmin ? "Asignando..." : "Asignar a este Kiosco"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Administrador */}
      {editingAdminUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                Editar Administrador
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!editingAdminLoading) setEditingAdminUser(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditAdminUserSubmit} className="flex flex-col gap-3.5">
              {editingAdminError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
                  {editingAdminError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Nombre del administrador *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Laura Gómez"
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Email / Usuario *
                </label>
                <input
                  type="email"
                  placeholder="Ej: laura@negocio.com"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Este email se utiliza para iniciar sesión. La contraseña y permisos existentes se mantendrán intactos.
                </p>
              </div>

              {editingAdminUser.role !== "superadmin" && kiosks.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                    Kiosco Asignado
                  </label>
                  <select
                    value={editAdminKioskId}
                    onChange={(e) => setEditAdminKioskId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {kiosks.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  disabled={editingAdminLoading}
                  onClick={() => setEditingAdminUser(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editingAdminLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {editingAdminLoading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación de Administrador */}
      {adminUserToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3 text-destructive">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="text-base font-bold text-foreground">Eliminar Administrador</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!deletingAdminUser) setAdminUserToDelete(null);
                }}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                ¿Estás seguro de que deseas eliminar al administrador{" "}
                <strong className="text-foreground font-bold">{adminUserToDelete.name}</strong> (@{adminUserToDelete.username})?
              </p>

              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-destructive text-[11px] leading-snug">
                <strong className="block font-bold mb-1">⚠️ Acción irreversible</strong>
                El usuario perderá el acceso a la plataforma y todas sus sesiones activas serán cerradas.
              </div>

              {deleteAdminUserError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-medium">
                  {deleteAdminUserError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <button
                  type="button"
                  disabled={deletingAdminUser}
                  onClick={() => setAdminUserToDelete(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deletingAdminUser}
                  onClick={handleDeleteAdminUserConfirm}
                  className="rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deletingAdminUser ? "Eliminando..." : "Eliminar Definitivamente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuración de plataforma adicional */}
      <div className="m-4 border-t border-border/60 pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Herramientas administrativas globales · PostgreSQL conectado
        </p>
      </div>
    </div>
  );
}

// ─── Componentes compartidos ──────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-relaxed text-muted-foreground">{hint}</span>}
    </label>
  );
}

function SectionCard({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm scroll-mt-20">
      <h3 className="mb-3.5 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-card px-3 py-3.5">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-foreground transition hover:bg-accent"
        aria-label="Volver"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h2 className="text-base font-bold">{title}</h2>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon ?? <Package className="h-8 w-8" />}
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
