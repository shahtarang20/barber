import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";

/**
 * The one place a booking gets cancelled and its slot freed — used by both the
 * barber-side and the customer-side cancel routes so they can't drift apart.
 *
 * Returns null if the booking was no longer CONFIRMED (someone else changed it
 * first), otherwise the cancelled booking plus up to 3 waitlisted people to
 * tell about the opening.
 */
export async function cancelBookingAndFreeSlot(bookingId: string) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: "CONFIRMED" },
    { $set: { status: "CANCELLED" } },
    { new: true }
  );
  if (!booking) return null;

  const { waitlist, slotTime } = await freeSlotSeat(booking.slotId, booking.startTime);
  return { booking, waitlist, slotTime };
}

/**
 * Gives back one seat on a slot (after a cancellation or a reschedule away
 * from it), reopens it if it was full, and returns up to 3 waitlisted people
 * to tell about the opening.
 */
export async function freeSlotSeat(slotId: unknown, fallbackTime = "") {
  await Slot.updateOne({ _id: slotId, bookingsCount: { $gt: 0 } }, { $inc: { bookingsCount: -1 } });
  const slot = await Slot.findOneAndUpdate(
    { _id: slotId, status: "BOOKED", $expr: { $lt: ["$bookingsCount", "$capacity"] } },
    { $set: { status: "AVAILABLE" } },
    { new: true }
  ) ?? (await Slot.findById(slotId));

  const hasRoom = !!slot && slot.bookingsCount < slot.capacity;
  const waitlist: { name: string; phone: string }[] = hasRoom
    ? (slot!.waitlist || []).slice(0, 3).map((w: { name: string; phone: string }) => ({ name: w.name, phone: w.phone }))
    : [];

  return { waitlist, slotTime: slot?.startTime ?? fallbackTime };
}
