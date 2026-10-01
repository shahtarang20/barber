import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { barberLinkUsage } from "@/lib/linkLimit";

export async function GET() {
  try {
    const payload = await requireAuth();
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Invalid token" } }, { status: 401 });
    }

    await connectToDatabase();
    
    // Exclude passwordHash and internal session-bookkeeping fields
    const user = await User.findById(payload.userId).select("-passwordHash -tokenVersion");
    
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    }

    const linkUsage = await barberLinkUsage(user._id, user.linkBookingLimit ?? null);
    return NextResponse.json({ success: true, data: { ...user.toObject(), linkUsage } });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
