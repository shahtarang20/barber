import { z } from "zod";
import mongoose from "mongoose";
import { CatalogueCategory } from "@/models/CatalogueCategory";
import { Shop } from "@/models/Shop";
import { planFor, safeUrl, type Scope } from "@/lib/catalogue";

const base = z.object({
  name: z.string().trim().min(2, "Service name must be at least 2 letters").max(80),
  categoryId: z.string().refine((v) => mongoose.isValidObjectId(v), "Choose a category"),
  description: z.string().trim().max(500).optional(),
  images: z.array(z.string()).max(20).optional(),
  videos: z.array(z.string()).max(10).optional(),
  durationMinutes: z.number({ error: "Enter the duration in minutes." }).int("Duration must be a whole number of minutes").min(5, "Duration must be at least 5 minutes").max(600, "Duration can be at most 600 minutes"),
  priceType: z.enum(["FIXED_PRICE", "STARTING_FROM", "ASK_SHOP"]).default("FIXED_PRICE"),
  price: z.number({ error: "Enter the price as a number." }).min(0, "The price cannot be negative.").max(1_000_000, "That price is too high.").optional(),
  originalPrice: z.number({ error: "Enter the original price as a number." }).min(0, "The original price cannot be negative.").max(1_000_000, "That price is too high.").optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number({ error: "Enter the discount as a number." }).min(0, "The discount cannot be negative.").max(1_000_000, "That discount is too high.").optional(),
  barberIds: z.array(z.string()).max(50).optional(),
  isFeatured: z.boolean().optional(), isPopular: z.boolean().optional(), isNew: z.boolean().optional(), isPremium: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
});
export const serviceCreateSchema = base;
export const servicePatchSchema = base.partial();
export type ServiceData = z.infer<typeof base>;

type Checked = { ok: true; data: ServiceData & { barberIds: string[]; images: string[]; videos: string[] } } | { ok: false; message: string; status: number };

/** Checks a service coming from the owner: shape, prices and discount, picture/video limits of the plan, category ownership, who performs it. */
export async function validateServiceInput(raw: unknown, scope: Scope, partialOf?: Partial<ServiceData>): Promise<Checked> {
  const parsed = (partialOf ? base.partial() : base).safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message, status: 400 };
  // A field that was not sent keeps its stored value (a missing key must never wipe it).
  const sent = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  const d = { ...(partialOf || {}), ...sent } as ServiceData;
  if (!d.name || !d.categoryId || d.durationMinutes === undefined) return { ok: false, message: "Name, category and duration are required.", status: 400 };

  const plan = await planFor(scope);
  const images: string[] = [];
  for (const i of d.images || []) { const u = safeUrl(i); if (!u) return { ok: false, message: "Pictures must be normal web addresses starting with https://", status: 400 }; images.push(u); }
  const videos: string[] = [];
  for (const v of d.videos || []) { const u = safeUrl(v); if (!u) return { ok: false, message: "Videos must be normal web addresses starting with https://", status: 400 }; videos.push(u); }
  if (images.length > plan.maxImagesPerService) return { ok: false, message: `Your ${plan.tier.toLowerCase()} plan allows ${plan.maxImagesPerService} pictures per service.`, status: 403 };
  if (videos.length > plan.maxVideosPerService) return { ok: false, message: plan.maxVideosPerService === 0 ? "Videos are not included in your plan. Upgrade to add one." : `Your ${plan.tier.toLowerCase()} plan allows ${plan.maxVideosPerService} video per service.`, status: 403 };

  if (d.priceType === "ASK_SHOP") { d.price = undefined; d.originalPrice = undefined; d.discountType = undefined; d.discountValue = undefined; }
  else if (d.price === undefined) return { ok: false, message: "Enter a price (or choose 'Ask shop').", status: 400 };
  if (d.discountType && !d.discountValue) { d.discountType = undefined; d.discountValue = undefined; }
  if (d.discountValue && d.price !== undefined) {
    if (d.discountType === "PERCENTAGE" && (d.discountValue < 1 || d.discountValue > 90)) return { ok: false, message: "A percentage discount must be between 1% and 90%.", status: 400 };
    if (d.discountType === "FIXED" && d.discountValue >= d.price) return { ok: false, message: "A fixed discount must be smaller than the price.", status: 400 };
    if (!d.discountType) return { ok: false, message: "Choose a discount type.", status: 400 };
  }
  if (d.originalPrice !== undefined && d.price !== undefined && d.originalPrice < d.price) return { ok: false, message: "The original price cannot be lower than the price.", status: 400 };

  // The category must be in THIS catalogue (never another barber's).
  const cat = await CatalogueCategory.findOne({ _id: d.categoryId, ownerType: scope.ownerType, ownerId: scope.ownerId }).select("_id").lean();
  if (!cat) return { ok: false, message: "That category was not found in your catalogue.", status: 404 };

  // Who performs it: a shop catalogue may name its barbers; a personal one is always just this barber.
  let barberIds: string[] = [];
  if (scope.ownerType === "SHOP" && d.barberIds?.length) {
    const shop = await Shop.findById(scope.ownerId).select("barberIds").lean<{ barberIds: mongoose.Types.ObjectId[] } | null>();
    const members = new Set((shop?.barberIds || []).map(String));
    if (!d.barberIds.every((b) => members.has(b))) return { ok: false, message: "Only barbers of this shop can be chosen.", status: 400 };
    barberIds = d.barberIds;
  }
  return { ok: true, data: { ...d, images, videos, barberIds } };
}
