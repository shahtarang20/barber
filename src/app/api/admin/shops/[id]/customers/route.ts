import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { loadShopCustomers } from "@/lib/shopCustomers";

/** Admin: the customers of ONE shop (the same list the shop's own barbers see), listed under that shop's name. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAuth(["ADMIN"]))) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: { message: "Invalid shop." } }, { status: 400 });
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const search = (searchParams.get("search") || "").trim().slice(0, 60);
    await connectToDatabase();
    const shop = await Shop.findById(id).select("name slug").lean<{ _id: unknown; name: string; slug: string } | null>();
    if (!shop) return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    const { data, total } = await loadShopCustomers(shop._id, { page, limit, search, repeatOnly: searchParams.get("repeat") === "1" });
    return NextResponse.json({ success: true, data: { shop: { name: shop.name, slug: shop.slug }, customers: data }, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Admin shop customers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
