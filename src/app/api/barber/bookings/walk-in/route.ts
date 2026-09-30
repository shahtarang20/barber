import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { getTodayISTString } from "@/lib/istTime";
import { bookSlotForStaff } from "@/lib/staffBooking";
import { Slot } from "@/models/Slot";

const schema = z.object({
  slotId: z.string().min(1, "Slot is required"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Valid phone number is required"),
});

/** A barber records a customer who walked in (or phoned): books one of his own open slots for them, any day. */
export async function POST(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const { slotId, name, phone } = parsed.data;

    await connectToDatabase();
    // "Walk-in" if it's for today, "Phone booking" if for a later day.
    const slotDate = await Slot.findById(slotId).select("date").lean<{ date: string } | null>().catch(() => null);
    const note = slotDate && slotDate.date !== getTodayISTString() ? "Phone booking" : "Walk-in";

    const result = await bookSlotForStaff({ slotId, barberId: payload.userId, name, phone, note });
    if (!result.ok) return NextResponse.json({ success: false, error: { message: result.message } }, { status: result.status });
    return NextResponse.json({ success: true, data: { bookingNumber: result.bookingNumber } }, { status: 201 });
  } catch (error) {
    console.error("Walk-in error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
