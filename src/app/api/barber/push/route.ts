import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { PushSubscription } from "@/models/PushSubscription";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** Saves this device's push subscription so the barber gets booking notifications. */
export async function POST(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Invalid subscription" } }, { status: 400 });
    }

    await connectToDatabase();
    // One row per device; re-subscribing from the same device (or a device a
    // different barber used before) just repoints it to the current barber.
    await PushSubscription.findOneAndUpdate(
      { endpoint: parsed.data.endpoint },
      { $set: { barberId: payload.userId, keys: parsed.data.keys } },
      { upsert: true }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

/** Removes this device's subscription (barber turned notifications off). */
export async function DELETE(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { endpoint } = await req.json().catch(() => ({}));
    if (typeof endpoint !== "string") {
      return NextResponse.json({ success: false, error: { message: "Invalid subscription" } }, { status: 400 });
    }
    await connectToDatabase();
    await PushSubscription.deleteOne({ endpoint, barberId: payload.userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
