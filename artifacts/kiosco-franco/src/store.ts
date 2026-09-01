import { useSyncExternalStore } from "react";

export type ProductBadge = "oferta" | "destacado" | "promocion" | "ultimas_unidades" | null;

export type Product = {
  id: string;
  kioskId?: string;
  name: string;
  price: number;
  category: string;
  emoji: string;
  image?: string | null;
  available?: boolean;
  description?: string | null;
  originalPrice?: number | null;
  badge?: ProductBadge;
  promoTitle?: string | null;
  promoEndDate?: string | null;
};

export type CartItem = {
  productId: string;
  qty: number;
};

export type OrderStatus = "nuevo" | "preparacion" | "listo" | "entregado";

export type PaymentMethod = "efectivo" | "mercadopago";

export type Order = {
  id: string;
  orderNumber?: number;
  kioskId?: string;
  createdAt: string;
  customerName: string;
  address: string;
  delivery: "retiro" | "envio";
  payment: PaymentMethod;
  items: { productId: string; name: string; price: number; qty: number }[];
  total: number;
  status: OrderStatus;
};

export type ThemeStyle = "modern" | "classic" | "vibrant";
export type ThemeColor = "sky" | "emerald" | "violet" | "amber" | "rose" | "slate";

export type ToastType = "info" | "success" | "warning" | "order";

export type ToastNotification = {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  timestamp: number;
  kioskId?: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  timestamp: number;
  read: boolean;
  orderId?: string;
  kioskId?: string;
  forAdmin?: boolean;
};

export type Settings = {
  whatsappNumber: string;
  shopName: string;
  mercadoPagoAlias: string;
  mercadoPagoQr?: string | null;
  welcomeMessage?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  kioskId?: string;
  name?: string;
  slug?: string;
  active?: boolean;
  exists?: boolean;
  themeStyle?: ThemeStyle | null;
  themeColor?: ThemeColor | null;
  bannerUrl?: string | null;
  welcomeMsgType?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  address?: string | null;
  businessHours?: string | null;
  deliveryInfo?: string | null;
  paymentMethods?: string | null;
};

export type Kiosk = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerPhone?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminInvitation = {
  id: string;
  email: string;
  name: string;
  kioskId: string;
  kioskName?: string;
  kioskSlug?: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
};

export type KioskNotice = {
  type: "error" | "inactive";
  message: string;
} | null;

export type State = {
  products: Product[];
  cart: CartItem[];
  orders: Order[];
  settings: Settings;
  loaded: boolean;
  view: "client" | "admin" | "superadmin";
  publicKiosks: Kiosk[];
  selectedKioskId: string;
  urlKioskNotice: KioskNotice;
  currentKiosk: Kiosk;
  toasts: ToastNotification[];
  notifications: NotificationItem[];
};


const CART_STORAGE_KEY = "kiosco-franco-cart-v1";
const LAST_ORDER_STORAGE_KEY = "kiosco-franco-last-order-v1";
const SELECTED_KIOSK_KEY = "kiosco-franco-selected-kiosk-v1";
const NOTIFICATIONS_STORAGE_KEY = "kiosco-franco-notifications-v1";

function loadInitialNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 50);
    }
  } catch {}
  return [];
}

function loadSelectedKioskId(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(SELECTED_KIOSK_KEY) || "";
  } catch {
    return "";
  }
}

const defaultSettings: Settings = {
  shopName: "",
  whatsappNumber: "",
  mercadoPagoAlias: "",
  mercadoPagoQr: null,
};

function getCartStorageKey(kioskId?: string): string {
  const k = kioskId || (typeof state !== "undefined" && state.selectedKioskId ? state.selectedKioskId : "default");
  return `kiosco-cart-v1_${k}`;
}

function loadCart(kioskId?: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getCartStorageKey(kioskId);
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function persistCart() {
  if (typeof window === "undefined") return;
  try {
    const key = getCartStorageKey(state.selectedKioskId);
    localStorage.setItem(key, JSON.stringify(state.cart));
  } catch {}
}

function getCurrentKioskObj(s: {
  publicKiosks: Kiosk[];
  selectedKioskId: string;
  settings: Settings;
}): Kiosk {
  const k = s.publicKiosks.find((item) => item.id === s.selectedKioskId || item.slug === s.selectedKioskId);
  const activeFromSettings = s.settings?.active;
  if (k) {
    return {
      ...k,
      name: s.settings?.shopName || k.name,
      active: typeof activeFromSettings === "boolean" ? activeFromSettings : (k.active !== false),
    };
  }
  const shopName = s.settings?.shopName || "";
  const slug = s.settings?.slug || s.selectedKioskId || "";
  return {
    id: s.selectedKioskId || "",
    name: shopName,
    slug,
    active: typeof s.settings?.active === "boolean" ? s.settings.active : true,
    createdAt: "",
    updatedAt: "",
  };
}

const initialSelectedKioskId = loadSelectedKioskId();

let state: State = {
  products: [],
  cart: loadCart(initialSelectedKioskId),
  orders: [],
  settings: defaultSettings,
  loaded: false,
  view: "client",
  publicKiosks: [],
  selectedKioskId: initialSelectedKioskId,
  urlKioskNotice: null,
  currentKiosk: {
    id: initialSelectedKioskId,
    name: "",
    slug: initialSelectedKioskId,
    active: true,
    createdAt: "",
    updatedAt: "",
  },
  toasts: [],
  notifications: loadInitialNotifications(),
};

const listeners = new Set<() => void>();

function setState(updater: (s: State) => State) {
  const next = updater(state);
  next.currentKiosk = getCurrentKioskObj(next);
  state = next;
  listeners.forEach((l) => l());
}

const ADMIN_TOKEN_KEY = "kiosco-franco-admin-token-v1";
const ADMIN_USER_KEY = "kiosco-franco-admin-user-v1";

export type AssignedKiosk = {
  id: string;
  name: string;
  slug: string | null;
  active: boolean;
};

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: "superadmin" | "admin";
  kioskId?: string | null;
  assignedKiosks?: AssignedKiosk[];
  kioskIds?: string[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

let adminToken: string | null = ((): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
})();

let adminUser: AdminUser | null = ((): AdminUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const API = "/api";

async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
  isRetry = false,
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "Accept": "application/json",
    ...(rest.headers as Record<string, string> ?? {}),
  };
  if (adminToken) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    if (res.status === 401 && adminToken) {
      // Token expired or invalid
      adminToken = null;
      try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch {}
    }
    let errMsg = `API ${path}: Error ${res.status}`;
    if (contentType.includes("application/json")) {
      try {
        const errBody = await res.json();
        if (errBody && errBody.error) errMsg = errBody.error;
      } catch {}
    }
    throw new Error(errMsg);
  }

  if (res.status === 204) return undefined as T;

  if (!contentType.includes("application/json")) {
    if (!isRetry) {
      await new Promise((r) => setTimeout(r, 600));
      return api<T>(path, init, true);
    }
    console.warn(`API response from ${path} was not JSON (${contentType})`);
    throw new Error(`Respuesta del servidor no válida para ${path}`);
  }

  try {
    return (await res.json()) as T;
  } catch (err) {
    if (!isRetry) {
      await new Promise((r) => setTimeout(r, 600));
      return api<T>(path, init, true);
    }
    console.warn(`Failed to parse JSON response from ${path}:`, err);
    throw new Error(`Error al procesar la respuesta del servidor para ${path}`);
  }
}

