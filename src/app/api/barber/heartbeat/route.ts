import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

/** An open dashboard says "I'm here" every few minutes, so the admin can see how many barbers are online. */
export async function POST() {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    await connectToDatabase();
    await User.updateOne({ _id: payload.userId }, { $set: { lastSeenAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
