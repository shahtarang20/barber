import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { shopLinkUsage } from "@/lib/linkLimit";
import { admitVisitor } from "@/lib/visitorLimit";
import { memo } from "@/lib/memo";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(`public-shop:${getClientIp(req)}`, 300, 60_000, { local: true }))) {
      return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }

    await connectToDatabase();
    const { slug } = await params;

    const shop = await memo(`pub:shop:${slug}`, 10_000, () =>
      Shop.findOne({ slug, isActive: true }).select("name slug barberIds linkBookingLimit visitorLimit").lean<{ _id: import("mongoose").Types.ObjectId; name: string; slug: string; barberIds: import("mongoose").Types.ObjectId[]; linkBookingLimit?: number; visitorLimit?: number } | null>());
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    // Only show barbers who are still active — a suspended barber
    // shouldn't be bookable from the shop page any more than from their
    // own individual link.
    const barbers = await memo(`pub:shop-barbers:${slug}`, 10_000, () =>
      User.find({ _id: { $in: shop.barberIds }, isActive: true }).select("name slug profileImage bio").lean());

    if (barbers.length === 0) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        name: shop.name,
        slug: shop.slug,
        barbers,
        linkClosed: (await shopLinkUsage(shop._id, shop.linkBookingLimit ?? null)).closed || !(await admitVisitor(req, "SHOP", shop._id, shop.visitorLimit ?? null)).allowed,
      },
    });
  } catch (error) {
    console.error("Fetch public shop error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
