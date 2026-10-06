"use client";

import useSWR from "swr";

/** Which catalogue the owner is editing: his own, or (shop owners only) the shop-wide one. */
export type CatalogueScope = "me" | "shop";

export interface CategoryDoc { _id: string; name: string; slug: string; description?: string; coverUrl?: string; displayOrder: number; isPublished: boolean }
export interface ServiceDoc {
  _id: string; categoryId: string; name: string; description?: string; images: string[]; videos: string[]; durationMinutes: number;
  priceType: "FIXED_PRICE" | "STARTING_FROM" | "ASK_SHOP"; price?: number; originalPrice?: number; discountType?: "PERCENTAGE" | "FIXED"; discountValue?: number;
  barberIds: string[]; isFeatured: boolean; isPopular: boolean; isNew: boolean; isPremium: boolean; status: "DRAFT" | "PUBLISHED"; displayOrder: number;
}
export interface SettingsDoc {
  enabled: boolean; logoUrl?: string; coverUrl?: string; intro?: string; address?: string; mapUrl?: string; phone?: string; whatsapp?: string;
  instagram?: string; facebook?: string; accent: "indigo" | "emerald" | "rose" | "amber" | "sky" | "zinc";
  layout?: "grid" | "list"; imageRatio?: "portrait" | "square" | "wide";
}
export interface PlanInfo { tier: "FREE" | "PREMIUM" | "BUSINESS"; maxCategories: number; maxServices: number; maxImagesPerService: number; maxVideosPerService: number; maxMediaMB: number; maxActiveOffers: number; maxCampaignsPerWeek: number }
export interface SettingsPayload { settings: SettingsDoc; plan: PlanInfo; usage: { categories: number; publishedServices: number }; scope: "BARBER" | "SHOP" }

export const withScope = (path: string, scope: CatalogueScope) => `${path}${path.includes("?") ? "&" : "?"}scope=${scope}`;

/** Calls an owner endpoint and returns its data; a failed call throws an Error carrying the server's plain-language message. */
export async function catalogueApi<T = unknown>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, scope: CatalogueScope, body?: unknown): Promise<T> {
  const res = await fetch(withScope(path, scope), { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message || "Something went wrong. Please try again.");
  return json.data as T;
}

const fetcher = (url: string) => fetch(url).then(async (r) => {
  const json = await r.json().catch(() => null);
  if (!r.ok || !json?.success) throw new Error(json?.error?.message || "Could not load");
  return json.data;
});

/** The owner's categories, services and settings for one catalogue, with refresh helpers. */
export function useOwnerCatalogue(scope: CatalogueScope) {
  const categories = useSWR<CategoryDoc[]>(withScope("/api/barber/catalogue/categories", scope), fetcher);
  const services = useSWR<ServiceDoc[]>(withScope("/api/barber/catalogue/services", scope), fetcher);
  const settings = useSWR<SettingsPayload>(withScope("/api/barber/catalogue/settings", scope), fetcher);
  const refresh = () => Promise.all([categories.mutate(), services.mutate(), settings.mutate()]);
  return { categories, services, settings, refresh, loading: categories.isLoading || services.isLoading || settings.isLoading };
}

export interface ShopInfo {
  _id: string; name: string; slug: string; isOwner: boolean; members: { _id: string; name: string }[];
  /** What the signed-in barber may do with the shop catalogue / numbers (owner: everything). */
  myAccess?: { catalogue: boolean; analytics: boolean; level: "OWNER" | "NONE" | "BASIC" | "FULL" };
  /** Owner only: what each other barber was allowed, and what the plan allows. */
  staff?: { userId: string; catalogue: boolean; analytics: boolean }[];
  staffLevel?: "NONE" | "BASIC" | "FULL";
}
export interface OfferDoc { _id: string; title: string; description?: string; discountType: "PERCENTAGE" | "FIXED"; discountValue: number; serviceIds: string[]; startsOn: string; endsOn: string; status: "ACTIVE" | "PAUSED" }

/** Is the signed-in barber the owner of a shop (so he may also edit the shop-wide catalogue), and who are its members? */
export function useShopOwnership() {
  const { data } = useSWR<{ success: boolean; data: ShopInfo | null }>("/api/barber/shop", (u: string) => fetch(u).then((r) => r.json()));
  const shop = data?.success ? data.data : null;
  // "isShopOwner" kept for the existing pages: true for the owner and for staff the owner allowed to edit the shop catalogue.
  return { isShopOwner: !!shop?.isOwner, canManageShop: !!(shop?.isOwner || shop?.myAccess?.catalogue), canViewShopNumbers: !!(shop?.isOwner || shop?.myAccess?.analytics), shop };
}

/** The barber's own booking-page address part ("raju-cutz"), for his catalogue link. */
export function useMySlug() {
  const { data } = useSWR<{ success: boolean; data: { slug?: string; name?: string } }>("/api/barber/profile", (u: string) => fetch(u).then((r) => r.json()));
  return data?.success ? data.data : null;
}
