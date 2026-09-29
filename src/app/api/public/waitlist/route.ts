import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { notifyBarber } from "@/lib/realtime";
import { normalizePhone } from "@/lib/phone";
import { User } from "@/models/User";

const waitlistSchema = z.object({
  slotId: z.string().min(1, "Slot is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Valid phone number is required"),
});

// Same two-layer approach as public bookings — a generous per-IP ceiling
// (CGNAT means many real customers can share one IP) plus a tight per-phone
// limit that actually catches a repeat offender.
const IP_LIMIT = 60;
const PHONE_LIMIT = 5;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`public-waitlist:${ip}`, IP_LIMIT, 60_000)) {
      return NextResponse.json({ success: false, error: { message: "Too many requests from your network. Please try again shortly." } }, { status: 429 });
    }

    await connectToDatabase();

    const body = await req.json();
    const result = waitlistSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }

    const { slotId, name } = result.data;
    const phone = normalizePhone(result.data.phone);

    if (!rateLimit(`public-waitlist-phone:${phone}`, PHONE_LIMIT, 60_000)) {
      return NextResponse.json({ success: false, error: { message: "Too many waitlist attempts with this phone number. Please try again in a minute." } }, { status: 429 });
    }

    // Don't let the same person join the same slot's waitlist repeatedly
    // (e.g. a resubmitted form) — check before the atomic push.
    const existingSlot = await Slot.findOne({ _id: slotId, "waitlist.phone": phone });
    if (existingSlot) {
      return NextResponse.json({
        success: false,
        error: { message: "You're already on the waitlist for this slot." },
      }, { status: 409 });
    }

    // Add to waitlist array using atomic push
    const slot = await Slot.findOneAndUpdate(
      { _id: slotId, status: { $ne: "BLOCKED" } },
      {
        $push: {
          waitlist: { name, phone, joinedAt: new Date() }
        }
      },
      { new: true }
    );

    if (!slot) {
      return NextResponse.json({
        success: false,
        error: { message: "Slot is no longer available for waitlisting." }
      }, { status: 400 });
    }

    const barber = await User.findById(slot.barberId).select("isActive").lean();
    if (!barber || barber.isActive === false) {
      await Slot.findByIdAndUpdate(slot._id, { $pull: { waitlist: { phone } } });
      return NextResponse.json({
        success: false,
        error: { message: "This barber is no longer accepting bookings." },
      }, { status: 410 });
    }

    notifyBarber(slot.barberId.toString(), "SLOTS_UPDATED");

    return NextResponse.json({
      success: true,
      data: {
        date: slot.date,
        startTime: slot.startTime,
        customerName: name,
        isWaitlist: true
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error("Public waitlist error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
