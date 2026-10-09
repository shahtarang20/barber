import mongoose from "mongoose";
import { addDays, format } from "date-fns";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { Slot } from "@/models/Slot";
import { AppSetting } from "@/models/AppSetting";
import { getTodayISTString } from "@/lib/istTime";
import { parseDateOnly } from "@/lib/timeSort";

const KEY = "retention";
const CLEANABLE = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export interface RetentionConfig {
  enabled: boolean;
  months: number; // how long finished bookings are kept
  storageLimitMB: number; // the plan's storage, used for the warning
  lastRun?: { at: string; bookingsDeleted: number; slotsDeleted: number };
}
const DEFAULTS: RetentionConfig = { enabled: false, months: 6, storageLimitMB: 512 };

export async function getRetentionConfig(): Promise<RetentionConfig> {
  const doc = await AppSetting.findOne({ key: KEY }).lean<{ value: Partial<RetentionConfig> } | null>();
  return { ...DEFAULTS, ...(doc?.value || {}) };
}

export async function saveRetentionConfig(patch: Partial<RetentionConfig>) {
  const next = { ...(await getRetentionConfig()), ...patch };
  await AppSetting.findOneAndUpdate({ key: KEY }, { $set: { value: next } }, { upsert: true });
  return next;
}

/** Bookings dated before this "YYYY-MM-DD" are old enough to clean up. */
export function retentionCutoff(months: number): string {
  return format(addDays(parseDateOnly(getTodayISTString()), -Math.round(months * 30.4375)), "yyyy-MM-dd");
}

export const eligibleFilter = (months: number) => ({ status: { $in: CLEANABLE }, date: { $lt: retentionCutoff(months) } });

/**
 * Removes finished bookings (completed / cancelled / no-show) older than the configured age.
 * Upcoming and confirmed bookings are never touched. Completed visits are first added to a
 * small per-barber tally on the customer, so a customer's visit count and "last visited" date
 * survive. Does at most `maxBookings` per call; the daily job calls it every day.
 */
export async function runRetention(maxBookings = 20000) {
  const cfg = await getRetentionConfig();
  if (!cfg.enabled) return { skipped: "retention is switched off" as const };

  const filter = eligibleFilter(cfg.months);
  let bookingsDeleted = 0;

  while (bookingsDeleted < maxBookings) {
    const batch = await Booking.find(filter).select("barberId customerId status date").limit(2000).lean();
    if (batch.length === 0) break;

    const tally = new Map<string, { barberId: unknown; customerId: unknown; visits: number; last: string }>();
    for (const b of batch) {
      if (b.status !== "COMPLETED") continue;
      const k = `${b.customerId}|${b.barberId}`;
      const t = tally.get(k) || { barberId: b.barberId, customerId: b.customerId, visits: 0, last: "" };
      t.visits += 1;
      if (b.date > t.last) t.last = b.date;
      tally.set(k, t);
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // One read and one bulk write for the whole batch (not two sequential updates per customer, which on a remote
        // database took minutes per batch and could outlast both the transaction limit and the function's time limit).
        const custIds = [...new Set([...tally.values()].map((t) => String(t.customerId)))];
        const existing = custIds.length
          ? await Customer.find({ _id: { $in: custIds } }).select("barberStats").session(session).lean<{ _id: unknown; barberStats?: { barberId: unknown; visits?: number; lastVisit?: string }[] }[]>()
          : [];
        const statsOf = new Map(existing.map((c) => [String(c._id), (c.barberStats || []).map((x) => ({ barberId: x.barberId, visits: x.visits || 0, lastVisit: x.lastVisit }))]));
        const touched = new Set<string>();
        for (const t of tally.values()) {
          const cid = String(t.customerId);
          const list = statsOf.get(cid);
          if (!list) continue; // customer record is gone: nothing to credit
          const row = list.find((x) => String(x.barberId) === String(t.barberId));
          if (row) {
            row.visits += t.visits;
            if (!row.lastVisit || t.last > row.lastVisit) row.lastVisit = t.last;
          } else {
            list.push({ barberId: t.barberId, visits: t.visits, lastVisit: t.last });
          }
          touched.add(cid);
        }
        if (touched.size) {
          await Customer.bulkWrite([...touched].map((cid) => ({ updateOne: { filter: { _id: cid }, update: { $set: { barberStats: statsOf.get(cid) } } } })), { session, ordered: false });
        }
        await Booking.deleteMany({ _id: { $in: batch.map((b) => b._id) } }, { session });
      });
    } finally {
      await session.endSession();
    }
    bookingsDeleted += batch.length;
  }

  // Old schedule days are useless once their bookings are gone.
  const slotsDeleted = (await Slot.deleteMany({ date: { $lt: retentionCutoff(cfg.months) } })).deletedCount;

  const lastRun = { at: new Date().toISOString(), bookingsDeleted, slotsDeleted };
  await saveRetentionConfig({ lastRun });
  return { bookingsDeleted, slotsDeleted, more: bookingsDeleted >= maxBookings };
}

/** Database size in MB (data + indexes), or null if the database won't say. */
export async function databaseSizeMB(): Promise<number | null> {
  try {
    const stats = await mongoose.connection.db!.command({ dbStats: 1, scale: 1024 * 1024 });
    return Math.round(((stats.dataSize || 0) + (stats.indexSize || 0)) * 10) / 10;
  } catch {
    return null;
  }
}
