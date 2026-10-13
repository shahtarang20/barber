"use client";

import { catalogueApi, type CatalogueScope } from "@/lib/catalogueClient";

/** The birthday-greeting settings the owner form reads and writes (mirrors AutoOfferConfig on the server). */
export interface AutoOfferConfig {
  birthdayEnabled: boolean;
  birthdayMessage: string;
  birthdayOfferId: string;
}
export interface BirthdayPayload { config: AutoOfferConfig; plan: { autoOffersPerWeek: number } }

/** Load the birthday settings and how many auto-offers a week the plan allows. */
export const getBirthday = (scope: CatalogueScope) => catalogueApi<BirthdayPayload>("GET", "/api/barber/catalogue/birthday", scope);
/** Save the birthday settings (the server clamps every value). */
export const saveBirthday = (scope: CatalogueScope, body: Partial<AutoOfferConfig>) => catalogueApi<BirthdayPayload>("PUT", "/api/barber/catalogue/birthday", scope, body);

export { catalogueApi, type CatalogueScope };
