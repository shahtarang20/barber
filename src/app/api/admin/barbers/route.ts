import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { barberLinkUsage, getDefaultLinkLimit } from "@/lib/linkLimit";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const skip = (page - 1) * limit;
    const search = (searchParams.get("search") || "").trim().slice(0, 60);
    const rx = search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const filter: Record<string, unknown> = { role: "BARBER", ...(rx ? { $or: [{ name: rx }, { barberCode: rx }, { email: rx }, { phone: rx }, { slug: rx }] } : {}) };

    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();

    const total = await User.countDocuments(filter);

    const barbers = await User.find(filter)
      .select("-passwordHash -tokenVersion")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // One grouped query for every barber on the page, instead of one count per barber.
    const counts = await Booking.aggregate([
      { $match: { barberId: { $in: barbers.map((b) => b._id) } } },
      { $group: { _id: "$barberId", count: { $sum: 1 } } },
    ]);
    const countByBarber = new Map<string, number>(counts.map((c) => [String(c._id), c.count]));
    const defaultLinkLimit = await getDefaultLinkLimit();
    const usages = await Promise.all(barbers.map((b) => barberLinkUsage(b._id, b.linkBookingLimit ?? null, defaultLinkLimit)));
    const barbersWithStats = barbers.map((barber, i) => ({
      ...barber,
      bookingCount: countByBarber.get(String(barber._id)) ?? 0,
      linkUsed: usages[i].used,
      linkLimitEffective: usages[i].limit,
    }));

    return NextResponse.json({
      success: true,
      data: barbersWithStats,
      defaultLinkLimit,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch admin barbers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
