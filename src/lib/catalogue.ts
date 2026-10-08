import mongoose from "mongoose";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { effectivePlan, staffLevel, type PlanLimits } from "@/lib/plans";

export type OwnerType = "BARBER" | "SHOP";
/** `ownerUserId` is the user whose plan and limits govern the catalogue (the shop owner, even when staff are working in it). */
export interface Scope { ownerType: OwnerType; ownerId: mongoose.Types.ObjectId; ownerUserId: string; role: "OWNER" | "STAFF_BASIC" | "STAFF_FULL" }

export type { PlanLimits };

export class CatalogueError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Which catalogue the signed-in barber is working on. "me" = his own; "shop" = the shop's, for the shop's owner and for
 * staff the owner gave access to (`need` says which kind of access the call needs). The limits always follow the OWNER.
 * Staff access depends on the owner's plan right now: Premium allows basic staff (services, categories, pictures),
 * Business also allows full staff (branding, on/off switch, numbers). A lapsed plan switches staff access off.
 */
export async function resolveScope(userId: string, scope: string | null | undefined, need: "catalogue" | "analytics" = "catalogue"): Promise<Scope> {
  const user = await User.findById(userId).select("shopId isActive catalogueEnabled premiumAmount").lean<{ _id: mongoose.Types.ObjectId; shopId?: mongoose.Types.ObjectId | null; catalogueEnabled?: boolean } | null>();
  if (!user) throw new CatalogueError(401, "Unauthorized");
  if (scope === "shop") {
    if (!user.shopId) throw new CatalogueError(400, "You are not in a shop.");
    const shop = await Shop.findById(user.shopId).select("ownerId staff").lean<{ _id: mongoose.Types.ObjectId; ownerId: mongoose.Types.ObjectId; staff?: { userId: mongoose.Types.ObjectId; catalogue: boolean; analytics: boolean }[] } | null>();
    if (!shop) throw new CatalogueError(403, "Shop not found.");
    if (String(shop.ownerId) === userId) return { ownerType: "SHOP", ownerId: shop._id, ownerUserId: userId, role: "OWNER" };
    const grant = (shop.staff || []).find((s) => String(s.userId) === userId);
    const level = staffLevel((await effectivePlan(String(shop.ownerId))).limits.tier);
    const allowed = grant && level !== "NONE" && (need === "analytics" ? grant.analytics && level === "FULL" : grant.catalogue);
    if (!allowed) throw new CatalogueError(403, need === "analytics" ? "The shop owner has not given you access to the shop numbers." : "Only the shop owner (or staff the owner has allowed) can change the shop catalogue.");
    return { ownerType: "SHOP", ownerId: shop._id, ownerUserId: String(shop.ownerId), role: level === "FULL" ? "STAFF_FULL" : "STAFF_BASIC" };
  }
  return { ownerType: "BARBER", ownerId: user._id, ownerUserId: userId, role: "OWNER" };
}

/** The limits in force for this catalogue's owner right now (expired plans fall back to Free). */
export async function planFor(scope: Scope): Promise<PlanLimits> {
  return (await effectivePlan(scope.ownerUserId)).limits;
}

export async function catalogueAllowed(userId: string): Promise<boolean> {
  const u = await User.findById(userId).select("catalogueEnabled").lean<{ catalogueEnabled?: boolean } | null>();
  return u?.catalogueEnabled !== false;
}

const OWN_MEDIA_PATH = /^\/api\/public\/media\/[A-Za-z0-9._-]{1,120}$/;

/** Only ordinary web addresses are accepted for pictures, videos and links (never javascript:, data:, file:...). */
export function safeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 500) return null;
  // A picture uploaded to this app (stored in the database when cloud storage is off) is addressed by a path of our own.
  if (OWN_MEDIA_PATH.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch { return null; }
}

export function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9ऀ-ॿ઀-૿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "category";
}

export interface PricedService { priceType: string; price?: number | null; originalPrice?: number | null; discountType?: string | null; discountValue?: number | null }
/** The price the customer pays, after the discount: computed on the server so the page never shows a misleading number. */
export function finalPrice(s: PricedService): number | null {
  if (s.priceType === "ASK_SHOP" || s.price === undefined || s.price === null) return null;
  const price = Number(s.price);
  if (s.discountType === "PERCENTAGE" && s.discountValue) return Math.max(0, Math.round(price * (1 - Math.min(100, Number(s.discountValue)) / 100)));
  if (s.discountType === "FIXED" && s.discountValue) return Math.max(0, Math.round(price - Number(s.discountValue)));
  return Math.round(price);
}
export function discountLabel(s: PricedService): string | null {
  if (!s.discountType || !s.discountValue || s.priceType === "ASK_SHOP") return null;
  return s.discountType === "PERCENTAGE" ? `${Math.round(Number(s.discountValue))}% off` : `₹${Math.round(Number(s.discountValue))} off`;
}

/**
 * The catalogue switch starts OFF, so an owner who adds and publishes services would otherwise see nothing on the customer page.
 * Publishing a service therefore turns it on, unless the owner has used the switch himself.
 */
export async function autoEnableCatalogue(scope: Scope): Promise<void> {
  const { CatalogueSettings } = await import("@/models/CatalogueSettings");
  try {
    await CatalogueSettings.updateOne(
      { ownerType: scope.ownerType, ownerId: scope.ownerId, enabled: { $ne: true }, enabledByOwner: { $ne: true } },
      { $set: { enabled: true }, $setOnInsert: { ownerType: scope.ownerType, ownerId: scope.ownerId } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err; // a record already exists that the owner switched himself: leave it alone
  }
}
