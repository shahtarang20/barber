import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { rateLimit } from "@/lib/rateLimit";
import { User } from "@/models/User";
import { PlanPayment } from "@/models/PlanPayment";
import { PlanError, recordPayment } from "@/lib/planAdmin";
import { getPlansConfig, subscriptionState } from "@/lib/plans";

const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });
const schema = z.object({
  amount: z.number({ message: "Enter the amount paid." }).min(0, "Amount cannot be negative.").max(10_000_000),
  months: z.number({ message: "Choose how many months." }).int("Months must be a whole number.").min(1, "At least 1 month.").max(24, "At most 24 months at a time."),
  method: z.enum(["CASH", "UPI", "BANK", "OTHER", "COMPLIMENTARY"], { message: "Choose how it was paid." }),
  reference: z.string().max(80).optional(),
  note: z.string().max(200).optional(),
});

/** Payment history of one barber, newest first (voided rows included), with where the plan stands now. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAuth(["ADMIN"]))) return fail("Unauthorized: Admins only", 401);
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return fail("Invalid barber.");
    await connectToDatabase();
    const [user, payments, cfg] = await Promise.all([
      User.findOne({ _id: id, role: "BARBER" }).select("name premiumAmount premiumDueDay planEndsOn lastPaymentAt").lean<{ premiumAmount?: number; premiumDueDay?: number; planEndsOn?: string } | null>(),
      PlanPayment.find({ barberId: id }).sort({ createdAt: -1 }).limit(100).lean(),
      getPlansConfig(),
    ]);
    if (!user) return fail("Barber not found.", 404);
    return NextResponse.json({ success: true, data: { plan: subscriptionState(user, cfg), payments } });
  } catch (error) {
    console.error("Payment history error:", error);
    return fail("Internal server error", 500);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) return fail("Unauthorized: Admins only", 401);
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    await connectToDatabase();
    if (!(await rateLimit(`plan-payment:${payload.userId}`, 60, 60_000))) return fail("Too many payments recorded too quickly. Wait a minute.", 429);
    const admin = await User.findById(payload.userId).select("name").lean<{ name: string } | null>();
    const payment = await recordPayment(id, parsed.data, { id: payload.userId, name: admin?.name || "Admin" });
    return NextResponse.json({ success: true, data: { payment } }, { status: 201 });
  } catch (error) {
    if (error instanceof PlanError) return fail(error.message, error.status);
    console.error("Record payment error:", error);
    return fail("Internal server error", 500);
  }
}
