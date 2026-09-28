import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { notifyBarber } from "@/lib/realtime";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const { capacity } = body;

    if (!capacity || typeof capacity !== 'number' || capacity < 1) {
      return NextResponse.json({ success: false, error: { message: "Invalid capacity. Must be 1 or greater." } }, { status: 400 });
    }

    await connectToDatabase();
    
    const resolvedParams = await params;
    const slot = await Slot.findOne({ _id: resolvedParams.id, barberId: payload.userId });
    if (!slot) {
      return NextResponse.json({ success: false, error: { message: "Slot not found" } }, { status: 404 });
    }

    if (capacity < slot.bookingsCount) {
      return NextResponse.json({ success: false, error: { message: `Capacity cannot be less than current bookings (${slot.bookingsCount}).` } }, { status: 400 });
    }

    slot.capacity = capacity;
    slot.isCustomCapacity = true;
    
    // If the new capacity is greater than current bookings, and the slot was BOOKED, we should open it up to AVAILABLE
    if (slot.capacity > slot.bookingsCount && slot.status === "BOOKED") {
      slot.status = "AVAILABLE";
    }
    // If the new capacity equals current bookings, and the slot is AVAILABLE, we should mark it as BOOKED
    else if (slot.capacity === slot.bookingsCount && slot.status === "AVAILABLE") {
      slot.status = "BOOKED";
    }

    await slot.save();

    notifyBarber(payload.userId, "SLOTS_UPDATED");

    return NextResponse.json({ success: true, data: slot });
  } catch (error) {
    console.error("Update capacity error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
