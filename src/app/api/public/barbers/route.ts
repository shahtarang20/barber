import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  try {
    if (!(await rateLimit(`public-barber-list:${getClientIp(req)}`, 120, 60_000, { local: true }))) {
      return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20") || 20, 1), 100);
    const q = (searchParams.get("q") || "").trim().slice(0, 50);

    await connectToDatabase();

    const filter: Record<string, unknown> = { role: "BARBER", isActive: true };
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.name = rx; // never match on the login code: it must not be discoverable from the public list
    }

    const total = await User.countDocuments(filter);
    const barbers = await User.find(filter)
      .select("name slug bio profileImage") // the login code (barberCode) is private
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: barbers,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } }); // the same public list for everyone
  } catch (error) {
    console.error("Fetch public barbers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
