import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { notifyBarber } from "@/lib/realtime";

/**
 * Takes a "no-show" mark back (the barber tapped it by mistake, or the customer turned up late).
 * The booking returns to CONFIRMED only if its slot still has a free seat; otherwise nothing changes.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: { message: "Booking not found" } }, { status: 404 });

    const booking = await Booking.findById(id).select("barberId status slotId").lean<{ barberId: mongoose.Types.ObjectId; status: string; slotId: mongoose.Types.ObjectId } | null>();
    if (!booking) return NextResponse.json({ success: false, error: { message: "Booking not found" } }, { status: 404 });
    if (booking.barberId.toString() !== payload.userId) return NextResponse.json({ success: false, error: { message: "Forbidden" } }, { status: 403 });
    if (booking.status !== "NO_SHOW") return NextResponse.json({ success: false, error: { message: `Cannot undo a no-show for a booking that is ${booking.status}` } }, { status: 400 });

    // Take the seat first (only while one is free and the slot is not blocked), then flip the booking; give the seat back if the flip lost a race.
    const seat = await Slot.updateOne(
      { _id: booking.slotId, status: { $ne: "BLOCKED" }, $expr: { $lt: ["$bookingsCount", "$capacity"] } },
      { $inc: { bookingsCount: 1 } }
    );
    if (seat.modifiedCount !== 1) {
      return NextResponse.json({ success: false, error: { message: "That time has no free seat any more, so the no-show cannot be undone." } }, { status: 409 });
    }
    const claimed = await Booking.findOneAndUpdate({ _id: id, status: "NO_SHOW" }, { $set: { status: "CONFIRMED" } }, { new: true }).lean();
    if (!claimed) {
      await Slot.updateOne({ _id: booking.slotId, bookingsCount: { $gt: 0 } }, { $inc: { bookingsCount: -1 } });
      return NextResponse.json({ success: false, error: { message: "This booking was already changed." } }, { status: 409 });
    }
    await Slot.updateOne({ _id: booking.slotId, status: "AVAILABLE", $expr: { $gte: ["$bookingsCount", "$capacity"] } }, { $set: { status: "BOOKED" } });

    notifyBarber(booking.barberId.toString(), "BOOKINGS_UPDATED");
    return NextResponse.json({ success: true, data: { message: "No-show undone", booking: claimed } });
  } catch (error) {
    console.error("Undo no-show error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
