import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { getDefaultLinkLimit, setDefaultLinkLimit } from "@/lib/linkLimit";

/** Platform default for the monthly booking limit on public links (0 = unlimited). */
export async function GET() {
  try {
    if (!(await requireAuth(["ADMIN"]))) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    await connectToDatabase();
    return NextResponse.json({ success: true, data: { defaultLimit: await getDefaultLinkLimit() } });
  } catch (error) {
    console.error("Get link limit error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!(await requireAuth(["ADMIN"]))) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    const n = Number((await req.json().catch(() => ({}))).defaultLimit);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
      return NextResponse.json({ success: false, error: { message: "Enter a whole number (0 = unlimited)." } }, { status: 400 });
    }
    await connectToDatabase();
    await setDefaultLinkLimit(n);
    return NextResponse.json({ success: true, data: { defaultLimit: n } });
  } catch (error) {
    console.error("Set link limit error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
