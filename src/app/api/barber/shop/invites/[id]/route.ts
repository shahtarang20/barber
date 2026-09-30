import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { ShopInvite } from "@/models/ShopInvite";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";

/** The invited barber accepts or declines. Body: { action: "accept" | "decline" }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;
    const { action } = await req.json().catch(() => ({}));
    if (!mongoose.isValidObjectId(id) || (action !== "accept" && action !== "decline")) {
      return NextResponse.json({ success: false, error: { message: "Invalid request." } }, { status: 400 });
    }

    await connectToDatabase();
    // Only a still-pending invitation addressed to this barber can be answered, and only once.
    const invite = await ShopInvite.findOneAndUpdate(
      { _id: id, barberId: payload.userId, status: "PENDING" },
      { $set: { status: action === "accept" ? "ACCEPTED" : "DECLINED" } },
      { new: true }
    );
    if (!invite) return NextResponse.json({ success: false, error: { message: "Invitation not found or already answered." } }, { status: 404 });
    if (action === "decline") return NextResponse.json({ success: true, data: { message: "Invitation declined." } });

    const me = await User.findById(payload.userId);
    const shop = await Shop.findById(invite.shopId);
    if (!me || !shop) {
      await ShopInvite.updateOne({ _id: id }, { $set: { status: "CANCELLED" } });
      return NextResponse.json({ success: false, error: { message: "That shop no longer exists." } }, { status: 404 });
    }
    if (me.shopId) {
      await ShopInvite.updateOne({ _id: id }, { $set: { status: "CANCELLED" } });
      return NextResponse.json({ success: false, error: { message: "You already belong to a shop. Leave it first." } }, { status: 400 });
    }

    me.shopId = shop._id;
    await me.save();
    shop.barberIds = [...shop.barberIds.filter((b: any) => b.toString() !== me._id.toString()), me._id];
    await shop.save();
    // Any other invitations this barber had are now moot.
    await ShopInvite.updateMany({ barberId: me._id, status: "PENDING" }, { $set: { status: "CANCELLED" } });

    return NextResponse.json({ success: true, data: { message: `You joined ${shop.name}.` } });
  } catch (error) {
    console.error("Answer invite error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

/** The shop owner withdraws a pending invitation. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: { message: "Invalid request." } }, { status: 400 });

    await connectToDatabase();
    const invite = await ShopInvite.findOne({ _id: id, status: "PENDING" });
    const shop = invite ? await Shop.findById(invite.shopId) : null;
    if (!invite || !shop || shop.ownerId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Invitation not found." } }, { status: 404 });
    }
    invite.status = "CANCELLED";
    await invite.save();
    return NextResponse.json({ success: true, data: { message: "Invitation withdrawn." } });
  } catch (error) {
    console.error("Withdraw invite error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
