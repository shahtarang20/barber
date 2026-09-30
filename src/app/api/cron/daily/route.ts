import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Slot } from "@/models/Slot";
import { CronState } from "@/models/CronState";
import { autoGenerateFutureSlots } from "@/lib/slotGenerator";
import { autoCompleteStaleBookings } from "@/lib/bookingMaintenance";
import { refreshAdminStats } from "@/lib/adminStats";
import { getTodayISTString } from "@/lib/istTime";
import { parseDateOnly } from "@/lib/timeSort";

export const maxDuration = 60;

// Past slots with no bookings are useless; keep a week of history for safety.
const PAST_SLOT_RETENTION_DAYS = 7;
const CONCURRENCY = 10;
const BATCH = Number(process.env.CRON_BATCH) || 50;
// Stop taking new barbers this long before the function's limit; the next trigger resumes from the saved cursor.
const TIME_BUDGET_MS = process.env.CRON_TIME_BUDGET_MS ? Number(process.env.CRON_TIME_BUDGET_MS) : 45_000;
const KEY = "daily-sync";

/**
 * Daily maintenance, triggered by the crons in vercel.json (more than one, so a
 * big fleet that can't finish in one call is resumed by the next):
 *  1. extend every active barber's slot window, in resumable batches,
 *  2. once every barber is done: delete old unbooked slots, auto-complete
 *     stale confirmed bookings, refresh the cached admin numbers.
 * Progress lives in the database (CronState), a lock stops two triggers from
 * working at once, and re-running a finished day is a no-op.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const started = Date.now();
  try {
    await connectToDatabase();
    const today = getTodayISTString();

    // A new IST day starts a fresh run.
    await CronState.updateOne(
      { key: KEY, date: { $ne: today } },
      { $set: { date: today, cursor: null, processed: 0, done: false, lockedUntil: null } },
      { upsert: false }
    );
    // First ever run (or a simultaneous first trigger — the duplicate-key error just means the other one created it).
    await CronState.updateOne({ key: KEY }, { $setOnInsert: { date: today } }, { upsert: true }).catch((e: { code?: number }) => {
      if (e?.code !== 11000) throw e;
    });

    // Take the lock (only if the day isn't finished and nobody else holds it).
    const state = await CronState.findOneAndUpdate(
      { key: KEY, date: today, done: false, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: new Date() } }] },
      { $set: { lockedUntil: new Date(Date.now() + (maxDuration + 10) * 1000) } },
      { new: true }
    );
    if (!state) {
      const current = await CronState.findOne({ key: KEY });
      return NextResponse.json({ success: true, data: { skipped: current?.done ? "already finished today" : "another run is in progress", processed: current?.processed ?? 0 } });
    }

    let cursor = state.cursor as unknown;
    let processed = state.processed as number;
    let finished = false;

    // At least one batch per trigger, so every run makes progress even with a tiny budget.
    do {
      const barbers = await User.find({ role: "BARBER", isActive: true, ...(cursor ? { _id: { $gt: cursor } } : {}) })
        .sort({ _id: 1 })
        .limit(BATCH)
        .select("workingHours slotDuration defaultCapacity");
      if (barbers.length === 0) { finished = true; break; }

      for (let i = 0; i < barbers.length; i += CONCURRENCY) {
        await Promise.allSettled(
          barbers.slice(i, i + CONCURRENCY).map((b) =>
            autoGenerateFutureSlots(b._id.toString(), b.workingHours, b.slotDuration, b.defaultCapacity)
          )
        );
      }
      cursor = barbers[barbers.length - 1]._id;
      processed += barbers.length;
      await CronState.updateOne({ key: KEY }, { $set: { cursor, processed } });
      // A short batch means that was the last of the fleet — no need for another trigger to find out.
      if (barbers.length < BATCH) { finished = true; break; }
    } while (Date.now() - started < TIME_BUDGET_MS);

    let cleanup: Record<string, number> | null = null;
    if (finished) {
      const cutoff = format(addDays(parseDateOnly(today), -PAST_SLOT_RETENTION_DAYS), "yyyy-MM-dd");
      const deleted = await Slot.deleteMany({ date: { $lt: cutoff }, bookingsCount: 0 });
      const autoCompleted = await autoCompleteStaleBookings();
      await refreshAdminStats();
      cleanup = { oldSlotsDeleted: deleted.deletedCount, autoCompleted };
    }

    await CronState.updateOne({ key: KEY }, { $set: { done: finished, lockedUntil: null } });

    return NextResponse.json({
      success: true,
      data: { barbersProcessedSoFar: processed, finished, ...(cleanup || { note: "more barbers remain; the next trigger resumes" }) },
    });
  } catch (error) {
    await CronState.updateOne({ key: KEY }, { $set: { lockedUntil: null } }).catch(() => {});
    console.error("Daily cron error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
