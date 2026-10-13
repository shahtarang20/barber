"use client";

import { catalogueApi, type CatalogueScope } from "@/lib/catalogueClient";

/** The punch-card settings the owner form reads and writes (mirrors LoyaltyConfig on the server). */
export interface LoyaltyConfig {
  enabled: boolean;
  stampsNeeded: number;
  rewardType: "FREE_SERVICE" | "PERCENTAGE" | "FIXED";
  rewardValue: number;
  rewardLabel: string;
  rewardValidDays: number;
}
export interface LoyaltyPayload { config: LoyaltyConfig; plan: { loyaltyEnabled: number } }
/** One issued coupon, as the owner's rewards list shows it. */
export interface LoyaltyReward { id: string; customerName: string; customerPhone: string; label: string; status: "ACTIVE" | "REDEEMED" | "EXPIRED"; createdAt: string }

/** Load the loyalty settings and whether the plan allows the card. */
export const getLoyalty = (scope: CatalogueScope) => catalogueApi<LoyaltyPayload>("GET", "/api/barber/catalogue/loyalty", scope);
/** Save the loyalty settings (the server clamps every value). */
export const saveLoyalty = (scope: CatalogueScope, body: Partial<LoyaltyConfig>) => catalogueApi<LoyaltyPayload>("PUT", "/api/barber/catalogue/loyalty", scope, body);
/** The newest issued coupons for this catalogue. */
export const listLoyaltyRewards = (scope: CatalogueScope) => catalogueApi<{ rewards: LoyaltyReward[] }>("GET", "/api/barber/catalogue/loyalty/rewards", scope);
/** Mark one coupon redeemed at the counter. */
export const redeemLoyaltyReward = (scope: CatalogueScope, rewardId: string) => catalogueApi<{ redeemed: boolean }>("POST", "/api/barber/catalogue/loyalty/rewards", scope, { rewardId });

export { catalogueApi, type CatalogueScope };
