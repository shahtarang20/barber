import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { hashPassword, verifyPassword } from "@/lib/password";
import crypto from "crypto";
import { z } from "zod";

const resetSchema = z.object({
  // Step-up confirmation: proves the request really came from the acting
  // admin (not a hijacked session doing something silent) — this is the
  // guardrail that was missing when admin-to-admin resets were previously
  // wide open with no friction or record at all.
  actingAdminPassword: z.string().min(1, "Your current password is required to confirm this action"),
});

function generateTempPassword(): string {
  return crypto.randomBytes(8).toString("base64url").slice(0, 10);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    const body = await req.json();
    const result = resetSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }

    await connectToDatabase();
    const { id: targetId } = await params;
    if (!mongoose.isValidObjectId(targetId)) {
      return NextResponse.json({ success: false, error: { message: "Admin not found." } }, { status: 404 });
    }

    if (targetId === payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Use 'Change Password' to update your own password." } }, { status: 400 });
    }

    const actingAdmin = await User.findById(payload.userId);
    if (!actingAdmin) {
      return NextResponse.json({ success: false, error: { message: "Your account could not be verified." } }, { status: 401 });
    }

    const isValid = (await verifyPassword(result.data.actingAdminPassword, actingAdmin.passwordHash)).ok;
    if (!isValid) {
      return NextResponse.json({ success: false, error: { message: "Your password is incorrect." } }, { status: 401 });
    }

    const targetAdmin = await User.findOne({ _id: targetId, role: "ADMIN" });
    if (!targetAdmin) {
      return NextResponse.json({ success: false, error: { message: "Admin not found." } }, { status: 404 });
    }

    const tempPassword = generateTempPassword();
    targetAdmin.passwordHash = await hashPassword(tempPassword);
    targetAdmin.tokenVersion = (targetAdmin.tokenVersion || 0) + 1;
    await targetAdmin.save();

    await AuditLog.create({
      action: "ADMIN_PASSWORD_RESET",
      actorId: actingAdmin._id,
      actorName: actingAdmin.name,
      targetId: targetAdmin._id,
      targetName: targetAdmin.name,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: `Password reset for ${targetAdmin.name}. Share this temporary password with them securely — it will not be shown again.`,
        tempPassword,
      },
    });
  } catch (error) {
    console.error("Admin-to-admin reset error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
