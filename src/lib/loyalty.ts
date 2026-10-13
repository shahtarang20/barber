import mongoose from "mongoose";
import { LoyaltyProgram } from "@/models/LoyaltyProgram";
import { LoyaltyCard } from "@/models/LoyaltyCard";
import { Reward } from "@/models/Reward";
import { getTodayISTString } from "@/lib/istTime";
import type { OwnerType } from "@/lib/catalogue";

/** The shape the owner form reads and writes. */
export interface LoyaltyConfig {
  enabled: boolean;
  stampsNeeded: number;
  rewardType: "FREE_SERVICE" | "PERCENTAGE" | "FIXED";
  rewardValue: number;
  rewardLabel: string;
  rewardValidDays: number;
}

const DEFAULT_CONFIG: LoyaltyConfig = { enabled: false, stampsNeeded: 10, rewardType: "FREE_SERVICE", rewardValue: 0, rewardLabel: "", rewardValidDays: 0 };

function clampConfig(input: Partial<LoyaltyConfig>): LoyaltyConfig {
  const n = (v: unknown, lo: number, hi: number, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  const rewardType = input.rewardType === "PERCENTAGE" || input.rewardType === "FIXED" ? input.rewardType : "FREE_SERVICE";
  return {
    enabled: !!input.enabled,
    stampsNeeded: n(input.stampsNeeded, 2, 50, 10),
    rewardType,
    rewardValue: rewardType === "PERCENTAGE" ? n(input.rewardValue, 1, 100, 10) : rewardType === "FIXED" ? n(input.rewardValue, 1, 100_000, 50) : 0,
    rewardLabel: typeof input.rewardLabel === "string" ? input.rewardLabel.trim().slice(0, 60) : "",
    rewardValidDays: n(input.rewardValidDays, 0, 365, 0),
  };
}

export async function getLoyaltyConfig(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId): Promise<LoyaltyConfig> {
  const doc = await LoyaltyProgram.findOne({ ownerType, ownerId }).lean<Partial<LoyaltyConfig> | null>();
  return doc ? clampConfig(doc) : { ...DEFAULT_CONFIG };
}

export async function saveLoyaltyConfig(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, input: Partial<LoyaltyConfig>): Promise<LoyaltyConfig> {
  const cfg = clampConfig(input);
  await LoyaltyProgram.findOneAndUpdate({ ownerType, ownerId }, { $set: { ...cfg, ownerType, ownerId } }, { upsert: true, setDefaultsOnInsert: true });
  return cfg;
}

/** A default human label for the reward when the owner left it blank, so the coupon always reads sensibly. */
function rewardLabelFor(cfg: LoyaltyConfig): string {
  if (cfg.rewardLabel) return cfg.rewardLabel;
  if (cfg.rewardType === "PERCENTAGE") return `${cfg.rewardValue}% off`;
  if (cfg.rewardType === "FIXED") return `₹${cfg.rewardValue} off`;
  return "Free service";
}

export interface AwardResult { awarded: boolean; stamps: number; stampsNeeded: number; rewardEarned: boolean }

/**
 * Called when a booking becomes COMPLETED. Adds one stamp (at most one per IST day per customer), and when the card is full
 * issues a Reward coupon and resets the stamps. Safe to call for any owner: does nothing when the program is off. Never
 * throws into the caller — a loyalty hiccup must not fail completing a booking.
 */
export async function awardStampForBooking(booking: { barberId: mongoose.Types.ObjectId | string; customerId: mongoose.Types.ObjectId | string; viaShopId?: mongoose.Types.ObjectId | string | null }): Promise<AwardResult | null> {
  try {
    // The loyalty card belongs to the booking's owner scope: a shop booking earns on the shop's card, else the barber's.
    const ownerType: OwnerType = booking.viaShopId ? "SHOP" : "BARBER";
    const ownerId = new mongoose.Types.ObjectId(String(booking.viaShopId || booking.barberId));
    const customerId = new mongoose.Types.ObjectId(String(booking.customerId));

    const cfg = await getLoyaltyConfig(ownerType, ownerId);
    if (!cfg.enabled) return null;

    const today = getTodayISTString();
    // One stamp per day: only bump when the last stamp was on an earlier day. Atomic so two same-moment completes can't double-stamp.
    const card = await LoyaltyCard.findOneAndUpdate(
      { ownerType, ownerId, customerId, lastStampDate: { $ne: today } },
      { $inc: { stamps: 1 }, $set: { lastStampDate: today }, $setOnInsert: { ownerType, ownerId, customerId } },
      { upsert: true, new: true }
    ).lean<{ stamps: number; redeemedCount: number } | null>().catch(() => null);

    if (!card) return { awarded: false, stamps: 0, stampsNeeded: cfg.stampsNeeded, rewardEarned: false }; // already stamped today

    if (card.stamps >= cfg.stampsNeeded) {
      // Card full: issue the coupon and reset. Reset is guarded so a concurrent award cannot wipe a fresh stamp.
      const expiresOn = cfg.rewardValidDays > 0 ? isoPlusDays(today, cfg.rewardValidDays) : "";
      await Reward.create({ ownerType, ownerId, customerId, source: "LOYALTY", rewardType: cfg.rewardType, value: cfg.rewardValue, label: rewardLabelFor(cfg), expiresOn });
      await LoyaltyCard.updateOne({ ownerType, ownerId, customerId }, { $inc: { stamps: -cfg.stampsNeeded, redeemedCount: 1 } });
      return { awarded: true, stamps: card.stamps - cfg.stampsNeeded, stampsNeeded: cfg.stampsNeeded, rewardEarned: true };
    }
    return { awarded: true, stamps: card.stamps, stampsNeeded: cfg.stampsNeeded, rewardEarned: false };
  } catch (e) {
    console.error("awardStampForBooking failed", e);
    return null;
  }
}

/** YYYY-MM-DD plus n days, in plain date arithmetic (IST dates are date-only, so no timezone math is needed). */
function isoPlusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The customer's live card + unredeemed rewards, for the public page. Returns null when the owner runs no loyalty card. */
export async function loyaltyForCustomer(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, customerId: mongoose.Types.ObjectId) {
  const cfg = await getLoyaltyConfig(ownerType, ownerId);
  if (!cfg.enabled) return null;
  const today = getTodayISTString();
  const [card, rewards] = await Promise.all([
    LoyaltyCard.findOne({ ownerType, ownerId, customerId }).lean<{ stamps: number } | null>(),
    // Only the card's OWN rewards belong here — a wheel-won coupon has its own banner, so it must not also appear (and be mislabelled) on the loyalty card.
    Reward.find({ ownerType, ownerId, customerId, source: "LOYALTY", status: "ACTIVE", $or: [{ expiresOn: "" }, { expiresOn: { $gte: today } }] }).select("label expiresOn").lean<{ _id: mongoose.Types.ObjectId; label: string; expiresOn: string }[]>(),
  ]);
  return {
    stamps: card?.stamps || 0,
    stampsNeeded: cfg.stampsNeeded,
    rewardName: rewardLabelFor(cfg),
    activeRewards: rewards.map((r) => ({ id: String(r._id), label: r.label, expiresOn: r.expiresOn })),
  };
}

/** Owner view of one customer's rewards + card, and the redeem action. */
export async function redeemReward(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, rewardId: string, byUserId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(rewardId)) return false;
  const today = getTodayISTString();
  // Atomic: only an ACTIVE, not-yet-expired reward of THIS owner can be redeemed, so it can never be spent twice,
  // across shops, or after it has lapsed. (expiresOn "" = never expires.)
  const res = await Reward.updateOne(
    { _id: rewardId, ownerType, ownerId, status: "ACTIVE", $or: [{ expiresOn: "" }, { expiresOn: { $gte: today } }] },
    { $set: { status: "REDEEMED", redeemedAt: new Date(), redeemedBy: new mongoose.Types.ObjectId(byUserId) } }
  );
  return res.modifiedCount === 1;
}
