import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { z } from "zod";
import { signToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const loginSchema = z.object({
  barberCode: z.string().min(1, "Barber Code is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    // Generous per-network ceiling: a whole shop (or a mobile carrier's shared
    // IP) can log in at once. It only stops a scripted flood.
    if (!(await rateLimit(`login:${ip}`, 200, 60_000))) {
      return NextResponse.json({ success: false, error: { message: "Too many login attempts. Please try again in a minute." } }, { status: 429 });
    }

    await connectToDatabase();

    const body = await req.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }
    
    const { barberCode, password } = result.data;

    // The real guard against password guessing is per account, not per network.
    if (!(await rateLimit(`login-account:${barberCode.toLowerCase()}`, 10, 60_000))) {
      return NextResponse.json({ success: false, error: { message: "Too many login attempts for this account. Please try again in a minute." } }, { status: 429 });
    }
    
    // Find user by barberCode or email
    const searchTerm = barberCode.toLowerCase();
    const user = await User.findOne({
      $or: [
        { barberCode: searchTerm },
        { email: searchTerm }
      ]
    });
    
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "Invalid barber code or password" } }, { status: 401 });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, error: { message: "Invalid barber code or password" } }, { status: 401 });
    }

    if (user.isActive === false) {
      return NextResponse.json({ success: false, error: { message: "This account has been suspended. Please contact the platform admin." } }, { status: 403 });
    }

    // Generate JWT token
    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      barberCode: user.barberCode,
      tokenVersion: user.tokenVersion || 0,
    });
    
    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        id: user._id,
        name: user.name,
        barberCode: user.barberCode,
        role: user.role
      } 
    });
    
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
