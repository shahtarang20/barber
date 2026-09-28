import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    await connectToDatabase();
    
    // We await params since Next.js 15+ dynamic route params are promises
    const resolvedParams = await params;
    const slotId = resolvedParams.id;
    
    const slot = await Slot.findById(slotId);
    
    if (!slot) {
      return NextResponse.json({ success: false, error: { message: "Slot not found" } }, { status: 404 });
    }

    // Verify ownership
    if (slot.barberId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Forbidden" } }, { status: 403 });
    }

    if (slot.status === "BOOKED") {
      return NextResponse.json({ success: false, error: { message: "Cannot block an already booked slot" } }, { status: 400 });
    }

    slot.status = "BLOCKED";
    await slot.save();

    return NextResponse.json({ success: true, data: slot });
  } catch (error) {
    console.error("Block slot error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
