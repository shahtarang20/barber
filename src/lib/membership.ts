import mongoose from "mongoose";
import { MembershipPlan } from "@/models/MembershipPlan";
import { Membership } from "@/models/Membership";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { getTodayISTString } from "@/lib/istTime";
import { normalizePhone } from "@/lib/phone";
import type { OwnerType, Scope } from "@/lib/catalogue";

/**
 * MEMBERSHIPS — manual-payment packages (no payment gateway). An owner creates plans; a member is sold a plan at the
 * counter (CASH / UPI / OTHER). A membership covers bookings for a window of days and (optionally) a limited number of
 * visits. Memberships are keyed on `customerId` so a shared family phone never merges two members.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * BOOKING-FLOW INTEGRATION (the hooks the booking route calls — nothing else in the booking flow needs to change):
 *
 *   1. BEFORE taking payment / showing the price, ask whether the customer's membership covers this service:
 *        const cover = await coverBookingWithMembership(ownerType, ownerId, customerId, serviceId, today);
 *        // cover.covered === true  → the visit is free for the customer; show cover.planName, skip the charge.
 *      coverBookingWithMembership NEVER decrements and NEVER throws (returns { covered: false } on any error), so it is
 *      safe to call unconditionally for every owner — it simply returns { covered: false } when no membership applies.
 *
 *   2. AFTER the booking is actually COMPLETED (not merely created), spend one visit:
 *        if (cover.covered && cover.membershipId) await consumeMembershipVisit(cover.membershipId);
 *      consumeMembershipVisit is atomic (only decrements when remainingVisits > 0), leaves unlimited (-1) alone, and
 *      never throws — a membership hiccup must not fail completing a booking.
 *
 *   `ownerType`/`ownerId` are the booking's owner scope (a shop booking → "SHOP" + viaShopId, else "BARBER" + barberId),
 *   exactly as loyalty's awardStampForBooking resolves them. `today` is getTodayISTString().
 * ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

export interface MembershipPlanInput {
  name: string;
  price: number;
  durationDays: number;
  includedVisits: number;
  serviceIds: string[];
  active: boolean;
}

/** The plan shape the owner UI reads (ids as strings). */
export interface MembershipPlanView {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  includedVisits: number;
  serviceIds: string[];
  active: boolean;
}

/** One member row the owner list shows. */
export interface MemberView {
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

export type PaymentMode = "CASH" | "UPI" | "OTHER";

const n = (v: unknown, lo: number, hi: number, d: number) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d;
};

function clampInput(input: Partial<MembershipPlanInput>): MembershipPlanInput {
  const serviceIds = Array.isArray(input.serviceIds)
    ? input.serviceIds.filter((s) => mongoose.isValidObjectId(s)).slice(0, 200).map(String)
    : [];
  return {
    name: typeof input.name === "string" ? input.name.trim().slice(0, 60) : "",
    price: n(input.price, 1, 1_000_000, 1),
    durationDays: n(input.durationDays, 1, 3650, 30),
    includedVisits: n(input.includedVisits, 0, 1000, 0),
    serviceIds,
    active: input.active === undefined ? true : !!input.active,
  };
}

function toPlanView(doc: { _id: mongoose.Types.ObjectId; name: string; price: number; durationDays: number; includedVisits: number; serviceIds?: mongoose.Types.ObjectId[]; active: boolean }): MembershipPlanView {
  return {
    id: String(doc._id),
    name: doc.name,
    price: doc.price,
    durationDays: doc.durationDays,
    includedVisits: doc.includedVisits,
    serviceIds: (doc.serviceIds || []).map(String),
    active: doc.active,
  };
}

/** YYYY-MM-DD plus n days (IST dates are date-only, so plain date arithmetic — no timezone math). */
function isoPlusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every plan for this owner, newest first. */
export async function listPlans(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId): Promise<MembershipPlanView[]> {
  const docs = await MembershipPlan.find({ ownerType, ownerId }).sort({ createdAt: -1 }).lean<Parameters<typeof toPlanView>[0][]>();
  return docs.map(toPlanView);
}

export async function createPlan(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, input: Partial<MembershipPlanInput>): Promise<MembershipPlanView> {
  const cfg = clampInput(input);
  const doc = await MembershipPlan.create({ ...cfg, ownerType, ownerId });
  return toPlanView(doc.toObject());
}

