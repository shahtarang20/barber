import mongoose from "mongoose";
import { Booking } from "@/models/Booking";
import { getTodayISTString } from "@/lib/istTime";
import { addDaysStr } from "@/lib/plans";

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export interface Analytics {
  range: Range; from: string; to: string;
  /** What this plan shows. Basic = counts only; Advanced = money, services, customers and busy times. */
  level: "BASIC" | "ADVANCED";
  totals: { bookings: number; completed: number; cancelled: number; noShows: number; upcoming: number; noShowRate: number | null };
  daily: { date: string; bookings: number }[];
  advanced?: {
    revenue: { total: number; bookingsWithPrice: number; completedWithoutPrice: number };
    topServices: { name: string; bookings: number; completed: number; revenue: number }[];
    customers: { unique: number; returning: number; new: number };
    peakHours: { hour: number; bookings: number }[];
    weekdays: { day: number; bookings: number }[];
  };
}

/**
 * Numbers for a set of barbers over the last 7 / 30 / 90 days (IST dates, today included). Revenue counts only COMPLETED
 * visits that had a catalogue service with a price (the price saved with the booking), so it is "what the catalogue
 * brought in", not a till total. Cleaned-up (retention) bookings are not counted.
 */
export async function loadAnalytics(barberIds: mongoose.Types.ObjectId[], range: Range, level: "BASIC" | "ADVANCED"): Promise<Analytics> {
  const to = getTodayISTString();
  const from = addDaysStr(to, -(range - 1));
  const match = { barberId: { $in: barberIds }, date: { $gte: from, $lte: to } };

  const [statusRows, dailyRows, upcoming] = await Promise.all([
    Booking.aggregate([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { ...match, status: { $ne: "CANCELLED" } } }, { $group: { _id: "$date", n: { $sum: 1 } } }]),
    // Confirmed visits still to come (today and later), whatever the chosen period.
    Booking.countDocuments({ barberId: { $in: barberIds }, status: "CONFIRMED", date: { $gte: to } }),
  ]);
  const by = (s: string) => statusRows.find((r) => r._id === s)?.n ?? 0;
  const completed = by("COMPLETED"), noShows = by("NO_SHOW"), cancelled = by("CANCELLED"), pending = by("CONFIRMED");
  const dayMap = new Map<string, number>(dailyRows.map((r) => [r._id, r.n]));
  const daily = Array.from({ length: range }, (_, i) => { const date = addDaysStr(from, i); return { date, bookings: dayMap.get(date) ?? 0 }; });
  const finished = completed + noShows;

  const out: Analytics = {
    range, from, to, level,
    totals: { bookings: completed + noShows + cancelled + pending, completed, cancelled, noShows, upcoming, noShowRate: finished > 0 ? Math.round((noShows / finished) * 1000) / 10 : null },
    daily,
  };
  if (level !== "ADVANCED") return out;

  const kept = { ...match, status: { $in: ["CONFIRMED", "COMPLETED"] } };
  const [services, revenue, custRows, hours, weekdays] = await Promise.all([
    Booking.aggregate([
      { $match: { ...kept, serviceNameSnapshot: { $exists: true } } },
      { $group: { _id: "$serviceNameSnapshot", bookings: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, { $ifNull: ["$servicePriceSnapshot", 0] }, 0] } } } },
      { $sort: { bookings: -1, revenue: -1 } }, { $limit: 8 },
    ]),
    Booking.aggregate([
      { $match: { ...match, status: "COMPLETED" } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$servicePriceSnapshot", 0] } }, priced: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$servicePriceSnapshot", 0] }, 0] }, 1, 0] } }, n: { $sum: 1 } } },
    ]),
    Booking.aggregate([{ $match: { ...match, status: { $in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] } } }, { $group: { _id: "$customerId", n: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: kept }, { $group: { _id: { $floor: { $divide: [{ $ifNull: ["$startMinutes", 0] }, 60] } }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 }]),
    Booking.aggregate([{ $match: kept }, { $group: { _id: "$date", n: { $sum: 1 } } }]),
  ]);

  // A customer is "returning" if they were here more than once in the period or had visited before it.
  const ids = custRows.map((r) => r._id);
  const before = ids.length ? await Booking.distinct("customerId", { barberId: { $in: barberIds }, customerId: { $in: ids }, date: { $lt: from }, status: { $in: ["COMPLETED", "NO_SHOW", "CONFIRMED"] } }) : [];
  const beforeSet = new Set(before.map(String));
  const returning = custRows.filter((r) => r.n > 1 || beforeSet.has(String(r._id))).length;

  const wd = new Array(7).fill(0) as number[];
  for (const r of weekdays) wd[new Date(`${r._id}T00:00:00Z`).getUTCDay()] += r.n;

  const rev = revenue[0] ?? { total: 0, priced: 0, n: 0 };
  out.advanced = {
    revenue: { total: rev.total, bookingsWithPrice: rev.priced, completedWithoutPrice: rev.n - rev.priced },
    topServices: services.map((s) => ({ name: s._id, bookings: s.bookings, completed: s.completed, revenue: s.revenue })),
    customers: { unique: custRows.length, returning, new: custRows.length - returning },
    peakHours: hours.map((h) => ({ hour: h._id, bookings: h.n })),
    weekdays: wd.map((n, day) => ({ day, bookings: n })),
  };
  return out;
}
