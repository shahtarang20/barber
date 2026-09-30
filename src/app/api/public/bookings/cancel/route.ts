import { NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { cancelBookingAndFreeSlot } from "@/lib/cancelBooking";
import { sendTemplate } from "@/lib/whatsapp";
import { Customer } from "@/models/Customer";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhone, getWhatsAppNumber } from "@/lib/phone";
import { minutesUntilSlot } from "@/lib/istTime";
import { notifyBarber } from "@/lib/realtime";

// Same cutoff the barber-side cancel uses.
const CANCELLATION_CUTOFF_MINUTES = 30;

const schema = z.object({
  bookingNumber: z.string().min(1, "Booking ID is required"),
  phone: z.string().min(10, "Valid phone number is required"),
});

const NOT_FOUND = { success: false, error: { message: "No matching booking found. Check your Booking ID and phone number." } };

/** Lets a customer cancel their own booking using Booking ID + the phone number it was made with. */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit)(`public-cancel:${getClientIp(req)}`, 20, 60_000)) {
      return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const phone = normalizePhone(parsed.data.phone);
    if (!(await rateLimit)(`public-cancel-phone:${phone}`, 5, 60_000)) {
      return NextResponse.json({ success: false, error: { message: "Too many attempts. Please try again in a minute." } }, { status: 429 });
    }

    await connectToDatabase();

    const booking = await Booking.findOne({ bookingNumber: parsed.data.bookingNumber.trim().toUpperCase() });
    const customer = booking ? await Customer.findById(booking.customerId) : null;
    // Same response for "no such booking" and "wrong phone" so IDs can't be probed.
    if (!booking || !customer || customer.phone !== phone) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ success: false, error: { message: `This booking is already ${booking.status.toLowerCase().replace("_", " ")}.` } }, { status: 400 });
    }
    if (minutesUntilSlot(booking.date, booking.startTime) < CANCELLATION_CUTOFF_MINUTES) {
      return NextResponse.json({
        success: false,
        error: { message: `Too late to cancel online — it starts in under ${CANCELLATION_CUTOFF_MINUTES} minutes. Please contact your barber.` },
      }, { status: 400 });
    }

    const cancelled = await cancelBookingAndFreeSlot(booking._id.toString());
    if (!cancelled) {
      return NextResponse.json({ success: false, error: { message: "This booking was already changed." } }, { status: 409 });
    }

    // Tell the barber's open dashboard (with the waitlist to offer the slot to),
    // and alert the waitlist directly if WhatsApp is configured.
    notifyBarber(booking.barberId.toString(), "BOOKING_CANCELLED_BY_CUSTOMER", {
      name: customer.name,
      phone: customer.phone,
      time: cancelled.slotTime,
      waitlistCustomers: cancelled.waitlist,
    });
    const link = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "";
    await Promise.allSettled(
      cancelled.waitlist.map((w) =>
        sendTemplate(getWhatsAppNumber(w.phone), process.env.WHATSAPP_WAITLIST_TEMPLATE, [w.name, cancelled.slotTime, link])
      )
    );

    return NextResponse.json({ success: true, data: { message: "Your booking has been cancelled." } });
  } catch (error) {
    console.error("Public cancel error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
