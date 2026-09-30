import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { bookSlotForStaff } from "@/lib/staffBooking";
import { pushToBarber } from "@/lib/push";

const schema = z.object({
  barberId: z.string().min(1),
  slotId: z.string().min(1, "Please choose a time"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Valid phone number is required"),
});

/** Shop front desk: the shop owner books a customer with ANY barber of the shop. */
export async function POST(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: parsed.error.issues[0].message } }, { status: 400 });
    }
    const { barberId, slotId, name, phone } = parsed.data;
    if (!mongoose.isValidObjectId(barberId)) return NextResponse.json({ success: false, error: { message: "Barber not found in your shop." } }, { status: 404 });

    await connectToDatabase();
    const owner = await User.findById(payload.userId).select("shopId");
    const shop = owner?.shopId ? await Shop.findById(owner.shopId) : null;
    if (!shop || shop.ownerId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Only the shop owner can book for the shop's barbers." } }, { status: 403 });
    }
    const target = await User.findOne({ _id: barberId, shopId: shop._id, isActive: { $ne: false } }).select("name");
    if (!target) return NextResponse.json({ success: false, error: { message: "Barber not found in your shop." } }, { status: 404 });

    const result = await bookSlotForStaff({ slotId, barberId, name, phone, note: "Front desk" });
    if (!result.ok) return NextResponse.json({ success: false, error: { message: result.message } }, { status: result.status });

    // Tell the barber whose chair it is — it's not on his own phone otherwise.
    if (barberId !== payload.userId) {
      await pushToBarber(barberId, { title: "New booking (front desk)", body: `${name} at ${result.slot.startTime} on ${result.slot.date}` });
    }
    return NextResponse.json({ success: true, data: { bookingNumber: result.bookingNumber, barberName: target.name, startTime: result.slot.startTime, date: result.slot.date } }, { status: 201 });
  } catch (error) {
    console.error("Shop front-desk booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
