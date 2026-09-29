import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();
    const { id: targetId } = await params;

    const requester = await User.findById(payload.userId);
    if (!requester?.shopId) {
      return NextResponse.json({ success: false, error: { message: "You don't belong to a shop." } }, { status: 400 });
    }

    const shop = await Shop.findById(requester.shopId);
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found." } }, { status: 404 });
    }

    const isOwner = shop.ownerId.toString() === payload.userId;
    const isSelf = targetId === payload.userId;

    if (!isOwner && !isSelf) {
      return NextResponse.json({ success: false, error: { message: "Only the shop owner can remove other members." } }, { status: 403 });
    }

    if (isOwner && isSelf) {
      return NextResponse.json({ success: false, error: { message: "The owner can't leave — delete the shop instead if you want to disband it." } }, { status: 400 });
    }

    const target = await User.findOne({ _id: targetId, shopId: shop._id });
    if (!target) {
      return NextResponse.json({ success: false, error: { message: "That barber isn't a member of this shop." } }, { status: 404 });
    }

    target.shopId = null;
    await target.save();

    shop.barberIds = shop.barberIds.filter((id: any) => id.toString() !== targetId);
    await shop.save();

    return NextResponse.json({ success: true, data: { message: isSelf ? "You've left the shop." : `${target.name} was removed from the shop.` } });
  } catch (error) {
    console.error("Remove shop member error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
