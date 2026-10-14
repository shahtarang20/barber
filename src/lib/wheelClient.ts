"use client";

import { catalogueApi, type CatalogueScope } from "@/lib/catalogueClient";

export interface WheelSegment { label: string; weight: number; rewardType: "NONE" | "FREE_SERVICE" | "PERCENTAGE" | "FIXED"; rewardValue: number }
export interface WheelConfig { enabled: boolean; segments: WheelSegment[]; cooldownDays: number; maxSpinsTotal: number; maxSpinsPerCustomer: number; rewardValidDays: number }
export interface WheelPayload { config: WheelConfig; plan: { wheelEnabled: number } }

export const getWheel = (scope: CatalogueScope) => catalogueApi<WheelPayload>("GET", "/api/barber/catalogue/wheel", scope);
export const saveWheel = (scope: CatalogueScope, body: Partial<WheelConfig>) => catalogueApi<WheelPayload>("PUT", "/api/barber/catalogue/wheel", scope, body);

export { catalogueApi, type CatalogueScope };
