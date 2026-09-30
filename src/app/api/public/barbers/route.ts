import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20") || 20, 1), 100);
    const q = (searchParams.get("q") || "").trim().slice(0, 50);

    await connectToDatabase();

    const filter: Record<string, unknown> = { role: "BARBER", isActive: true };
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { barberCode: rx }];
    }

    const total = await User.countDocuments(filter);
    const barbers = await User.find(filter)
      .select("name slug bio profileImage barberCode")
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: barbers,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Fetch public barbers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
