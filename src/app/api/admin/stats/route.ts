import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { getAdminStats } from "@/lib/adminStats";

export async function GET() {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    // Served from a 5-minute cached snapshot — the counts run over every booking, so they shouldn't rerun on each page view.
    return NextResponse.json({ success: true, data: await getAdminStats() });
  } catch (error) {
    console.error("Fetch admin stats error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
