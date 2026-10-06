import { z } from "zod";
import { CatalogueCategory } from "@/models/CatalogueCategory";
import { BarberService } from "@/models/BarberService";
import { safeUrl, slugify } from "@/lib/catalogue";
import { fail, isId, ok, ownerRoute } from "@/lib/catalogueApi";
import { notifyBarber } from "@/lib/realtime";

const schema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  description: z.string().trim().max(300).optional(),
  coverUrl: z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const { id } = await params;
    if (!isId(id)) return fail("Category not found", 404);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const d = parsed.data;
    const filter = { _id: id, ownerType: scope.ownerType, ownerId: scope.ownerId }; // ownership: only inside MY catalogue
    const cat = await CatalogueCategory.findOne(filter);
    if (!cat) return fail("Category not found", 404);
    if (d.name && d.name !== cat.name) {
      const base = slugify(d.name);
      let slug = base, n = 1;
      while (await CatalogueCategory.exists({ ownerType: scope.ownerType, ownerId: scope.ownerId, slug, _id: { $ne: cat._id } })) slug = `${base}-${++n}`;
      cat.name = d.name; cat.slug = slug;
    }
    if (d.description !== undefined) cat.description = d.description;
    if (d.coverUrl !== undefined) {
      if (d.coverUrl === "") cat.coverUrl = "";
      else { const u = safeUrl(d.coverUrl); if (!u) return fail("The cover picture must be a normal web address starting with https://"); cat.coverUrl = u; }
    }
    if (d.isPublished !== undefined) cat.isPublished = d.isPublished;
    await cat.save();
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok(cat);
  }, { write: true });
}

/**
 * Deleting a category that still has services needs a decision: move them to another category (?moveTo=<id>),
 * otherwise nothing is deleted. To just hide a category, unpublish it instead.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return ownerRoute(req, async ({ scope, userId, url }) => {
    const { id } = await params;
    if (!isId(id)) return fail("Category not found", 404);
    const mine = { ownerType: scope.ownerType, ownerId: scope.ownerId };
    const cat = await CatalogueCategory.findOne({ _id: id, ...mine });
    if (!cat) return fail("Category not found", 404);
    const inside = await BarberService.countDocuments({ ...mine, categoryId: cat._id });
    if (inside > 0) {
      const moveTo = url.searchParams.get("moveTo");
      if (!moveTo || !isId(moveTo) || moveTo === id) return fail(`This category has ${inside} service${inside === 1 ? "" : "s"}. Choose another category to move them to, or unpublish the category instead.`, 409);
      const target = await CatalogueCategory.findOne({ _id: moveTo, ...mine }).select("_id");
      if (!target) return fail("The category to move services into was not found.", 404);
      await BarberService.updateMany({ ...mine, categoryId: cat._id }, { $set: { categoryId: target._id } });
    }
    await cat.deleteOne();
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok({ deleted: true, moved: inside });
  }, { write: true });
}