async function refreshPublicKiosks() {
  try {
    const res = await api<{ ok: boolean; kiosks: Kiosk[] }>("/kiosks");
    if (res && res.kiosks) {
      const seen = new Set<string>();
      const deduped = res.kiosks.filter((k) => {
        if (!k.id || seen.has(k.id)) return false;
        seen.add(k.id);
        return true;
      });
      setState((s) => ({ ...s, publicKiosks: deduped }));
    }
  } catch (err) {
    console.error("Failed to fetch public kiosks", err);
  }
}

async function refreshProducts() {
  try {
    const query = state.selectedKioskId ? `?kioskId=${encodeURIComponent(state.selectedKioskId)}` : "";
    const products = await api<Product[]>(`/products${query}`);
    if (Array.isArray(products)) {
      setState((s) => ({ ...s, products }));
    }
  } catch (err) {
    console.warn("Failed to refresh products", err);
  }
}

// ─── Sistema de Notificaciones y Audio ─────────────────────────────────────────

export function playNotificationSound(type: "new_order" | "status_change") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "new_order") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {}
}

export function addToast(toast: Omit<ToastNotification, "id" | "timestamp">) {
  const newToast: ToastNotification = {
    ...toast,
    id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
  };
  setState((s) => ({
    ...s,
    toasts: [newToast, ...s.toasts].slice(0, 5),
  }));

  setTimeout(() => {
    removeToast(newToast.id);
  }, 6000);
}

export function removeToast(id: string) {
  setState((s) => ({
    ...s,
    toasts: s.toasts.filter((t) => t.id !== id),
  }));
}

export function addNotification(
  notif: Omit<NotificationItem, "id" | "timestamp" | "read">
) {
  const item: NotificationItem = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    read: false,
  };

  setState((s) => {
    const updated = [item, ...(s.notifications || [])].slice(0, 50);
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return {
      ...s,
      notifications: updated,
    };
  });

  addToast({
    title: item.title,
    message: item.message,
    type: item.type,
    kioskId: item.kioskId,
  });
}

export function markNotificationAsRead(id: string) {
  setState((s) => {
    const updated = (s.notifications || []).map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return { ...s, notifications: updated };
  });
}

export function markAllNotificationsAsRead(forAdmin?: boolean, kioskId?: string) {
  setState((s) => {
    const updated = (s.notifications || []).map((n) => {
      const matchAdmin = forAdmin === undefined || n.forAdmin === forAdmin;
      const matchKiosk = !kioskId || n.kioskId === kioskId;
      if (matchAdmin && matchKiosk) {
        return { ...n, read: true };
      }
      return n;
    });
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return { ...s, notifications: updated };
  });
}

export function deleteNotification(id: string) {
  setState((s) => {
    const updated = (s.notifications || []).filter((n) => n.id !== id);
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return { ...s, notifications: updated };
  });
}

const knownOrders = new Map<string, OrderStatus>();
let isInitialOrdersLoad = true;

const STATUS_TEXTS: Record<OrderStatus, string> = {
  nuevo: "Recibido / Pendiente",
  preparacion: "En preparación 👨‍🍳",
  listo: "¡Listo para retirar / entregar! 🎉",
  entregado: "Entregado ✅",
};

