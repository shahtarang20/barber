import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
});

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    const body = await req.json();
    const result = registerSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }
    
    const { name, email, password, slug } = result.data;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { slug }] });
    if (existingUser) {
      if (existingUser.email === email) {
        return NextResponse.json({ success: false, error: { message: "Email already registered" } }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: { message: "Booking URL slug is already taken" } }, { status: 400 });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Default working hours
    const defaultWorkingHours = [
      { day: "Monday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Tuesday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Wednesday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Thursday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Friday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Saturday", startTime: "10:00 AM", endTime: "8:00 PM", isClosed: false },
      { day: "Sunday", isClosed: true },
    ];
    
    // Create user (barberCode is auto-generated via pre-save hook)
    const newUser = new User({
      name,
      email,
      passwordHash,
      slug,
      role: "BARBER",
      workingHours: defaultWorkingHours,
    });
    
    await newUser.save();
    
    return NextResponse.json({ 
      success: true, 
      data: { 
        id: newUser._id, 
        name: newUser.name, 
        barberCode: newUser.barberCode,
        slug: newUser.slug
      } 
    }, { status: 201 });
    
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
