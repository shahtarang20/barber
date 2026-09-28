import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";

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
      return NextResponse.json({ success: false, error: { message: `Cannot mark as no-show for a booking that is ${booking.status}` } }, { status: 400 });
    }

    // Update booking status
    booking.status = "NO_SHOW";
    await booking.save();

    // Also decrement the slot's bookingsCount and make it available again
    const { Slot } = await import("@/models/Slot");
    const slot = await Slot.findById(booking.slotId);
    if (slot) {
      const newCount = Math.max(0, slot.bookingsCount - 1);
      
      // The user says: "check that tell left for that slot or not if yes then automatic the slot dynamically one down"
      // If there's 15 mins left, or any time left, it becomes available. 
      // Our dashboard hides slots in the past, so if it's in the past, making it AVAILABLE won't hurt, it will just be hidden!
      slot.bookingsCount = newCount;
      if (slot.status === "BOOKED" && newCount < slot.capacity) {
        slot.status = "AVAILABLE";
      }
      await slot.save();
    }

    return NextResponse.json({ success: true, data: { message: "Booking marked as no-show", booking } });
  } catch (error) {
    console.error("No-show booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