async function refreshOrders() {
  try {
    const query = state.selectedKioskId ? `?kioskId=${encodeURIComponent(state.selectedKioskId)}` : "";
    const orders = await api<Order[]>(`/orders${query}`);

    if (isInitialOrdersLoad) {
      orders.forEach((o) => {
        knownOrders.set(o.id, o.status);
      });
      isInitialOrdersLoad = false;
      setState((s) => ({ ...s, orders }));
      return;
    }

    const currentLastOrderId = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
    const activeKioskId = state.selectedKioskId;
    const isAdminView = state.view === "admin" || state.view === "superadmin" || !!adminToken;

    for (const o of orders) {
      const prevStatus = knownOrders.get(o.id);
      const orderKioskId = o.kioskId || activeKioskId;

      if (prevStatus === undefined) {
        // Pedido totalmente nuevo
        const createdAtMs = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();
        const isRecent = Date.now() - createdAtMs < 180000; // Creado hace menos de 3 min

        if (isAdminView && orderKioskId === activeKioskId && isRecent) {
          const orderNumDisplay = o.orderNumber != null ? `#${o.orderNumber}` : `#${o.id.slice(-4)}`;
          addNotification({
            title: "🔔 ¡Nuevo pedido recibido!",
            message: `Pedido ${orderNumDisplay} de ${o.customerName} (${o.delivery === "envio" ? "Envío" : "Retiro"}) - $${o.total.toLocaleString("es-AR")}`,
            type: "order",
            kioskId: orderKioskId,
            orderId: o.id,
            forAdmin: true,
          });
          playNotificationSound("new_order");
        }
      } else if (prevStatus !== o.status) {
        // Cambio de estado
        if (currentLastOrderId && o.id === currentLastOrderId) {
          const statusText = STATUS_TEXTS[o.status] || o.status;
          const orderNumDisplay = o.orderNumber != null ? `#${o.orderNumber}` : `#${o.id.slice(-4)}`;
          addNotification({
            title: "📦 Estado de tu pedido",
            message: `Tu pedido ${orderNumDisplay} cambió a: ${statusText}`,
            type: "info",
            kioskId: orderKioskId,
            orderId: o.id,
            forAdmin: false,
          });
          playNotificationSound("status_change");
        }
      }

      knownOrders.set(o.id, o.status);
    }

    setState((s) => ({ ...s, orders }));
  } catch (err: any) {
    // Si la conexión falló momentáneamente durante el polling de fondo o devolvió 304, no emitir warning alarmante
    if (err?.message?.includes("304") || err?.message?.includes("Failed to fetch") || err?.name === "TypeError") {
      return;
    }
    console.warn("Failed to refresh orders", err);
  }
}

export function updatePwaHead(settings: Settings) {
  if (typeof document === "undefined") return;

  const slug = settings.slug || settings.kioskId || "";
  const name = settings.shopName || "Tienda Online";

  document.title = name ? `${name} - Tienda Online` : "Tienda Online";

  let manifestLink = document.getElementById("app-manifest") as HTMLLinkElement;
  if (!manifestLink) {
    manifestLink = document.createElement("link");
    manifestLink.id = "app-manifest";
    manifestLink.rel = "manifest";
    document.head.appendChild(manifestLink);
  }
  manifestLink.href = `/api/manifest.json?kiosk=${encodeURIComponent(slug)}`;

  let appleIcon = document.getElementById("apple-touch-icon") as HTMLLinkElement;
  if (!appleIcon) {
    appleIcon = document.createElement("link");
    appleIcon.id = "apple-touch-icon";
    appleIcon.rel = "apple-touch-icon";
    document.head.appendChild(appleIcon);
  }
  appleIcon.href = `/api/kiosk-icon?kiosk=${encodeURIComponent(slug)}`;

  let faviconLink = document.getElementById("app-favicon") as HTMLLinkElement;
  if (!faviconLink) {
    faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (faviconLink) faviconLink.id = "app-favicon";
  }
  if (faviconLink) {
    faviconLink.href = `/api/kiosk-icon?kiosk=${encodeURIComponent(slug)}`;
  }
}

async function refreshSettings(kioskOrParam?: string) {
  const target = kioskOrParam || state.selectedKioskId;
  if (!target) return null;
  try {
    const settings = await api<Settings>(`/settings?kiosk=${encodeURIComponent(target)}`);
    setState((s) => ({
      ...s,
      settings,
      selectedKioskId: settings.kioskId || s.selectedKioskId,
    }));
    updatePwaHead(settings);
    return settings;
  } catch (err: any) {
    console.warn("Could not fetch settings for kiosk:", target, err?.message || err);
    return null;
  }
}

async function verifyAdmin(): Promise<AdminUser | null> {
  if (!adminToken) return null;
  try {
    const res = await api<{ ok: boolean; user: AdminUser }>("/admin/verify");
    if (res && res.ok && res.user) {
      adminUser = res.user;
      try {
        localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(res.user));
      } catch {}

      if (res.user.role === "admin") {
        const assignedIds = (res.user.assignedKiosks || []).map((k) => k.id);
        if (assignedIds.length > 0) {
          if (!assignedIds.includes(state.selectedKioskId)) {
            selectKiosk(assignedIds[0]);
          }
        } else if (res.user.kioskId && res.user.kioskId !== state.selectedKioskId) {
          selectKiosk(res.user.kioskId);
        }
      }
      return res.user;
    }
  } catch {
    adminToken = null;
    adminUser = null;
    try {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(ADMIN_USER_KEY);
    } catch {}
  }
  return null;
}

