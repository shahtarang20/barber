import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "BARBER") {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date"); // Format YYYY-MM-DD

    if (!date) {
      return NextResponse.json({ success: false, error: { message: "Date is required" } }, { status: 400 });
    }

    await connectToDatabase();
    
    // Fetch slots for this barber on this date
    // Sort by startTime (lexicographical sort works for HH:MM format if 24hr, but we have AM/PM, so we'll need to sort on client or ensure format is correct)
    const slots = await Slot.find({
      barberId: payload.userId,
      date: date
    });

    return NextResponse.json({ success: true, data: slots });
  } catch (error) {
    console.error("Fetch slots error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
