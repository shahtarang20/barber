import { z } from "zod";
import { CatalogueSettings } from "@/models/CatalogueSettings";
import { CatalogueCategory } from "@/models/CatalogueCategory";
import { BarberService } from "@/models/BarberService";
import { autoEnableCatalogue, planFor, safeUrl } from "@/lib/catalogue";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { notifyBarber } from "@/lib/realtime";
import { loadPublicCatalogue } from "@/lib/cataloguePublic";

// A field that is not sent stays undefined (and is left alone); sending "" clears it. Never turn "missing" into "".
const urlOrEmpty = z.string().max(500).optional().transform((v) => (v === undefined ? undefined : v.trim()));
const schema = z.object({
  enabled: z.boolean().optional(),
  logoUrl: urlOrEmpty, coverUrl: urlOrEmpty, mapUrl: urlOrEmpty, instagram: urlOrEmpty, facebook: urlOrEmpty,
  intro: z.string().max(400).optional(), address: z.string().max(200).optional(),
  phone: z.string().max(20).optional(), whatsapp: z.string().max(20).optional(),
  accent: z.enum(["indigo", "emerald", "rose", "amber", "sky", "zinc"]).optional(),
  layout: z.enum(["grid", "list"]).optional(),
  imageRatio: z.enum(["portrait", "square", "wide"]).optional(),
});

/** The catalogue's on/off switch and branding, plus what the plan allows and how much is used. */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const mine = { ownerType: scope.ownerType, ownerId: scope.ownerId };
    const [plan, categories, services, publishedCategoryIds] = await Promise.all([
      planFor(scope),
      CatalogueCategory.countDocuments(mine),
      BarberService.countDocuments({ ...mine, status: "PUBLISHED" }),
      BarberService.distinct("categoryId", { ...mine, status: "PUBLISHED" }),
    ]);
    // An owner who already published services before this switch existed (and never touched it) would see nothing on the customer page: turn it on once.
    if (services > 0) await autoEnableCatalogue(scope);
    const settings = await CatalogueSettings.findOne(mine).lean<{ enabled?: boolean } | null>();
    const visibleCategories = publishedCategoryIds.length ? await CatalogueCategory.countDocuments({ ...mine, _id: { $in: publishedCategoryIds }, isPublished: true }) : 0;
    // Ask the very same loader customers use, so what the owner is told is what customers really get.
    const live = await loadPublicCatalogue(scope.ownerType, scope.ownerId, "");
    const shownServices = live.categories.reduce((n, c) => n + c.services.length, 0);
    const visibility = !settings?.enabled ? "SWITCH_OFF" : services === 0 ? "NO_PUBLISHED_SERVICE" : visibleCategories === 0 ? "NO_PUBLISHED_CATEGORY" : !live.available ? "PLAN_LIMIT" : shownServices < services ? "PARTIAL" : "LIVE";
    return ok({ settings: settings ? { ...settings } : { enabled: false, accent: "indigo" }, plan, usage: { categories, publishedServices: services, shownServices }, visibility, scope: scope.ownerType });
  });
}

export async function PUT(req: Request) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const d = parsed.data;
    const set: Record<string, unknown> = {};
    for (const k of ["logoUrl", "coverUrl", "mapUrl", "instagram", "facebook"] as const) {
      if (d[k] === undefined) continue;
      if (d[k] === "") set[k] = "";
      else { const u = safeUrl(d[k]); if (!u) return fail("Pictures and links must be normal web addresses starting with https://"); set[k] = u; }
    }
    for (const k of ["intro", "address", "phone", "whatsapp", "accent", "layout", "imageRatio"] as const) if (d[k] !== undefined) set[k] = typeof d[k] === "string" ? (d[k] as string).trim() : d[k];
    if (d.enabled !== undefined) { set.enabled = d.enabled; set.enabledByOwner = true; }
    const saved = await CatalogueSettings.findOneAndUpdate({ ownerType: scope.ownerType, ownerId: scope.ownerId }, { $set: set, $setOnInsert: { ownerType: scope.ownerType, ownerId: scope.ownerId } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok({ settings: saved });
  }, { write: true, ownerOrFullOnly: true });
}
