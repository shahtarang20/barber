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

  if (stale.length > 0) {
    await Booking.updateMany({ _id: { $in: stale.map((b) => b._id) } }, { $set: { status: "COMPLETED" } });
    // Loyalty: each auto-completed visit earns its stamp too (no-op when the owner runs no card; never throws).
    for (const b of stale) {
      await awardStampForBooking(b);
      // Membership: deduct the covered visit on auto-completion as well.
      if ((b as { coveredByMembershipId?: unknown }).coveredByMembershipId) await consumeMembershipVisit(String((b as { coveredByMembershipId?: unknown }).coveredByMembershipId)).catch(() => {});
    }
  }
  return stale.length;
}
