import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const skip = (page - 1) * limit;

    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();

    const total = await User.countDocuments({ role: "BARBER" });

    const barbers = await User.find({ role: "BARBER" })
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
    const barbersWithStats = barbers.map((barber) => ({
      ...barber,
      bookingCount: countByBarber.get(String(barber._id)) ?? 0,
    }));

    return NextResponse.json({
      success: true,
      data: barbersWithStats,
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
