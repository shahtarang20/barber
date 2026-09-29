import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { notifyBarber } from "@/lib/realtime";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const { capacity } = body;

    if (!capacity || typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity < 1 || capacity > 50) {
      return NextResponse.json({ success: false, error: { message: "Invalid capacity. Must be a whole number between 1 and 50." } }, { status: 400 });
    }

    await connectToDatabase();

    const resolvedParams = await params;

    // Atomic conditional update: the capacity-vs-bookingsCount check and the
    // write happen as one operation, so a concurrent booking (which bumps
    // bookingsCount separately) or a second capacity edit can't act on data
    // that's gone stale between a separate read and a separate write.
    const slot = await Slot.findOneAndUpdate(
      {
        _id: resolvedParams.id,
        barberId: payload.userId,
        $expr: { $gte: [capacity, "$bookingsCount"] },
      },
      [
        {
          $set: {
            capacity,
            isCustomCapacity: true,
            status: {
              $cond: [
                { $and: [{ $gt: [capacity, "$bookingsCount"] }, { $eq: ["$status", "BOOKED"] }] },
                "AVAILABLE",
                {
                  $cond: [
                    { $and: [{ $eq: [capacity, "$bookingsCount"] }, { $eq: ["$status", "AVAILABLE"] }] },
                    "BOOKED",
                    "$status",
                  ],
                },
              ],
            },
          },
        },
      ],
      { new: true }
    );

    if (!slot) {
      // Either the slot doesn't exist/belong to this barber, or the
      // capacity would now be less than the (possibly just-changed)
      // current booking count — re-check which, for an accurate message.
      const existing = await Slot.findOne({ _id: resolvedParams.id, barberId: payload.userId }).select("bookingsCount");
      if (!existing) {
        return NextResponse.json({ success: false, error: { message: "Slot not found" } }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: { message: `Capacity cannot be less than current bookings (${existing.bookingsCount}).` } }, { status: 400 });
    }

    notifyBarber(payload.userId, "SLOTS_UPDATED");

    return NextResponse.json({ success: true, data: slot });
  } catch (error) {
    console.error("Update capacity error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
