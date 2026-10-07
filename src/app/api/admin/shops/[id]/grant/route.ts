import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { rateLimit } from "@/lib/rateLimit";
import { User } from "@/models/User";
import { PlanError, setGrant } from "@/lib/planAdmin";
import mongoose from "mongoose";
import { Shop } from "@/models/Shop";

const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });
const schema = z.object({
  tier: z.enum(["PREMIUM", "BUSINESS", "NONE"], { message: "Choose Premium, Business or remove the access." }),
  months: z.number().int("Months must be a whole number.").min(1, "At least 1 month.").max(36, "At most 36 months.").optional(),
  until: z.string().optional(),
});

/** Admin: give free access to a paid plan (or take it away). For a shop the plan belongs to its owner, so it is given to the owner (the shop and all its members follow). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) return fail("Unauthorized: Admins only", 401);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { id } = await params;
    await connectToDatabase();
    if (!(await rateLimit(`plan-grant:${payload.userId}`, 60, 60_000))) return fail("Too many changes too quickly. Wait a minute.", 429);
    const admin = await User.findById(payload.userId).select("name").lean<{ name: string } | null>();
    if (!mongoose.isValidObjectId(id)) return fail("Invalid shop.");
    const shop = await Shop.findById(id).select("name ownerId").lean<{ name: string; ownerId: mongoose.Types.ObjectId } | null>();
    if (!shop) return fail("Shop not found.", 404);
    const result = await setGrant(String(shop.ownerId), parsed.data, { id: payload.userId, name: admin?.name || "Admin" }, shop.name);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof PlanError) return fail(error.message, error.status);
    console.error("Grant plan error:", error);
    return fail("Internal server error", 500);
  }
}
