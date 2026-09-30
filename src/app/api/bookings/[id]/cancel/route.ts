import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { cancelBookingAndFreeSlot } from "@/lib/cancelBooking";
import { notifyBarber } from "@/lib/realtime";
import { minutesUntilSlot } from "@/lib/istTime";

// A booking can't be cancelled once it's this close to starting — matches
// the slot granularity, so it's the smallest meaningful cutoff.
const CANCELLATION_CUTOFF_MINUTES = 30;

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
      return NextResponse.json({ success: false, error: { message: `Cannot cancel a booking that is ${booking.status}` } }, { status: 400 });
    }

    const minutesLeft = minutesUntilSlot(booking.date, booking.startTime);
    if (minutesLeft < CANCELLATION_CUTOFF_MINUTES) {
      return NextResponse.json({
        success: false,
        error: { message: `This booking can no longer be cancelled — it starts in less than ${CANCELLATION_CUTOFF_MINUTES} minutes (or has already started).` },
      }, { status: 400 });
    }

    const cancelled = await cancelBookingAndFreeSlot(bookingId);
    if (!cancelled) {
      return NextResponse.json({ success: false, error: { message: "This booking was already changed." } }, { status: 409 });
    }
    const { booking: cancelledBooking, waitlist: waitlistToNotify, slotTime } = cancelled;

    const { Customer } = await import("@/models/Customer");
    const customer = await Customer.findById(cancelledBooking.customerId);

    notifyBarber(booking.barberId.toString(), "BOOKINGS_UPDATED");

    return NextResponse.json({
      success: true, 
      data: { 
        message: "Booking cancelled successfully", 
        booking: cancelledBooking,
        customer: customer ? { name: customer.name, phone: customer.phone } : null,
        waitlistCustomers: waitlistToNotify,
        slotTime
      } 
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
