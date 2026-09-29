import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!rateLimit(`public-shop:${getClientIp(req)}`, 60, 60_000)) {
      return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }

    await connectToDatabase();
    const { slug } = await params;

    const shop = await Shop.findOne({ slug, isActive: true });
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    // Only show barbers who are still active — a suspended barber
    // shouldn't be bookable from the shop page any more than from their
    // own individual link.
    const barbers = await User.find({ _id: { $in: shop.barberIds }, isActive: true })
      .select("name slug profileImage bio")
      .lean();

    if (barbers.length === 0) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        name: shop.name,
        slug: shop.slug,
        barbers,
      },
    });
  } catch (error) {
    console.error("Fetch public shop error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
