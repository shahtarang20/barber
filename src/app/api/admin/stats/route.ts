import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    
    const totalBarbers = await User.countDocuments({ role: "BARBER" });
    const totalBookings = await Booking.countDocuments();
    const totalCustomers = await Customer.countDocuments();
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = await Booking.countDocuments({ date: today });

    return NextResponse.json({ 
      success: true, 
      data: {
        totalBarbers,
        totalBookings,
        totalCustomers,
        todayBookings
      } 
    });
  } catch (error) {
    console.error("Fetch admin stats error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
