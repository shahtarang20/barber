import mongoose from "mongoose";
import { CatalogueCategory } from "@/models/CatalogueCategory";
import { BarberService } from "@/models/BarberService";
import { CatalogueSettings } from "@/models/CatalogueSettings";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { effectivePlan } from "@/lib/plans";
import { Offer } from "@/models/Offer";
import { offerPrice } from "@/lib/offers";
import { getTodayISTString } from "@/lib/istTime";
import { discountLabel, finalPrice, type OwnerType } from "@/lib/catalogue";
import { MediaAsset } from "@/models/MediaAsset";
import { resolveTemplate, type TemplateId } from "@/lib/catalogueTemplate";

/** What a customer is allowed to see of one service. Never contains owner ids, drafts or internal fields. */
export interface PublicService {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  images: string[];
  /** 480px thumbnail of the first picture (cards use this; "" = none known, use the picture itself). */
  thumb: string;
  videos: string[];
  durationMinutes: number;
  priceType: "FIXED_PRICE" | "STARTING_FROM" | "ASK_SHOP";
  price: number | null;
  originalPrice: number | null;
  finalPrice: number | null;
  discountLabel: string | null;
  /** The discount as numbers, so each language can word it. */
  discount: { type: "PERCENTAGE" | "FIXED"; value: number } | null;
  badges: { featured: boolean; popular: boolean; isNew: boolean; premium: boolean };
  /** Barbers who perform it (a shop catalogue). Empty = any barber. */
  barberIds: string[];
  /** The live offer that gives this price, if one is better than the service's own discount. */
  offer: { id: string; title: string; endsOn: string } | null;
}

export interface PublicCategory { id: string; name: string; slug: string; description: string; coverUrl: string; services: PublicService[] }

export interface PublicOffer { id: string; title: string; description: string; endsOn: string; discount: { type: "PERCENTAGE" | "FIXED"; value: number }; allServices: boolean }

export interface PublicCatalogue {
  /** True only when the owner switched it on, the admin allows it, and at least one published service exists. */
  available: boolean;
  /** Customer page style 1-5 (stored, else a stable hash of the owner id). Always present, even when the catalogue is off. */
  template: TemplateId;
  branding: { name: string; logoUrl: string; coverUrl: string; intro: string; address: string; mapUrl: string; phone: string; whatsapp: string; instagram: string; facebook: string; accent: string; layout: string; imageRatio: string };
  categories: PublicCategory[];
  /** Offers that are on today (shown as a strip above the services). */
  offers: PublicOffer[];
}

const EMPTY_BRANDING = { logoUrl: "", coverUrl: "", intro: "", address: "", mapUrl: "", phone: "", whatsapp: "", instagram: "", facebook: "", accent: "indigo", layout: "grid", imageRatio: "portrait" };

type Lean = Record<string, unknown> & { _id: mongoose.Types.ObjectId };

const toPublicService = (s: Lean): PublicService => {
  const priced = { priceType: String(s.priceType), price: s.price as number | undefined, originalPrice: s.originalPrice as number | undefined, discountType: s.discountType as string | undefined, discountValue: s.discountValue as number | undefined };
  return {
    id: String(s._id),
    categoryId: String(s.categoryId),
    name: String(s.name),
    description: (s.description as string) || "",
    images: (s.images as string[]) || [],
    thumb: "",
    videos: (s.videos as string[]) || [],
    durationMinutes: Number(s.durationMinutes),
    priceType: s.priceType as PublicService["priceType"],
    price: priced.priceType === "ASK_SHOP" || priced.price === undefined ? null : Number(priced.price),
    originalPrice: priced.originalPrice === undefined ? null : Number(priced.originalPrice),
    finalPrice: finalPrice(priced),
    discountLabel: discountLabel(priced),
    discount: priced.discountType && priced.discountValue && priced.priceType !== "ASK_SHOP" ? { type: priced.discountType as "PERCENTAGE" | "FIXED", value: Number(priced.discountValue) } : null,
    badges: { featured: !!s.isFeatured, popular: !!s.isPopular, isNew: !!s.isNew, premium: !!s.isPremium },
    barberIds: ((s.barberIds as mongoose.Types.ObjectId[]) || []).map(String),
    offer: null,
  };
};

