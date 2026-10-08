import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { databaseSizeMB, eligibleFilter, getRetentionConfig, retentionCutoff, saveRetentionConfig } from "@/lib/retention";

const schema = z.object({
  enabled: z.boolean().optional(),
  months: z.number().int().min(1, "Keep at least 1 month").max(60, "60 months at most").optional(),
  storageLimitMB: z.number().int().min(50).max(1_000_000).optional(),
});

/** Current cleanup settings, what would be removed, and how full the database is. */
export async function GET() {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });

    await connectToDatabase();
    const config = await getRetentionConfig();
    const [eligible, totalBookings, sizeMB] = await Promise.all([
      Booking.countDocuments(eligibleFilter(config.months)),
      Booking.estimatedDocumentCount(),
      databaseSizeMB(),
    ]);
    return NextResponse.json({
      success: true,
      data: { config, cutoff: retentionCutoff(config.months), eligible, totalBookings, sizeMB },
    });
  } catch (error) {
    console.error("Get retention error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

/** Admin changes the cleanup settings. */
export async function PUT(req: Request) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: parsed.error.issues[0].message } }, { status: 400 });
    }

    await connectToDatabase();
    const before = await getRetentionConfig();
    const config = await saveRetentionConfig(parsed.data);
    const admin = await User.findById(payload.userId).select("name");
    await AuditLog.create({
      action: "RETENTION_SETTINGS_CHANGED",
      actorId: payload.userId,
      actorName: admin?.name || "Admin",
      metadata: { before: { enabled: before.enabled, months: before.months }, after: { enabled: config.enabled, months: config.months } },
    });
    return NextResponse.json({ success: true, data: { config } });
  } catch (error) {
    console.error("Update retention error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
