import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { sortByStartTime } from "@/lib/timeSort";
import { getTodayISTString } from "@/lib/istTime";
import { autoCompleteStaleBookings } from "@/lib/bookingMaintenance";

export async function GET(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // Format YYYY-MM-DD

    if (!date) {
      return NextResponse.json({ success: false, error: { message: "Date is required" } }, { status: 400 });
    }

    await connectToDatabase();

    // Opening today's schedule is a natural moment to settle bookings the barber forgot to close.
    if (date === getTodayISTString()) await autoCompleteStaleBookings(payload.userId);

    // Fetch slots for this barber on this date, sorted chronologically —
    // AM/PM strings can't be sorted lexicographically ("10:00 AM" < "2:00 PM").
    const slots = await Slot.find({
      barberId: payload.userId,
      date: date
    });

    return NextResponse.json({ success: true, data: sortByStartTime(slots) });
  } catch (error) {
    console.error("Fetch slots error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
