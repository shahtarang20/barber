import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { visitorUsage, getDefaultVisitorLimit } from "@/lib/visitorLimit";
import { getPlansConfig, subscriptionState } from "@/lib/plans";
import { shopLinkUsage, getDefaultLinkLimit } from "@/lib/linkLimit";

export async function GET(req: Request) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const skip = (page - 1) * limit;

    const total = await Shop.countDocuments();

    const shops = await Shop.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const ownerIds = shops.map((s) => s.ownerId);
    const owners = await User.find({ _id: { $in: ownerIds } }).select("name barberCode premiumAmount premiumDueDay planEndsOn grantedTier grantedUntil catalogueEnabled").lean();
    const plansCfg = await getPlansConfig();
    const ownerById = new Map(owners.map((o) => [o._id.toString(), o]));

    const defaultLinkLimit = await getDefaultLinkLimit();
    const usages = await Promise.all(shops.map((s) => shopLinkUsage(s._id, s.linkBookingLimit ?? null, defaultLinkLimit)));
    const defaultVisitorLimit = await getDefaultVisitorLimit();
    const visitors = await Promise.all(shops.map((s) => visitorUsage("SHOP", s._id, s.visitorLimit ?? null, defaultVisitorLimit)));
    const data = shops.map((s, i) => ({
      _id: s._id,
      name: s.name,
      slug: s.slug,
      isActive: s.isActive,
      memberCount: s.barberIds?.length || 0,
      owner: (() => { const o = ownerById.get(s.ownerId.toString()); return o ? { name: o.name, barberCode: o.barberCode } : null; })(),
      // The plan and the catalogue switch of a shop are its OWNER'S.
      plan: (() => { const o = ownerById.get(s.ownerId.toString()); return o ? subscriptionState(o, plansCfg) : null; })(),
      catalogueEnabled: ownerById.get(s.ownerId.toString())?.catalogueEnabled !== false,
      createdAt: s.createdAt,
      linkBookingLimit: s.linkBookingLimit ?? null,
      linkUsed: usages[i].used,
      linkLimitEffective: usages[i].limit,
      visitorLimit: s.visitorLimit ?? null,
      visitorUsed: visitors[i].used,
      visitorLimitEffective: visitors[i].limit,
    }));

    return NextResponse.json({
      success: true,
      data,
      defaultLinkLimit,
      defaultVisitorLimit,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Fetch admin shops error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
