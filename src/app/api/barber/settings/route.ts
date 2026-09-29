import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { cleanupStaleSlots } from "@/lib/slotCleanup";
import { notifyBarber } from "@/lib/realtime";
import { format } from "date-fns";
import { timeStringToMinutes } from "@/lib/timeSort";

const VALID_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function validateWorkingHours(workingHours: any): string | null {
  if (!Array.isArray(workingHours)) return "Working hours must be a list.";

  const seenDays = new Set<string>();
  for (const wh of workingHours) {
    if (!VALID_DAYS.includes(wh?.day)) {
      return `"${wh?.day}" is not a valid day of the week.`;
    }
    if (seenDays.has(wh.day)) {
      return `${wh.day} is listed more than once.`;
    }
    seenDays.add(wh.day);

    if (wh.isClosed) continue;

    if (!wh.startTime || !wh.endTime) {
      return `${wh.day} needs both an opening and closing time, or should be marked closed.`;
    }
    const start = timeStringToMinutes(wh.startTime);
    const end = timeStringToMinutes(wh.endTime);
    if (start >= end) {
      return `${wh.day}'s closing time must be after its opening time.`;
    }
  }
  return null;
}

export async function PUT(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const { bio, workingHours } = body;

    if (workingHours !== undefined) {
      const validationError = validateWorkingHours(workingHours);
      if (validationError) {
        return NextResponse.json({ success: false, error: { message: validationError } }, { status: 400 });
      }
    }

    await connectToDatabase();

    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    }

    if (bio !== undefined) user.bio = bio;
    if (workingHours !== undefined) user.workingHours = workingHours;

    await user.save();

    // Working hours only update this User document — already-generated Slot
    // documents for future dates don't know hours changed unless we sweep
    // them here (e.g. a day switched to closed after slots existed for it).
    let cleanup = { deletedCount: 0, blockedByBookings: 0 };
    if (workingHours !== undefined) {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      cleanup = await cleanupStaleSlots(payload.userId, workingHours, { $gte: todayStr });
      if (cleanup.deletedCount > 0) {
        notifyBarber(payload.userId, "SLOTS_UPDATED");
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        message: "Settings updated successfully",
        removedSlots: cleanup.deletedCount,
        slotsNeedingManualCancellation: cleanup.blockedByBookings,
      },
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
