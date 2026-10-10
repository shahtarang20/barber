import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Slot } from "@/models/Slot";
import { sortByStartTime } from "@/lib/timeSort";
import { admitVisitor } from "@/lib/visitorLimit";
import { memo } from "@/lib/memo";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(`public-barber-slots:${getClientIp(req)}`, 600, 60_000, { local: true }))) {
      return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }
    await connectToDatabase();
    
    const resolvedParams = await params;
    const slug = resolvedParams.slug;
    
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // Format YYYY-MM-DD
    
    if (!date) {
      return NextResponse.json({ success: false, error: { message: "Date is required" } }, { status: 400 });
    }

    const barber = await memo(`pub:barber-lite:${slug}`, 10_000, () =>
      User.findOne({ slug, role: "BARBER" }).select("isActive visitorLimit").lean<{ _id: import("mongoose").Types.ObjectId; isActive?: boolean; visitorLimit?: number } | null>());

    if (!barber || barber.isActive === false) {
      return NextResponse.json({ success: false, error: { message: "Barber not found" } }, { status: 404 });
    }
    if (!(await admitVisitor(req, "BARBER", barber._id, barber.visitorLimit ?? null)).allowed) return NextResponse.json({ success: false, error: { code: "VISITOR_LIMIT", message: "This page is not available right now. Please contact the barber directly." } }, { status: 403 });

    // Only return AVAILABLE and BOOKED slots. Exclude BLOCKED or keep them to show unavailability?
    // Requirements: "Customers must never be able to book blocked slots. Do not show unavailable dates as if they contain bookable slots."
    // We will return all so frontend knows exact schedule, but blocked will be treated as unavailable.
    const slots = await Slot.find({
      barberId: barber._id,
      date: date
    }).select("startTime endTime status capacity bookingsCount").lean();

    return NextResponse.json({ success: true, data: sortByStartTime(slots) });
  } catch (error) {
    console.error("Fetch public slots error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
