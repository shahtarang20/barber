import mongoose from "mongoose";
import { Slot } from "@/models/Slot";
import { createConfirmedBooking } from "@/lib/createBooking";
import { minutesUntilSlotEnd } from "@/lib/istTime";
import { markSlotFullIfFull, releaseClaimedSeat } from "@/lib/cancelBooking";
import { normalizePhone } from "@/lib/phone";
import { heldByOthersExpr, activeHoldCount } from "@/lib/waitlistHold";
import { notifyBarber } from "@/lib/realtime";

export type StaffBookingResult =
  | { ok: true; bookingNumber: string; slot: { barberId: unknown; date: string; startTime: string; endTime: string } }
  | { ok: false; status: number; message: string };

/**
 * Books a customer into one barber's slot on the staff's behalf (a walk-in, a phone call, or the shop's
 * front desk). The slot must belong to `barberId`. A seat held for a waitlisted customer stays theirs.
 */
export async function bookSlotForStaff(input: { slotId: string; barberId: string; name: string; phone: string; note: string }): Promise<StaffBookingResult> {
  const { slotId, barberId, name, phone, note } = input;
  if (!mongoose.isValidObjectId(slotId)) return { ok: false, status: 409, message: "That slot is no longer available." };

  const phoneNorm = normalizePhone(phone);
  const slot = await Slot.findOneAndUpdate(
    {
      _id: slotId,
      barberId,
      status: "AVAILABLE",
      $expr: { $lt: ["$bookingsCount", { $subtract: ["$capacity", heldByOthersExpr(phoneNorm)] }] },
    },
    { $inc: { bookingsCount: 1 }, $pull: { holds: { phone: phoneNorm } } },
    { new: true }
  );
  if (!slot) {
    const probe = await Slot.findOne({ _id: slotId, barberId }).select("status bookingsCount capacity holds");
    const held = !!probe && probe.status === "AVAILABLE" && probe.bookingsCount < probe.capacity && activeHoldCount(probe) > 0;
    return {
      ok: false,
      status: 409,
      message: held
        ? "The last seat in this time is being held for a waitlisted customer for a few minutes. Pick another time, or try again shortly."
        : "That slot is no longer available.",
    };
  }

  const release = () => releaseClaimedSeat(slot._id);

  if (minutesUntilSlotEnd(slot.date, slot.endTime) <= 0) {
    await release();
    return { ok: false, status: 410, message: "That slot has already ended." };
  }
  if (slot.bookingsCount >= slot.capacity) await markSlotFullIfFull(slot._id);

  try {
    const { booking } = await createConfirmedBooking(slot, name, phone, note);
    notifyBarber(slot.barberId.toString(), "BOOKINGS_UPDATED");
    return { ok: true, bookingNumber: booking.bookingNumber, slot };
  } catch (err) {
    await release();
    console.error("Staff booking failed, slot released:", err);
    return { ok: false, status: 500, message: "Failed to add the booking. Please try again." };
  }
}
