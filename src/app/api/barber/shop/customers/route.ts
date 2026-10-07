import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { loadShopCustomers } from "@/lib/shopCustomers";

/**
 * Any shop barber's (owner or member) view of every customer who has booked with ANY barber of the shop — visits
 * added up across barbers, which barbers they've seen, and repeat customers. Barbers' private notes
 * are deliberately NOT included.
 */
export async function GET(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const search = (searchParams.get("search") || "").trim().slice(0, 60);
    const repeatOnly = searchParams.get("repeat") === "1";

    await connectToDatabase();
    const me = await User.findById(payload.userId).select("shopId");
    const shop = me?.shopId ? await Shop.findById(me.shopId) : null;
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "You don't belong to a shop." } }, { status: 403 });
    }

    const { data, total } = await loadShopCustomers(shop._id, { page, limit, search, repeatOnly });
    return NextResponse.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Shop customers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
