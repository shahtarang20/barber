import crypto from "crypto";
import { AppSetting } from "@/models/AppSetting";
import { LinkVisitor } from "@/models/LinkVisitor";
import { getClientIp } from "@/lib/rateLimit";
import { getTodayISTString } from "@/lib/istTime";
import { memo, forget } from "@/lib/memo";

/**
 * Monthly cap on UNIQUE VISITORS (network addresses) that may open a barber's or shop's public link.
 * The admin sets it per barber / per shop; anyone without their own number gets the platform default; 0 = unlimited.
 * Visitors already counted this month keep full access; only a NEW address beyond the cap is turned away.
 * (This is separate from, and in addition to, the monthly cap on BOOKINGS in linkLimit.ts.)
 */
const KEY = "visitorLimit";
export type OwnerKind = "BARBER" | "SHOP";

// Read on every public page view; cached for a few seconds per server instance (see memo.ts).
export async function getDefaultVisitorLimit(): Promise<number> {
  return memo(`setting:${KEY}`, 15_000, async () => {
    const doc = await AppSetting.findOne({ key: KEY }).lean<{ value?: { defaultLimit?: number } } | null>();
    const n = Number(doc?.value?.defaultLimit);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
}
export async function setDefaultVisitorLimit(defaultLimit: number) {
  await AppSetting.findOneAndUpdate({ key: KEY }, { $set: { value: { defaultLimit } } }, { upsert: true });
  forget(`setting:${KEY}`);
}

const monthKey = () => getTodayISTString().slice(0, 7);
const effective = (own: number | null | undefined, fallback: number) => (typeof own === "number" && own >= 0 ? own : fallback);
const hashIp = (ip: string) => crypto.createHash("sha256").update(`${ip}|${process.env.AUTH_SECRET || "visitor"}`).digest("hex").slice(0, 32);

// Remember addresses already let in this month, so a returning visitor costs no database call on this server instance.
const seen = new Map<string, number>();
const SEEN_MAX = 50_000;
const remember = (key: string) => { if (seen.size >= SEEN_MAX) seen.clear(); seen.set(key, Date.now()); };

export interface VisitorUsage { used: number; limit: number; closed: boolean }

export async function visitorUsage(ownerType: OwnerKind, ownerId: unknown, own?: number | null, fallback?: number): Promise<VisitorUsage> {
  const def = fallback ?? (await getDefaultVisitorLimit());
  const limit = effective(own, def);
  const used = await LinkVisitor.countDocuments({ ownerType, ownerId, month: monthKey() });
  return { used, limit, closed: limit > 0 && used >= limit };
}

/**
 * Lets a visitor in, counting them the first time they are seen this month. A NEW address is refused when the month's
 * cap is already full. The check runs again after saving (ranked by arrival) so many new visitors arriving at the same
 * instant cannot all slip past the cap; the ones beyond it are removed again and refused.
 */
export async function admitVisitor(req: Request, ownerType: OwnerKind, ownerId: unknown, own?: number | null): Promise<{ allowed: boolean }> {
  const ipHash = hashIp(getClientIp(req));
  const month = monthKey();
  const key = `${ownerType}:${String(ownerId)}:${month}:${ipHash}`;
  if (seen.has(key)) return { allowed: true };
  const filter = { ownerType, ownerId, month, ipHash };
  if (await LinkVisitor.exists(filter)) { remember(key); return { allowed: true }; }

  const limit = effective(own, await getDefaultVisitorLimit());
  if (limit > 0 && (await LinkVisitor.countDocuments({ ownerType, ownerId, month })) >= limit) {
    // The cap looks full, but it may be full BECAUSE of this very visitor: their page sends several requests at the same
    // moment and a faster one may have just been counted. Look again before turning them away.
    if (await LinkVisitor.exists(filter)) { remember(key); return { allowed: true }; }
    return { allowed: false };
  }

  let doc;
  try { doc = await LinkVisitor.create(filter); }
  catch (err) { if ((err as { code?: number }).code === 11000) { remember(key); return { allowed: true }; } throw err; }
  if (limit > 0) {
    const position = await LinkVisitor.countDocuments({ ownerType, ownerId, month, _id: { $lte: doc._id } });
    if (position > limit) { await LinkVisitor.deleteOne({ _id: doc._id }); return { allowed: false }; }
  }
  remember(key);
  return { allowed: true };
}

/** Unique visitors this month for many barbers in ONE query (admin list). */
export async function visitorUsedMap(ownerType: OwnerKind, ownerIds: unknown[]): Promise<Map<string, number>> {
  if (ownerIds.length === 0) return new Map();
  const rows = await LinkVisitor.aggregate([
    { $match: { ownerType, ownerId: { $in: ownerIds }, month: monthKey() } },
    { $group: { _id: "$ownerId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r: { _id: unknown; n: number }) => [String(r._id), r.n]));
}
