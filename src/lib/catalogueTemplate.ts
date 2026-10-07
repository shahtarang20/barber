/**
 * The look of a customer-facing page (1-5). Each shop / barber gets one at random when its catalogue settings are first
 * created; records created before this existed use a stable hash of the owner id, so nothing needs migrating and the
 * page never changes between visits. An admin can pin a specific one (Auto = the stored/hashed one).
 */
export const TEMPLATE_COUNT = 5;
export type TemplateId = 1 | 2 | 3 | 4 | 5;

/** FNV-1a over the id string, then a final avalanche so similar ObjectIds (shared timestamp prefix) spread evenly. */
export function hashTemplate(ownerId: string): TemplateId {
  let h = 0x811c9dc5;
  for (let i = 0; i < ownerId.length; i++) { h ^= ownerId.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return ((h >>> 0) % TEMPLATE_COUNT + 1) as TemplateId;
}

export const isTemplateId = (n: unknown): n is TemplateId => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= TEMPLATE_COUNT;

/** The stored template when valid, else the deterministic one for this owner. */
export const resolveTemplate = (stored: unknown, ownerId: unknown): TemplateId => (isTemplateId(stored) ? stored : hashTemplate(String(ownerId)));

/** Random pick for a brand-new settings record. */
export const randomTemplate = (): TemplateId => (Math.floor(Math.random() * TEMPLATE_COUNT) + 1) as TemplateId;

export const TEMPLATE_NAMES: Record<TemplateId, string> = { 1: "Noir Gold", 2: "Ivory Editorial", 3: "Royal Emerald", 4: "Midnight Velvet", 5: "Rose Gold Boutique" };
