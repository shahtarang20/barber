import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { notifyBarber } from "@/lib/realtime";

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
      return NextResponse.json({ success: false, error: { message: `Cannot complete a booking that is ${booking.status}` } }, { status: 400 });
    }

    // Update booking status
    booking.status = "COMPLETED";
    await booking.save();

    notifyBarber(booking.barberId.toString(), "BOOKINGS_UPDATED");

    return NextResponse.json({ success: true, data: { message: "Booking marked as completed", booking } });
  } catch (error) {
    console.error("Complete booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
