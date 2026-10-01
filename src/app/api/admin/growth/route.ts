import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { computeGrowth, setPusherLimit } from "@/lib/growth";

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

/** The admin tells the app which Pusher plan size they pay for (default 100 = free). */
export async function PUT(req: Request) {
  try {
    if (!(await requireAuth(["ADMIN"]))) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    const n = Number((await req.json().catch(() => ({}))).pusherLimit);
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
      return NextResponse.json({ success: false, error: { message: "Enter a whole number of connections, for example 100 or 500." } }, { status: 400 });
    }
    await connectToDatabase();
    await setPusherLimit(n);
    return NextResponse.json({ success: true, data: { pusherLimit: n } });
  } catch (error) {
    console.error("Set growth plan error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
