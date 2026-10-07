import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { getDefaultVisitorLimit, setDefaultVisitorLimit } from "@/lib/visitorLimit";

/** Platform default for the monthly cap on unique visitors (network addresses) per public link (0 = unlimited). */
export async function GET() {
  try {
    if (!(await requireAuth(["ADMIN"]))) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    await connectToDatabase();
    return NextResponse.json({ success: true, data: { defaultLimit: await getDefaultVisitorLimit() } });
  } catch (error) {
    console.error("Get visitor limit error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    if (!(await requireAuth(["ADMIN"]))) return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    const n = Number((await req.json().catch(() => ({}))).defaultLimit);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
      return NextResponse.json({ success: false, error: { message: "Enter a whole number of visitors (0 = unlimited)." } }, { status: 400 });
    }
    await connectToDatabase();
    await setDefaultVisitorLimit(n);
    return NextResponse.json({ success: true, data: { defaultLimit: n } });
  } catch (error) {
    console.error("Set visitor limit error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
