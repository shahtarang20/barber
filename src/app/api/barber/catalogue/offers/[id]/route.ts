import { Offer } from "@/models/Offer";
import { fail, isId, ok, ownerRoute } from "@/lib/catalogueApi";
import { checkOffer, offerSchema } from "@/lib/offers";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ownerRoute(req, async ({ scope }) => {
    if (!isId(id)) return fail("Invalid offer.");
    const parsed = offerSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const mine = { _id: id, ownerType: scope.ownerType, ownerId: scope.ownerId };
    if (!(await Offer.exists(mine))) return fail("Offer not found.", 404);
    const serviceIds = await checkOffer(scope, parsed.data, id);
    const saved = await Offer.findOneAndUpdate(mine, { $set: { ...parsed.data, serviceIds } }, { new: true }).lean();
    return ok(saved);
  }, { write: true, ownerOrFullOnly: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ownerRoute(req, async ({ scope }) => {
    if (!isId(id)) return fail("Invalid offer.");
    const gone = await Offer.findOneAndDelete({ _id: id, ownerType: scope.ownerType, ownerId: scope.ownerId });
    return gone ? ok({ deleted: true }) : fail("Offer not found.", 404);
  }, { write: true, ownerOrFullOnly: true });
}
