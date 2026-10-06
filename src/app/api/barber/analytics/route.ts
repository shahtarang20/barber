import mongoose from "mongoose";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { RANGES, loadAnalytics, type Range } from "@/lib/analytics";
import { analyticsLevel, effectivePlan } from "@/lib/plans";
import { Shop } from "@/models/Shop";

export const maxDuration = 30;

/** Booking and revenue numbers for the barber (`?scope=me`) or, for the shop owner / allowed staff, the whole shop (`?scope=shop`). */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope, userId, url }) => {
    const range = Number(url.searchParams.get("range") || 30) as Range;
    if (!RANGES.includes(range)) return fail("Choose 7, 30 or 90 days.");
    const { limits } = await effectivePlan(scope.ownerUserId);
    let barberIds: mongoose.Types.ObjectId[] = [new mongoose.Types.ObjectId(userId)];
    if (scope.ownerType === "SHOP") {
      const shop = await Shop.findById(scope.ownerId).select("barberIds").lean<{ barberIds: mongoose.Types.ObjectId[] } | null>();
      barberIds = shop?.barberIds ?? [];
    }
    return ok(await loadAnalytics(barberIds, range, analyticsLevel(limits.tier)));
  }, { need: "analytics" });
}
