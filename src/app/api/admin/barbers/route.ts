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
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Attach booking counts
    const barbersWithStats = await Promise.all(barbers.map(async (barber) => {
      const bookingCount = await Booking.countDocuments({ barberId: barber._id });
      return {
        ...barber,
        bookingCount
      };
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
