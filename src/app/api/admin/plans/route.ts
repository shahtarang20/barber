import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { audit } from "@/lib/planAdmin";
import { DEFAULT_PLANS_CONFIG, LIMIT_BOUNDS, getPlansConfig, savePlansConfig, type TierLimits } from "@/lib/plans";

const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });
const limitField = (k: keyof TierLimits) => z.number().int("Use whole numbers.").min(0, "Limits cannot be negative.").max(LIMIT_BOUNDS[k], `Too large (most is ${LIMIT_BOUNDS[k]}).`);
const tier = z.object({ maxCategories: limitField("maxCategories"), maxServices: limitField("maxServices"), maxImagesPerService: limitField("maxImagesPerService"), maxVideosPerService: limitField("maxVideosPerService"), maxMediaMB: limitField("maxMediaMB"), maxActiveOffers: limitField("maxActiveOffers"), maxCampaignsPerWeek: limitField("maxCampaignsPerWeek") });
const schema = z.object({
  businessFromAmount: z.number().int().min(1, "Business starts at ₹1 or more.").max(1_000_000).optional(),
  graceDays: z.number().int("Use whole days.").min(0).max(60, "Grace can be at most 60 days.").optional(),
  tiers: z.object({ FREE: tier, PREMIUM: tier, BUSINESS: tier }).partial().optional(),
});

/** Plan sizes, the Business price threshold and the grace period (admin only). */
export async function GET() {
  try {
    if (!(await requireAuth(["ADMIN"]))) return fail("Unauthorized: Admins only", 401);
    await connectToDatabase();
    return NextResponse.json({ success: true, data: { config: await getPlansConfig(), defaults: DEFAULT_PLANS_CONFIG } });
  } catch (error) {
    console.error("Get plans error:", error);
    return fail("Internal server error", 500);
  }
}

export async function PUT(req: Request) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) return fail("Unauthorized: Admins only", 401);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    await connectToDatabase();
    const before = await getPlansConfig();
    const after = await savePlansConfig(parsed.data);
    const admin = await User.findById(payload.userId).select("name").lean<{ name: string } | null>();
    await audit({ id: payload.userId, name: admin?.name || "Admin" }, "PLAN_SETTINGS_CHANGED", null, { before, after });
    return NextResponse.json({ success: true, data: { config: after } });
  } catch (error) {
    console.error("Save plans error:", error);
    return fail("Internal server error", 500);
  }
}
