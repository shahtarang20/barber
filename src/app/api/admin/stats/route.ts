import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";

export async function GET(req: Request) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    
    const totalBarbers = await User.countDocuments({ role: "BARBER" });
    const totalBookings = await Booking.countDocuments();
    const totalCustomers = await Customer.countDocuments();
    const { format } = await import("date-fns");
    const today = format(new Date(), "yyyy-MM-dd");
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
