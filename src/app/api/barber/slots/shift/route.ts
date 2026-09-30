import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { notifyBarber } from "@/lib/realtime";
import { parseDateOnly, timeStringToMinutes, endTimeToMinutes } from "@/lib/timeSort";
import { format, addMinutes, startOfDay } from "date-fns";
import { minutesUntilSlot, getTodayISTString } from "@/lib/istTime";

export async function POST(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { date, shiftMinutes } = await req.json();

    if (!date || !shiftMinutes || isNaN(shiftMinutes) || shiftMinutes <= 0) {
      return NextResponse.json({ success: false, error: { message: "Valid date and shiftMinutes are required." } }, { status: 400 });
    }

    await connectToDatabase();
    
    // Find all slots for this date for this barber, then sort DESCENDING by
    // actual time (not a Mongo string sort — "10:00 AM" vs "9:00 AM" sorts
    // wrong lexicographically). Since we're shifting forward in time,
    // processing the latest slot first means it moves into an empty time
    // slot before an earlier slot tries to move into where it currently
    // sits — processing ascending would collide with the unique
    // {barberId,date,startTime} index the moment two back-to-back slots
    // both exist, which is the normal case.
    const unsortedSlots = await Slot.find({ barberId: payload.userId, date });
    const slots = unsortedSlots.sort((a, b) => timeStringToMinutes(b.startTime) - timeStringToMinutes(a.startTime));
    if (slots.length === 0) {
      return NextResponse.json({ success: false, error: { message: "No slots found for this date." } }, { status: 404 });
    }

    const dateObj = parseDateOnly(date);
    const affectedCustomers = [];
    
    // We only want to shift slots that haven't happened yet
    const slotsToShift = slots.filter(slot => {
      // If it's today, check if it's in the future
      if (date === getTodayISTString()) {
        try {
          return minutesUntilSlot(date, slot.startTime) > -30; // Shift anything that hasn't fully passed
        } catch (e) {
          return true;
        }
      }
      return true; // Future dates: shift everything
    });

    if (slotsToShift.length === 0) {
      return NextResponse.json({ success: false, error: { message: "No upcoming slots to shift today." } }, { status: 400 });
    }

    // Reject upfront if shifting the latest slot would cross midnight —
    // silently letting it wrap would produce a slot whose time label says
    // e.g. "12:30 AM" while its `date` field still says today, corrupting
    // the two out of sync with each other.
    const latestEndMins = Math.max(...slotsToShift.map((s) => endTimeToMinutes(s.endTime)));
    if (latestEndMins + shiftMinutes >= 24 * 60) {
      return NextResponse.json({ success: false, error: { message: "That shift would push a slot past midnight. Please choose a smaller amount." } }, { status: 400 });
    }

    // Process shifting
    for (const slot of slotsToShift) {
      const oldTime = slot.startTime;
      const oldStartMins = timeStringToMinutes(slot.startTime);
      const oldEndMins = timeStringToMinutes(slot.endTime);

      const baseDate = startOfDay(new Date(2000, 0, 1));
      const newStartDate = addMinutes(baseDate, oldStartMins + shiftMinutes);
      const newEndDate = addMinutes(baseDate, oldEndMins + shiftMinutes);

      const newStartTimeStr = format(newStartDate, "h:mm a");
      const newEndTimeStr = format(newEndDate, "h:mm a");

      slot.shiftedAt = new Date();
      slot.startTime = newStartTimeStr;
      slot.endTime = newEndTimeStr;
      await slot.save();

      // If there are bookings for this slot, update them and collect customer info
      if (slot.bookingsCount > 0) {
        const bookings = await Booking.find({ slotId: slot._id, status: "CONFIRMED" });
        for (const booking of bookings) {
          booking.startTime = newStartTimeStr;
          booking.endTime = newEndTimeStr;
          await booking.save();

          const customer = await Customer.findById(booking.customerId);
          if (customer) {
            affectedCustomers.push({
              name: customer.name,
              phone: customer.phone,
              oldTime,
              newTime: newStartTimeStr
            });
          }
        }
      }
    }

    notifyBarber(payload.userId, "SLOTS_UPDATED");
    notifyBarber(payload.userId, "BOOKINGS_UPDATED");

    return NextResponse.json({
      success: true,
      data: {
        message: `Successfully shifted ${slotsToShift.length} slots by ${shiftMinutes} minutes.`,
        affectedCustomers
      }
    });

  } catch (error) {
    console.error("Shift schedule error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
