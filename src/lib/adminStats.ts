import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { Stat } from "@/models/Stat";
import { addDays, format } from "date-fns";
import { getTodayISTString } from "@/lib/istTime";
import { parseDateOnly } from "@/lib/timeSort";

const KEY = "admin-dashboard";
export const ADMIN_STATS_TTL_MS = 5 * 60 * 1000;

/** Computes the admin numbers from scratch. Totals use the collection's own metadata count (instant at any size). */
export async function computeAdminStats() {
  const today = getTodayISTString();
  const from = format(addDays(parseDateOnly(today), -6), "yyyy-MM-dd");

  const [totalBarbers, totalBookings, totalCustomers, todayBookings, statusCounts, trendRaw] = await Promise.all([
    User.countDocuments({ role: "BARBER" }),
    Booking.estimatedDocumentCount(),
    Customer.estimatedDocumentCount(),
    Booking.countDocuments({ date: today }),
    Booking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { date: { $gte: from, $lte: today } } },
      { $group: { _id: "$date", count: { $sum: 1 } } },
    ]),
  ]);

  const bookingsByStatus: Record<string, number> = {};
  statusCounts.forEach((s) => { bookingsByStatus[s._id] = s.count; });
  const trendByDate: Record<string, number> = {};
  trendRaw.forEach((t) => { trendByDate[t._id] = t.count; });
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const date = format(addDays(parseDateOnly(today), i - 6), "yyyy-MM-dd");
    return { date, count: trendByDate[date] || 0 };
  });

  return { totalBarbers, totalBookings, totalCustomers, todayBookings, bookingsByStatus, last7Days };
}

/** Recomputes and stores the snapshot (used by the daily job and on cache expiry). */
export async function refreshAdminStats() {
  const data = await computeAdminStats();
  await Stat.findOneAndUpdate({ key: KEY }, { $set: { data, computedAt: new Date() } }, { upsert: true });
  return data;
}

/** Returns the cached snapshot if it's fresh, otherwise refreshes it. */
export async function getAdminStats() {
  const cached = await Stat.findOne({ key: KEY }).lean<{ data: unknown; computedAt: Date } | null>();
  if (cached && Date.now() - new Date(cached.computedAt).getTime() < ADMIN_STATS_TTL_MS) return cached.data;
  return refreshAdminStats();
}
