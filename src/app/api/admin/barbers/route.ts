import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";

export async function GET(req: Request) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    
    const barbers = await User.find({ role: "BARBER" }).select("-passwordHash").lean();
    
    // Attach booking counts
    const barbersWithStats = await Promise.all(barbers.map(async (barber) => {
      const bookingCount = await Booking.countDocuments({ barberId: barber._id });
      return {
        ...barber,
        bookingCount
      };
    }));

    return NextResponse.json({ success: true, data: barbersWithStats });
  } catch (error) {
    console.error("Fetch admin barbers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
