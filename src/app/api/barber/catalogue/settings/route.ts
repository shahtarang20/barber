import { z } from "zod";
import { CatalogueSettings } from "@/models/CatalogueSettings";
import { CatalogueCategory } from "@/models/CatalogueCategory";
import { BarberService } from "@/models/BarberService";
import { planFor, safeUrl } from "@/lib/catalogue";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { notifyBarber } from "@/lib/realtime";

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
    const [settings, plan, categories, services] = await Promise.all([
      CatalogueSettings.findOne({ ownerType: scope.ownerType, ownerId: scope.ownerId }).lean(),
      planFor(scope),
      CatalogueCategory.countDocuments({ ownerType: scope.ownerType, ownerId: scope.ownerId }),
      BarberService.countDocuments({ ownerType: scope.ownerType, ownerId: scope.ownerId, status: "PUBLISHED" }),
    ]);
    return ok({ settings: settings || { enabled: false, accent: "indigo" }, plan, usage: { categories, publishedServices: services }, scope: scope.ownerType });
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
    if (d.enabled !== undefined) set.enabled = d.enabled;
    const saved = await CatalogueSettings.findOneAndUpdate({ ownerType: scope.ownerType, ownerId: scope.ownerId }, { $set: set, $setOnInsert: { ownerType: scope.ownerType, ownerId: scope.ownerId } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    notifyBarber(userId, "CATALOGUE_UPDATED");
    return ok({ settings: saved });
  }, { write: true, ownerOrFullOnly: true });
}
