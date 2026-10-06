import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { PlanPayment } from "@/models/PlanPayment";
import { getPlansConfig, limitsOf, subscriptionState } from "@/lib/plans";

/** The signed-in barber's plan: what they pay, until when, what is allowed, and their recent payments. */
export async function GET() {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    await connectToDatabase();
    const [u, cfg, payments] = await Promise.all([
      User.findById(payload.userId).select("premiumAmount premiumDueDay planEndsOn lastPaymentAt").lean<{ premiumAmount?: number; premiumDueDay?: number; planEndsOn?: string } | null>(),
      getPlansConfig(),
      PlanPayment.find({ barberId: payload.userId, status: "PAID" }).sort({ createdAt: -1 }).limit(10).select("amount months method periodStart periodEnd createdAt").lean(),
    ]);
    const state = subscriptionState(u || {}, cfg);
    return NextResponse.json({ success: true, data: { ...state, limits: limitsOf(state.tier, cfg), graceDays: cfg.graceDays, payments } });
  } catch (error) {
    console.error("Barber plan error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
