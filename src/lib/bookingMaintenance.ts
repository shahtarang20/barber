import { Booking } from "@/models/Booking";
import { getTodayISTString, minutesUntilSlotEnd } from "@/lib/istTime";

// A CONFIRMED booking is auto-marked COMPLETED this long after its slot ends,
// so bookings the barber forgot to close don't stay "Confirmed" forever.
export const AUTO_COMPLETE_AFTER_MINUTES = 120;

/** Marks stale CONFIRMED bookings COMPLETED — for one barber, or everyone when `barberId` is omitted. */
export async function autoCompleteStaleBookings(barberId?: string): Promise<number> {
  const pastConfirmed = await Booking.find({
    ...(barberId ? { barberId } : {}),
    status: "CONFIRMED",
    date: { $lte: getTodayISTString() },
  }).select("date endTime").lean();

  const staleIds = pastConfirmed
    .filter((b) => minutesUntilSlotEnd(b.date, b.endTime) <= -AUTO_COMPLETE_AFTER_MINUTES)
    .map((b) => b._id);

  if (staleIds.length > 0) {
    await Booking.updateMany({ _id: { $in: staleIds } }, { $set: { status: "COMPLETED" } });
  }
  return staleIds.length;
}
