import { z } from "zod";
import { CatalogueCategory } from "@/models/CatalogueCategory";
import { planFor, safeUrl, slugify } from "@/lib/catalogue";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { notifyBarber } from "@/lib/realtime";

const schema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 letters").max(60),
  description: z.string().trim().max(300).optional(),
  coverUrl: z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
});

export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => ok(await CatalogueCategory.find({ ownerType: scope.ownerType, ownerId: scope.ownerId }).sort({ displayOrder: 1, createdAt: 1 }).lean()));
}

export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const d = parsed.data;
    const plan = await planFor(scope);
    const filter = { ownerType: scope.ownerType, ownerId: scope.ownerId };
    const count = await CatalogueCategory.countDocuments(filter);
    if (count >= plan.maxCategories) return fail(`Your ${plan.tier.toLowerCase()} plan allows ${plan.maxCategories} categories. Upgrade to add more.`, 403);
    let coverUrl: string | undefined;
    if (d.coverUrl) { coverUrl = safeUrl(d.coverUrl) || undefined; if (!coverUrl) return fail("The cover picture must be a normal web address starting with https://"); }
    const base = slugify(d.name);
    let slug = base, n = 1;
    while (await CatalogueCategory.exists({ ...filter, slug })) slug = `${base}-${++n}`;
    const last = await CatalogueCategory.findOne(filter).sort({ displayOrder: -1 }).select("displayOrder").lean<{ displayOrder: number } | null>();
    let created;
    try {
      created = await CatalogueCategory.create({ ...filter, name: d.name, slug, description: d.description, coverUrl, isPublished: d.isPublished ?? true, displayOrder: (last?.displayOrder ?? -1) + 1 });
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return fail("A category with this name already exists.", 409);
      throw e;
    }
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok(created, 201);
  }, { write: true });
}
