import { AppSetting } from "@/models/AppSetting";
import { User } from "@/models/User";
import { getTodayISTString } from "@/lib/istTime";

export type Tier = "FREE" | "PREMIUM" | "BUSINESS";
/** What a plan allows. */
export interface PlanLimits {
  tier: Tier;
  maxCategories: number; maxServices: number; maxImagesPerService: number; maxVideosPerService: number;
  /** Total storage for uploaded pictures and videos, in megabytes. */
  maxMediaMB: number;
  /** Offers that can be live at the same time. */
  maxActiveOffers: number;
  /** Notifications an owner may send to opted-in customers in any 7 days (0 = none). */
  maxCampaignsPerWeek: number;
}
export type TierLimits = Omit<PlanLimits, "tier">;

export const DEFAULT_TIER_LIMITS: Record<Tier, TierLimits> = {
  FREE: { maxCategories: 3, maxServices: 10, maxImagesPerService: 2, maxVideosPerService: 0, maxMediaMB: 25, maxActiveOffers: 1, maxCampaignsPerWeek: 0 },
  PREMIUM: { maxCategories: 15, maxServices: 100, maxImagesPerService: 6, maxVideosPerService: 1, maxMediaMB: 500, maxActiveOffers: 10, maxCampaignsPerWeek: 2 },
  BUSINESS: { maxCategories: 100, maxServices: 500, maxImagesPerService: 10, maxVideosPerService: 3, maxMediaMB: 2000, maxActiveOffers: 50, maxCampaignsPerWeek: 5 },
};
export const LIMIT_BOUNDS: Record<keyof TierLimits, number> = { maxCategories: 1000, maxServices: 5000, maxImagesPerService: 30, maxVideosPerService: 10, maxMediaMB: 100_000, maxActiveOffers: 500, maxCampaignsPerWeek: 21 };

/** Everything the admin can tune about plans, stored as one setting. */
export interface PlansConfig {
  /** Monthly amount (₹) from which a barber counts as Business. */
  businessFromAmount: number;
  /** Days after the plan ends during which the paid features keep working. */
  graceDays: number;
  tiers: Record<Tier, TierLimits>;
}
export const DEFAULT_PLANS_CONFIG: PlansConfig = { businessFromAmount: 1500, graceDays: 7, tiers: DEFAULT_TIER_LIMITS };
const KEY = "plans-config";
export const REMINDER_DAYS = 3;

let cache: { at: number; value: PlansConfig } | null = null;

/** Defaults overlaid with whatever the admin saved; every number is re-checked so a bad stored value can never break the app. */
function merge(stored: Partial<PlansConfig> | null | undefined): PlansConfig {
  const tiers = {} as Record<Tier, TierLimits>;
  for (const t of ["FREE", "PREMIUM", "BUSINESS"] as Tier[]) {
    const row = { ...DEFAULT_TIER_LIMITS[t] };
    for (const k of Object.keys(row) as (keyof TierLimits)[]) {
      const v = stored?.tiers?.[t]?.[k];
      if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= LIMIT_BOUNDS[k]) row[k] = v;
    }
    tiers[t] = row;
  }
  const g = stored?.graceDays, b = stored?.businessFromAmount;
  return {
    businessFromAmount: typeof b === "number" && Number.isInteger(b) && b > 0 ? b : DEFAULT_PLANS_CONFIG.businessFromAmount,
    graceDays: typeof g === "number" && Number.isInteger(g) && g >= 0 && g <= 60 ? g : DEFAULT_PLANS_CONFIG.graceDays,
    tiers,
  };
}

export async function getPlansConfig(): Promise<PlansConfig> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const row = await AppSetting.findOne({ key: KEY }).lean<{ value?: Partial<PlansConfig> } | null>();
  const value = merge(row?.value);
  cache = { at: Date.now(), value };
  return value;
}

export async function savePlansConfig(input: { businessFromAmount?: number; graceDays?: number; tiers?: Partial<Record<Tier, TierLimits>> }): Promise<PlansConfig> {
  const current = await getPlansConfig();
  const next = merge({ ...current, ...input, tiers: { ...current.tiers, ...(input.tiers || {}) } as Record<Tier, TierLimits> });
  await AppSetting.updateOne({ key: KEY }, { $set: { value: next } }, { upsert: true });
  cache = { at: Date.now(), value: next };
  return next;
}
export const resetPlansConfigCache = () => { cache = null; };

export function tierFor(amount: number | undefined, cfg: PlansConfig): Tier {
  const a = Number(amount) || 0;
  return a >= cfg.businessFromAmount ? "BUSINESS" : a > 0 ? "PREMIUM" : "FREE";
}

