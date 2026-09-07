export interface ThemeColorPreset {
  id: string;
  name: string;
  bg: string;
  hsl: string; // Space-separated HSL channels for Tailwind v4: "H S% L%"
  hex: string;
  foregroundHsl?: string;
}

export const THEME_COLOR_PRESETS: ThemeColorPreset[] = [
  { id: "sky", name: "Azul Creador", bg: "bg-sky-500", hsl: "201 96% 36%", hex: "#0284c7" },
  { id: "emerald", name: "Esmeralda Fresco", bg: "bg-emerald-500", hsl: "160 84% 33%", hex: "#059669" },
  { id: "violet", name: "Púrpura Elegante", bg: "bg-purple-600", hsl: "262 83% 54%", hex: "#7c3aed" },
  { id: "amber", name: "Cálido Naranja", bg: "bg-amber-500", hsl: "37 92% 44%", hex: "#d97706" },
  { id: "rose", name: "Rosa Vibrante", bg: "bg-rose-500", hsl: "347 77% 49%", hex: "#e11d48" },
  { id: "indigo", name: "Índigo Profundo", bg: "bg-indigo-600", hsl: "239 84% 59%", hex: "#4f46e5" },
  { id: "teal", name: "Verde Petróleo", bg: "bg-teal-600", hsl: "175 84% 32%", hex: "#0d9488" },
  { id: "slate", name: "Gris Clásico", bg: "bg-slate-700", hsl: "215 28% 22%", hex: "#334155" },
];

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const clean = hex.replace(/^#/, "").trim();
  if (clean.length !== 3 && clean.length !== 6) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) / 255;
    g = parseInt(clean[1] + clean[1], 16) / 255;
    b = parseInt(clean[2] + clean[2], 16) / 255;
  } else {
    r = parseInt(clean.slice(0, 2), 16) / 255;
    g = parseInt(clean.slice(2, 4), 16) / 255;
    b = parseInt(clean.slice(4, 6), 16) / 255;
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function resolveThemeColor(colorIdOrHex?: string | null): {
  id: string;
  hex: string;
  hsl: string;
  foregroundHsl: string;
} {
  const defaultPreset = THEME_COLOR_PRESETS[0]; // sky
  if (!colorIdOrHex) {
    return {
      id: defaultPreset.id,
      hex: defaultPreset.hex,
      hsl: defaultPreset.hsl,
      foregroundHsl: defaultPreset.foregroundHsl || "0 0% 100%",
    };
  }

  const trimmed = colorIdOrHex.trim();

  // 1. Check if it matches a preset id
  const preset = THEME_COLOR_PRESETS.find((p) => p.id.toLowerCase() === trimmed.toLowerCase());
  if (preset) {
    return {
      id: preset.id,
      hex: preset.hex,
      hsl: preset.hsl,
      foregroundHsl: preset.foregroundHsl || "0 0% 100%",
    };
  }

  // 2. Check if it's a valid hex color (e.g. #0284c7 or #10b981)
  if (trimmed.startsWith("#") || /^[0-9a-fA-F]{3,6}$/.test(trimmed)) {
    const normalizedHex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    const parsed = hexToHsl(normalizedHex);
    if (parsed) {
      const hsl = `${parsed.h} ${parsed.s}% ${parsed.l}%`;
      const foregroundHsl = parsed.l > 65 ? "222 47% 11%" : "0 0% 100%";
      return {
        id: normalizedHex,
        hex: normalizedHex,
        hsl,
        foregroundHsl,
      };
    }
  }

  // Fallback to default preset
  return {
    id: defaultPreset.id,
    hex: defaultPreset.hex,
    hsl: defaultPreset.hsl,
    foregroundHsl: defaultPreset.foregroundHsl || "0 0% 100%",
  };
}

export function applyThemeColor(colorIdOrHex?: string | null) {
  if (typeof document === "undefined") return;

  const { hex, hsl, foregroundHsl } = resolveThemeColor(colorIdOrHex);
  const root = document.documentElement;

  // Modern Tailwind v4 and CSS variables
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--primary-foreground", foregroundHsl);

  // Directly assign --color-primary as well for complete consistency
  root.style.setProperty("--color-primary", `hsl(${hsl})`);
  root.style.setProperty("--color-primary-foreground", `hsl(${foregroundHsl})`);
  root.style.setProperty("--color-ring", `hsl(${hsl})`);

  // Update browser/mobile theme color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", hex);
  }
}

export function getCachedKioskTheme(kioskId?: string): string | null {
  if (typeof window === "undefined" || !kioskId) return null;
  try {
    return localStorage.getItem(`kiosk_theme_color_${kioskId}`);
  } catch {
    return null;
  }
}

export function setCachedKioskTheme(kioskId: string, color: string) {
  if (typeof window === "undefined" || !kioskId) return;
  try {
    localStorage.setItem(`kiosk_theme_color_${kioskId}`, color);
  } catch {}
}