function selectKiosk(kioskId: string) {
  if (!kioskId) {
    setState((s) => ({
      ...s,
      selectedKioskId: "",
      urlKioskNotice: null,
      products: [],
      orders: [],
      cart: [],
      currentKiosk: {
        id: "",
        name: "",
        slug: "",
        active: true,
        createdAt: "",
        updatedAt: "",
      },
      settings: defaultSettings,
    }));
    try {
      localStorage.removeItem(SELECTED_KIOSK_KEY);
    } catch {}
    return;
  }

  setState((s) => {
    const isDifferentKiosk = s.selectedKioskId !== kioskId;
    const targetKiosk = s.publicKiosks.find((k) => k.id === kioskId || k.slug === kioskId);
    const realKioskId = targetKiosk?.id || kioskId;
    const fallbackName = targetKiosk?.name || "";
    const fallbackSlug = targetKiosk?.slug || realKioskId;
    return {
      ...s,
      selectedKioskId: realKioskId,
      urlKioskNotice: null,
      products: [],
      orders: [],
      cart: isDifferentKiosk ? loadCart(realKioskId) : s.cart,
      currentKiosk: targetKiosk || {
        id: realKioskId,
        name: fallbackName,
        slug: fallbackSlug,
        active: true,
        createdAt: "",
        updatedAt: "",
      },
      settings: {
        shopName: fallbackName,
        whatsappNumber: "",
        mercadoPagoAlias: "",
        mercadoPagoQr: null,
        welcomeMessage: null,
        description: null,
        logoUrl: null,
        kioskId: realKioskId,
        active: true,
      },
    };
  });
  try {
    localStorage.setItem(SELECTED_KIOSK_KEY, kioskId);
  } catch {}
  void refreshProducts();
  void refreshSettings(kioskId);
  void refreshOrders();
}

export async function bootstrap() {
  try {
    if (adminToken) {
      await verifyAdmin();
    }

    await refreshPublicKiosks();

    let urlParam: string | null = null;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      for (const [key, val] of urlParams.entries()) {
        if (["kiosk", "kioskid", "kiosk_id"].includes(key.toLowerCase())) {
          urlParam = val.trim();
          break;
        }
      }

      if (!urlParam && window.location.hostname) {
        const hostname = window.location.hostname.toLowerCase();
        const isReplitHost =
          hostname === "replit.dev" ||
          hostname.endsWith(".replit.dev") ||
          hostname === "replit.app" ||
          hostname.endsWith(".replit.app");
        if (!isReplitHost) {
          const parts = hostname.split(".");
          if (parts.length >= 2) {
            const sub = parts[0];
            const ignored = ["www", "app", "dev", "api", "localhost", "127", "0"];
            const isIgnored = ignored.some((ign) => sub === ign || sub.startsWith("ais-dev-") || sub.startsWith("ais-pre-"));
            if (!isIgnored && sub) {
              urlParam = sub;
            }
          }
        }
      }
    }

    let activeKioskToSelect = state.selectedKioskId;
    let urlKioskNotice: KioskNotice = null;

    if (urlParam) {
      const fetchedSettings = await refreshSettings(urlParam);
      if (!fetchedSettings || fetchedSettings.exists === false) {
        urlKioskNotice = {
          type: "error",
          message: `El negocio con el identificador "${urlParam}" no fue encontrado.`,
        };
        if (state.publicKiosks.length > 0) {
          const fallbackId = state.publicKiosks[0].id;
          activeKioskToSelect = fallbackId;
          setState((s) => ({ ...s, selectedKioskId: fallbackId }));
          try { localStorage.setItem(SELECTED_KIOSK_KEY, fallbackId); } catch {}
          await refreshSettings(fallbackId);
        } else {
          activeKioskToSelect = "";
          setState((s) => ({
            ...s,
            selectedKioskId: "",
            currentKiosk: { id: "", name: "", slug: "", active: true, createdAt: "", updatedAt: "" },
            settings: defaultSettings,
          }));
          try { localStorage.removeItem(SELECTED_KIOSK_KEY); } catch {}
        }
      } else {
        if (fetchedSettings.active === false) {
          urlKioskNotice = {
            type: "inactive",
            message: `El negocio "${fetchedSettings.shopName || urlParam}" se encuentra pausado / inactivo actualmente. No se aceptan nuevos pedidos.`,
          };
        }
        if (fetchedSettings.kioskId) {
          if (fetchedSettings.kioskId !== activeKioskToSelect) {
            setState((s) => ({ ...s, cart: loadCart(fetchedSettings.kioskId) }));
          }
          activeKioskToSelect = fetchedSettings.kioskId;
          setState((s) => ({ ...s, selectedKioskId: activeKioskToSelect }));
          try {
            localStorage.setItem(SELECTED_KIOSK_KEY, activeKioskToSelect);
          } catch {}
        }
      }
    } else {
      // Validate whether activeKioskToSelect is actually among publicKiosks
      const isValid = state.publicKiosks.some(
        (k) => k.id === activeKioskToSelect || k.slug === activeKioskToSelect
      );

      if (!isValid) {
        if (state.publicKiosks.length > 0) {
          activeKioskToSelect = state.publicKiosks[0].id;
          setState((s) => ({ ...s, selectedKioskId: activeKioskToSelect }));
          try { localStorage.setItem(SELECTED_KIOSK_KEY, activeKioskToSelect); } catch {}
        } else {
          activeKioskToSelect = "";
          setState((s) => ({
            ...s,
            selectedKioskId: "",
            currentKiosk: { id: "", name: "", slug: "", active: true, createdAt: "", updatedAt: "" },
            settings: defaultSettings,
            products: [],
            orders: [],
          }));
          try { localStorage.removeItem(SELECTED_KIOSK_KEY); } catch {}
        }
      }

      if (activeKioskToSelect) {
        const fetchedSettings = await refreshSettings(activeKioskToSelect);
        if (fetchedSettings && fetchedSettings.active === false) {
          urlKioskNotice = {
            type: "inactive",
            message: `El negocio "${fetchedSettings.shopName || "seleccionado"}" se encuentra pausado / inactivo actualmente.`,
          };
        }
      }
    }

    setState((s) => ({
      ...s,
      urlKioskNotice,
      cart: activeKioskToSelect ? loadCart(activeKioskToSelect) : [],
    }));

    if (activeKioskToSelect) {
      await Promise.all([
        refreshProducts(),
        refreshOrders(),
      ]);
    }
  } catch (err) {
    console.error("Bootstrap failed", err);
  } finally {
    setState((s) => ({ ...s, loaded: true }));
  }
}

