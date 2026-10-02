import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { User } from "@/models/User";
import { normalizeBookingNumber } from "@/lib/ownBooking";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const skip = (page - 1) * limit;

    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();

    // Search by booking ID, customer name / phone, or barber name / code.
    const search = (searchParams.get("search") || "").trim().slice(0, 60);
    let filter: Record<string, unknown> = {};
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const digits = search.replace(/\D/g, "");
      const phoneRx = digits.length >= 3 ? new RegExp(digits.replace(/^(91|0)(?=\d{10}$)/, "")) : rx;
      const [customers, barbers] = await Promise.all([
        Customer.find({ $or: [{ name: rx }, { phone: phoneRx }] }).select("_id").limit(300).lean(),
        User.find({ role: "BARBER", $or: [{ name: rx }, { barberCode: rx }] }).select("_id").limit(100).lean(),
      ]);
      // "B-0001" / "b0001" is a Booking ID: look for that booking only (its digits are not a phone number).
      if (/^b[\s-]?\d{1,10}$/i.test(search)) {
        filter = { $or: [{ bookingNumber: normalizeBookingNumber(search) }, { bookingNumber: rx }] };
      } else
      filter = { $or: [{ bookingNumber: normalizeBookingNumber(search) }, { bookingNumber: rx }, { customerId: { $in: customers.map((c) => c._id) } }, { barberId: { $in: barbers.map((b) => b._id) } }] };
    }

    const total = await Booking.countDocuments(filter);

    const bookings = await Booking.find(filter)
      .populate("barberId", "name email slug barberCode")
      .populate("customerId", "name phone email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch admin bookings error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
