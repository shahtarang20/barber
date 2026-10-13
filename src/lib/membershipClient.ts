"use client";

import { catalogueApi, type CatalogueScope } from "@/lib/catalogueClient";

/** One membership plan the owner creates and sells (mirrors MembershipPlanView on the server). */
export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  includedVisits: number; // 0 = unlimited for the window
  serviceIds: string[]; // empty = all services
  active: boolean;
}
export interface MembershipPlansPayload { plans: MembershipPlan[]; plan: { membershipEnabled: number } }

/** The fields the owner sends when creating / editing a plan. */
export type MembershipPlanInput = Omit<MembershipPlan, "id">;

/** One sold membership, as the owner's members list shows it. */
export interface Member {
  id: string;
  customerName: string;
  customerPhone: string;
  planName: string;
  remainingVisits: number; // -1 = unlimited
  startsOn: string;
  expiresOn: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  paymentMode: "CASH" | "UPI" | "OTHER";
}

/** Load the membership plans and whether the plan allows memberships. */
export const getMembershipPlans = (scope: CatalogueScope) => catalogueApi<MembershipPlansPayload>("GET", "/api/barber/catalogue/membership", scope);
/** Create a membership plan (the server clamps every value). */
export const createMembershipPlan = (scope: CatalogueScope, body: Partial<MembershipPlanInput>) => catalogueApi<{ plan: MembershipPlan }>("POST", "/api/barber/catalogue/membership", scope, body);
/** Update (or deactivate, via `active:false`) a membership plan. */
export const updateMembershipPlan = (scope: CatalogueScope, id: string, body: Partial<MembershipPlanInput>) => catalogueApi<{ plan: MembershipPlan }>("PUT", "/api/barber/catalogue/membership", scope, { id, ...body });

/** The owner's current members (active + recently expired). */
export const listMembers = (scope: CatalogueScope) => catalogueApi<{ members: Member[] }>("GET", "/api/barber/catalogue/membership/members", scope);
/** Sell a membership: the server resolves / creates the customer by phone + name. */
export const sellMembership = (scope: CatalogueScope, body: { planId: string; customerName: string; customerPhone?: string; paymentMode?: "CASH" | "UPI" | "OTHER" }) => catalogueApi<{ member: Member }>("POST", "/api/barber/catalogue/membership/members", scope, body);

export { catalogueApi, type CatalogueScope };
