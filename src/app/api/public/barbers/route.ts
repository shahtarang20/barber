import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function GET() {
  try {
    await connectToDatabase();
    
    // Get all barbers. In a real app we might paginate or filter.
    const barbers = await User.find({ role: "BARBER", isActive: true })
      .select("name slug bio profileImage barberCode")
      .lean();

    return NextResponse.json({ success: true, data: barbers });
  } catch (error) {
    console.error("Fetch public barbers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
