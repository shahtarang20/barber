import { AppSetting } from "@/models/AppSetting";
import { Booking } from "@/models/Booking";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { getTodayISTString } from "@/lib/istTime";
import { memo, forget } from "@/lib/memo";

/**
 * Monthly cap on bookings that come in through a barber's or a shop's public link.
 * The admin sets it per barber / per shop; anyone without their own number gets the
 * platform default. 0 means unlimited. The count restarts on the 1st (India time).
 */
const KEY = "linkLimit";

// Read on every public page view; cached for a few seconds per server instance (see memo.ts).
export async function getDefaultLinkLimit(): Promise<number> {
  return memo(`setting:${KEY}`, 15_000, async () => {
    const doc = await AppSetting.findOne({ key: KEY }).lean<{ value?: { defaultLimit?: number } } | null>();
    const n = Number(doc?.value?.defaultLimit);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
}

export async function setDefaultLinkLimit(defaultLimit: number) {
  await AppSetting.findOneAndUpdate({ key: KEY }, { $set: { value: { defaultLimit } } }, { upsert: true });
  forget(`setting:${KEY}`);
}

/** Start of this month in India, as a UTC Date. */
function monthStart(): Date {
  const [y, m] = getTodayISTString().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 330 * 60_000);
}

const effective = (own: number | null | undefined, fallback: number) =>
  typeof own === "number" && own >= 0 ? own : fallback;

export interface LinkUsage { used: number; limit: number; closed: boolean }

const usage = (used: number, limit: number): LinkUsage => ({ used, limit, closed: limit > 0 && used >= limit });

export async function barberLinkUsage(barberId: unknown, own?: number | null, fallback?: number): Promise<LinkUsage> {
  const def = fallback ?? (await getDefaultLinkLimit());
  if (own === undefined) own = (await User.findById(barberId).select("linkBookingLimit").lean<{ linkBookingLimit?: number } | null>())?.linkBookingLimit;
  const limit = effective(own, def);
  const used = await Booking.countDocuments({ barberId, viaLink: true, status: { $ne: "CANCELLED" }, createdAt: { $gte: monthStart() } });
  return usage(used, limit);
}

export async function shopLinkUsage(shopId: unknown, own?: number | null, fallback?: number): Promise<LinkUsage> {
  const def = fallback ?? (await getDefaultLinkLimit());
  if (own === undefined) own = (await Shop.findById(shopId).select("linkBookingLimit").lean<{ linkBookingLimit?: number } | null>())?.linkBookingLimit;
  const limit = effective(own, def);
  const used = await Booking.countDocuments({ viaShopId: shopId, status: { $ne: "CANCELLED" }, createdAt: { $gte: monthStart() } });
  return usage(used, limit);
}

/**
 * Checked AFTER a link booking is saved, so many customers booking at the same instant can't all
 * slip past the pre-check. Bookings are ranked by creation order: only the first `limit` of the
 * month keep their place; later ones return true here and the caller undoes them.
 */
export async function isOverLinkLimit(bookingId: unknown, barberId: unknown, viaShopId?: unknown): Promise<boolean> {
  const def = await getDefaultLinkLimit();
  const own = (await User.findById(barberId).select("linkBookingLimit").lean<{ linkBookingLimit?: number } | null>())?.linkBookingLimit;
  const barberLimit = effective(own, def);
  const since = monthStart();
  if (barberLimit > 0) {
    const position = await Booking.countDocuments({ barberId, viaLink: true, status: { $ne: "CANCELLED" }, createdAt: { $gte: since }, _id: { $lte: bookingId } });
    if (position > barberLimit) return true;
  }
  if (viaShopId) {
    const shopOwn = (await Shop.findById(viaShopId).select("linkBookingLimit").lean<{ linkBookingLimit?: number } | null>())?.linkBookingLimit;
    const shopLimit = effective(shopOwn, def);
    if (shopLimit > 0) {
      const position = await Booking.countDocuments({ viaShopId, status: { $ne: "CANCELLED" }, createdAt: { $gte: since }, _id: { $lte: bookingId } });
      if (position > shopLimit) return true;
    }
  }
  return false;
}

/** Bookings through each barber's link this month, for many barbers in ONE query (admin list). */
export async function barberLinkUsedMap(barberIds: unknown[]): Promise<Map<string, number>> {
  if (barberIds.length === 0) return new Map();
  const rows = await Booking.aggregate([
    { $match: { barberId: { $in: barberIds }, viaLink: true, status: { $ne: "CANCELLED" }, createdAt: { $gte: monthStart() } } },
    { $group: { _id: "$barberId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n as number]));
}

/** Bookings through each shop's link this month, for many shops in ONE query (admin list). */
export async function shopLinkUsedMap(shopIds: unknown[]): Promise<Map<string, number>> {
  if (shopIds.length === 0) return new Map();
  const rows = await Booking.aggregate([
    { $match: { viaShopId: { $in: shopIds }, status: { $ne: "CANCELLED" }, createdAt: { $gte: monthStart() } } },
    { $group: { _id: "$viaShopId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n as number]));
}

export { effective as effectiveLimit };
