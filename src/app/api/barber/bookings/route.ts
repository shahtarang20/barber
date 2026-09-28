import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { format } from "date-fns";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const skip = (page - 1) * limit;

    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();
    
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const query = { barberId: payload.userId, date: { $gte: todayStr } };

    const total = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .populate({ path: 'customerId', model: Customer, select: 'name phone' })
      .sort({ date: -1, startTime: 1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({ 
      success: true, 
      data: bookings,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Fetch bookings error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
