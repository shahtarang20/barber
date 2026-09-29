import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Slot } from "@/models/Slot";
import { sortByStartTime } from "@/lib/timeSort";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await connectToDatabase();
    
    const resolvedParams = await params;
    const slug = resolvedParams.slug;
    
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // Format YYYY-MM-DD
    
    if (!date) {
      return NextResponse.json({ success: false, error: { message: "Date is required" } }, { status: 400 });
    }

    const barber = await User.findOne({ slug, role: "BARBER" });
    
    if (!barber) {
      return NextResponse.json({ success: false, error: { message: "Barber not found" } }, { status: 404 });
    }

    // Only return AVAILABLE and BOOKED slots. Exclude BLOCKED or keep them to show unavailability?
    // Requirements: "Customers must never be able to book blocked slots. Do not show unavailable dates as if they contain bookable slots."
    // We will return all so frontend knows exact schedule, but blocked will be treated as unavailable.
    const slots = await Slot.find({
      barberId: barber._id,
      date: date
    }).select("startTime endTime status capacity bookingsCount");

    return NextResponse.json({ success: true, data: sortByStartTime(slots) });
  } catch (error) {
    console.error("Fetch public slots error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
