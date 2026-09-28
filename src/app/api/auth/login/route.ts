import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { z } from "zod";
import { signToken } from "@/lib/auth";
import { cookies } from "next/headers";

const loginSchema = z.object({
  barberCode: z.string().min(1, "Barber Code is required"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    const body = await req.json();
    const result = loginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: (result.error as any).errors[0].message } }, { status: 400 });
    }
    
    const { barberCode, password } = result.data;
    
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
    
    // Generate JWT token
    const token = signToken({
      userId: user._id.toString(),
      role: user.role,
      barberCode: user.barberCode
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
