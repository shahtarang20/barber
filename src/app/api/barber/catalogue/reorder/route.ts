import { z } from "zod";
import { CatalogueCategory } from "@/models/CatalogueCategory";
import { BarberService } from "@/models/BarberService";
import { fail, isId, ok, ownerRoute } from "@/lib/catalogueApi";
import { notifyBarber } from "@/lib/realtime";

const schema = z.object({
  type: z.enum(["category", "service"]),
  // The new order, first to last. Every id must belong to the signed-in barber's catalogue.
  ids: z.array(z.string()).min(1).max(500),
});

/** Saves a drag-or-arrow reordering of categories or services in one request. */
export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { type, ids } = parsed.data;
    if (!ids.every(isId) || new Set(ids).size !== ids.length) return fail("The list contains an invalid or repeated item.");

    const Model = type === "category" ? CatalogueCategory : BarberService;
    const owner = { ownerType: scope.ownerType, ownerId: scope.ownerId };
    // Ownership: refuse the whole request if even one id is not in this catalogue.
    const found = await Model.countDocuments({ ...owner, _id: { $in: ids } });
    if (found !== ids.length) return fail("Some items were not found in your catalogue.", 404);

    await Model.bulkWrite(ids.map((id, index) => ({ updateOne: { filter: { _id: id, ...owner }, update: { $set: { displayOrder: index } } } })));
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok({ reordered: ids.length });
  }, { write: true });
}
