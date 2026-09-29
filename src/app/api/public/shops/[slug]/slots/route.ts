import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { Slot } from "@/models/Slot";
import { sortByStartTime } from "@/lib/timeSort";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit)(`public-shop-slots:${getClientIp(req)}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }

    await connectToDatabase();
    const { slug } = await params;

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) {
      return NextResponse.json({ success: false, error: { message: "Date is required" } }, { status: 400 });
    }

    const shop = await Shop.findOne({ slug, isActive: true });
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    const activeBarbers = await User.find({ _id: { $in: shop.barberIds }, isActive: true }).select("name slug").lean();
    if (activeBarbers.length === 0) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }
    const barberNameById = new Map(activeBarbers.map((b) => [b._id.toString(), { name: b.name, slug: b.slug }]));

    // Merge every active member barber's slots for this date into one list —
    // this is the whole point of a shop: one page, one date picker, every
    // barber's availability shown together instead of needing separate links.
    const slots = await Slot.find({
      barberId: { $in: Array.from(barberNameById.keys()) },
      date,
    }).select("startTime endTime status capacity bookingsCount barberId").lean();

    const enriched = slots.map((s) => ({
      ...s,
      barberName: barberNameById.get(s.barberId.toString())?.name,
      barberSlug: barberNameById.get(s.barberId.toString())?.slug,
    }));

    return NextResponse.json({ success: true, data: sortByStartTime(enriched) });
  } catch (error) {
    console.error("Fetch public shop slots error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
