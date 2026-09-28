import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "BARBER") {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();
    
    const resolvedParams = await params;
    const bookingId = resolvedParams.id;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return NextResponse.json({ success: false, error: { message: "Booking not found" } }, { status: 404 });
    }

    // Verify ownership
    if (booking.barberId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Forbidden" } }, { status: 403 });
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ success: false, error: { message: `Cannot cancel a booking that is ${booking.status}` } }, { status: 400 });
    }

    // Update booking status
    booking.status = "CANCELLED";
    await booking.save();

    // Free up the slot
    const slot = await Slot.findById(booking.slotId);
    if (slot) {
      const newCount = Math.max(0, slot.bookingsCount - 1);
      slot.bookingsCount = newCount;
      if (newCount < slot.capacity) {
        slot.status = "AVAILABLE";
      }
      await slot.save();
    }

    return NextResponse.json({ success: true, data: { message: "Booking cancelled successfully", booking } });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
