import mongoose from "mongoose";
import { z } from "zod";
import { Campaign } from "@/models/Campaign";
import { CustomerPush } from "@/models/CustomerPush";
import { Offer } from "@/models/Offer";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { CatalogueError, planFor, type Scope } from "@/lib/catalogue";
import { isPushConfigured, sendToSubscription } from "@/lib/push";
import { isLive } from "@/lib/offers";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_PER_DEVICE_MS = 20 * 60 * 60 * 1000; // a phone gets at most one message a day from the same owner
export const MAX_SUBSCRIBERS_PER_OWNER = 20_000;

export const campaignSchema = z.object({
  message: z.string().trim().min(5, "Write a short message (at least 5 letters).").max(120, "Keep the message under 120 letters."),
  offerId: z.string().optional(),
});

export async function campaignStatus(scope: Scope) {
  const since = new Date(Date.now() - WEEK_MS);
  const [plan, subscribers, recent, history] = await Promise.all([
    planFor(scope),
    CustomerPush.countDocuments({ ownerType: scope.ownerType, ownerId: scope.ownerId }),
    Campaign.find({ ownerType: scope.ownerType, ownerId: scope.ownerId, createdAt: { $gte: since } }).sort({ createdAt: 1 }).select("createdAt").lean<{ createdAt: Date }[]>(),
    Campaign.find({ ownerType: scope.ownerType, ownerId: scope.ownerId }).sort({ createdAt: -1 }).limit(10).select("message audience delivered failed createdAt").lean(),
  ]);
  const limit = plan.maxCampaignsPerWeek;
  // When the oldest message of the last 7 days falls out of the window, one more can be sent.
  const nextAt = recent.length >= limit && limit > 0 ? new Date(recent[recent.length - limit].createdAt.getTime() + WEEK_MS) : null;
  return { subscribers, limit, sentThisWeek: recent.length, nextAt, pushReady: isPushConfigured, history };
}

/** Sends a message to the owner's opted-in customers. Plan limit per rolling week, one message per device per day, 1 send at a time per owner. */
export async function sendCampaign(scope: Scope, userId: string, input: z.infer<typeof campaignSchema>) {
  if (!isPushConfigured) throw new CatalogueError(503, "Phone notifications are not set up on this server yet. Ask the admin.");
  const status = await campaignStatus(scope);
  if (status.limit === 0) throw new CatalogueError(403, "Messages to customers are part of the Premium plan.");
  if (status.sentThisWeek >= status.limit) throw new CatalogueError(429, `Your plan allows ${status.limit} message${status.limit === 1 ? "" : "s"} to customers in any 7 days. You can send again ${status.nextAt ? `after ${status.nextAt.toISOString().slice(0, 10)}` : "later"}.`);

  let offerId: mongoose.Types.ObjectId | undefined;
  let link = "";
  if (input.offerId) {
    if (!mongoose.isValidObjectId(input.offerId)) throw new CatalogueError(400, "Invalid offer.");
    const offer = await Offer.findOne({ _id: input.offerId, ownerType: scope.ownerType, ownerId: scope.ownerId }).lean<{ _id: mongoose.Types.ObjectId; status: string; startsOn: string; endsOn: string } | null>();
    if (!offer) throw new CatalogueError(404, "Offer not found.");
    if (!isLive(offer)) throw new CatalogueError(400, "That offer is not live today, so it cannot be announced.");
    offerId = offer._id;
  }

  const target = scope.ownerType === "SHOP"
    ? await Shop.findById(scope.ownerId).select("name slug").lean<{ name: string; slug: string } | null>()
    : await User.findById(scope.ownerId).select("name slug").lean<{ name: string; slug: string } | null>();
  if (!target) throw new CatalogueError(404, "Not found.");
  link = `/${scope.ownerType === "SHOP" ? "s" : "b"}/${target.slug}?view=catalogue`;

  // Reserve the weekly slot first (so two clicks cannot both pass the limit check), then deliver.
  const campaign = await Campaign.create({ ownerType: scope.ownerType, ownerId: scope.ownerId, sentBy: userId, message: input.message, offerId });
  const recheck = await Campaign.countDocuments({ ownerType: scope.ownerType, ownerId: scope.ownerId, createdAt: { $gte: new Date(Date.now() - WEEK_MS) } });
  if (recheck > status.limit) { await campaign.deleteOne(); throw new CatalogueError(429, "Another message was just sent. Please wait and check the limit."); }

  const cutoff = new Date(Date.now() - ONE_PER_DEVICE_MS);
  const devices = await CustomerPush.find({ ownerType: scope.ownerType, ownerId: scope.ownerId, $or: [{ lastSentAt: { $exists: false } }, { lastSentAt: { $lt: cutoff } }] }).limit(MAX_SUBSCRIBERS_PER_OWNER).lean<{ _id: unknown; endpoint: string; keys: { p256dh: string; auth: string } }[]>();
  let delivered = 0, failed = 0;
  const gone: unknown[] = [], sent: unknown[] = [];
  for (let i = 0; i < devices.length; i += 25) {
    const results = await Promise.all(devices.slice(i, i + 25).map((d) => sendToSubscription(d, { title: target.name, body: input.message, url: link, tag: `offer-${scope.ownerId}` })));
    results.forEach((r, j) => { const d = devices[i + j]; if (r === "ok") { delivered++; sent.push(d._id); } else if (r === "gone") { failed++; gone.push(d._id); } else failed++; });
  }
  if (sent.length) await CustomerPush.updateMany({ _id: { $in: sent } }, { $set: { lastSentAt: new Date() } });
  if (gone.length) await CustomerPush.deleteMany({ _id: { $in: gone } });
  await Campaign.updateOne({ _id: campaign._id }, { $set: { audience: devices.length, delivered, failed } });
  return { audience: devices.length, delivered, failed };
}
