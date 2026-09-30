import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Slot } from "@/models/Slot";
import { Booking } from "@/models/Booking";
import { autoGenerateFutureSlots } from "@/lib/slotGenerator";
import { autoCompleteStaleBookings } from "@/lib/bookingMaintenance";
import { getTodayISTString } from "@/lib/istTime";
import { parseDateOnly } from "@/lib/timeSort";
import { getWhatsAppNumber } from "@/lib/phone";
import { isWhatsAppConfigured, sendReminderTemplate } from "@/lib/whatsapp";

export const maxDuration = 60;

// Past slots with no bookings are useless; keep a week of history for safety.
const PAST_SLOT_RETENTION_DAYS = 7;
const CONCURRENCY = 10;

async function inBatches<T>(items: T[], fn: (item: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.allSettled(items.slice(i, i + CONCURRENCY).map(fn));
  }
}

/**
 * Daily maintenance, triggered by the Vercel cron in vercel.json:
 *  1. extend every active barber's slot window (so it never runs dry),
 *  2. delete old unbooked slots,
 *  3. auto-complete stale confirmed bookings,
 *  4. send next-day WhatsApp reminders.
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const today = getTodayISTString();

    const barbers = await User.find({ role: "BARBER", isActive: true }).select("workingHours slotDuration defaultCapacity");
    await inBatches(barbers, (b) =>
      autoGenerateFutureSlots(b._id.toString(), b.workingHours, b.slotDuration, b.defaultCapacity)
    );

    const cutoff = format(addDays(parseDateOnly(today), -PAST_SLOT_RETENTION_DAYS), "yyyy-MM-dd");
    const deleted = await Slot.deleteMany({ date: { $lt: cutoff }, bookingsCount: 0 });

    const autoCompleted = await autoCompleteStaleBookings();

    let remindersSent = 0;
    if (isWhatsAppConfigured()) {
      const tomorrow = format(addDays(parseDateOnly(today), 1), "yyyy-MM-dd");
      const due = await Booking.find({ status: "CONFIRMED", date: tomorrow, reminderSentAt: { $exists: false } })
        .populate("customerId", "name phone")
        .populate("barberId", "name");
      await inBatches(due, async (b: any) => {
        if (!b.customerId?.phone) return;
        const ok = await sendReminderTemplate(getWhatsAppNumber(b.customerId.phone), [
          b.customerId.name,
          `${format(parseDateOnly(b.date), "d MMM")} at ${b.startTime}`,
          b.barberId?.name || "your barber",
        ]);
        if (ok) {
          await Booking.updateOne({ _id: b._id }, { $set: { reminderSentAt: new Date() } });
          remindersSent++;
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: { barbers: barbers.length, oldSlotsDeleted: deleted.deletedCount, autoCompleted, remindersSent },
    });
  } catch (error) {
    console.error("Daily cron error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