export const store = {
  api: api,

  getState: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  addToast: (toast: Omit<ToastNotification, "id" | "timestamp">) => addToast(toast),
  removeToast: (id: string) => removeToast(id),
  addNotification: (notif: Omit<NotificationItem, "id" | "timestamp" | "read">) => addNotification(notif),
  markNotificationAsRead: (id: string) => markNotificationAsRead(id),
  markAllNotificationsAsRead: (forAdmin?: boolean, kioskId?: string) => markAllNotificationsAsRead(forAdmin, kioskId),
  deleteNotification: (id: string) => deleteNotification(id),
  setView: (view: "client" | "admin" | "superadmin") => {
    setState((s) => ({ ...s, view }));
  },
  selectKiosk: (kioskId: string) => {
    selectKiosk(kioskId);
  },
  dismissNotice: () => {
    setState((s) => ({ ...s, urlKioskNotice: null }));
  },
  refreshPublicKiosks: () => {
    void refreshPublicKiosks();
  },
  refreshProducts: () => {
    void refreshProducts();
  },
  addToCart: (productId: string) => {
    const prod = state.products.find((p) => p.id === productId);
    if (prod && prod.available === false) {
      return;
    }
    setState((s) => {
      const existing = s.cart.find((i) => i.productId === productId);
      const cart = existing
        ? s.cart.map((i) =>
            i.productId === productId ? { ...i, qty: i.qty + 1 } : i,
          )
        : [...s.cart, { productId, qty: 1 }];
      return { ...s, cart };
    });
    persistCart();
  },

  decrementCart: (productId: string) => {
    setState((s) => {
      const cart = s.cart
        .map((i) =>
          i.productId === productId ? { ...i, qty: i.qty - 1 } : i,
        )
        .filter((i) => i.qty > 0);
      return { ...s, cart };
    });
    persistCart();
  },

  removeFromCart: (productId: string) => {
    setState((s) => ({
      ...s,
      cart: s.cart.filter((i) => i.productId !== productId),
    }));
    persistCart();
  },

  clearCart: () => {
    setState((s) => ({ ...s, cart: [] }));
    persistCart();
  },

  createOrder: async (data: {
    customerName: string;
    address: string;
    delivery: "retiro" | "envio";
    payment: PaymentMethod;
  }): Promise<Order> => {
    const items = state.cart.map((c) => {
      const p = state.products.find((p) => p.id === c.productId)!;
      return { productId: p.id, name: p.name, price: p.price, qty: c.qty };
    });
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    const real = await api<Order>("/orders", {
      method: "POST",
      json: {
        kioskId: state.selectedKioskId,
        customerName: data.customerName,
        address: data.address,
        delivery: data.delivery,
        payment: data.payment,
        items,
      },
    });

    knownOrders.set(real.id, real.status);
    try {
      localStorage.setItem(LAST_ORDER_STORAGE_KEY, real.id);
    } catch {}

    const orderNumDisplay = real.orderNumber != null ? `#${real.orderNumber}` : `#${real.id.slice(-4)}`;
    addNotification({
      title: "🎉 ¡Pedido enviado con éxito!",
      message: `Tu pedido ${orderNumDisplay} por $${real.total.toLocaleString("es-AR")} fue registrado correctamente.`,
      type: "success",
      kioskId: state.selectedKioskId,
      orderId: real.id,
      forAdmin: false,
    });

    setState((s) => ({
      ...s,
      orders: [real, ...s.orders.filter((o) => o.id !== real.id)],
      cart: [],
    }));
    persistCart();

    return real;
  },

  updateOrderStatus: (orderId: string, status: OrderStatus) => {
    knownOrders.set(orderId, status);
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    }));
    api<Order>(`/orders/${orderId}`, {
      method: "PATCH",
      json: { status },
    }).catch(() => {
      void refreshOrders();
    });
  },

  deleteOrder: (orderId: string) => {
    setState((s) => ({
      ...s,
      orders: s.orders.filter((o) => o.id !== orderId),
    }));
    api(`/orders/${orderId}`, { method: "DELETE" }).catch(() => {
      void refreshOrders();
    });
  },

  refreshOrders: () => {
    void refreshOrders();
  },
getLastOrderId: (): string | null => {
  try {
    return localStorage.getItem(LAST_ORDER_STORAGE_KEY);
  } catch {
    return null;
  }
},

