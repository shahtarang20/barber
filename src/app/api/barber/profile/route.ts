import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function GET() {
  try {
    const payload = await requireAuth();
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Invalid token" } }, { status: 401 });
    }

    await connectToDatabase();
    
    // Get user without passwordHash
    const user = await User.findById(payload.userId).select("-passwordHash");
    
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
