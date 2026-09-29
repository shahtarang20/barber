import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { Customer } from "@/models/Customer";
import { Booking } from "@/models/Booking";
import { Counter } from "@/models/Counter";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { notifyBarber } from "@/lib/realtime";
import { normalizePhone } from "@/lib/phone";
import { User } from "@/models/User";

const bookingSchema = z.object({
  slotId: z.string().min(1, "Slot is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Valid phone number is required"),
  notes: z.string().max(500, "Notes must be 500 characters or fewer").optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`public-booking:${ip}`, 10, 60_000)) {
      return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }

    await connectToDatabase();
    
    const body = await req.json();
    const result = bookingSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }
    
    const { slotId, name, phone, notes } = result.data;
    
    // ATOMIC OPERATION: Check if bookingsCount < capacity and increment in one step.
    const slot = await Slot.findOneAndUpdate(
      { _id: slotId, status: "AVAILABLE", $expr: { $lt: ["$bookingsCount", "$capacity"] } },
      { $inc: { bookingsCount: 1 } },
      { new: true }
    );

    if (!slot) {
      return NextResponse.json({
        success: false,
        error: { code: "SLOT_ALREADY_BOOKED", message: "Sorry, this slot is fully booked or unavailable. Please choose another time." }
      }, { status: 409 });
    }

    // A slot can outlive the barber being deactivated after it was
    // generated — don't let a booking complete against a suspended barber.
    const barber = await User.findById(slot.barberId).select("isActive").lean();
    if (!barber || barber.isActive === false) {
      await Slot.findByIdAndUpdate(slot._id, { $set: { status: "AVAILABLE" }, $inc: { bookingsCount: -1 } });
      return NextResponse.json({
        success: false,
        error: { message: "This barber is no longer accepting bookings." },
      }, { status: 410 });
    }

    // If we just hit capacity, mark it as BOOKED so it doesn't show in UI
    if (slot.bookingsCount >= slot.capacity) {
      await Slot.findByIdAndUpdate(slot._id, { $set: { status: "BOOKED" } });
    }

    let counterIncremented = false;
    try {
      const normalizedPhone = normalizePhone(phone);

      // Find or create customer
      let customer = await Customer.findOne({ phone: normalizedPhone });
      if (!customer) {
        customer = new Customer({ name, phone: normalizedPhone });
        await customer.save();
      } else if (customer.name !== name) {
        // Update the name if they changed it
        customer.name = name;
        await customer.save();
      }

      // Generate human-readable booking number (e.g. RB-1042)
      // For MVP, we will use a global counter for booking numbers
      const counter = await Counter.findByIdAndUpdate(
        { _id: "bookingNumber" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      counterIncremented = true;

      const bookingNumber = `B-${counter.seq.toString().padStart(4, "0")}`;

      // Create Booking
      const newBooking = new Booking({
        bookingNumber,
        barberId: slot.barberId,
        slotId: slot._id,
        customerId: customer._id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "CONFIRMED",
        notes
      });

      await newBooking.save();

      // slot.bookingId is no longer used since a slot can have multiple bookings
      // The relation is maintained by Booking.slotId

      notifyBarber(slot.barberId.toString(), "BOOKINGS_UPDATED");

      return NextResponse.json({
        success: true, 
        data: { 
          bookingNumber: newBooking.bookingNumber,
          date: newBooking.date,
          startTime: newBooking.startTime,
          customerName: customer.name
        } 
      }, { status: 201 });

    } catch (bookingError) {
      // ROLLBACK: If creating the booking fails, we MUST release the slot back to AVAILABLE
      await Slot.findByIdAndUpdate(slot._id, { $set: { status: "AVAILABLE" }, $inc: { bookingsCount: -1 } });
      if (counterIncremented) {
        // Best-effort: avoid permanently burning a booking-number sequence
        // value for a booking that never actually got created.
        await Counter.findByIdAndUpdate({ _id: "bookingNumber" }, { $inc: { seq: -1 } });
      }
      console.error("Booking creation failed, rolled back slot:", bookingError);
      return NextResponse.json({ success: false, error: { message: "Failed to create booking. Slot has been released." } }, { status: 500 });
    }
    
  } catch (error) {
    console.error("Public booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
