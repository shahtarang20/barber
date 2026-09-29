import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { cleanupStaleSlots } from "@/lib/slotCleanup";
import { notifyBarber } from "@/lib/realtime";
import { format } from "date-fns";

export async function PUT(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const { bio, workingHours } = body;

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
