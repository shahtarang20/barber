import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { z } from "zod";

const addMemberSchema = z.object({
  barberCode: z.string().min(1, "Barber code is required"),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    const body = await req.json();
    const result = addMemberSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }

    await connectToDatabase();
    const { id } = await params;

    const shop = await Shop.findById(id);
    if (!shop) {
      return NextResponse.json({ success: false, error: { message: "Shop not found" } }, { status: 404 });
    }

    const barberCode = result.data.barberCode.trim().toLowerCase();
    const target = await User.findOne({ barberCode, role: "BARBER" });
    if (!target) {
      return NextResponse.json({ success: false, error: { message: "No barber found with that code." } }, { status: 404 });
    }
    if (target.shopId) {
      return NextResponse.json({ success: false, error: { message: `${target.name} already belongs to a shop.` } }, { status: 400 });
    }

    target.shopId = shop._id;
    await target.save();

    shop.barberIds = [...shop.barberIds.filter((bid: any) => bid.toString() !== target._id.toString()), target._id];
    await shop.save();

    return NextResponse.json({ success: true, data: { message: `${target.name} added to ${shop.name}.` } });
  } catch (error) {
    console.error("Admin add shop member error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
