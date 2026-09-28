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
    const { format, subDays } = await import("date-fns");
    const today = format(new Date(), "yyyy-MM-dd");
    const todayBookings = await Booking.countDocuments({ date: today });

    // Booking status breakdown
    const statusCounts = await Booking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const bookingsByStatus = statusCounts.reduce((acc: Record<string, number>, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {});

    // Last 7 days booking trend
    const sevenDaysAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const trendRaw = await Booking.aggregate([
      { $match: { date: { $gte: sevenDaysAgo, $lte: today } } },
      { $group: { _id: "$date", count: { $sum: 1 } } },
    ]);
    const trendByDate: Record<string, number> = {};
    trendRaw.forEach((t) => { trendByDate[t._id] = t.count; });
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
      return { date, count: trendByDate[date] || 0 };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalBarbers,
        totalBookings,
        totalCustomers,
        todayBookings,
        bookingsByStatus,
        last7Days,
      }
    });
  } catch (error) {
    console.error("Fetch admin stats error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
