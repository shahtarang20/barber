import { NextResponse } from "next/server";
import { timeStringToMinutes } from "@/lib/timeSort";
import { z } from "zod";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";
import { minutesUntilSlot } from "@/lib/istTime";
import { notifyBarber } from "@/lib/realtime";
import { pushToBarber } from "@/lib/push";
import { findOwnBooking, withinDailyOwnBookingLimit } from "@/lib/ownBooking";
import { freeSlotSeat } from "@/lib/cancelBooking";
import { heldByOthersExpr } from "@/lib/waitlistHold";

// Same cutoff as cancelling: too close to the start, contact the barber instead.
const CHANGE_CUTOFF_MINUTES = 30;

const schema = z.object({
  bookingNumber: z.string().min(1, "Booking ID is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  newSlotId: z.string().min(1, "Please choose a new time"),
});

/** Moves a customer's booking to another open slot of the same barber, keeping the same Booking ID. */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`public-reschedule:${getClientIp(req)}`, 60, 60_000))) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const { bookingNumber, phone, newSlotId } = parsed.data;
    if (!mongoose.isValidObjectId(newSlotId)) {
      return NextResponse.json({ success: false, error: { code: "SLOT_UNAVAILABLE", message: "Sorry, that time is no longer available. Please choose another." } }, { status: 409 });
    }
    if (!(await rateLimit(`public-reschedule-phone:${normalizePhone(phone)}`, 5, 60_000))) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again in a minute." } }, { status: 429 });
    }
    if (!(await withinDailyOwnBookingLimit(phone))) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many attempts for this phone number today. Please try again tomorrow or contact the barber." } }, { status: 429 });
    }

    await connectToDatabase();
    const found = await findOwnBooking(bookingNumber, phone);
    if (!found) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "No matching booking found. Check your Booking ID and phone number." } }, { status: 404 });
    }
    const { booking, customer } = found;

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ success: false, error: { code: "BOOKING_NOT_ACTIVE", message: `This booking is already ${booking.status.toLowerCase().replace("_", " ")}.` } }, { status: 400 });
    }
    if (booking.slotId.toString() === newSlotId) {
      return NextResponse.json({ success: false, error: { code: "SAME_SLOT", message: "That is already your current time." } }, { status: 400 });
    }
    if (minutesUntilSlot(booking.date, booking.startTime) < CHANGE_CUTOFF_MINUTES) {
      return NextResponse.json({ success: false, error: { code: "TOO_LATE_CHANGE", message: `Too late to change online — it starts in under ${CHANGE_CUTOFF_MINUTES} minutes. Please contact your barber.` } }, { status: 400 });
    }

    // 1. Claim the new seat first (same barber only), so the customer never ends up with no slot.
    const phoneNorm = normalizePhone(phone);
    const newSlot = await Slot.findOneAndUpdate(
      {
        _id: newSlotId,
        barberId: booking.barberId,
        status: "AVAILABLE",
        $expr: { $lt: ["$bookingsCount", { $subtract: ["$capacity", heldByOthersExpr(phoneNorm)] }] },
      },
      { $inc: { bookingsCount: 1 }, $pull: { holds: { phone: phoneNorm } } },
      { new: true }
    );
    if (!newSlot) {
      return NextResponse.json({ success: false, error: { code: "SLOT_UNAVAILABLE", message: "Sorry, that time is no longer available. Please choose another." } }, { status: 409 });
    }
    const releaseNew = () =>
      Slot.findByIdAndUpdate(newSlot._id, { $set: { status: "AVAILABLE" }, $inc: { bookingsCount: -1 } });

    if (minutesUntilSlot(newSlot.date, newSlot.startTime) < 0) {
      await releaseNew();
      return NextResponse.json({ success: false, error: { code: "SLOT_PASSED", message: "That time has already passed. Please choose another." } }, { status: 410 });
    }
    if (newSlot.bookingsCount >= newSlot.capacity) {
      await Slot.findByIdAndUpdate(newSlot._id, { $set: { status: "BOOKED" } });
    }

    // 2. Move the booking — only if it's still CONFIRMED.
    const oldSlotId = booking.slotId;
    const moved = await Booking.findOneAndUpdate(
      { _id: booking._id, status: "CONFIRMED", slotId: oldSlotId },
      { $set: { slotId: newSlot._id, date: newSlot.date, startTime: newSlot.startTime, startMinutes: timeStringToMinutes(newSlot.startTime), endTime: newSlot.endTime } },
      { new: true }
    );
    if (!moved) {
      await releaseNew();
      return NextResponse.json({ success: false, error: { code: "ALREADY_CHANGED", message: "This booking was already changed." } }, { status: 409 });
    }

    // 3. Give the old seat back and offer it to the waitlist via the barber's dashboard.
    const freed = await freeSlotSeat(oldSlotId, booking.startTime);
    notifyBarber(booking.barberId.toString(), "BOOKING_CANCELLED_BY_CUSTOMER", {
      name: customer.name,
      phone: customer.phone,
      time: freed.slotTime,
      waitlistCustomers: freed.waitlist,
      holdMinutes: freed.holdMinutes,
    });

    await pushToBarber(booking.barberId.toString(), {
      title: "Booking moved",
      body: `${customer.name} moved from ${freed.slotTime} to ${moved.startTime} on ${moved.date}`,
    });

    return NextResponse.json({
      success: true,
      data: { message: "Your booking has been moved.", date: moved.date, startTime: moved.startTime, bookingNumber: moved.bookingNumber },
    });
  } catch (error) {
    console.error("Public reschedule error:", error);
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: "Internal server error" } }, { status: 500 });
  }
}