/** A live offer replaces the price when it beats the service's own discount. Prices that cannot be discounted (ask the shop) are left alone. */
function applyOffers(service: PublicService, offers: Lean[]): PublicService {
  if (service.priceType === "ASK_SHOP" || service.price === null) return service;
  let best: { price: number; offer: Lean } | null = null;
  for (const o of offers) {
    const ids = ((o.serviceIds as mongoose.Types.ObjectId[]) || []).map(String);
    if (ids.length > 0 && !ids.includes(service.id)) continue;
    const p = offerPrice(service.price, { discountType: String(o.discountType), discountValue: Number(o.discountValue) });
    if (p !== null && p < (service.finalPrice ?? service.price) && (!best || p < best.price)) best = { price: p, offer: o };
  }
  if (!best) return service;
  const type = String(best.offer.discountType) as "PERCENTAGE" | "FIXED", value = Number(best.offer.discountValue);
  return { ...service, finalPrice: best.price, discount: { type, value }, discountLabel: type === "PERCENTAGE" ? `${value}% off` : `₹${value} off`, offer: { id: String(best.offer._id), title: String(best.offer.title), endsOn: String(best.offer.endsOn) } };
}

/** The user whose plan and admin switch govern this catalogue: the barber himself, or the shop's owner. */
async function governingUserId(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId): Promise<string | null> {
  if (ownerType === "BARBER") return String(ownerId);
  const shop = await Shop.findById(ownerId).select("ownerId isActive").lean<{ ownerId: mongoose.Types.ObjectId; isActive?: boolean } | null>();
  return shop && shop.isActive !== false ? String(shop.ownerId) : null;
}

