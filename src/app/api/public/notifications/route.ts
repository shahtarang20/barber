import { NextResponse } from "next/server";
import { z } from "zod";
import connectToDatabase from "@/lib/mongodb";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { CustomerPush } from "@/models/CustomerPush";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { MAX_SUBSCRIBERS_PER_OWNER } from "@/lib/campaigns";

const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });
/** Only the browsers' real push services are accepted as a device address (the server will POST to it), never an arbitrary host. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/, /^web\.push\.apple\.com$/];
const allowedPushHost = (endpoint: string) => {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:") return false;
    if (process.env.PUSH_ALLOW_ANY_HOST === "1") return true; // any https host: local testing only, never set in production
    return !u.port && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch { return false; }
};
const target = z.object({ kind: z.enum(["barber", "shop"]), slug: z.string().min(1).max(80) });
const subscribe = target.extend({
  subscription: z.object({ endpoint: z.string().url().max(600).refine(allowedPushHost, "Invalid device."), keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) }),
});
const unsubscribe = target.extend({ endpoint: z.string().url().max(600) });

async function resolveOwner(kind: "barber" | "shop", slug: string) {
  if (kind === "shop") { const s = await Shop.findOne({ slug, isActive: true }).select("_id").lean<{ _id: unknown } | null>(); return s ? { ownerType: "SHOP" as const, ownerId: s._id } : null; }
  const b = await User.findOne({ slug, role: "BARBER", isActive: true }).select("_id").lean<{ _id: unknown } | null>();
  return b ? { ownerType: "BARBER" as const, ownerId: b._id } : null;
}

/** A customer says "yes, send me offers from this barber/shop" (this device only). */
export async function POST(req: Request) {
  try {
    const parsed = subscribe.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("Invalid request.");
    await connectToDatabase();
    if (!(await rateLimit(`cust-push:${getClientIp(req)}`, 20, 60 * 60_000))) return fail("Too many attempts. Please try again later.", 429);
    const owner = await resolveOwner(parsed.data.kind, parsed.data.slug);
    if (!owner) return fail("Not found.", 404);
    const filter = { ownerType: owner.ownerType, ownerId: owner.ownerId };
    const exists = await CustomerPush.exists({ ...filter, endpoint: parsed.data.subscription.endpoint });
    if (!exists && (await CustomerPush.countDocuments(filter)) >= MAX_SUBSCRIBERS_PER_OWNER) return fail("This shop cannot take more subscribers right now.", 429);
    await CustomerPush.updateOne({ ...filter, endpoint: parsed.data.subscription.endpoint }, { $set: { keys: parsed.data.subscription.keys }, $setOnInsert: { optedInAt: new Date() } }, { upsert: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer subscribe error:", error);
    return fail("Internal server error", 500);
  }
}

/** The customer turns offers off again. */
export async function DELETE(req: Request) {
  try {
    const parsed = unsubscribe.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("Invalid request.");
    await connectToDatabase();
    const owner = await resolveOwner(parsed.data.kind, parsed.data.slug);
    if (owner) await CustomerPush.deleteOne({ ownerType: owner.ownerType, ownerId: owner.ownerId, endpoint: parsed.data.endpoint });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer unsubscribe error:", error);
    return fail("Internal server error", 500);
  }
}
