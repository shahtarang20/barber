import { NextResponse } from "next/server";
import mongoose from "mongoose";
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

    if (slot.status !== "BLOCKED") {
      return NextResponse.json({ success: false, error: { message: "Only blocked slots can be unblocked" } }, { status: 400 });
    }

    // Take the BLOCKED -> AVAILABLE step atomically, so a double tap (or two devices) unblocks once and hands the
    // seat to the waitlist once.
    const opened = await Slot.findOneAndUpdate({ _id: slot._id, barberId: payload.userId, status: "BLOCKED" }, { $set: { status: "AVAILABLE" } }, { new: true });
    if (!opened) {
      return NextResponse.json({ success: false, error: { message: "Only blocked slots can be unblocked" } }, { status: 400 });
    }

    // A slot whose seats are all taken (visits already completed) reopens as full, not as bookable.
    if (opened.bookingsCount >= opened.capacity) await Slot.updateOne({ _id: slot._id, status: "AVAILABLE", $expr: { $gte: ["$bookingsCount", "$capacity"] } }, { $set: { status: "BOOKED" } });

    let waitlistCustomer = null;
    let autoBooking = null;

    // Auto-convert the first waitlisted customer into a confirmed booking,
    // rather than just notifying them — avoids the race where someone else
    // books the slot before they get a chance to.
    if (opened.waitlist && opened.waitlist.length > 0 && opened.bookingsCount < opened.capacity) {
      // Atomically take the first person AND their seat (the document before the change tells who was first).
      const before = await Slot.findOneAndUpdate(
        { _id: slot._id, status: "AVAILABLE", "waitlist.0": { $exists: true }, $expr: { $lt: ["$bookingsCount", "$capacity"] } },
        { $pop: { waitlist: -1 }, $inc: { bookingsCount: 1 } },
        { new: false }
      );
      const entry = before?.waitlist?.[0];
      if (before && entry) {
        waitlistCustomer = { name: entry.name, phone: entry.phone };
        try {
          // Same rule as every other booking: phone AND name (case-insensitive), so a waitlisted customer is never
          // attached to somebody else's record that merely shares the phone number.
          let customer = await Customer.findOne({ phone: entry.phone, name: String(entry.name).trim() }).collation({ locale: "en", strength: 2 });
          if (!customer) {
            customer = new Customer({ name: String(entry.name).trim(), phone: entry.phone });
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
          autoBooking = { bookingNumber: newBooking.bookingNumber };
        } catch (err) {
          // Could not save the booking: give the seat back and put the person back first in line.
          await Slot.updateOne({ _id: slot._id }, { $inc: { bookingsCount: -1 }, $push: { waitlist: { $each: [entry], $position: 0 } } });
          throw err;
        }
        await Slot.updateOne({ _id: slot._id, status: "AVAILABLE", $expr: { $gte: ["$bookingsCount", "$capacity"] } }, { $set: { status: "BOOKED" } });
      }
    }

    const fresh = (await Slot.findById(slot._id)) ?? opened;

    notifyBarber(payload.userId, autoBooking ? "BOOKINGS_UPDATED" : "SLOTS_UPDATED");

    return NextResponse.json({ success: true, data: fresh, waitlistCustomer, autoBooking });
  } catch (error) {
    console.error("Unblock slot error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
