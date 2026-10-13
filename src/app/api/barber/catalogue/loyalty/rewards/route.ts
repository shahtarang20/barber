import mongoose from "mongoose";
import { z } from "zod";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { redeemReward } from "@/lib/loyalty";
import { Reward } from "@/models/Reward";
import { Customer } from "@/models/Customer";

interface RewardRow { _id: mongoose.Types.ObjectId; customerId: mongoose.Types.ObjectId; label: string; status: string; createdAt: Date }

/** The owner's "coupons issued vs redeemed" list: the newest 100 rewards for this catalogue, each with its customer's name and phone. */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const rows = await Reward.find({ ownerType: scope.ownerType, ownerId: scope.ownerId, status: { $in: ["ACTIVE", "REDEEMED"] } })
      .select("customerId label status createdAt").sort({ createdAt: -1 }).limit(100).lean<RewardRow[]>();
    // One lookup for every customer on the page, then stitched back by id, so the list stays a single extra query.
    const customers = await Customer.find({ _id: { $in: rows.map((r) => r.customerId) } }).select("name phone").lean<{ _id: mongoose.Types.ObjectId; name: string; phone: string }[]>();
    const byId = new Map(customers.map((c) => [String(c._id), c]));
    const rewards = rows.map((r) => {
      const c = byId.get(String(r.customerId));
      return { id: String(r._id), customerName: c?.name || "", customerPhone: c?.phone || "", label: r.label, status: r.status, createdAt: r.createdAt };
    });
    return ok({ rewards });
  });
}

const schema = z.object({ rewardId: z.string() });

export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const done = await redeemReward(scope.ownerType, scope.ownerId, parsed.data.rewardId, userId);
    if (!done) return fail("This reward was already redeemed or not found.");
    return ok({ redeemed: true });
  }, { write: true, ownerOrFullOnly: true });
}
