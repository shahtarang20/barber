import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { ShopInvite } from "@/models/ShopInvite";
import { z } from "zod";

const addMemberSchema = z.object({
  barberCode: z.string().min(1, "Barber code is required"),
});

export async function POST(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const result = addMemberSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }

    await connectToDatabase();

    const owner = await User.findById(payload.userId);
    if (!owner?.shopId) {
      return NextResponse.json({ success: false, error: { message: "You don't belong to a shop." } }, { status: 400 });
    }

    const shop = await Shop.findById(owner.shopId);
    if (!shop || shop.ownerId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Only the shop owner can add members." } }, { status: 403 });
    }

    const barberCode = result.data.barberCode.trim().toLowerCase();
    const target = await User.findOne({ barberCode, role: "BARBER" });
    if (!target) {
      return NextResponse.json({ success: false, error: { message: "No barber found with that code." } }, { status: 404 });
    }

    if (target._id.toString() === payload.userId) {
      return NextResponse.json({ success: false, error: { message: "You're already the owner of this shop." } }, { status: 400 });
    }

    if (target.shopId) {
      return NextResponse.json({ success: false, error: { message: `${target.name} already belongs to a shop.` } }, { status: 400 });
    }

    // Not added directly: the barber has to accept first.
    try {
      await ShopInvite.create({ shopId: shop._id, barberId: target._id, invitedBy: owner._id });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return NextResponse.json({ success: false, error: { message: `You already invited ${target.name}. They haven't answered yet.` } }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json({ success: true, data: { message: `Invitation sent to ${target.name}. They'll join once they accept.` } });
  } catch (error) {
    console.error("Add shop member error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
