import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  cookieStore.delete("auth_token");

  // Bump tokenVersion so the JWT that was just cleared client-side can't be
  // replayed against the API afterward (e.g. a captured cookie value) —
  // clearing the cookie alone doesn't invalidate the token itself.
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    try {
      await connectToDatabase();
      await User.findByIdAndUpdate(payload.userId, { $inc: { tokenVersion: 1 } });
    } catch (error) {
      console.error("Logout token revocation error:", error);
    }
  }

  return NextResponse.json({ success: true, data: { message: "Logged out successfully" } });
}
