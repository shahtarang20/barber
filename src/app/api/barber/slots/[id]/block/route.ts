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
      
      let customersList: { name: string; phone: string; bookingId: unknown }[] = [];
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
        // Close the slot first (atomically), so no customer can take another seat while the bookings are being cancelled.
        await Slot.updateOne({ _id: slot._id }, { $set: { status: "BLOCKED" } });
        // Then cancel every still-confirmed booking and give back exactly one seat for each one really cancelled, as one unit
        // (a failure partway through must not leave the slot's bookingsCount out of sync with the bookings).
        // Seats of visits already COMPLETED stay counted, as everywhere else. A booking that was changed by someone else in the
        // meantime is simply skipped, never counted twice.
        const cancelledNow: { _id: unknown; customerId: unknown }[] = [];
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            cancelledNow.length = 0;
            const current = await Booking.find({ slotId: slot._id, status: "CONFIRMED" }).select("customerId").session(session).lean();
            for (const b of current) {
              const done = await Booking.findOneAndUpdate({ _id: b._id, status: "CONFIRMED", slotId: slot._id }, { $set: { status: "CANCELLED" } }, { session });
              if (!done) continue;
              await Slot.updateOne({ _id: slot._id, bookingsCount: { $gt: 0 } }, { $inc: { bookingsCount: -1 } }, { session });
              cancelledNow.push({ _id: b._id, customerId: b.customerId });
            }
          });
        } finally {
          await session.endSession();
        }
        customersList = [];
        for (const b of cancelledNow) {
          const customer = await Customer.findById(b.customerId);
          if (customer) customersList.push({ name: customer.name, phone: customer.phone, bookingId: b._id });
        }
        const fresh = (await Slot.findById(slot._id)) ?? slot;

        notifyBarber(payload.userId, "SLOTS_UPDATED");

        return NextResponse.json({
          success: true,
          data: fresh,
          cancelledCustomers: customersList
        });
      }
    }

    // Atomic: only a slot that still has no bookings is blocked (a customer booking at the same moment must never end up in a blocked slot).
    const blocked = await Slot.findOneAndUpdate({ _id: slot._id, bookingsCount: 0 }, { $set: { status: "BLOCKED" } }, { new: true });
    if (!blocked) {
      return NextResponse.json({ success: false, error: { message: "A booking has just come in for this slot. Please check it and try again." } }, { status: 409 });
    }

    notifyBarber(payload.userId, "SLOTS_UPDATED");

    return NextResponse.json({ success: true, data: blocked });
  } catch (error) {
    console.error("Block slot error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
