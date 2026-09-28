import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
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

    if (slot.status !== "BLOCKED") {
      return NextResponse.json({ success: false, error: { message: "Only blocked slots can be unblocked" } }, { status: 400 });
    }

    slot.status = "AVAILABLE";
    
    let waitlistCustomer = null;
    if (slot.waitlist && slot.waitlist.length > 0) {
      // Pull the first person off the waitlist
      waitlistCustomer = slot.waitlist.shift();
      // Wait, do we want to auto-book them or just notify them?
      // "automatically prepares a WhatsApp message to notify them that a spot just opened up"
      // Let's just pull them from the waitlist and notify them. They can book it themselves.
    }
    
    await slot.save();

    return NextResponse.json({ success: true, data: slot, waitlistCustomer });
  } catch (error) {
    console.error("Unblock slot error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