getLastOrder: (): Order | null => {
  let id: string | null = null;
  try {
    id = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
  } catch {}
  if (!id) return null;
  return state.orders.find((o) => o.id === id) ?? null;
},
  fetchKioskSettings: async (kioskId: string): Promise<Settings> => {
    return await api<Settings>(`/settings?kioskId=${encodeURIComponent(kioskId)}`);
  },
  refreshSettings: async (kioskOrParam?: string): Promise<Settings | null> => {
    return await refreshSettings(kioskOrParam);
  },

  updateSettings: async (
    settingsPatch: Partial<Settings> & {
      kioskId?: string;
      name?: string;
      slug?: string;
      active?: boolean;
    },
  ) => {
    const targetKioskId = settingsPatch.kioskId || state.selectedKioskId;
    const body = {
      ...settingsPatch,
      kioskId: targetKioskId,
    };
    const updated = await api<Settings>(`/settings`, {
      method: "PUT",
      json: body,
    });
    if (targetKioskId === state.selectedKioskId) {
      setState((s) => ({ ...s, settings: { ...s.settings, ...updated } }));
      updatePwaHead({ ...state.settings, ...updated });
    }
    void refreshPublicKiosks();
    return updated;
  },

  addProduct: (p: Omit<Product, "id"> & { kioskId?: string }) => {
    const targetKioskId = p.kioskId || state.selectedKioskId;
    const payload = {
      ...p,
      kioskId: targetKioskId,
      emoji: p.emoji || "📦",
    };
    api<Product>(`/products?kioskId=${encodeURIComponent(targetKioskId)}`, { method: "POST", json: payload })
      .then((created) => {
        if ((created.kioskId || targetKioskId) === state.selectedKioskId) {
          setState((s) => ({ ...s, products: [...s.products, created] }));
        }
      })
      .catch((err) => console.error("Failed to add product", err));
  },

  updateProduct: (id: string, patch: Partial<Omit<Product, "id">>) => {
    const current = state.products.find((p) => p.id === id);
    if (!current) return;
    const merged = { ...current, ...patch };

    // Optimistic update inmediato para que la UI refleje el cambio sin esperar al servidor
    setState((s) => ({
      ...s,
      products: s.products.map((p) => (p.id === id ? merged : p)),
    }));

    // Solo enviamos al servidor los campos que cambiaron (el "patch"), NO el producto completo.
    // Esto evita reenviar el base64 de la imagen cuando no cambió,
    // previniendo que un request demasiado grande falle y borre la imagen del estado.
    api<Product>(`/products/${id}`, { method: "PATCH", json: patch })
      .then((updated) => {
        // Confirmar con la respuesta real del servidor
        setState((s) => ({
          ...s,
          products: s.products.map((p) => (p.id === id ? { ...p, ...updated } : p)),
        }));
      })
      .catch(() => {
        // Si el PATCH falló, restaurar desde el servidor para mantener consistencia
        void refreshProducts();
      });
  },

  toggleProductAvailability: (id: string) => {
    const current = state.products.find((p) => p.id === id);
    if (!current) return;
    const isAvail = current.available !== false;
    store.updateProduct(id, { available: !isAvail });
  },

  deleteProduct: (id: string) => {
    setState((s) => ({
      ...s,
      products: s.products.filter((p) => p.id !== id),
      cart: s.cart.filter((c) => c.productId !== id),
    }));
    persistCart();
    api(`/products/${id}`, { method: "DELETE" }).catch(() => {
      void refreshProducts();
    });
  },

  hasAdminAuth: (): boolean => {
    return !!adminToken;
  },

  getAdminUser: (): AdminUser | null => {
    return adminUser;
  },

  getAdminRole: (): "superadmin" | "admin" | null => {
    return adminUser?.role || (adminToken ? "admin" : null);
  },

  verifyAdmin: async (): Promise<AdminUser | null> => {
    return await verifyAdmin();
  },

  loginAdmin: async (
    password: string,
    username?: string,
  ): Promise<{ ok: boolean; user?: AdminUser; error?: string }> => {
    try {
      const res = await api<{
        ok: boolean;
        token: string;
        user: AdminUser;
        error?: string;
      }>("/admin/login", {
        method: "POST",
        json: { password, username },
      });
      if (res.ok && res.token && res.user) {
        adminToken = res.token;
        adminUser = res.user;
        try {
          localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
          localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(res.user));
        } catch {}

        if (res.user.role === "admin") {
          const targetKiosk = res.user.assignedKiosks?.[0]?.id || res.user.kioskId || "kiosk-franco";
          selectKiosk(targetKiosk);
        } else {
          setState((s) => ({ ...s, urlKioskNotice: null }));
        }

        return { ok: true, user: res.user };
      }
      return { ok: false, error: res.error || "Credenciales incorrectas" };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al iniciar sesión" };
    }
  },

  logoutAdmin: () => {
    adminToken = null;
    adminUser = null;
    try {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(ADMIN_USER_KEY);
      localStorage.removeItem(SELECTED_KIOSK_KEY);
    } catch {}
    if (typeof window !== "undefined" && window.history) {
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {}
    }
    setState((s) => ({
      ...s,
      view: "admin",
      urlKioskNotice: null,
    }));
  },

  // Super Admin API methods
  fetchAdminUsers: async (): Promise<AdminUser[]> => {
    try {
      const res = await api<{ users: AdminUser[] }>("/admin/users");
      return res.users || [];
    } catch {
      return [];
    }
  },

  createAdminUser: async (data: {
    username: string;
    name: string;
    password: string;
    role?: "admin" | "superadmin";
    kioskId?: string | null;
    kioskIds?: string[];
    assignIfExists?: boolean;
  }): Promise<{ ok: boolean; user?: AdminUser; error?: string; userExists?: boolean; assignedToExisting?: boolean; message?: string }> => {
    try {
      const res = await api<{
        ok: boolean;
        user: AdminUser;
        error?: string;
        userExists?: boolean;
        assignedToExisting?: boolean;
        message?: string;
      }>("/admin/users", {
        method: "POST",
        json: data,
      });
      return {
        ok: true,
        user: res.user,
        assignedToExisting: res.assignedToExisting,
        message: res.message,
      };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message || "Error al crear usuario",
        userExists: e?.userExists,
      };
    }
  },

  updateAdminUser: async (
    id: string,
    data: {
      name?: string;
      email?: string;
      username?: string;
      role?: "admin" | "superadmin";
      kioskId?: string | null;
      kioskIds?: string[];
      active?: boolean;
    },
  ): Promise<{ ok: boolean; user?: AdminUser; error?: string; message?: string }> => {
    try {
      const res = await api<{ ok: boolean; user: AdminUser; message?: string }>(
        `/admin/users/${id}`,
        {
          method: "PATCH",
          json: data,
        },
      );
      return { ok: true, user: res.user, message: res.message };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al actualizar usuario" };
    }
  },

  deleteAdminUser: async (
    id: string
  ): Promise<{ ok: boolean; message?: string; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; message?: string }>(`/admin/users/${id}`, {
        method: "DELETE",
      });
      return { ok: true, message: res.message };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al eliminar usuario" };
    }
  },

  assignKioskToUser: async (
    userId: string,
    kioskId: string
  ): Promise<{ ok: boolean; assignedKiosks?: AssignedKiosk[]; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; assignedKiosks: AssignedKiosk[] }>(
        `/admin/users/${userId}/kiosks`,
        {
          method: "POST",
          json: { kioskId },
        }
      );
      return { ok: true, assignedKiosks: res.assignedKiosks };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al asignar kiosco" };
    }
  },

  unassignKioskFromUser: async (
    userId: string,
    kioskId: string
  ): Promise<{ ok: boolean; assignedKiosks?: AssignedKiosk[]; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; assignedKiosks: AssignedKiosk[] }>(
        `/admin/users/${userId}/kiosks/${kioskId}`,
        {
          method: "DELETE",
        }
      );
      return { ok: true, assignedKiosks: res.assignedKiosks };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al desasignar kiosco" };
    }
  },

  resetAdminPassword: async (
    id: string,
    newPassword: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      await api(`/admin/users/${id}/reset-password`, {
        method: "POST",
        json: { newPassword },
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al restablecer contraseña" };
    }
  },

  revokeAdminSessions: async (
    id: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      await api(`/admin/users/${id}/revoke-sessions`, {
        method: "POST",
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al revocar sesiones" };
    }
  },

  fetchSystemInfo: async (): Promise<any> => {
    return await api("/admin/system-info");
  },

  fetchInvitations: async (): Promise<{ ok: boolean; invitations?: AdminInvitation[]; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; invitations: AdminInvitation[] }>("/admin/invitations");
      return { ok: true, invitations: res?.invitations || [] };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al obtener invitaciones" };
    }
  },

  createInvitation: async (data: {
    name: string;
    email: string;
    kioskId: string;
  }): Promise<{
    ok: boolean;
    invitation?: AdminInvitation;
    message?: string;
    emailResult?: { simulated: boolean; inviteUrl?: string };
    error?: string;
  }> => {
    try {
      const res = await api<{
        ok: boolean;
        invitation: AdminInvitation;
        message: string;
        emailResult?: { simulated: boolean; inviteUrl?: string };
      }>("/admin/invitations", {
        method: "POST",
        json: data,
      });
      return {
        ok: true,
        invitation: res.invitation,
        message: res.message,
        emailResult: res.emailResult,
      };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message || "Error al crear invitación",
      };
    }
  },

  resendInvitation: async (
    id: string
  ): Promise<{
    ok: boolean;
    invitation?: AdminInvitation;
    message?: string;
    emailResult?: { simulated: boolean; inviteUrl?: string };
    error?: string;
  }> => {
    try {
      const res = await api<{
        ok: boolean;
        invitation: AdminInvitation;
        message: string;
        emailResult?: { simulated: boolean; inviteUrl?: string };
      }>(`/admin/invitations/${id}/resend`, {
        method: "POST",
      });
      return {
        ok: true,
        invitation: res.invitation,
        message: res.message,
        emailResult: res.emailResult,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al reenviar invitación" };
    }
  },

  cancelInvitation: async (id: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      await api(`/admin/invitations/${id}`, {
        method: "DELETE",
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al cancelar invitación" };
    }
  },

  validateInvitationToken: async (
    token: string
  ): Promise<{
    ok: boolean;
    invitation?: {
      id: string;
      email: string;
      name: string;
      kioskId: string;
      kioskName: string;
      expiresAt: string;
    };
    error?: string;
    alreadyAccepted?: boolean;
    expired?: boolean;
  }> => {
    try {
      const res = await api<{
        ok: boolean;
        invitation: {
          id: string;
          email: string;
          name: string;
          kioskId: string;
          kioskName: string;
          expiresAt: string;
        };
      }>(`/auth/invitations/${encodeURIComponent(token)}`);
      return { ok: true, invitation: res.invitation };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message || "Error al validar invitación",
        alreadyAccepted: e?.alreadyAccepted,
        expired: e?.expired,
      };
    }
  },

  acceptInvitation: async (data: {
    token: string;
    password: string;
    confirmPassword?: string;
  }): Promise<{
    ok: boolean;
    token?: string;
    user?: AdminUser;
    message?: string;
    error?: string;
  }> => {
    try {
      const res = await api<{
        ok: boolean;
        token: string;
        user: AdminUser;
        message: string;
      }>("/auth/invitations/accept", {
        method: "POST",
        json: data,
      });
      if (res.ok && res.token && res.user) {
        adminToken = res.token;
        adminUser = res.user;
        try {
          localStorage.setItem(ADMIN_TOKEN_KEY, res.token);
          localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(res.user));
        } catch {}
        if (res.user.kioskId) {
          selectKiosk(res.user.kioskId);
        }
      }
      return { ok: true, token: res.token, user: res.user, message: res.message };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al activar la cuenta" };
    }
  },

  fetchKiosks: async (): Promise<{ ok: boolean; kiosks?: Kiosk[]; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; kiosks: Kiosk[] }>("/admin/kiosks");
      if (res && res.ok && res.kiosks) {
        const seen = new Set<string>();
        const deduped = res.kiosks.filter((k) => {
          if (!k.id || seen.has(k.id)) return false;
          seen.add(k.id);
          return true;
        });
        setState((s) => ({
          ...s,
          publicKiosks: deduped,
        }));
        return { ok: true, kiosks: deduped };
      }
      return { ok: true, kiosks: res?.kiosks || [] };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al listar negocios" };
    }
  },

  createKiosk: async (data: {
    name: string;
    slug?: string;
    active?: boolean;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    adminUserId?: string;
  }): Promise<{ ok: boolean; kiosk?: Kiosk; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; kiosk: Kiosk }>("/admin/kiosks", {
        method: "POST",
        json: data,
      });
      if (res.ok && res.kiosk) {
        setState((s) => ({
          ...s,
          publicKiosks: [res.kiosk, ...s.publicKiosks.filter((k) => k.id !== res.kiosk.id)],
        }));
      }
      return { ok: true, kiosk: res.kiosk };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al crear negocio" };
    }
  },

  updateKiosk: async (
    id: string,
    data: {
      name?: string;
      slug?: string;
      active?: boolean;
      ownerName?: string;
      ownerEmail?: string;
      ownerPhone?: string;
    },
  ): Promise<{ ok: boolean; kiosk?: Kiosk; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; kiosk: Kiosk }>(`/admin/kiosks/${id}`, {
        method: "PATCH",
        json: data,
      });
      if (res.ok && res.kiosk) {
        setState((s) => ({
          ...s,
          publicKiosks: s.publicKiosks.map((k) => (k.id === id ? { ...k, ...res.kiosk } : k)),
          settings: s.selectedKioskId === id ? { ...s.settings, shopName: res.kiosk.name, slug: res.kiosk.slug } : s.settings,
        }));
        if (state.selectedKioskId === id) {
          updatePwaHead({ ...state.settings, shopName: res.kiosk.name, slug: res.kiosk.slug });
        }
      }
      return { ok: true, kiosk: res.kiosk };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al actualizar negocio" };
    }
  },

  toggleKioskStatus: async (id: string, active: boolean): Promise<{ ok: boolean; kiosk?: Kiosk; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; kiosk: Kiosk }>(`/admin/kiosks/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        json: { active },
      });
      if (res.ok && res.kiosk) {
        const kioskRealId = res.kiosk.id;
        const updatedActive = res.kiosk.active;
        setState((s) => {
          const updatedPublicKiosks = s.publicKiosks.map((k) =>
            k.id === id || k.id === kioskRealId || k.slug === id ? { ...k, active: updatedActive } : k
          );
          const isCurrentSelected =
            s.selectedKioskId === id ||
            s.selectedKioskId === kioskRealId ||
            s.settings.kioskId === id ||
            s.settings.kioskId === kioskRealId;
          return {
            ...s,
            publicKiosks: updatedPublicKiosks,
            settings: isCurrentSelected ? { ...s.settings, active: updatedActive } : s.settings,
            currentKiosk: isCurrentSelected ? { ...s.currentKiosk, active: updatedActive } : s.currentKiosk,
          };
        });
      }
      return { ok: true, kiosk: res.kiosk };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al cambiar estado del negocio" };
    }
  },

  deleteKiosk: async (id: string): Promise<{ ok: boolean; message?: string; error?: string }> => {
    try {
      const res = await api<{ ok: boolean; message?: string }>(`/admin/kiosks/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const remaining = state.publicKiosks.filter((k) => k.id !== id && k.slug !== id);
        setState((s) => ({
          ...s,
          publicKiosks: remaining,
        }));
        if (
          state.selectedKioskId === id ||
          state.currentKiosk.id === id ||
          state.currentKiosk.slug === id ||
          remaining.length === 0
        ) {
          if (remaining.length > 0) {
            selectKiosk(remaining[0].id);
          } else {
            selectKiosk("");
          }
        }
        try {
          const stored = localStorage.getItem(SELECTED_KIOSK_KEY);
          if (stored === id || remaining.length === 0) {
            if (remaining.length > 0) {
              localStorage.setItem(SELECTED_KIOSK_KEY, remaining[0].id);
            } else {
              localStorage.removeItem(SELECTED_KIOSK_KEY);
            }
          }
        } catch {}
        return { ok: true, message: res.message };
      }
      return { ok: false, error: "No se pudo eliminar el negocio" };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Error al eliminar el negocio" };
    }
  },
};

