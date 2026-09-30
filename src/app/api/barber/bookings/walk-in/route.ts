import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { createConfirmedBooking } from "@/lib/createBooking";
import { minutesUntilSlotEnd } from "@/lib/istTime";
import { normalizePhone } from "@/lib/phone";
import { heldByOthersExpr, activeHoldCount } from "@/lib/waitlistHold";
import { notifyBarber } from "@/lib/realtime";

const schema = z.object({
  slotId: z.string().min(1, "Slot is required"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Valid phone number is required"),
});

/** Barber records a customer who walked in: books one of the barber's own open slots for them. */
export async function POST(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const { slotId, name, phone } = parsed.data;
    if (!mongoose.isValidObjectId(slotId)) {
      return NextResponse.json({ success: false, error: { message: "That slot is no longer available." } }, { status: 409 });
    }

    await connectToDatabase();

    // Atomic claim, restricted to this barber's own slot. A walk-in may take the
    // slot that's in progress, so only a slot that has already ended is refused.
    // A seat held for a waitlisted customer stays theirs — the barber is shown the reason instead of quietly taking it.
    const phoneNorm = normalizePhone(phone);
    const slot = await Slot.findOneAndUpdate(
      {
        _id: slotId,
        barberId: payload.userId,
        status: "AVAILABLE",
        $expr: { $lt: ["$bookingsCount", { $subtract: ["$capacity", heldByOthersExpr(phoneNorm)] }] },
      },
      { $inc: { bookingsCount: 1 }, $pull: { holds: { phone: phoneNorm } } },
      { new: true }
    );
    if (!slot) {
      const probe = await Slot.findOne({ _id: slotId, barberId: payload.userId }).select("status bookingsCount capacity holds");
      const held = !!probe && probe.status === "AVAILABLE" && probe.bookingsCount < probe.capacity && activeHoldCount(probe) > 0;
      return NextResponse.json({
        success: false,
        error: { message: held ? "The last seat in this time is being held for a waitlisted customer for a few minutes. Pick another time, or try again shortly." : "That slot is no longer available." },
      }, { status: 409 });
    }

    const release = () =>
      Slot.findByIdAndUpdate(slot._id, { $set: { status: "AVAILABLE" }, $inc: { bookingsCount: -1 } });

    if (minutesUntilSlotEnd(slot.date, slot.endTime) <= 0) {
      await release();
      return NextResponse.json({ success: false, error: { message: "That slot has already ended." } }, { status: 410 });
    }
    if (slot.bookingsCount >= slot.capacity) {
      await Slot.findByIdAndUpdate(slot._id, { $set: { status: "BOOKED" } });
    }

    try {
      const { booking } = await createConfirmedBooking(slot, name, phone, "Walk-in");

      notifyBarber(slot.barberId.toString(), "BOOKINGS_UPDATED");
      return NextResponse.json({ success: true, data: { bookingNumber: booking.bookingNumber } }, { status: 201 });
    } catch (err) {
      await release();
      console.error("Walk-in booking failed, slot released:", err);
      return NextResponse.json({ success: false, error: { message: "Failed to add walk-in. Please try again." } }, { status: 500 });
    }
  } catch (error) {
    console.error("Walk-in error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
