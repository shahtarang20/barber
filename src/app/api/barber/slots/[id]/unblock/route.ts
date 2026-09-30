import { NextResponse } from "next/server";
import { timeStringToMinutes } from "@/lib/timeSort";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { Customer } from "@/models/Customer";
import { Booking } from "@/models/Booking";
import { Counter } from "@/models/Counter";
import { notifyBarber } from "@/lib/realtime";

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
    let autoBooking = null;

    // Auto-convert the first waitlisted customer into a confirmed booking,
    // rather than just notifying them — avoids the race where someone else
    // books the slot before they get a chance to.
    if (slot.waitlist && slot.waitlist.length > 0 && slot.bookingsCount < slot.capacity) {
      const entry = slot.waitlist.shift();
      waitlistCustomer = { name: entry.name, phone: entry.phone };

      let customer = await Customer.findOne({ phone: entry.phone });
      if (!customer) {
        customer = new Customer({ name: entry.name, phone: entry.phone });
        await customer.save();
      }

      const counter = await Counter.findByIdAndUpdate(
        { _id: "bookingNumber" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const bookingNumber = `B-${counter.seq.toString().padStart(4, "0")}`;

      const newBooking = new Booking({
        bookingNumber,
        barberId: slot.barberId,
        slotId: slot._id,
        customerId: customer._id,
        date: slot.date,
        startTime: slot.startTime,
        startMinutes: timeStringToMinutes(slot.startTime),
        endTime: slot.endTime,
        status: "CONFIRMED",
      });
      await newBooking.save();

      slot.bookingsCount += 1;
      if (slot.bookingsCount >= slot.capacity) {
        slot.status = "BOOKED";
      }

      autoBooking = { bookingNumber: newBooking.bookingNumber };
    }

    await slot.save();

    notifyBarber(payload.userId, autoBooking ? "BOOKINGS_UPDATED" : "SLOTS_UPDATED");

    return NextResponse.json({ success: true, data: slot, waitlistCustomer, autoBooking });
  } catch (error) {
    console.error("Unblock slot error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