/** Update one plan, scoped so an owner can only touch his own plans. */
export async function updatePlan(planId: string, scope: { ownerType: OwnerType; ownerId: mongoose.Types.ObjectId }, input: Partial<MembershipPlanInput>): Promise<MembershipPlanView | null> {
  if (!mongoose.isValidObjectId(planId)) return null;
  const cfg = clampInput(input);
  const doc = await MembershipPlan.findOneAndUpdate(
    { _id: planId, ownerType: scope.ownerType, ownerId: scope.ownerId },
    { $set: cfg },
    { new: true }
  ).lean<Parameters<typeof toPlanView>[0] | null>();
  return doc ? toPlanView(doc) : null;
}

/** Stop a plan being sold again (its sold memberships keep running). */
export async function deactivatePlan(planId: string, scope: { ownerType: OwnerType; ownerId: mongoose.Types.ObjectId }): Promise<boolean> {
  if (!mongoose.isValidObjectId(planId)) return false;
  const res = await MembershipPlan.updateOne({ _id: planId, ownerType: scope.ownerType, ownerId: scope.ownerId }, { $set: { active: false } });
  return res.modifiedCount === 1;
}

/**
 * Find or create the Customer a membership is being sold to, by phone + name. Mirrors createConfirmedBooking: an exact,
 * case-insensitive match via collation (never a RegExp from user input); a shared number + different name is a different
 * family member. With no phone the customer belongs to this barber alone (shop sales require a phone).
 */
export async function resolveMemberCustomer(scope: Scope, name: string, phone: string): Promise<mongoose.Types.ObjectId | null> {
  const cleanName = (name || "").trim();
  if (!cleanName) return null;
  const normalizedPhone = normalizePhone(phone || "");
  const noPhone = normalizedPhone === "";
  // Without a phone we can only safely own the customer under a BARBER scope (a user id); a shop sale needs a phone.
  if (noPhone && scope.ownerType !== "BARBER") return null;
  const ownerScope = noPhone ? { ownerBarberId: scope.ownerId } : {};
  let customer = await Customer.findOne({ phone: normalizedPhone, name: cleanName, ...ownerScope }).collation({ locale: "en", strength: 2 });
  if (!customer) customer = await new Customer({ name: cleanName, phone: normalizedPhone, ...ownerScope }).save();
  return customer._id as mongoose.Types.ObjectId;
}

/**
 * Sell a plan to a customer: snapshots the plan name, sets the window (today + durationDays) and the visit budget
 * (0 included visits = unlimited, stored as -1). Returns the new membership. Throws if the plan is missing / inactive.
 */
export async function sellMembership(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, customerId: mongoose.Types.ObjectId | string, planId: string, paymentMode: PaymentMode, soldBy: string): Promise<MemberView> {
  if (!mongoose.isValidObjectId(planId)) throw new Error("Unknown plan.");
  const plan = await MembershipPlan.findOne({ _id: planId, ownerType, ownerId, active: true }).lean<{ _id: mongoose.Types.ObjectId; name: string; durationDays: number; includedVisits: number } | null>();
  if (!plan) throw new Error("That plan is no longer available.");

  const today = getTodayISTString();
  const expiresOn = isoPlusDays(today, plan.durationDays);
  const remainingVisits = plan.includedVisits === 0 ? -1 : plan.includedVisits;

  const doc = await Membership.create({
    ownerType,
    ownerId,
    customerId: new mongoose.Types.ObjectId(String(customerId)),
    planId: plan._id,
    planNameSnapshot: plan.name,
    startsOn: today,
    expiresOn,
    remainingVisits,
    status: "ACTIVE",
    paymentMode,
    soldBy: mongoose.isValidObjectId(soldBy) ? new mongoose.Types.ObjectId(soldBy) : undefined,
  });

  const cust = await Customer.findById(customerId).select("name phone").lean<{ name: string; phone: string } | null>();
  return {
    id: String(doc._id),
    customerName: cust?.name || "",
    customerPhone: cust?.phone || "",
    planName: doc.planNameSnapshot,
    remainingVisits: doc.remainingVisits,
    startsOn: doc.startsOn,
    expiresOn: doc.expiresOn,
    status: doc.status,
    paymentMode: doc.paymentMode,
  };
}

interface MemberRow {
  _id: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  planNameSnapshot: string;
  remainingVisits: number;
  startsOn: string;
  expiresOn: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  paymentMode: "CASH" | "UPI" | "OTHER";
}

