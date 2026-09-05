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
export const NOTIFICATION_TTL_MS = 2 * 60 * 1000; // 2 minutos de caducidad automática
export const MAX_STORED_NOTIFICATIONS = 10;

function loadInitialNotifications(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const now = Date.now();
      const valid = parsed.filter(
        (n: any) =>
          n &&
          typeof n.timestamp === "number" &&
          now - n.timestamp < NOTIFICATION_TTL_MS &&
          !n.read
      ).slice(0, MAX_STORED_NOTIFICATIONS);
      try {
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(valid));
      } catch {}
      return valid;
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
  const k =
    s.publicKiosks.find((item) => item.id === s.selectedKioskId || item.slug === s.selectedKioskId) ||
    adminUser?.assignedKiosks?.find((item) => item.id === s.selectedKioskId || item.slug === s.selectedKioskId);
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

export type NotificationSoundType =
  | "new_order"
  | "preparacion"
  | "listo"
  | "en_camino"
  | "entregado"
  | "status_change";

let sharedAudioCtx: AudioContext | null = null;
let audioContextUnlocked = false;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    try {
      sharedAudioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

export function getAudioStatus(): "running" | "suspended" | "closed" | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return "unsupported";
  if (!sharedAudioCtx) return "suspended";
  return sharedAudioCtx.state;
}

export async function unlockAudioPipeline(): Promise<boolean> {
  const ctx = getSharedAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    // Buffer silencioso de 1 muestra para desbloquear pipeline en iOS WebKit y Chrome Android
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    audioContextUnlocked = ctx.state === "running";
    return ctx.state === "running";
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  const handleInteraction = () => {
    void unlockAudioPipeline();
  };
  window.addEventListener("pointerdown", handleInteraction, { passive: true, capture: true });
  window.addEventListener("click", handleInteraction, { passive: true, capture: true });
  window.addEventListener("touchstart", handleInteraction, { passive: true, capture: true });
  window.addEventListener("touchend", handleInteraction, { passive: true, capture: true });
  window.addEventListener("keydown", handleInteraction, { passive: true, capture: true });
}

export async function playNotificationSound(type: NotificationSoundType): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return false;

    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }

    if (ctx.state !== "running") {
      return false;
    }

    const t = ctx.currentTime;

    const playTone = (
      freq: number,
      offset: number,
      duration: number,
      vol = 0.30,
      waveType: OscillatorType = "sine"
    ) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, t + offset);
        gain.gain.setValueAtTime(vol, t + offset);
        gain.gain.linearRampToValueAtTime(0.0001, t + offset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + offset);
        osc.stop(t + offset + duration);
      } catch {}
    };

    switch (type) {
      case "new_order":
        // Tono doble ascendente y distintivo para nuevo pedido (D5 587Hz -> A5 880Hz)
        playTone(587.33, 0, 0.14, 0.35, "triangle");
        playTone(880.00, 0.12, 0.38, 0.35, "sine");
        break;

      case "preparacion":
        // Tono armónico en preparación para el cliente (C5 523Hz -> E5 659Hz)
        playTone(523.25, 0, 0.14, 0.30, "sine");
        playTone(659.25, 0.11, 0.32, 0.30, "sine");
        break;

      case "listo":
        // Campana alegre tríada mayor para retiro en local (C5 -> E5 -> G5)
        playTone(523.25, 0, 0.10, 0.28, "triangle");
        playTone(659.25, 0.09, 0.12, 0.30, "triangle");
        playTone(783.99, 0.18, 0.42, 0.35, "sine");
        break;

      case "en_camino":
        // Tono dinámico de despacho / envío en camino (F5 -> A5 -> C6)
        playTone(698.46, 0, 0.10, 0.28, "triangle");
        playTone(880.00, 0.09, 0.12, 0.32, "triangle");
        playTone(1046.50, 0.18, 0.40, 0.35, "sine");
        break;

      case "entregado":
        // Tono cálido de entrega confirmada (E5 -> A5)
        playTone(659.25, 0, 0.14, 0.30, "sine");
        playTone(880.00, 0.11, 0.40, 0.32, "sine");
        break;

      case "status_change":
      default:
        playTone(587.33, 0, 0.25, 0.28, "sine");
        break;
    }
    return true;
  } catch {
    return false;
  }
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