// ---- IST date maths on "YYYY-MM-DD" strings (no time zones involved) ----
const toUtc = (d: string) => { const [y, m, day] = d.split("-").map(Number); return Date.UTC(y, m - 1, day); };
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDaysStr = (d: string, n: number) => fmt(toUtc(d) + n * 86_400_000);
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
/** Same day-of-month `n` months later; 31 Jan + 1 month = 28/29 Feb, never a spill into March. */
export function addMonthsStr(d: string, n: number): string {
  const [y, m, day] = d.split("-").map(Number);
  const total = m - 1 + n;
  const ny = y + Math.floor(total / 12), nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fmt(Date.UTC(ny, nm, Math.min(day, last)));
}
/** The next date (today included) that falls on `day` of the month, clamped to the month's length. */
export function nextDueDate(today: string, day: number): string {
  const [y, m] = today.split("-").map(Number);
  for (let i = 0; i < 2; i++) {
    const last = new Date(Date.UTC(y, m - 1 + i + 1, 0)).getUTCDate();
    const cand = fmt(Date.UTC(y, m - 1 + i, Math.min(day, last)));
    if (cand >= today) return cand;
  }
  return today;
}

export type PlanStatus = "FREE" | "ACTIVE" | "GRACE" | "EXPIRED";
export interface SubscriptionState {
  status: PlanStatus;
  /** What the barber pays for. */
  paidTier: Tier;
  /** What is in force right now: the paid tier while ACTIVE/GRACE, FREE otherwise. */
  tier: Tier;
  amount: number;
  /** Last covered day, and the last day of the grace period (IST dates). */
  endsOn: string | null;
  graceEndsOn: string | null;
  /** Days until the plan ends (negative once it has ended). */
  daysLeft: number | null;
  /** True when no payment is recorded yet and the end date is just the monthly due day. */
  estimated: boolean;
  /** Show renewal reminders: the last 3 days, the grace period, and after expiry. */
  reminder: boolean;
  /** True when the tier in force comes from free access given by the admin (and `endsOn` is when that access ends). */
  granted: boolean;
}

export interface PlanUser { premiumAmount?: number; premiumDueDay?: number; planEndsOn?: string; grantedTier?: string; grantedUntil?: string }

/**
 * Where a barber stands. A paid plan with no recorded payment yet keeps the old behaviour (renews on the monthly due day,
 * never expires) so nobody is cut off before the admin starts recording payments.
 */
export function subscriptionState(u: PlanUser, cfg: PlansConfig, today = getTodayISTString()): SubscriptionState {
  const paid = paidState(u, cfg, today);
  // Free access from the admin: applies when it is better than what the barber's own payments give right now.
  const gt = u.grantedTier === "PREMIUM" || u.grantedTier === "BUSINESS" ? u.grantedTier : null;
  if (gt && u.grantedUntil && u.grantedUntil >= today && RANK[gt] > RANK[paid.tier]) {
    const daysLeft = daysBetween(today, u.grantedUntil);
    return { ...paid, status: "ACTIVE", tier: gt, paidTier: RANK[gt] > RANK[paid.paidTier] ? gt : paid.paidTier, endsOn: u.grantedUntil, graceEndsOn: null, daysLeft, estimated: false, reminder: daysLeft <= REMINDER_DAYS, granted: true };
  }
  return paid;
}

const RANK: Record<Tier, number> = { FREE: 0, PREMIUM: 1, BUSINESS: 2 };

function paidState(u: PlanUser, cfg: PlansConfig, today: string): SubscriptionState {
  const amount = Number(u.premiumAmount) || 0;
  const paidTier = tierFor(amount, cfg);
  if (paidTier === "FREE") return { status: "FREE", paidTier, tier: "FREE", amount, endsOn: null, graceEndsOn: null, daysLeft: null, estimated: false, reminder: false, granted: false };
  const estimated = !u.planEndsOn;
  const endsOn = u.planEndsOn || nextDueDate(today, Number(u.premiumDueDay) || 28);
  const graceEndsOn = addDaysStr(endsOn, cfg.graceDays);
  const daysLeft = daysBetween(today, endsOn);
  const status: PlanStatus = today <= endsOn ? "ACTIVE" : today <= graceEndsOn ? "GRACE" : "EXPIRED";
  return { status, paidTier, tier: status === "EXPIRED" ? "FREE" : paidTier, amount, endsOn, graceEndsOn, daysLeft, estimated, reminder: status !== "ACTIVE" || daysLeft <= REMINDER_DAYS, granted: false };
}

export function limitsOf(tier: Tier, cfg: PlansConfig): PlanLimits {
  return { tier, ...cfg.tiers[tier] };
}

/** What the plan unlocks that is not a number: advanced analytics (Premium+) and staff permissions (Premium basic, Business full). */
export const analyticsLevel = (tier: Tier): "BASIC" | "ADVANCED" => (tier === "FREE" ? "BASIC" : "ADVANCED");
export const staffLevel = (tier: Tier): "NONE" | "BASIC" | "FULL" => (tier === "FREE" ? "NONE" : tier === "PREMIUM" ? "BASIC" : "FULL");

/** The limits in force for one user right now (expired plans fall back to Free; nothing is deleted). */
export async function effectivePlan(userId: string): Promise<{ limits: PlanLimits; state: SubscriptionState }> {
  const [u, cfg] = await Promise.all([
    User.findById(userId).select("premiumAmount premiumDueDay planEndsOn grantedTier grantedUntil").lean<PlanUser | null>(),
    getPlansConfig(),
  ]);
  const state = subscriptionState(u || {}, cfg);
  return { limits: limitsOf(state.tier, cfg), state };
}