if (typeof window !== "undefined") {
  void bootstrap();
  // Refresh orders periodically so admin sees new orders without reload
  setInterval(() => {
    void refreshOrders().catch(() => {});
  }, 15000);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(state),
  );
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatOrderNumber(order: { orderNumber?: number | null; id: string }): string {
  if (order.orderNumber != null && order.orderNumber > 0) {
    return `#${order.orderNumber}`;
  }
  return `#${order.id}`;
}

export function buildWhatsappUrl(order: Order, settings: Settings): string {
  const shopName = settings?.shopName || "Kiosco";
  const whatsappNum = settings?.whatsappNumber || "5493437449728";
  const orderNumDisplay = order.orderNumber != null ? `#${order.orderNumber}` : `#${order.id}`;
  const lines = [
    `*🛍️ Nuevo pedido ${orderNumDisplay} - ${shopName}*`,
    ``,
    `*Cliente:* ${order.customerName}`,
    `*Modalidad:* ${order.delivery === "retiro" ? "Retiro en local" : "Envío a domicilio"}`,
    order.delivery === "envio" ? `*Dirección:* ${order.address || "(sin dirección)"}` : null,
    ``,
    `*Productos:*`,
    ...order.items.map(
      (i) => `• ${i.qty} x ${i.name} - ${formatPrice(i.price * i.qty)}`,
    ),
    ``,
    `*Total: ${formatPrice(order.total)}*`,
    `*Pago:* ${order.payment === "mercadopago" ? "Mercado Pago" : "Efectivo"}`,
    ``,
    `Pedido ${orderNumDisplay}`,
  ].filter(Boolean) as string[];
  const text = encodeURIComponent(lines.join("\n"));
  const number = whatsappNum.replace(/\D/g, "");
  return `https://wa.me/${number}?text=${text}`;
}
