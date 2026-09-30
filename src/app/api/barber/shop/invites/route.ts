import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { ShopInvite } from "@/models/ShopInvite";
import { User } from "@/models/User";

/** Invitations waiting for the signed-in barber to accept or decline. */
export async function GET() {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    await connectToDatabase();
    const me = await User.findById(payload.userId).select("shopId");
    if (me?.shopId) return NextResponse.json({ success: true, data: [] }); // already in a shop

    const invites = await ShopInvite.find({ barberId: payload.userId, status: "PENDING" })
      .populate("shopId", "name")
      .populate("invitedBy", "name");
    const data = invites
      .filter((i: any) => i.shopId)
      .map((i: any) => ({ _id: i._id, shopName: i.shopId.name, invitedBy: i.invitedBy?.name }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Fetch invites error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
