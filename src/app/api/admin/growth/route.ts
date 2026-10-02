import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { CHECK_KEYS, computeGrowth, saveGrowthSettings } from "@/lib/growth";

/** Where the business stands against the growth plan (shops, online barbers, storage) with upgrade warnings. */
export async function GET() {
  try {
    if (!(await requireAuth(["ADMIN"]))) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    await connectToDatabase();
    return NextResponse.json({ success: true, data: await computeGrowth() });
  } catch (error) {
    console.error("Growth error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

/** The admin saves the plan sizes they pay for, or marks a manual check as done today. */
export async function PUT(req: Request) {
  try {
    if (!(await requireAuth(["ADMIN"]))) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const whole = (v: unknown, max: number) => (v === undefined ? undefined : Number.isInteger(v) && (v as number) >= 1 && (v as number) <= max ? (v as number) : null);
    const patch = {
      pusherLimit: whole(body.pusherLimit, 1_000_000),
      pusherDailyMessages: whole(body.pusherDailyMessages, 1_000_000_000),
      redisMonthlyCommands: whole(body.redisMonthlyCommands, 1_000_000_000),
    };
    if (Object.values(patch).some((v) => v === null)) {
      return NextResponse.json({ success: false, error: { message: "Enter a whole number, for example 100 or 500000." } }, { status: 400 });
    }
    if (body.vercelPlan !== undefined && body.vercelPlan !== "hobby" && body.vercelPlan !== "pro") {
      return NextResponse.json({ success: false, error: { message: "Vercel plan must be hobby or pro." } }, { status: 400 });
    }
    if (body.checkedNow !== undefined && !(CHECK_KEYS as readonly string[]).includes(body.checkedNow)) {
      return NextResponse.json({ success: false, error: { message: "Unknown check." } }, { status: 400 });
    }
    await connectToDatabase();
    await saveGrowthSettings({
      pusherLimit: patch.pusherLimit as number | undefined,
      pusherDailyMessages: patch.pusherDailyMessages as number | undefined,
      redisMonthlyCommands: patch.redisMonthlyCommands as number | undefined,
      vercelPlan: body.vercelPlan,
      checkedNow: body.checkedNow,
    });
    return NextResponse.json({ success: true, data: await computeGrowth() });
  } catch (error) {
    console.error("Set growth plan error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
