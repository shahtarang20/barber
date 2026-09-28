import { NextResponse } from "next/server";
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
      slot.bookingsCount = newCount;
      
      try {
        // Calculate slot end time to see if there's less than 15 mins left
        // Parse "10:30 AM" or "14:00" — use the slot's own stored endTime,
        // since slotDuration is configurable per-barber and not always 30 mins.
        const cleanStr = slot.endTime.trim().toLowerCase();
        const slotDateStr = new Date(slot.date).toISOString().split('T')[0];

        let hours = 0;
        let minutes = 0;

        if (cleanStr.includes("am") || cleanStr.includes("pm")) {
          const timeParts = cleanStr.match(/(\d+):(\d+)\s*(am|pm)/);
          if (timeParts) {
            hours = parseInt(timeParts[1]);
            minutes = parseInt(timeParts[2]);
            if (timeParts[3] === 'pm' && hours < 12) hours += 12;
            if (timeParts[3] === 'am' && hours === 12) hours = 0;
          }
        } else {
          const timeParts = cleanStr.split(':');
          if (timeParts.length >= 2) {
            hours = parseInt(timeParts[0]);
            minutes = parseInt(timeParts[1]);
          }
        }

        const slotEndTime = new Date(`${slotDateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);

        const timeRemainingMins = (slotEndTime.getTime() - new Date().getTime()) / 60000;
        
        // If 15 minutes or less remaining, reduce capacity so it doesn't open up again
        if (timeRemainingMins <= 15 && slot.capacity > 1) {
          slot.capacity = slot.capacity - 1;
        }
      } catch (e) {
        console.error("Error calculating slot time for no-show logic", e);
      }

      if (slot.status === "BOOKED" && newCount < slot.capacity) {
        slot.status = "AVAILABLE";
      }
      await slot.save();
    }

    notifyBarber(booking.barberId.toString(), "BOOKINGS_UPDATED");

    return NextResponse.json({ success: true, data: { message: "Booking marked as no-show", booking } });
  } catch (error) {
    console.error("No-show booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
