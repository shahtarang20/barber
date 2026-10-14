import { Booking } from "@/models/Booking";
import { getTodayISTString, minutesUntilSlotEnd } from "@/lib/istTime";
import { awardStampForBooking } from "@/lib/loyalty";
import { consumeMembershipVisit } from "@/lib/membership";

// A CONFIRMED booking is auto-marked COMPLETED this long after its slot ends,
// so bookings the barber forgot to close don't stay "Confirmed" forever.
export const AUTO_COMPLETE_AFTER_MINUTES = 120;

/** Marks stale CONFIRMED bookings COMPLETED — for one barber, or everyone when `barberId` is omitted. */
export async function autoCompleteStaleBookings(barberId?: string): Promise<number> {
  const pastConfirmed = await Booking.find({
    ...(barberId ? { barberId } : {}),
    status: "CONFIRMED",
    date: { $lte: getTodayISTString() },
  }).select("date endTime barberId customerId viaShopId coveredByMembershipId").lean();

  const stale = pastConfirmed.filter((b) => minutesUntilSlotEnd(b.date, b.endTime) <= -AUTO_COMPLETE_AFTER_MINUTES);

  let completed = 0;
  for (const b of stale) {
    // Transition each booking atomically: only a booking that is STILL "CONFIRMED" is completed here. This is what makes
    // the side effects idempotent — if the barber's manual "complete" (or an earlier run) already closed it, this skips it,
    // so a membership visit is never deducted twice for the same booking.
    const done = await Booking.findOneAndUpdate({ _id: b._id, status: "CONFIRMED" }, { $set: { status: "COMPLETED" } }).lean();
    if (!done) continue;
    completed++;
    // Loyalty: each auto-completed visit earns its stamp too (no-op when the owner runs no card; never throws).
    await awardStampForBooking(b);
    // Membership: deduct the covered visit on auto-completion as well.
    const covered = (b as { coveredByMembershipId?: unknown }).coveredByMembershipId;
    if (covered) await consumeMembershipVisit(String(covered)).catch(() => {});
  }
  return completed;
}
