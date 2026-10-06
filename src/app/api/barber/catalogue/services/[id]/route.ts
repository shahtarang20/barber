import { BarberService } from "@/models/BarberService";
import { fail, isId, ok, ownerRoute } from "@/lib/catalogueApi";
import { validateServiceInput, type ServiceData } from "@/lib/catalogueService";
import { planFor } from "@/lib/catalogue";
import { notifyBarber } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

/** A service is only ever reachable inside the signed-in barber's own catalogue (his, or his shop's if he owns it). */
const mine = (scope: { ownerType: string; ownerId: unknown }, id: string) => ({ _id: id, ownerType: scope.ownerType, ownerId: scope.ownerId });

export async function GET(req: Request, { params }: Params) {
  return ownerRoute(req, async ({ scope }) => {
    const { id } = await params;
    if (!isId(id)) return fail("Service not found", 404);
    const service = await BarberService.findOne(mine(scope, id)).lean();
    return service ? ok(service) : fail("Service not found", 404);
  });
}

/** Partial update: only the fields sent change; the result is validated as a whole (limits, prices, ownership). */
export async function PATCH(req: Request, { params }: Params) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const { id } = await params;
    if (!isId(id)) return fail("Service not found", 404);
    const existing = await BarberService.findOne(mine(scope, id)).lean<Record<string, unknown> & { categoryId: unknown; barberIds?: unknown[] } | null>();
    if (!existing) return fail("Service not found", 404);

    const current = {
      name: existing.name, categoryId: String(existing.categoryId), description: existing.description, images: existing.images, videos: existing.videos,
      durationMinutes: existing.durationMinutes, priceType: existing.priceType, price: existing.price, originalPrice: existing.originalPrice,
      discountType: existing.discountType, discountValue: existing.discountValue, barberIds: (existing.barberIds || []).map(String),
      isFeatured: existing.isFeatured, isPopular: existing.isPopular, isNew: existing.isNew, isPremium: existing.isPremium, status: existing.status,
    } as Partial<ServiceData>;

    const checked = await validateServiceInput(await req.json().catch(() => ({})), scope, current);
    if (!checked.ok) return fail(checked.message, checked.status);

    // Publishing a draft counts against the plan.
    if (checked.data.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      const plan = await planFor(scope);
      const published = await BarberService.countDocuments({ ownerType: scope.ownerType, ownerId: scope.ownerId, status: "PUBLISHED" });
      if (published >= plan.maxServices) return fail(`Your ${plan.tier.toLowerCase()} plan allows ${plan.maxServices} published services. Unpublish another one or upgrade.`, 403);
    }

    // $unset what the owner cleared (for example a discount) instead of leaving a stale value behind.
    const unset: Record<string, 1> = {};
    for (const key of ["price", "originalPrice", "discountType", "discountValue", "description"] as const) {
      if (checked.data[key] === undefined || checked.data[key] === "") unset[key] = 1;
    }
    const set = { ...checked.data };
    for (const key of Object.keys(unset)) delete (set as Record<string, unknown>)[key];

    const saved = await BarberService.findOneAndUpdate(mine(scope, id), { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true }).lean();
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok(saved);
  }, { write: true });
}

/** Bookings keep their own copy (name, duration, price) of the service, so deleting is always safe for old records. */
export async function DELETE(req: Request, { params }: Params) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const { id } = await params;
    if (!isId(id)) return fail("Service not found", 404);
    const deleted = await BarberService.findOneAndDelete(mine(scope, id)).select("_id").lean();
    if (!deleted) return fail("Service not found", 404);
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok({ deleted: true });
  }, { write: true });
}
