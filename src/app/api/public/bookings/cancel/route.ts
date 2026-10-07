import { NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/mongodb";
import { cancelBookingAndFreeSlot } from "@/lib/cancelBooking";
import { findOwnBooking, withinDailyOwnBookingLimit } from "@/lib/ownBooking";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";
import { minutesUntilSlot } from "@/lib/istTime";
import { notifyBarber } from "@/lib/realtime";
import { pushToBarber } from "@/lib/push";

// Same cutoff the barber-side cancel uses.
const CANCELLATION_CUTOFF_MINUTES = 30;

const schema = z.object({
  bookingNumber: z.string().min(1, "Booking ID is required"),
  phone: z.string().min(10, "Valid phone number is required"),
});

const NOT_FOUND = { success: false, error: { code: "NOT_FOUND", message: "No matching booking found. Check your Booking ID and phone number." } };

/** Lets a customer cancel their own booking using Booking ID + the phone number it was made with. */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`public-cancel:${getClientIp(req)}`, 60, 60_000))) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const phone = normalizePhone(parsed.data.phone);
    if (!(await rateLimit(`public-cancel-phone:${phone}`, 5, 60_000))) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again in a minute." } }, { status: 429 });
    }
    if (!(await withinDailyOwnBookingLimit(phone))) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many attempts for this phone number today. Please try again tomorrow or contact the barber." } }, { status: 429 });
    }

    await connectToDatabase();

    const found = await findOwnBooking(parsed.data.bookingNumber, parsed.data.phone);
    if (!found) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    const { booking, customer } = found;

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ success: false, error: { code: "BOOKING_NOT_ACTIVE", message: `This booking is already ${booking.status.toLowerCase().replace("_", " ")}.` } }, { status: 400 });
    }
    if (minutesUntilSlot(booking.date, booking.startTime) < CANCELLATION_CUTOFF_MINUTES) {
      return NextResponse.json({
        success: false,
        error: { code: "TOO_LATE_CANCEL", message: `Too late to cancel online — it starts in under ${CANCELLATION_CUTOFF_MINUTES} minutes. Please contact your barber.` },
      }, { status: 400 });
    }

    const cancelled = await cancelBookingAndFreeSlot(booking._id.toString());
    if (!cancelled) {
      return NextResponse.json({ success: false, error: { code: "ALREADY_CHANGED", message: "This booking was already changed." } }, { status: 409 });
    }

    // Tell the barber's open dashboard, with the waitlist to offer the slot to.
    notifyBarber(booking.barberId.toString(), "BOOKING_CANCELLED_BY_CUSTOMER", {
      name: customer.name,
      phone: customer.phone,
      time: cancelled.slotTime,
      waitlistCustomers: cancelled.waitlist,
      holdMinutes: cancelled.holdMinutes,
    });

    await pushToBarber(booking.barberId.toString(), {
      title: "Booking cancelled",
      body: `${customer.name} cancelled ${cancelled.slotTime}${cancelled.waitlist.length ? " — people are on the waitlist" : ""}`,
    });

    return NextResponse.json({ success: true, data: { message: "Your booking has been cancelled." } });
  } catch (error) {
    console.error("Public cancel error:", error);
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: "Internal server error" } }, { status: 500 });
  }
}