const CUSTOMER_ORDERS_STORAGE_KEY = "kiosco-customer-order-ids-v1";

export function getCustomerOrderIds(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOMER_ORDERS_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const lastId = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
    if (lastId && !list.includes(lastId)) {
      list.unshift(lastId);
    }
    return list;
  } catch {
    const lastId = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
    return lastId ? [lastId] : [];
  }
}

export function saveCustomerOrderId(orderId: string) {
  try {
    const list = getCustomerOrderIds().filter((id) => id !== orderId);
    list.unshift(orderId);
    localStorage.setItem(CUSTOMER_ORDERS_STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
    localStorage.setItem(LAST_ORDER_STORAGE_KEY, orderId);
  } catch {}
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return "unsupported";
  }
}

export function getNotificationPermissionStatus(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function cleanExpiredNotifications() {
  const now = Date.now();
  setState((s) => {
    const current = s.notifications || [];
    const valid = current.filter(
      (n) => now - n.timestamp < NOTIFICATION_TTL_MS && !n.read
    );
    if (valid.length !== current.length) {
      try {
        localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(valid));
      } catch {}
      return { ...s, notifications: valid };
    }
    return s;
  });
}

export function addNotification(
  notif: Omit<NotificationItem, "id" | "timestamp" | "read">
) {
  const now = Date.now();
  const item: NotificationItem = {
    ...notif,
    id: `notif_${now}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    read: false,
  };

  setState((s) => {
    const current = s.notifications || [];
    // Filtrar expiradas o atendidas antes de agregar la nueva
    const validExisting = current.filter(
      (n) => now - n.timestamp < NOTIFICATION_TTL_MS && !n.read
    );
    const updated = [item, ...validExisting].slice(0, MAX_STORED_NOTIFICATIONS);
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return {
      ...s,
      notifications: updated,
    };
  });

  // Temporizador de caducidad automática para esta notificación
  if (typeof window !== "undefined") {
    setTimeout(() => {
      cleanExpiredNotifications();
    }, NOTIFICATION_TTL_MS + 200);
  }

  addToast({
    title: item.title,
    message: item.message,
    type: item.type,
    kioskId: item.kioskId,
  });

  // Notificación nativa para Chrome / PWA instalada en Android y escritorio
  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(item.title, {
              body: item.message,
              icon: "/favicon.svg",
              badge: "/favicon.svg",
              tag: item.id,
              renotify: true,
              vibrate: [200, 100, 200],
            } as any);
          })
          .catch(() => {
            new Notification(item.title, { body: item.message, icon: "/favicon.svg" });
          });
      } else {
        new Notification(item.title, { body: item.message, icon: "/favicon.svg" });
      }
    } catch {}
  }
}

export function markNotificationAsRead(id: string) {
  // Al abrir o atender la notificación, se marca como atendida y desaparece
  setState((s) => {
    const updated = (s.notifications || []).filter((n) => n.id !== id);
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    return { ...s, notifications: updated };
  });
}

export function markAllNotificationsAsRead(forAdmin?: boolean, kioskId?: string) {
  setState((s) => {
    const updated = (s.notifications || []).filter((n) => {
      const matchAdmin = forAdmin === undefined || n.forAdmin === forAdmin;
      const matchKiosk = !kioskId || n.kioskId === kioskId;
      return !(matchAdmin && matchKiosk);
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
const notifiedOrderEvents = new Set<string>();
let isInitialOrdersLoad = true;

const STATUS_TEXTS: Record<OrderStatus, string> = {
  nuevo: "Recibido / Pendiente",
  preparacion: "En preparación 👨‍🍳",
  listo: "¡Listo para retirar / entregar! 🎉",
  entregado: "Entregado ✅",
};

async function refreshOrders() {
  try {
    const isAdminView = state.view === "admin" || state.view === "superadmin" || !!adminToken;
    let query = state.selectedKioskId ? `?kioskId=${encodeURIComponent(state.selectedKioskId)}` : "";

    if (!isAdminView) {
      const customerIds = getCustomerOrderIds();
      if (customerIds.length === 0) {
        // El cliente todavía no ha realizado pedidos
        setState((s) => ({ ...s, orders: [] }));
        return;
      }
      query += `${query ? "&" : "?"}orderIds=${encodeURIComponent(customerIds.join(","))}`;
    }

    const orders = await api<Order[]>(`/orders${query}`);

    if (isInitialOrdersLoad) {
      orders.forEach((o) => {
        knownOrders.set(o.id, o.status);
        notifiedOrderEvents.add(`new_${o.id}`);
        notifiedOrderEvents.add(`status_${o.id}_${o.status}`);
      });
      isInitialOrdersLoad = false;
      setState((s) => ({ ...s, orders }));
      return;
    }

    const currentLastOrderId = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
    const activeKioskId = state.selectedKioskId;

    for (const o of orders) {
      const prevStatus = knownOrders.get(o.id);
      const orderKioskId = o.kioskId || activeKioskId;

      if (prevStatus === undefined) {
        // Pedido totalmente nuevo
        const createdAtMs = o.createdAt ? new Date(o.createdAt).getTime() : Date.now();
        const isRecent = Date.now() - createdAtMs < NOTIFICATION_TTL_MS;

        if (isAdminView && orderKioskId === activeKioskId && isRecent) {
          const eventKey = `new_${o.id}`;
          if (!notifiedOrderEvents.has(eventKey)) {
            notifiedOrderEvents.add(eventKey);
            const orderNumDisplay = o.orderNumber != null ? `#${o.orderNumber}` : `#${o.id.slice(-4)}`;
            addNotification({
              title: "🔔 ¡Nuevo pedido recibido!",
              message: `Pedido ${orderNumDisplay} de ${o.customerName} (${o.delivery === "envio" ? "Envío" : "Retiro"}) - $${o.total.toLocaleString("es-AR")}`,
              type: "order",
              kioskId: orderKioskId,
              orderId: o.id,
              forAdmin: true,
            });
            void playNotificationSound("new_order");
          }
        }
      } else if (prevStatus !== o.status) {
        // Cambio de estado relevante únicamente para el cliente que generó el pedido
        const customerIds = getCustomerOrderIds();
        const isTargetCustomerOrder = customerIds.includes(o.id) || (currentLastOrderId && o.id === currentLastOrderId);

        if (!isAdminView && isTargetCustomerOrder && orderKioskId === activeKioskId) {
          const eventKey = `status_${o.id}_${o.status}`;
          if (!notifiedOrderEvents.has(eventKey)) {
            notifiedOrderEvents.add(eventKey);
            const orderNumDisplay = o.orderNumber != null ? `#${o.orderNumber}` : `#${o.id.slice(-4)}`;
            let title = "📦 Estado de tu pedido";
            let message = `Tu pedido ${orderNumDisplay} cambió a: ${STATUS_TEXTS[o.status] || o.status}`;
            let soundType: NotificationSoundType = "status_change";

            if (o.status === "preparacion") {
              title = "👨‍🍳 Pedido en preparación";
              message = `Tu pedido ${orderNumDisplay} está siendo preparado en este momento.`;
              soundType = "preparacion";
            } else if (o.status === "listo") {
              if (o.delivery === "envio") {
                title = "🛵 ¡Tu pedido está en camino!";
                message = `Tu pedido ${orderNumDisplay} ya salió y va en camino a tu domicilio.`;
                soundType = "en_camino";
              } else {
                title = "🎉 ¡Tu pedido está listo!";
                message = `Tu pedido ${orderNumDisplay} está listo para retirar por el local.`;
                soundType = "listo";
              }
            } else if (o.status === "entregado") {
              title = "✅ Pedido entregado";
              message = `Tu pedido ${orderNumDisplay} fue entregado con éxito. ¡Muchas gracias!`;
              soundType = "entregado";
            }

            addNotification({
              title,
              message,
              type: o.status === "entregado" || o.status === "listo" ? "success" : "info",
              kioskId: orderKioskId,
              orderId: o.id,
              forAdmin: false,
            });
            void playNotificationSound(soundType);
          }
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
    const targetKiosk =
      s.publicKiosks.find((k) => k.id === kioskId || k.slug === kioskId) ||
      adminUser?.assignedKiosks?.find((k) => k.id === kioskId || k.slug === kioskId);
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
        active: targetKiosk ? targetKiosk.active !== false : true,
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
      // Validate whether activeKioskToSelect is valid
      const isAssignedToAdmin =
        adminUser?.role === "superadmin" ||
        (adminUser?.assignedKiosks || []).some(
          (k) => k.id === activeKioskToSelect || k.slug === activeKioskToSelect
        ) ||
        adminUser?.kioskId === activeKioskToSelect;

      const isValid =
        Boolean(isAssignedToAdmin && activeKioskToSelect) ||
        state.publicKiosks.some(
          (k) => k.id === activeKioskToSelect || k.slug === activeKioskToSelect
        );

      if (!isValid) {
        if (adminUser?.role === "admin" && (adminUser.assignedKiosks?.length ?? 0) > 0) {
          activeKioskToSelect = adminUser.assignedKiosks![0].id;
          setState((s) => ({ ...s, selectedKioskId: activeKioskToSelect }));
          try { localStorage.setItem(SELECTED_KIOSK_KEY, activeKioskToSelect); } catch {}
        } else if (state.publicKiosks.length > 0) {
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
  cleanExpiredNotifications: () => cleanExpiredNotifications(),
  playNotificationSound: (type: NotificationSoundType) => playNotificationSound(type),
  getAudioStatus: () => getAudioStatus(),
  unlockAudioPipeline: () => unlockAudioPipeline(),
  simulateTestNotification: (
    type: "new_order" | "preparacion" | "listo" | "en_camino" | "entregado",
    kioskId?: string
  ) => {
    if (adminUser?.role !== "superadmin") {
      console.warn("Acceso denegado: solo SuperAdmin puede ejecutar simulaciones de prueba.");
      return;
    }
    const targetKioskId = kioskId || state.selectedKioskId;
    const testOrderId = `test_${Date.now()}`;
    const testOrderNum = Math.floor(100 + Math.random() * 900);

    switch (type) {
      case "new_order":
        addNotification({
          title: "🔔 [PRUEBA] ¡Nuevo pedido recibido!",
          message: `Pedido #${testOrderNum} de Cliente de Prueba (Envío) - $14.500`,
          type: "order",
          kioskId: targetKioskId,
          orderId: testOrderId,
          forAdmin: true,
        });
        void playNotificationSound("new_order");
        break;

      case "preparacion":
        addNotification({
          title: "👨‍🍳 [PRUEBA] Pedido en preparación",
          message: `Tu pedido #${testOrderNum} está siendo preparado en este momento.`,
          type: "info",
          kioskId: targetKioskId,
          orderId: testOrderId,
          forAdmin: false,
        });
        void playNotificationSound("preparacion");
        break;

      case "listo":
        addNotification({
          title: "🎉 [PRUEBA] ¡Tu pedido está listo!",
          message: `Tu pedido #${testOrderNum} está listo para retirar por el local.`,
          type: "success",
          kioskId: targetKioskId,
          orderId: testOrderId,
          forAdmin: false,
        });
        void playNotificationSound("listo");
        break;

      case "en_camino":
        addNotification({
          title: "🛵 [PRUEBA] ¡Tu pedido está en camino!",
          message: `Tu pedido #${testOrderNum} ya salió y va en camino a tu domicilio.`,
          type: "info",
          kioskId: targetKioskId,
          orderId: testOrderId,
          forAdmin: false,
        });
        void playNotificationSound("en_camino");
        break;

      case "entregado":
        addNotification({
          title: "✅ [PRUEBA] Pedido entregado",
          message: `Tu pedido #${testOrderNum} fue entregado con éxito. ¡Muchas gracias!`,
          type: "success",
          kioskId: targetKioskId,
          orderId: testOrderId,
          forAdmin: false,
        });
        void playNotificationSound("entregado");
        break;
    }
  },
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
    notifiedOrderEvents.add(`new_${real.id}`);
    notifiedOrderEvents.add(`status_${real.id}_${real.status}`);
    saveCustomerOrderId(real.id);

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
    notifiedOrderEvents.add(`status_${orderId}_${status}`);
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

  updateOrder: async (
    orderId: string,
    updates: Partial<Omit<Order, "id" | "kioskId" | "createdAt">>,
  ): Promise<{ ok: boolean; order?: Order; error?: string }> => {
    try {
      if (updates.status) {
        knownOrders.set(orderId, updates.status);
        notifiedOrderEvents.add(`status_${orderId}_${updates.status}`);
      }
      const updated = await api<Order>(`/orders/${orderId}`, {
        method: "PATCH",
        json: updates,
      });
      setState((s) => ({
        ...s,
        orders: s.orders.map((o) => (o.id === orderId ? { ...o, ...updated } : o)),
      }));
      return { ok: true, order: updated };
    } catch (err: any) {
      void refreshOrders();
      return { ok: false, error: err?.message || "Error al actualizar el pedido" };
    }
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
          const targetKiosk = res.user.assignedKiosks?.[0]?.id || res.user.kioskId;
          if (targetKiosk) {
            selectKiosk(targetKiosk);
          }
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
    inviteUrl?: string;
    emailResult?: { simulated: boolean; inviteUrl?: string; error?: string };
    error?: string;
  }> => {
    try {
      const res = await api<{
        ok: boolean;
        invitation: AdminInvitation;
        message: string;
        inviteUrl?: string;
        emailResult?: { simulated: boolean; inviteUrl?: string; error?: string };
      }>("/admin/invitations", {
        method: "POST",
        json: data,
      });
      const inviteUrl = res.inviteUrl || res.emailResult?.inviteUrl;
      return {
        ok: true,
        invitation: res.invitation,
        message: res.message,
        inviteUrl,
        emailResult: res.emailResult || (inviteUrl ? { simulated: true, inviteUrl } : undefined),
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
    inviteUrl?: string;
    emailResult?: { simulated: boolean; inviteUrl?: string; error?: string };
    error?: string;
  }> => {
    try {
      const res = await api<{
        ok: boolean;
        invitation: AdminInvitation;
        message: string;
        inviteUrl?: string;
        emailResult?: { simulated: boolean; inviteUrl?: string; error?: string };
      }>(`/admin/invitations/${id}/resend`, {
        method: "POST",
      });
      const inviteUrl = res.inviteUrl || res.emailResult?.inviteUrl;
      return {
        ok: true,
        invitation: res.invitation,
        message: res.message,
        inviteUrl,
        emailResult: res.emailResult || (inviteUrl ? { simulated: true, inviteUrl } : undefined),
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
  // Sincronización ágil de pedidos y limpieza de notificaciones caducadas
  setInterval(() => {
    cleanExpiredNotifications();
    void refreshOrders().catch(() => {});
  }, 4000);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshOrders().catch(() => {});
      void unlockAudioPipeline().catch(() => {});
    }
  });
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

export function buildWhatsappUrl(order: Order, settings: Settings, kioskOverride?: Kiosk): string {
  const currentKiosk = kioskOverride || (typeof state !== "undefined" ? state.currentKiosk : undefined);
  const shopName = settings?.shopName || currentKiosk?.name || "Tienda Online";
  const whatsappNum = settings?.whatsappNumber || "";
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
  return number ? `https://wa.me/${number}?text=${text}` : `https://wa.me/?text=${text}`;
}
