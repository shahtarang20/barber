import { cache } from "react";
import type mongoose from "mongoose";
import { CatalogueSettings } from "@/models/CatalogueSettings";
import { resolveTemplate, type TemplateId } from "@/lib/catalogueTemplate";
import type { OwnerType } from "@/lib/catalogue";

/** The owner's picture / contact branding as the page header needs it on the very first paint. */
export interface PageBranding { logoUrl: string; coverUrl: string; intro: string; address: string; mapUrl: string; phone: string; whatsapp: string; instagram: string; facebook: string }
export interface PageStyle { template: TemplateId; /** the owner switched the catalogue on (the public API still has the last word) */ enabled: boolean; branding: PageBranding }

const FIELDS = ["logoUrl", "coverUrl", "intro", "address", "mapUrl", "phone", "whatsapp", "instagram", "facebook"] as const;

/**
 * Style number and header branding of one owner, for a server layout: one small read of the settings record (indexed),
 * shared within a request. With it the header (cover, logo, intro) and the Book / Catalogue switch are in the first HTML,
 * so nothing jumps when the catalogue data arrives.
 */
export const loadPageStyle = cache(async (ownerType: OwnerType, ownerId: string | mongoose.Types.ObjectId): Promise<PageStyle> => {
  const s = await CatalogueSettings.findOne({ ownerType, ownerId }).select(`template enabled ${FIELDS.join(" ")}`).lean<Record<string, unknown> | null>();
  const branding = Object.fromEntries(FIELDS.map((k) => [k, typeof s?.[k] === "string" ? (s[k] as string) : ""])) as unknown as PageBranding;
  return { template: resolveTemplate(s?.template, ownerId), enabled: !!s?.enabled, branding };
});
