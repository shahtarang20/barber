import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { AuditLog } from "@/models/AuditLog";
import { effectivePlan, staffLevel } from "@/lib/plans";

const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });
const schema = z.object({ userId: z.string(), catalogue: z.boolean(), analytics: z.boolean() });

/** The shop owner decides what each other barber of the shop may do with the shop catalogue and the shop numbers. */
export async function PUT(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return fail("Unauthorized", 401);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || !mongoose.isValidObjectId(parsed.data.userId)) return fail("Invalid request.");
    const { userId, catalogue, analytics } = parsed.data;
    await connectToDatabase();
    const me = await User.findById(payload.userId).select("name shopId").lean<{ name: string; shopId?: mongoose.Types.ObjectId | null } | null>();
    const shop = me?.shopId ? await Shop.findById(me.shopId) : null;
    if (!shop || String(shop.ownerId) !== payload.userId) return fail("Only the shop owner can change staff access.", 403);
    if (userId === payload.userId) return fail("You already have full access as the owner.");
    const member = await User.findOne({ _id: userId, shopId: shop._id }).select("name").lean<{ _id: mongoose.Types.ObjectId; name: string } | null>();
    if (!member) return fail("That barber is not in your shop.", 404);

    const level = staffLevel((await effectivePlan(payload.userId)).limits.tier);
    if (level === "NONE" && (catalogue || analytics)) return fail("Staff access is part of the Premium plan.", 403);
    if (level === "BASIC" && analytics) return fail("Access to the shop numbers is part of the Business plan.", 403);

    const others = (shop.staff || []).filter((s: { userId: mongoose.Types.ObjectId }) => String(s.userId) !== userId);
    shop.staff = catalogue || analytics ? [...others, { userId: member._id, catalogue, analytics }] : others;
    await shop.save();
    await AuditLog.create({ action: "STAFF_ACCESS_CHANGED", actorId: payload.userId, actorName: me?.name || "Owner", targetId: member._id, targetName: member.name, metadata: { shop: shop.name, catalogue, analytics } }).catch((e: unknown) => console.error("Audit failed:", e));
    return NextResponse.json({ success: true, data: { userId, catalogue, analytics } });
  } catch (error) {
    console.error("Staff access error:", error);
    return fail("Internal server error", 500);
  }
}