/** The published catalogue of one barber or one shop, as customers see it. */
export async function loadPublicCatalogue(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, displayName: string): Promise<PublicCatalogue> {
  const unavailable: PublicCatalogue = { available: false, template: resolveTemplate(undefined, ownerId), branding: { name: displayName, ...EMPTY_BRANDING }, categories: [], offers: [] };
  const governing = await governingUserId(ownerType, ownerId);
  if (!governing) return unavailable;

  const [settings, owner] = await Promise.all([
    CatalogueSettings.findOne({ ownerType, ownerId }).lean<Lean | null>(),
    User.findById(governing).select("isActive catalogueEnabled").lean<{ isActive?: boolean; catalogueEnabled?: boolean } | null>(),
  ]);
  const template = resolveTemplate(settings?.template, ownerId);
  unavailable.template = template;
  const branding = { name: displayName, ...EMPTY_BRANDING, ...Object.fromEntries(Object.entries(settings || {}).filter(([k, v]) => k in EMPTY_BRANDING && typeof v === "string")) } as PublicCatalogue["branding"];
  if (!settings?.enabled || !owner || owner.isActive === false || owner.catalogueEnabled === false) return { ...unavailable, branding };

  const today = getTodayISTString();
  const [allCategories, allServices, { limits }, liveOffers] = await Promise.all([
    CatalogueCategory.find({ ownerType, ownerId, isPublished: true }).sort({ displayOrder: 1, createdAt: 1 }).lean<Lean[]>(),
    BarberService.find({ ownerType, ownerId, status: "PUBLISHED" }).sort({ displayOrder: 1, createdAt: 1 }).lean<Lean[]>(),
    effectivePlan(governing),
    Offer.find({ ownerType, ownerId, status: "ACTIVE", startsOn: { $lte: today }, endsOn: { $gte: today } }).sort({ endsOn: 1 }).limit(20).lean<Lean[]>(),
  ]);
  // After a plan ends (and its grace period) only what the Free plan allows is shown. Nothing is deleted: renewing brings it all back.
  const categories = allCategories.slice(0, limits.maxCategories);
  const inShown = new Set(categories.map((c) => String(c._id)));
  const services = allServices.filter((s) => inShown.has(String(s.categoryId))).slice(0, limits.maxServices)
    .map((s) => ({ ...s, images: ((s.images as string[]) || []).slice(0, limits.maxImagesPerService), videos: ((s.videos as string[]) || []).slice(0, limits.maxVideosPerService) } as Lean));
  const byCategory = new Map<string, PublicService[]>();
  for (const s of services) {
    const key = String(s.categoryId);
    byCategory.set(key, [...(byCategory.get(key) || []), applyOffers(toPublicService(s), liveOffers)]);
  }
  const shown: PublicCategory[] = categories
    .map((c) => ({ id: String(c._id), name: String(c.name), slug: String(c.slug), description: (c.description as string) || "", coverUrl: (c.coverUrl as string) || "", services: byCategory.get(String(c._id)) || [] }))
    .filter((c) => c.services.length > 0); // an empty category is not shown to customers
  const offers: PublicOffer[] = liveOffers.map((o) => ({ id: String(o._id), title: String(o.title), description: (o.description as string) || "", endsOn: String(o.endsOn), discount: { type: o.discountType as "PERCENTAGE" | "FIXED", value: Number(o.discountValue) }, allServices: ((o.serviceIds as unknown[]) || []).length === 0 }));
  // Cards use the 480px thumbnail of each service's first picture (looked up by the owner's index, matched in memory).
  const firstImages = new Set(shown.flatMap((c) => c.services.map((s) => s.images[0])).filter(Boolean));
  if (firstImages.size > 0) {
    const assets = await MediaAsset.find({ ownerType, ownerId, kind: "IMAGE" }).select("url thumbUrl").lean<{ url: string; thumbUrl?: string }[]>();
    const thumbOf = new Map(assets.filter((a) => a.thumbUrl && firstImages.has(a.url)).map((a) => [a.url, a.thumbUrl as string]));
    for (const c of shown) for (const s of c.services) s.thumb = thumbOf.get(s.images[0]) || "";
  }
  return { available: shown.length > 0, template, branding, categories: shown, offers };
}

export interface ServiceSnapshot { serviceId: mongoose.Types.ObjectId; name: string; durationMinutes: number; price: number | null }

/**
 * The service a customer picked, checked at the moment of booking: it must still be published, in a published category,
 * belong to THIS barber's catalogue (or the shop he is booked through, and be one he performs), and the catalogue must be on.
 * Returns the copy that is saved with the booking, or null if it is no longer valid.
 */
export async function loadServiceForBooking(serviceId: string, barberId: unknown, shopId?: unknown): Promise<ServiceSnapshot | null> {
  if (!mongoose.isValidObjectId(serviceId)) return null;
  const service = await BarberService.findOne({ _id: serviceId, status: "PUBLISHED" }).lean<Lean | null>();
  if (!service) return null;

  const ownerType = service.ownerType as OwnerType;
  const ownerId = service.ownerId as mongoose.Types.ObjectId;
  if (ownerType === "BARBER") { if (String(ownerId) !== String(barberId)) return null; }
  else {
    if (!shopId || String(ownerId) !== String(shopId)) return null;
    const performers = ((service.barberIds as mongoose.Types.ObjectId[]) || []).map(String);
    if (performers.length > 0 && !performers.includes(String(barberId))) return null;
  }

  // Same rules as the public page (published category, catalogue on, admin switch, plan limits), so a hidden service cannot be booked by id.
  const shown = (await loadPublicCatalogue(ownerType, ownerId, "")).categories.flatMap((c) => c.services).find((x) => x.id === String(service._id));
  if (!shown) return null;

  return { serviceId: service._id, name: String(service.name), durationMinutes: Number(service.durationMinutes), price: shown.finalPrice };
}
