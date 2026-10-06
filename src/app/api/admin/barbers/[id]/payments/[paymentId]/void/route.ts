import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { PlanError, voidPayment } from "@/lib/planAdmin";

const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });
const schema = z.object({ reason: z.string().trim().min(3, "Please say why (at least 3 letters).").max(200) });

/** Cancels a payment recorded by mistake. The row stays in the history, marked void. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) return fail("Unauthorized: Admins only", 401);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const { id, paymentId } = await params;
    await connectToDatabase();
    const admin = await User.findById(payload.userId).select("name").lean<{ name: string } | null>();
    const payment = await voidPayment(id, paymentId, parsed.data.reason, { id: payload.userId, name: admin?.name || "Admin" });
    return NextResponse.json({ success: true, data: { payment } });
  } catch (error) {
    if (error instanceof PlanError) return fail(error.message, error.status);
    console.error("Void payment error:", error);
    return fail("Internal server error", 500);
  }
}
