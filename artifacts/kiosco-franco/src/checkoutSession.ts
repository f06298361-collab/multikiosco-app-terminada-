import type { CartItem, Order, PaymentMethod } from "./store";

export interface ActiveCheckoutSession {
  kioskId: string;
  screen: "cart" | "checkout" | "payment";
  cart: CartItem[];
  customerName: string;
  address: string;
  delivery: "retiro" | "envio";
  payment: PaymentMethod;
  orderId?: string;
  order?: Order;
  timestamp: number;
}

const CHECKOUT_SESSION_KEY = "ferrapp_active_checkout_v1";
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 horas

export function getActiveCheckoutSession(): ActiveCheckoutSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHECKOUT_SESSION_KEY);
    if (!raw) return null;
    const session: ActiveCheckoutSession = JSON.parse(raw);
    if (!session || typeof session !== "object") return null;
    if (Date.now() - (session.timestamp || 0) > SESSION_MAX_AGE_MS) {
      clearActiveCheckoutSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveActiveCheckoutSession(patch: Partial<ActiveCheckoutSession>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getActiveCheckoutSession() || {
      kioskId: "",
      screen: "checkout" as const,
      cart: [],
      customerName: "",
      address: "",
      delivery: "retiro" as const,
      payment: "mercadopago" as const,
      timestamp: Date.now(),
    };

    const updated: ActiveCheckoutSession = {
      ...existing,
      ...patch,
      timestamp: Date.now(),
    };

    localStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to persist active checkout session:", err);
  }
}

export function clearActiveCheckoutSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CHECKOUT_SESSION_KEY);
  } catch {}
}
