import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { runRetention } from "@/lib/retention";

export const maxDuration = 60;

/** Admin runs the cleanup right now (one batch of up to 20,000 bookings). */
export async function POST() {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });

    await connectToDatabase();
    const result = await runRetention();
    if ("skipped" in result) {
      return NextResponse.json({ success: false, error: { message: "Cleanup is switched off. Turn it on first." } }, { status: 400 });
    }
    const admin = await User.findById(payload.userId).select("name");
    await AuditLog.create({
      action: "RETENTION_RUN_MANUALLY",
      actorId: payload.userId,
      actorName: admin?.name || "Admin",
      metadata: result,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Run retention error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
