/**
 * Automatic birthday offers. The cron and the booking route wire into exactly two exports:
 *
 *   runBirthdayOffersForOwner(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, today: string): Promise<number>
 *   isBirthdayToday(birthday: string | undefined, today: string): boolean
 *
 * `today` is an IST "YYYY-MM-DD" (see getTodayISTString); a customer's `birthday` is a "MM-DD" string on the Customer doc.
 * runBirthdayOffersForOwner never throws and returns the number of birthday customers greeted today (0 when off, already
 * run, or the plan allows no auto-offers). isBirthdayToday is a pure helper the booking route uses to decide whether to
 * show the on-screen birthday greeting.
 */
import mongoose from "mongoose";
import { AutoOffer } from "@/models/AutoOffer";
import { Customer } from "@/models/Customer";
import { CustomerPush } from "@/models/CustomerPush";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { effectivePlan } from "@/lib/plans";
import { isPushConfigured, sendToSubscription } from "@/lib/push";
import type { OwnerType } from "@/lib/catalogue";

const MAX_SUBSCRIBERS_PER_OWNER = 20_000;
const DEFAULT_BIRTHDAY_MESSAGE = "Happy birthday! 🎂 Treat yourself to a fresh look on us.";

/** The shape the owner form reads and writes (lastBirthdayRun is internal and never exposed to the form). */
export interface AutoOfferConfig {
  birthdayEnabled: boolean;
  birthdayMessage: string;
  birthdayOfferId: string;
}

const DEFAULT_CONFIG: AutoOfferConfig = { birthdayEnabled: false, birthdayMessage: "", birthdayOfferId: "" };

function clampConfig(input: Partial<AutoOfferConfig> & { birthdayOfferId?: unknown }): AutoOfferConfig {
  const offerId = input.birthdayOfferId;
  return {
    birthdayEnabled: !!input.birthdayEnabled,
    birthdayMessage: typeof input.birthdayMessage === "string" ? input.birthdayMessage.trim().slice(0, 120) : "",
    birthdayOfferId: typeof offerId === "string" && mongoose.isValidObjectId(offerId) ? offerId : "",
  };
}

export async function getAutoOfferConfig(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId): Promise<AutoOfferConfig> {
  const doc = await AutoOffer.findOne({ ownerType, ownerId }).lean<(Partial<AutoOfferConfig> & { birthdayOfferId?: mongoose.Types.ObjectId }) | null>();
  if (!doc) return { ...DEFAULT_CONFIG };
  return clampConfig({ ...doc, birthdayOfferId: doc.birthdayOfferId ? String(doc.birthdayOfferId) : "" });
}

