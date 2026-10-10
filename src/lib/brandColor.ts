/**
 * The owner-chosen brand colour. Only a plain 6-digit hex colour ("#rrggbb") is ever accepted, so the value is safe to put
 * into a style attribute, a manifest or an image address: anything else (names, rgb(), url(), ";") is rejected, never "cleaned".
 */
const HEX = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_BRAND = "#4f46e5";

/** "#AABBCC" -> "#aabbcc"; null when it is not a plain 6-digit hex colour. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  return HEX.test(v) ? v.toLowerCase() : null;
}

const channels = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** White or near-black text, whichever is easier to read on this colour. */
export function readableInk(hex: string): "#ffffff" | "#111111" {
  const L = luminance(hex);
  // contrast with white = 1.05 / (L + 0.05); with near-black (L = 0.006) = (L + 0.05) / 0.056
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.056 ? "#ffffff" : "#111111";
}

/** Mixes the colour with black: ratio 0 = unchanged, 1 = black. */
export function darken(hex: string, ratio: number): string {
  const k = 1 - Math.max(0, Math.min(1, ratio));
  const [r, g, b] = channels(hex);
  return toHex(r * k, g * k, b * k);
}

/** The ready-made choices offered to owners. */
export const BRAND_PRESETS = [
  { id: "burgundy", hex: "#7a1632" },
  { id: "forest", hex: "#14532d" },
  { id: "navy", hex: "#1e3a5f" },
  { id: "charcoal", hex: "#2b2b2f" },
  { id: "gold", hex: "#b8860b" },
  { id: "purple", hex: "#5b2a86" },
] as const;

/** Up to two letters/digits (Latin only: the icon renderer's built-in font has no Indic letters), for the app icon. */
export function iconInitials(name: string): string {
  const words = name.trim().split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, "")).filter(Boolean);
  if (words.length === 0) return "B";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

/** Address of the generated app icon for a shop (size 180 / 192 / 512). `maskable` adds the safe-zone padding Android needs. */
export function appIconUrl(opts: { color: string; name: string; size: 180 | 192 | 512; maskable?: boolean }): string {
  const c = normalizeHex(opts.color) ?? DEFAULT_BRAND;
  return `/api/public/app-icon?s=${opts.size}&c=${c.slice(1)}&t=${iconInitials(opts.name)}${opts.maskable ? "&m=1" : ""}`;
}
