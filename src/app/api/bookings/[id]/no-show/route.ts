import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { notifyBarber } from "@/lib/realtime";
import { minutesUntilSlotEnd } from "@/lib/istTime";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();
    
    const resolvedParams = await params;
    const bookingId = resolvedParams.id;
    if (!mongoose.isValidObjectId(bookingId)) {
      return NextResponse.json({ success: false, error: { message: "Booking not found" } }, { status: 404 });
    }
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return NextResponse.json({ success: false, error: { message: "Booking not found" } }, { status: 404 });
    }

    // Verify ownership
    if (booking.barberId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Forbidden" } }, { status: 403 });
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ success: false, error: { message: `Cannot mark as no-show for a booking that is ${booking.status}` } }, { status: 400 });
    }

    // Claim the change atomically: a double tap (or a cancel at the same moment) must free the seat only once.
    const claimed = await Booking.findOneAndUpdate({ _id: bookingId, status: "CONFIRMED" }, { $set: { status: "NO_SHOW" } }, { new: true });
    if (!claimed) {
      return NextResponse.json({ success: false, error: { message: "This booking was already changed." } }, { status: 409 });
    }
    booking.status = "NO_SHOW";

    // Also give the seat back and make the slot available again. One atomic step each, so a booking made at the
    // same moment is never lost. Near the end of the slot the capacity shrinks too, so the seat does not reopen.
    const { Slot } = await import("@/models/Slot");
    const slot = await Slot.findById(booking.slotId).select("date endTime capacity").lean<{ date: string; endTime: string; capacity: number } | null>();
    if (slot) {
      const shrink = slot.capacity > 1 && minutesUntilSlotEnd(slot.date, slot.endTime) <= 15;
      await Slot.updateOne({ _id: booking.slotId, bookingsCount: { $gt: 0 } }, { $inc: shrink ? { bookingsCount: -1, capacity: -1 } : { bookingsCount: -1 } });
      await Slot.updateOne({ _id: booking.slotId, status: "BOOKED", $expr: { $lt: ["$bookingsCount", "$capacity"] } }, { $set: { status: "AVAILABLE" } });
    }

    notifyBarber(booking.barberId.toString(), "BOOKINGS_UPDATED");

    return NextResponse.json({ success: true, data: { message: "Booking marked as no-show", booking } });
  } catch (error) {
    console.error("No-show booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
