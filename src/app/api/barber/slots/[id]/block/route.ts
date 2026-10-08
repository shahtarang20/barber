import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { notifyBarber } from "@/lib/realtime";
import mongoose from "mongoose";

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
    if (!mongoose.isValidObjectId(slotId)) {
      return NextResponse.json({ success: false, error: { message: "Slot not found" } }, { status: 404 });
    }
    
    const slot = await Slot.findById(slotId);
    
    if (!slot) {
      return NextResponse.json({ success: false, error: { message: "Slot not found" } }, { status: 404 });
    }

    // Verify ownership
    if (slot.barberId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Forbidden" } }, { status: 403 });
    }

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    const { Booking } = await import("@/models/Booking");
    const { Customer } = await import("@/models/Customer");

    if (slot.status === "BOOKED" || slot.bookingsCount > 0) {
      const activeBookings = await Booking.find({ 
        slotId: slot._id,
        status: "CONFIRMED"
      });
      
      let customersList = [];
      for (const b of activeBookings) {
        const customer = await Customer.findById(b.customerId);
        if (customer) {
          customersList.push({ name: customer.name, phone: customer.phone, bookingId: b._id });
        }
      }
      
      if (!force) {
        return NextResponse.json({ 
          success: false, 
          requiresConfirmation: true,
          customers: customersList,
          error: { message: `This slot has existing bookings.` } 
        }, { status: 409 });
      } else {
        // Force-cancel all bookings and block the slot as one atomic unit —
        // without a transaction, a failure partway through (e.g. after
        // cancelling booking 1 of 3) left the slot's bookingsCount out of
        // sync with which bookings were actually cancelled.
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            for (const b of activeBookings) {
              b.status = "CANCELLED";
              await b.save({ session });
            }
            slot.status = "BLOCKED";
            slot.bookingsCount = 0;
            await slot.save({ session });
          });
        } finally {
          await session.endSession();
        }

        notifyBarber(payload.userId, "SLOTS_UPDATED");

        return NextResponse.json({
          success: true,
          data: slot,
          cancelledCustomers: customersList
        });
      }
    }

    slot.status = "BLOCKED";
    await slot.save();

    notifyBarber(payload.userId, "SLOTS_UPDATED");

    return NextResponse.json({ success: true, data: slot });
  } catch (error) {
    console.error("Block slot error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
