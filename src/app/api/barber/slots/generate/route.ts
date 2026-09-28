import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { User } from "@/models/User";
import { addMinutes, format, parse } from "date-fns";

export async function POST(req: Request) {
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

    const body = await req.json();
    const { date, slotDuration = 30, capacity = 1 } = body; // default 30 mins, 1 booking per slot

    if (!date) {
      return NextResponse.json({ success: false, error: { message: "Date is required" } }, { status: 400 });
    }

    await connectToDatabase();
    
    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    }

    // Determine day of week
    const dateObj = new Date(date);
    const dayOfWeek = format(dateObj, "EEEE"); // e.g. "Monday"
    
    const dayConfig = user.workingHours.find((h: any) => h.day === dayOfWeek);
    
    if (!dayConfig || dayConfig.isClosed) {
      return NextResponse.json({ success: false, error: { message: `You are closed on ${dayOfWeek}s.` } }, { status: 400 });
    }

    // Generate slots
    const parseTime = (timeStr: string, date: Date) => {
      const cleanStr = timeStr.trim().toLowerCase();
      if (cleanStr.includes("am") || cleanStr.includes("pm")) {
        // Try h:mm a format (with space) or h:mma (without space)
        try {
          const strWithSpace = cleanStr.replace(/([0-9])(am|pm)/, "$1 $2");
          return parse(strWithSpace, "h:mm a", date);
        } catch(e) {
          return parse(timeStr, "HH:mm", date); // fallback
        }
      }
      return parse(timeStr, "HH:mm", date);
    };

    const startObj = parseTime(dayConfig.startTime, dateObj);
    const endObj = parseTime(dayConfig.endTime, dateObj);
    
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

    if (newSlots.length > 0) {
      await Slot.insertMany(newSlots);
    }

    return NextResponse.json({ 
      success: true, 
      data: { message: `Successfully generated and updated schedule for ${date}.` } 
    });

  } catch (error) {
    console.error("Generate slots error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
