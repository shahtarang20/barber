import { NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhone } from "@/lib/phone";
import { findOwnBooking } from "@/lib/ownBooking";

const schema = z.object({
  bookingNumber: z.string().min(1, "Booking ID is required"),
  phone: z.string().min(10, "Valid phone number is required"),
});

/** Lets a customer look up their own booking (Booking ID + phone) so they can pick a new time for it. */
export async function POST(req: Request) {
  try {
    if (!(await rateLimit(`public-lookup:${getClientIp(req)}`, 20, 60_000))) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0].message } }, { status: 400 });
    }
    if (!(await rateLimit(`public-lookup-phone:${normalizePhone(parsed.data.phone)}`, 5, 60_000))) {
      return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again in a minute." } }, { status: 429 });
    }

    await connectToDatabase();
    const found = await findOwnBooking(parsed.data.bookingNumber, parsed.data.phone);
    if (!found) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "No matching booking found. Check your Booking ID and phone number." } }, { status: 404 });
    }
    const { booking } = found;
    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ success: false, error: { code: "BOOKING_NOT_ACTIVE", message: `This booking is already ${booking.status.toLowerCase().replace("_", " ")}.` } }, { status: 400 });
    }

    const barber = await User.findById(booking.barberId).select("slug name");
    return NextResponse.json({
      success: true,
      data: { date: booking.date, startTime: booking.startTime, barberSlug: barber?.slug, barberName: barber?.name },
    });
  } catch (error) {
    console.error("Public lookup error:", error);
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: "Internal server error" } }, { status: 500 });
  }
}
