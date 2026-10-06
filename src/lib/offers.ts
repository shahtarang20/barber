import mongoose from "mongoose";
import { z } from "zod";
import { Offer } from "@/models/Offer";
import { BarberService } from "@/models/BarberService";
import { getTodayISTString } from "@/lib/istTime";
import { addDaysStr, daysBetween } from "@/lib/plans";
import { CatalogueError, planFor, type Scope } from "@/lib/catalogue";

export const MAX_OFFER_DAYS = 180;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Use a valid date.");

export const offerSchema = z.object({
  title: z.string().trim().min(3, "Give the offer a name (at least 3 letters).").max(60, "Keep the name under 60 letters."),
  description: z.string().trim().max(200, "Keep the description under 200 letters.").optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"], { message: "Choose percentage or rupees off." }),
  discountValue: z.number({ message: "Enter the discount." }).min(1, "The discount must be at least 1."),
  serviceIds: z.array(z.string()).max(100).optional(),
  startsOn: date, endsOn: date,
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
}).superRefine((o, ctx) => {
  if (o.discountType === "PERCENTAGE" && (o.discountValue > 90 || !Number.isInteger(o.discountValue))) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "A percentage offer must be a whole number up to 90." });
  if (o.discountType === "FIXED" && o.discountValue > 100_000) ctx.addIssue({ code: "custom", path: ["discountValue"], message: "That amount is too large." });
  if (o.endsOn < o.startsOn) ctx.addIssue({ code: "custom", path: ["endsOn"], message: "The offer cannot end before it starts." });
  else if (daysBetween(o.startsOn, o.endsOn) > MAX_OFFER_DAYS) ctx.addIssue({ code: "custom", path: ["endsOn"], message: `An offer can run for at most ${MAX_OFFER_DAYS} days.` });
});
export type OfferInput = z.infer<typeof offerSchema>;

export const isLive = (o: { status: string; startsOn: string; endsOn: string }, today = getTodayISTString()) => o.status === "ACTIVE" && o.startsOn <= today && today <= o.endsOn;

/** The price after an offer, or null if it cannot apply (no price, or the discount would take it to zero or below). */
export function offerPrice(price: number | null | undefined, o: { discountType: string; discountValue: number }): number | null {
  if (price === null || price === undefined || !(price > 0)) return null;
  const p = o.discountType === "PERCENTAGE" ? Math.round(price * (1 - o.discountValue / 100)) : Math.round(price - o.discountValue);
  return p > 0 && p < price ? p : null;
}

/** Offers that are on now, or about to be (not ended), and ACTIVE: they count against the plan's "live offers" limit. */
export async function countOpenOffers(scope: Scope, excludeId?: string) {
  const today = getTodayISTString();
  return Offer.countDocuments({ ownerType: scope.ownerType, ownerId: scope.ownerId, status: "ACTIVE", endsOn: { $gte: today }, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
}

/** Every service id must belong to this catalogue; the plan's limit on open offers is checked when an offer is (or becomes) ACTIVE and not ended. */
export async function checkOffer(scope: Scope, input: OfferInput, excludeId?: string) {
  const ids = [...new Set(input.serviceIds ?? [])];
  if (ids.some((i) => !mongoose.isValidObjectId(i))) throw new CatalogueError(400, "One of the chosen services is not valid.");
  if (ids.length) {
    const found = await BarberService.countDocuments({ _id: { $in: ids }, ownerType: scope.ownerType, ownerId: scope.ownerId });
    if (found !== ids.length) throw new CatalogueError(404, "One of the chosen services was not found in this catalogue.");
  }
  if ((input.status ?? "ACTIVE") === "ACTIVE" && input.endsOn >= getTodayISTString()) {
    const limits = await planFor(scope);
    if ((await countOpenOffers(scope, excludeId)) >= limits.maxActiveOffers) throw new CatalogueError(403, `Your plan allows ${limits.maxActiveOffers} live offer${limits.maxActiveOffers === 1 ? "" : "s"} at a time. Pause or delete one, or upgrade.`);
  }
  return ids;
}
export { addDaysStr };
