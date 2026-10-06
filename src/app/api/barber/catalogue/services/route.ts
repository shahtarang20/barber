import { BarberService } from "@/models/BarberService";
import { fail, isId, ok, ownerRoute } from "@/lib/catalogueApi";
import { validateServiceInput } from "@/lib/catalogueService";
import { planFor } from "@/lib/catalogue";
import { notifyBarber } from "@/lib/realtime";

export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope, url }) => {
    const categoryId = url.searchParams.get("categoryId");
    const filter: Record<string, unknown> = { ownerType: scope.ownerType, ownerId: scope.ownerId };
    if (categoryId) { if (!isId(categoryId)) return fail("Category not found", 404); filter.categoryId = categoryId; }
    return ok(await BarberService.find(filter).sort({ displayOrder: 1, createdAt: 1 }).lean());
  });
}

export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const checked = await validateServiceInput(await req.json().catch(() => ({})), scope);
    if (!checked.ok) return fail(checked.message, checked.status);
    const d = checked.data;
    const mine = { ownerType: scope.ownerType, ownerId: scope.ownerId };
    const plan = await planFor(scope);
    if (d.status === "PUBLISHED") {
      const published = await BarberService.countDocuments({ ...mine, status: "PUBLISHED" });
      if (published >= plan.maxServices) return fail(`Your ${plan.tier.toLowerCase()} plan allows ${plan.maxServices} published services. Save this one as a draft or upgrade.`, 403);
    }
    const last = await BarberService.findOne({ ...mine, categoryId: d.categoryId }).sort({ displayOrder: -1 }).select("displayOrder").lean<{ displayOrder: number } | null>();
    const created = await BarberService.create({ ...mine, ...d, displayOrder: (last?.displayOrder ?? -1) + 1 });
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok(created, 201);
  }, { write: true });
}
