import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { hashPassword, verifyPassword } from "@/lib/password";
import crypto from "crypto";

function generateTempPassword(): string {
  // 10 random alphanumeric characters, easy to read aloud/type over WhatsApp
  return crypto.randomBytes(8).toString("base64url").slice(0, 10);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const user = await User.findById(id);
    if (!user || user.role !== "BARBER") {
      return NextResponse.json({ success: false, error: { message: "Barber not found" } }, { status: 404 });
    }

    const tempPassword = generateTempPassword();
    user.passwordHash = await hashPassword(tempPassword);
    // Invalidate any session the barber currently has open — a password
    // reset should force re-login everywhere, not leave old tokens valid.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    return NextResponse.json({
      success: true,
      data: {
        message: `Password reset for ${user.name}. Share this temporary password with them securely — it will not be shown again.`,
        tempPassword,
      },
    });
  } catch (error) {
    console.error("Reset barber password error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
