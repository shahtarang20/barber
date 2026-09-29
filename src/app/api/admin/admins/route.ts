import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function GET() {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();

    const admins = await User.find({ role: "ADMIN" }).select("name barberCode email").lean();

    return NextResponse.json({
      success: true,
      data: admins.map((a) => ({ ...a, isSelf: a._id.toString() === payload.userId })),
    });
  } catch (error) {
    console.error("Fetch admins error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
