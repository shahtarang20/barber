import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export async function PUT(req: Request) {
  try {
    // No role restriction — any authenticated barber or admin can change
    // their own password as long as they can prove they know the current one.
    const payload = await requireAuth();
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const result = changePasswordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }
    const { currentPassword, newPassword } = result.data;

    await connectToDatabase();

    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ success: false, error: { message: "Current password is incorrect" } }, { status: 401 });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    // Force re-login everywhere else — a password change should invalidate
    // any other session that might be using the old credentials.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    return NextResponse.json({ success: true, data: { message: "Password changed successfully. Please log in again." } });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
