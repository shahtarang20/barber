import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; barberId: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    const { id, barberId } = await params;

    const shop = await Shop.findById(id);
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    if (shop.ownerId.toString() === barberId) {
      return NextResponse.json({
        success: false,
        error: { message: "Can't remove the shop's owner directly — delete the whole shop instead if needed." },
      }, { status: 400 });
    }

    const target = await User.findOne({ _id: barberId, shopId: shop._id });
    if (!target) {
      return NextResponse.json({ success: false, error: { message: "That barber isn't a member of this shop." } }, { status: 404 });
    }

    target.shopId = null;
    await target.save();

    shop.barberIds = shop.barberIds.filter((bid: any) => bid.toString() !== barberId);
    shop.staff = (shop.staff || []).filter((s: { userId: { toString(): string } }) => s.userId.toString() !== barberId); // staff access ends with membership
    await shop.save();

    return NextResponse.json({ success: true, data: { message: `${target.name} was removed from the shop.` } });
  } catch (error) {
    console.error("Admin remove shop member error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
