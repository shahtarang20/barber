import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { notifyBarber } from "@/lib/realtime";
import { timeStringToMinutes, endTimeToMinutes } from "@/lib/timeSort";
import { autoGenerateFutureSlots } from "@/lib/slotGenerator";

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
    const end = endTimeToMinutes(wh.endTime);
    if (start === Number.MAX_SAFE_INTEGER || end === Number.MAX_SAFE_INTEGER) {
      return `Invalid time format for ${wh.day}. Please use standard formats like "10:00 AM".`;
    }
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
    const { bio, workingHours, slotDuration, defaultCapacity } = body;

    if (workingHours !== undefined) {
      const validationError = validateWorkingHours(workingHours);
      if (validationError) {
        return NextResponse.json({ success: false, error: { message: validationError } }, { status: 400 });
      }
    }

    if (slotDuration !== undefined) {
      const duration = Number(slotDuration);
      if (!Number.isInteger(duration) || duration < 10 || duration > 60) {
        return NextResponse.json({ success: false, error: { message: "Slot duration must be a whole number of minutes between 10 and 60." } }, { status: 400 });
      }
    }

    if (defaultCapacity !== undefined) {
      const cap = Number(defaultCapacity);
      if (!Number.isInteger(cap) || cap < 1 || cap > 50) {
        return NextResponse.json({ success: false, error: { message: "Default capacity must be a whole number between 1 and 50." } }, { status: 400 });
      }
    }

    await connectToDatabase();

    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    }

    if (bio !== undefined) user.bio = bio;
    if (workingHours !== undefined) user.workingHours = workingHours;
    if (slotDuration !== undefined) user.slotDuration = Number(slotDuration);
    if (defaultCapacity !== undefined) user.defaultCapacity = Number(defaultCapacity);

    await user.save();

    // Any of these three settings changing means the future schedule can be
    // stale relative to what's now configured: a day's hours changed, the
    // slot-duration grid shifted (old slots no longer line up with it), or
    // the default capacity changed (existing slots would keep a stale
    // value). One reconciliation pass handles deletion of now-invalid
    // slots, capacity updates on still-valid ones, and creation of newly
    // opened ones — so Schedule always reflects exactly what Settings says.
    let reconcile = { createdCount: 0, updatedCount: 0, deletedCount: 0, blockedByBookings: 0, capacityKeptCount: 0 };
    if (workingHours !== undefined || slotDuration !== undefined || defaultCapacity !== undefined) {
      reconcile = await autoGenerateFutureSlots(
        payload.userId,
        workingHours !== undefined ? workingHours : user.workingHours,
        slotDuration !== undefined ? Number(slotDuration) : user.slotDuration || 30,
        defaultCapacity !== undefined ? Number(defaultCapacity) : user.defaultCapacity || 1
      );
      if (reconcile.createdCount > 0 || reconcile.updatedCount > 0 || reconcile.deletedCount > 0) {
        notifyBarber(payload.userId, "SLOTS_UPDATED");
      }
    }

    // Tell other open dashboards (a second device) to re-read the settings.
    notifyBarber(payload.userId, "SETTINGS_UPDATED");

    return NextResponse.json({
      success: true,
      data: {
        message: "Settings updated successfully",
        capacityKeptSlots: reconcile.capacityKeptCount,
        removedSlots: reconcile.deletedCount,
        slotsNeedingManualCancellation: reconcile.blockedByBookings,
      },
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
