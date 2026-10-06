import { Offer } from "@/models/Offer";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { checkOffer, offerSchema } from "@/lib/offers";
import { planFor } from "@/lib/catalogue";
import { getTodayISTString } from "@/lib/istTime";

export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const [offers, plan] = await Promise.all([Offer.find({ ownerType: scope.ownerType, ownerId: scope.ownerId }).sort({ endsOn: -1, createdAt: -1 }).limit(200).lean(), planFor(scope)]);
    return ok({ offers, today: getTodayISTString(), maxActiveOffers: plan.maxActiveOffers });
  });
}

export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const parsed = offerSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const serviceIds = await checkOffer(scope, parsed.data);
    const offer = await Offer.create({ ...parsed.data, serviceIds, ownerType: scope.ownerType, ownerId: scope.ownerId });
    return ok(offer, 201);
  }, { write: true });
}
