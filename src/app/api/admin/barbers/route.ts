import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";
import { getPlansConfig, subscriptionState } from "@/lib/plans";
import { visitorUsedMap, getDefaultVisitorLimit } from "@/lib/visitorLimit";
import { barberLinkUsedMap, getDefaultLinkLimit, effectiveLimit } from "@/lib/linkLimit";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10") || 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = (searchParams.get("search") || "").trim().slice(0, 60);
    const rx = search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    // A phone is stored as 10 plain digits, so match on the digits typed ("+91 98765 43210" and "98765" both work).
    // Only when what was typed looks like a phone number (digits, spaces, +, -, brackets). A code like "b001" must not match phones.
    const digits = search.replace(/\D/g, "");
    const phoneRx = digits.length >= 3 && /^[\d\s+()-]+$/.test(search) ? new RegExp(digits.replace(/^(91|0)(?=\d{10}$)/, "")) : rx;
    const filter: Record<string, unknown> = { role: "BARBER", ...(rx ? { $or: [{ name: rx }, { barberCode: rx }, { email: rx }, { phone: phoneRx }, { slug: rx }] } : {}) };

    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();

    const total = await User.countDocuments(filter);

    const barbers = await User.find(filter)
      .select("-passwordHash -tokenVersion")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // One grouped query for every barber on the page, instead of one count per barber.
    const counts = await Booking.aggregate([
      { $match: { barberId: { $in: barbers.map((b) => b._id) } } },
      { $group: { _id: "$barberId", count: { $sum: 1 } } },
    ]);
    const countByBarber = new Map<string, number>(counts.map((c) => [String(c._id), c.count]));
    const defaultLinkLimit = await getDefaultLinkLimit();
    const plansCfg = await getPlansConfig();
    const defaultVisitorLimit = await getDefaultVisitorLimit();
    // Two grouped queries for the whole page (not two counts per barber).
    const ids = barbers.map((b) => b._id);
    const [visitorUsed, linkUsed] = await Promise.all([visitorUsedMap("BARBER", ids), barberLinkUsedMap(ids)]);
    const visitors = barbers.map((b) => ({ used: visitorUsed.get(String(b._id)) ?? 0, limit: effectiveLimit(b.visitorLimit ?? null, defaultVisitorLimit) }));
    const usages = barbers.map((b) => ({ used: linkUsed.get(String(b._id)) ?? 0, limit: effectiveLimit(b.linkBookingLimit ?? null, defaultLinkLimit) }));
    const barbersWithStats = barbers.map((barber, i) => ({
      ...barber,
      bookingCount: countByBarber.get(String(barber._id)) ?? 0,
      linkUsed: usages[i].used,
      linkLimitEffective: usages[i].limit,
      plan: subscriptionState(barber, plansCfg),
      visitorUsed: visitors[i].used,
      visitorLimitEffective: visitors[i].limit,
    }));

    return NextResponse.json({
      success: true,
      data: barbersWithStats,
      defaultLinkLimit,
      defaultVisitorLimit,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch admin barbers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
