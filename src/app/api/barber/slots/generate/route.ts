import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { User } from "@/models/User";
import { addMinutes, format, parse, isValid, addDays, startOfDay } from "date-fns";
import { notifyBarber } from "@/lib/realtime";
import { cleanupStaleSlots } from "@/lib/slotCleanup";
import { parseDateOnly } from "@/lib/timeSort";

export async function POST(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const { date, capacity: rawCapacity = 1 } = body;
    // Slots are always exactly 30 minutes — this is fixed, not configurable,
    // so barbers and customers always see a consistent, easy-to-scan schedule.
    const slotDuration = 30;

    if (!date) {
      return NextResponse.json({ success: false, error: { message: "Date is required" } }, { status: 400 });
    }

    const capacity = Number(rawCapacity);
    if (!Number.isFinite(capacity) || capacity < 1 || capacity > 50) {
      return NextResponse.json({ success: false, error: { message: "Capacity must be a whole number between 1 and 50." } }, { status: 400 });
    }

    const requestedDate = isNaN(Date.parse(date)) ? new Date(NaN) : startOfDay(parseDateOnly(date));
    const today = startOfDay(new Date());
    const maxFutureDate = addDays(today, 90);
    if (isNaN(requestedDate.getTime())) {
      return NextResponse.json({ success: false, error: { message: "Invalid date." } }, { status: 400 });
    }
    if (requestedDate < today) {
      return NextResponse.json({ success: false, error: { message: "Cannot generate slots for a past date." } }, { status: 400 });
    }
    if (requestedDate > maxFutureDate) {
      return NextResponse.json({ success: false, error: { message: "Cannot generate slots more than 90 days in advance." } }, { status: 400 });
    }

    await connectToDatabase();
    
    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    }

    // Determine day of week — parsed as a local calendar date, not UTC, since
    // `new Date("2026-09-29")` shifts to the previous evening in any
    // timezone west of UTC, which silently computes the wrong weekday.
    const dateObj = parseDateOnly(date);
    const dayOfWeek = format(dateObj, "EEEE"); // e.g. "Monday"
    
    const dayConfig = user.workingHours.find((h: any) => h.day === dayOfWeek);
    
    if (!dayConfig || dayConfig.isClosed) {
      // Even though we can't generate new slots for a closed day, still clear
      // out any stale unbooked slots left over from before it was marked
      // closed — otherwise manually re-clicking "Generate" here can't help
      // either, since this early return used to skip cleanup entirely.
      const cleanup = await cleanupStaleSlots(payload.userId, user.workingHours, date);
      if (cleanup.deletedCount > 0) {
        notifyBarber(payload.userId, "SLOTS_UPDATED");
      }
      return NextResponse.json({
        success: false,
        error: { message: `You are closed on ${dayOfWeek}s.` },
        data: { removedSlots: cleanup.deletedCount, slotsNeedingManualCancellation: cleanup.blockedByBookings },
      }, { status: 400 });
    }

    // Generate slots. date-fns' `parse` never throws on a bad format — it
    // silently returns an Invalid Date — so fallbacks must be checked with
    // `isValid`, not try/catch, and must convert the string before retrying.
    const parseTime = (timeStr: string, date: Date) => {
      const cleanStr = timeStr.trim().toLowerCase();
      if (cleanStr.includes("am") || cleanStr.includes("pm")) {
        // Try "h:mm a" (with space); if that fails, normalize and retry.
        const strWithSpace = cleanStr.replace(/([0-9])(am|pm)/, "$1 $2");
        const parsed = parse(strWithSpace, "h:mm a", date);
        if (isValid(parsed)) return parsed;
      }

      const parsed24h = parse(cleanStr, "HH:mm", date);
      if (isValid(parsed24h)) return parsed24h;

      throw new Error(`Unable to parse time value: "${timeStr}"`);
    };

    let startObj: Date;
    let endObj: Date;
    try {
      startObj = parseTime(dayConfig.startTime, dateObj);
      endObj = parseTime(dayConfig.endTime, dateObj);
    } catch (e) {
      return NextResponse.json({ success: false, error: { message: `Invalid working hours configured for ${dayOfWeek}. Please re-save your working hours.` } }, { status: 400 });
    }
    
    let currentSlotStart = startObj;
    const newSlots = [];

    // Simple generation without complex break handling for now
    while (currentSlotStart < endObj) {
      const currentSlotEnd = addMinutes(currentSlotStart, slotDuration);
      
      if (currentSlotEnd > endObj) break;

      const startTimeStr = format(currentSlotStart, "h:mm a");
      const endTimeStr = format(currentSlotEnd, "h:mm a");

      // Check if slot already exists to prevent duplicates
      const existingSlot = await Slot.findOne({
        barberId: user._id,
        date: date,
        startTime: startTimeStr,
      });

      if (!existingSlot) {
        newSlots.push({
          barberId: user._id,
          date: date,
          startTime: startTimeStr,
          endTime: endTimeStr,
          status: "AVAILABLE",
          capacity: Number(capacity),
          bookingsCount: 0,
        });
      } else if (!existingSlot.isCustomCapacity) {
        // Feature Fix: If barber generates again with a new capacity, update existing slots
        const newCap = Number(capacity);
        if (newCap >= (existingSlot.bookingsCount || 0)) {
          existingSlot.capacity = newCap;
          if (existingSlot.status === "BOOKED" && newCap > (existingSlot.bookingsCount || 0)) {
            existingSlot.status = "AVAILABLE";
          } else if (existingSlot.status === "AVAILABLE" && newCap === existingSlot.bookingsCount) {
            existingSlot.status = "BOOKED";
          }
          await existingSlot.save();
        }
      }

      currentSlotStart = currentSlotEnd;
    }

    // CLEANUP: Remove any unbooked slots outside the new working hours
    const allSlotsForDate = await Slot.find({ barberId: user._id, date: date });
    const slotsToDelete = [];
    
    for (const s of allSlotsForDate) {
      if (s.bookingsCount > 0) continue; // Never delete booked slots
      
      try {
        const sStart = parseTime(s.startTime, dateObj);
        if (sStart < startObj || sStart >= endObj) {
          slotsToDelete.push(s._id);
        }
      } catch(e) {
        // Ignore parsing errors for existing slots
      }
    }
    
    if (slotsToDelete.length > 0) {
      await Slot.deleteMany({ _id: { $in: slotsToDelete } });
    }

    if (newSlots.length > 0) {
      try {
        // ordered: false lets Mongo skip past a duplicate-key conflict (a
        // concurrent request already inserted that exact slot) instead of
        // aborting the whole batch — the unique index is the real guard
        // against two requests creating independently-bookable duplicates.
        await Slot.insertMany(newSlots, { ordered: false });
      } catch (err: any) {
        if (err?.code !== 11000 && !(err?.writeErrors?.every((e: any) => e.code === 11000))) {
          throw err;
        }
      }
    }

    notifyBarber(payload.userId, "SLOTS_UPDATED");

    return NextResponse.json({
      success: true, 
      data: { message: `Successfully generated and updated schedule for ${date}.` } 
    });

  } catch (error) {
    console.error("Generate slots error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
