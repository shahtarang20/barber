import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { holdSeatForWaitlist, HOLD_MINUTES } from "@/lib/waitlistHold";

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

  const { waitlist, slotTime, holdMinutes } = await freeSlotSeat(booking.slotId, booking.startTime);
  return { booking, waitlist, slotTime, holdMinutes };
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

  // A seat opened: hold it for the first waitlisted customer instead of leaving it for whoever clicks first.
  const holder = await holdSeatForWaitlist(slotId);
  const waitlist: { name: string; phone: string }[] = holder ? [{ name: holder.name, phone: holder.phone }] : [];

  return { waitlist, slotTime: slot?.startTime ?? fallbackTime, holdMinutes: HOLD_MINUTES };
}

/**
 * Undoes a seat that was claimed a moment ago but not used (the booking could not be completed). One atomic step each, and the slot is
 * only reopened if it is still full-and-BOOKED with a free seat now, so it never un-blocks a slot the barber blocked meanwhile.
 */
export async function releaseClaimedSeat(slotId: unknown) {
  await Slot.updateOne({ _id: slotId, bookingsCount: { $gt: 0 } }, { $inc: { bookingsCount: -1 } });
  await Slot.updateOne({ _id: slotId, status: "BOOKED", $expr: { $lt: ["$bookingsCount", "$capacity"] } }, { $set: { status: "AVAILABLE" } });
}

/** Marks a slot BOOKED only if it is still open and really full right now (a cancel or a block at the same moment wins). */
export async function markSlotFullIfFull(slotId: unknown) {
  await Slot.updateOne({ _id: slotId, status: "AVAILABLE", $expr: { $gte: ["$bookingsCount", "$capacity"] } }, { $set: { status: "BOOKED" } });
}
