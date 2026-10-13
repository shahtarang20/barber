import mongoose from "mongoose";
import { WheelConfig } from "@/models/WheelConfig";
import { WheelSpin } from "@/models/WheelSpin";
import { Reward } from "@/models/Reward";
import { getTodayISTString } from "@/lib/istTime";
import type { OwnerType } from "@/lib/catalogue";

export interface WheelSegment { label: string; weight: number; rewardType: "NONE" | "FREE_SERVICE" | "PERCENTAGE" | "FIXED"; rewardValue: number }
export interface WheelConfigShape { enabled: boolean; segments: WheelSegment[]; cooldownDays: number; rewardValidDays: number }

/** A sensible starter wheel, used as the default when the owner has not built one yet. */
const DEFAULT_SEGMENTS: WheelSegment[] = [
  { label: "10% off", weight: 30, rewardType: "PERCENTAGE", rewardValue: 10 },
  { label: "Try again", weight: 34, rewardType: "NONE", rewardValue: 0 },
  { label: "₹50 off", weight: 20, rewardType: "FIXED", rewardValue: 50 },
  { label: "Free beard trim", weight: 6, rewardType: "FREE_SERVICE", rewardValue: 0 },
  { label: "15% off", weight: 10, rewardType: "PERCENTAGE", rewardValue: 15 },
];
const DEFAULT_CONFIG: WheelConfigShape = { enabled: false, segments: DEFAULT_SEGMENTS, cooldownDays: 30, rewardValidDays: 30 };

function clampSegments(input: unknown): WheelSegment[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 8).map((s): WheelSegment => {
    const seg = (s || {}) as Partial<WheelSegment>;
    const rewardType = seg.rewardType === "FREE_SERVICE" || seg.rewardType === "PERCENTAGE" || seg.rewardType === "FIXED" ? seg.rewardType : "NONE";
    const num = (v: unknown, lo: number, hi: number, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
    return {
      label: typeof seg.label === "string" && seg.label.trim() ? seg.label.trim().slice(0, 40) : "Prize",
      weight: num(seg.weight, 0, 1000, 1),
      rewardType,
      rewardValue: rewardType === "PERCENTAGE" ? num(seg.rewardValue, 1, 100, 10) : rewardType === "FIXED" ? num(seg.rewardValue, 1, 100_000, 50) : 0,
    };
  }).filter((s) => s.weight > 0 || s.rewardType === "NONE");
}

export function clampWheelConfig(input: { enabled?: unknown; segments?: unknown; cooldownDays?: unknown; rewardValidDays?: unknown }): WheelConfigShape {
  const n = (v: unknown, lo: number, hi: number, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  const segments = clampSegments(input.segments);
  return {
    enabled: !!input.enabled,
    segments: segments.length ? segments : DEFAULT_SEGMENTS,
    cooldownDays: n(input.cooldownDays, 0, 365, 30),
    rewardValidDays: n(input.rewardValidDays, 0, 365, 30),
  };
}

export async function getWheelConfig(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId): Promise<WheelConfigShape> {
  const doc = await WheelConfig.findOne({ ownerType, ownerId }).lean<Partial<WheelConfigShape> | null>();
  return doc ? clampWheelConfig(doc) : { ...DEFAULT_CONFIG };
}

export async function saveWheelConfig(ownerType: OwnerType, ownerId: mongoose.Types.ObjectId, input: { enabled?: unknown; segments?: unknown; cooldownDays?: unknown; rewardValidDays?: unknown }): Promise<WheelConfigShape> {
  const cfg = clampWheelConfig(input);
  await WheelConfig.findOneAndUpdate({ ownerType, ownerId }, { $set: { ...cfg, ownerType, ownerId } }, { upsert: true, setDefaultsOnInsert: true });
  return cfg;
}

function rewardLabelFor(seg: WheelSegment): string {
  if (seg.label) return seg.label;
  if (seg.rewardType === "PERCENTAGE") return `${seg.rewardValue}% off`;
  if (seg.rewardType === "FIXED") return `₹${seg.rewardValue} off`;
  return "Free service";
}

function isoPlusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Weighted pick: returns the index of the chosen segment. Falls back to the last index if weights are degenerate. */
function drawIndex(segments: WheelSegment[]): number {
  const total = segments.reduce((a, s) => a + Math.max(0, s.weight), 0);
  if (total <= 0) return segments.length - 1;
  let r = Math.random() * total;
  for (let i = 0; i < segments.length; i++) { r -= Math.max(0, segments[i].weight); if (r < 0) return i; }
  return segments.length - 1;
}

export interface WheelDraw {
  segments: { label: string; win: boolean }[];
  winningIndex: number;
  won: boolean;
  rewardLabel: string | null;
}

/**
 * Decides this booking's spin ON THE SERVER: enforces the cooldown, picks a weighted segment, records the spin, and
 * (on a win) issues the Reward coupon. The returned shape lets the phone animate the wheel to the already-decided result.
 * Returns null when the wheel is off, empty, or the customer is still inside the cooldown. Never throws into the caller.
 */
export async function wheelForBooking(booking: { barberId: mongoose.Types.ObjectId | string; customerId: mongoose.Types.ObjectId | string; viaShopId?: mongoose.Types.ObjectId | string | null }): Promise<WheelDraw | null> {
  try {
    const ownerType: OwnerType = booking.viaShopId ? "SHOP" : "BARBER";
    const ownerId = new mongoose.Types.ObjectId(String(booking.viaShopId || booking.barberId));
    const customerId = new mongoose.Types.ObjectId(String(booking.customerId));

    const cfg = await getWheelConfig(ownerType, ownerId);
    if (!cfg.enabled || cfg.segments.length === 0) return null;

    const today = getTodayISTString();
    if (cfg.cooldownDays > 0) {
      const last = await WheelSpin.findOne({ ownerType, ownerId, customerId }).sort({ createdAt: -1 }).select("date").lean<{ date: string } | null>();
      // Still inside the cooldown window: no spin this time.
      if (last?.date && isoPlusDays(last.date, cfg.cooldownDays) > today) return null;
    }

    const winningIndex = drawIndex(cfg.segments);
    const seg = cfg.segments[winningIndex];
    const won = seg.rewardType !== "NONE";

    let rewardId: mongoose.Types.ObjectId | undefined;
    let rewardLabel: string | null = null;
    if (won) {
      const expiresOn = cfg.rewardValidDays > 0 ? isoPlusDays(today, cfg.rewardValidDays) : "";
      rewardLabel = rewardLabelFor(seg);
      const reward = await Reward.create({ ownerType, ownerId, customerId, source: "WHEEL", rewardType: seg.rewardType, value: seg.rewardValue, label: rewardLabel, expiresOn });
      rewardId = reward._id as mongoose.Types.ObjectId;
    }
    await WheelSpin.create({ ownerType, ownerId, customerId, date: today, segmentLabel: seg.label, won, rewardId });

    return {
      segments: cfg.segments.map((s) => ({ label: s.label, win: s.rewardType !== "NONE" })),
      winningIndex,
      won,
      rewardLabel,
    };
  } catch (e) {
    console.error("wheelForBooking failed", e);
    return null;
  }
}