/** The owner's member list: active and recently-expired memberships, newest first, each with the customer's name + phone. */
export async function listMembers(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId): Promise<MemberView[]> {
  const rows = await Membership.find({ ownerType, ownerId, status: { $in: ["ACTIVE", "EXPIRED"] } })
    .select("customerId planNameSnapshot remainingVisits startsOn expiresOn status paymentMode")
    .sort({ createdAt: -1 }).limit(100).lean<MemberRow[]>();
  // One lookup for every customer on the page, then stitched back by id (single extra query, like the rewards route).
  const customers = await Customer.find({ _id: { $in: rows.map((r) => r.customerId) } }).select("name phone").lean<{ _id: mongoose.Types.ObjectId; name: string; phone: string }[]>();
  const byId = new Map(customers.map((c) => [String(c._id), c]));
  return rows.map((r) => {
    const c = byId.get(String(r.customerId));
    return {
      id: String(r._id),
      customerName: c?.name || "",
      customerPhone: c?.phone || "",
      planName: r.planNameSnapshot,
      remainingVisits: r.remainingVisits,
      startsOn: r.startsOn,
      expiresOn: r.expiresOn,
      status: r.status,
      paymentMode: r.paymentMode,
    };
  });
}

interface ActiveMembership {
  _id: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planNameSnapshot: string;
  remainingVisits: number;
  expiresOn: string;
}

/**
 * The customer's current usable membership (ACTIVE, not past its expiry), or null. The booking flow calls this. Newest
 * first so the most recently sold membership wins when a customer somehow holds more than one.
 */
export async function activeMembershipForCustomer(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, customerId: mongoose.Types.ObjectId | string, today: string): Promise<ActiveMembership | null> {
  if (!mongoose.isValidObjectId(String(customerId))) return null;
  return Membership.findOne({ ownerType, ownerId, customerId: new mongoose.Types.ObjectId(String(customerId)), status: "ACTIVE", expiresOn: { $gte: today } })
    .sort({ createdAt: -1 })
    .select("planId planNameSnapshot remainingVisits expiresOn")
    .lean<ActiveMembership | null>();
}

/**
 * Atomically spend one visit: only decrements when remainingVisits > 0, so it can never go negative and two same-moment
 * completes can't double-spend. An unlimited membership (-1) is left untouched. Never throws.
 */
export async function consumeMembershipVisit(membershipId: string): Promise<void> {
  try {
    if (!mongoose.isValidObjectId(membershipId)) return;
    await Membership.updateOne({ _id: membershipId, remainingVisits: { $gt: 0 } }, { $inc: { remainingVisits: -1 } });
  } catch (e) {
    console.error("consumeMembershipVisit failed", e);
  }
}

/**
 * BOOKING HOOK. Does this customer hold a membership that covers `serviceId` right now? Covered when there is an active,
 * non-expired membership whose plan either covers all services (empty serviceIds) or lists this one, AND that still has
 * visits left (remainingVisits !== 0; -1 = unlimited). Does NOT decrement — call consumeMembershipVisit after the booking
 * is COMPLETED. Never throws: returns { covered: false } on any error, so it is safe to call for every owner.
 */
export async function coverBookingWithMembership(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, customerId: mongoose.Types.ObjectId | string, serviceId: mongoose.Types.ObjectId | string | null | undefined, today: string): Promise<{ covered: boolean; membershipId?: string; planName?: string; remaining?: number }> {
  try {
    const m = await activeMembershipForCustomer(ownerType, ownerId, customerId, today);
    if (!m) return { covered: false };
    const unlimited = m.remainingVisits === -1;
    // Count the visits already promised to this member's still-open bookings, so "visits left" subtracts what is in flight,
    // not only what has been completed. This stops several bookings from each claiming the same remaining visit.
    const openCovered = unlimited ? 0 : await Booking.countDocuments({ coveredByMembershipId: m._id, status: "CONFIRMED" });
    if (!unlimited && m.remainingVisits <= openCovered) return { covered: false }; // every remaining visit is already spoken for
    // The plan must cover this service: empty serviceIds = all services, otherwise the service must be listed.
    const plan = await MembershipPlan.findById(m.planId).select("serviceIds").lean<{ serviceIds?: mongoose.Types.ObjectId[] } | null>();
    const list = plan?.serviceIds || [];
    const covers = list.length === 0 || (!!serviceId && list.some((s) => String(s) === String(serviceId)));
    if (!covers) return { covered: false };
    // Visits left for the customer AFTER this booking (−1 = unlimited), for the "covered" banner.
    const remaining = unlimited ? -1 : Math.max(0, m.remainingVisits - openCovered - 1);
    return { covered: true, membershipId: String(m._id), planName: m.planNameSnapshot, remaining };
  } catch (e) {
    console.error("coverBookingWithMembership failed", e);
    return { covered: false };
  }
}