export async function saveAutoOfferConfig(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, input: Partial<AutoOfferConfig>): Promise<AutoOfferConfig> {
  const cfg = clampConfig(input);
  await AutoOffer.findOneAndUpdate(
    { ownerType, ownerId },
    {
      $set: {
        ownerType,
        ownerId,
        birthdayEnabled: cfg.birthdayEnabled,
        birthdayMessage: cfg.birthdayMessage,
        // Empty string clears the optional offer; a valid id sets it.
        birthdayOfferId: cfg.birthdayOfferId ? new mongoose.Types.ObjectId(cfg.birthdayOfferId) : undefined,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return cfg;
}

/** True when a "MM-DD" (or "YYYY-MM-DD") birthday falls on the same month-and-day as today's "YYYY-MM-DD". Pure. */
export function isBirthdayToday(birthday: string | undefined, today: string): boolean {
  if (!birthday || typeof birthday !== "string") return false;
  // slice(-5) takes the trailing "MM-DD" whether the stored value is "MM-DD" or a full "YYYY-MM-DD".
  return birthday.slice(-5) === today.slice(5);
}

/** The barber user ids that make up this owner: the barber himself, or every member of the shop. */
async function ownerBarberIds(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId[]> {
  if (ownerType === "BARBER") return [ownerId];
  const members = await User.find({ shopId: ownerId }).select("_id").lean<{ _id: mongoose.Types.ObjectId }[]>();
  return members.map((m) => m._id);
}

/** The user whose plan governs this owner scope (the shop's owner, else the barber himself). */
async function ownerUserId(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId): Promise<string | null> {
  if (ownerType === "BARBER") return String(ownerId);
  const shop = await Shop.findById(ownerId).select("ownerId").lean<{ ownerId: mongoose.Types.ObjectId } | null>();
  return shop ? String(shop.ownerId) : null;
}

/** Customers of this owner whose birthday (MM-DD) is today. `today` is an IST "YYYY-MM-DD". */
export async function birthdayAudience(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, today: string) {
  const mmdd = today.slice(5); // "MM-DD"
  const barberIds = await ownerBarberIds(ownerType, ownerId);
  if (!barberIds.length) return [];
  // A customer belongs to the owner when a barber of this owner owns them, or has them in their archived visit stats.
  return Customer.find({
    birthday: mmdd,
    $or: [{ ownerBarberId: { $in: barberIds } }, { "barberStats.barberId": { $in: barberIds } }],
  })
    .select("name phone birthday")
    .lean<{ _id: mongoose.Types.ObjectId; name: string; phone: string; birthday?: string }[]>();
}

/**
 * The daily birthday run for one owner. When the owner has birthday offers on and the day has not already run, it finds
 * today's birthday customers and sends the owner's birthday message to the owner's opted-in devices via the existing push
 * path (CustomerPush + sendToSubscription — never duplicated here). Counts against the plan's weekly auto-offer budget
 * (checked as > 0 for now). Reserves the day atomically first, so two crons cannot both fire. Never throws.
 * Returns the number of birthday customers greeted today (0 when off, already run, or the plan allows no auto-offers).
 */
export async function runBirthdayOffersForOwner(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, today: string): Promise<number> {
  try {
    if (!isPushConfigured) return 0;

    const cfg = await getAutoOfferConfig(ownerType, ownerId);
    if (!cfg.birthdayEnabled) return 0;

    // Budget gate: the owner's plan must allow at least one auto-offer a week.
    const userId = await ownerUserId(ownerType, ownerId);
    if (!userId) return 0;
    const { limits } = await effectivePlan(userId);
    if (limits.autoOffersPerWeek <= 0) return 0;

    // Reserve today atomically: only flips lastBirthdayRun when it is not already today, so a second run finds nothing.
    const reserved = await AutoOffer.findOneAndUpdate(
      { ownerType, ownerId, birthdayEnabled: true, lastBirthdayRun: { $ne: today } },
      { $set: { lastBirthdayRun: today } },
      { new: true }
    ).lean<{ birthdayMessage?: string } | null>();
    if (!reserved) return 0; // already run today (or disabled between the read and here)

    const audience = await birthdayAudience(ownerType, ownerId, today);
    if (!audience.length) return 0;

    // Deliver via the existing customer-push path. CustomerPush is device-based (no per-customer link), so the greeting
    // goes to the owner's opted-in devices once, triggered by there being a birthday today.
    const message = reserved.birthdayMessage?.trim() || cfg.birthdayMessage || DEFAULT_BIRTHDAY_MESSAGE;
    const target = ownerType === "SHOP"
      ? await Shop.findById(ownerId).select("name slug").lean<{ name: string; slug: string } | null>()
      : await User.findById(ownerId).select("name slug").lean<{ name: string; slug: string } | null>();
    if (!target) return audience.length;
    const link = `/${ownerType === "SHOP" ? "s" : "b"}/${target.slug}?view=catalogue`;

    const devices = await CustomerPush.find({ ownerType, ownerId })
      .limit(MAX_SUBSCRIBERS_PER_OWNER)
      .lean<{ _id: unknown; endpoint: string; keys: { p256dh: string; auth: string } }[]>();
    const gone: unknown[] = [];
    for (let i = 0; i < devices.length; i += 50) {
      const batch = devices.slice(i, i + 50);
      const results = await Promise.all(batch.map((d) => sendToSubscription(d, { title: target.name, body: message, url: link, tag: `birthday-${ownerId}` })));
      results.forEach((r, j) => { if (r === "gone") gone.push(batch[j]._id); });
    }
    if (gone.length) await CustomerPush.deleteMany({ _id: { $in: gone } });

    return audience.length;
  } catch (e) {
    console.error("runBirthdayOffersForOwner failed", e);
    return 0;
  }
}
