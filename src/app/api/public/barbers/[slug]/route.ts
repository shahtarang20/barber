import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { barberLinkUsage } from "@/lib/linkLimit";
import { admitVisitor } from "@/lib/visitorLimit";
import { memo } from "@/lib/memo";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(`public-barber:${getClientIp(req)}`, 300, 60_000, { local: true }))) {
      return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
    }
    await connectToDatabase();
    
    const resolvedParams = await params;
    const slug = resolvedParams.slug;
    
    // Find barber by slug, only return safe public fields
    // The profile itself changes rarely, so it is remembered for a few seconds per server instance; the visitor count and
    // the monthly booking cap below are still checked on every request.
    const barber = await memo(`pub:barber:${slug}`, 10_000, () =>
      User.findOne({ slug, role: "BARBER" }).select("name profileImage bio workingHours isActive linkBookingLimit visitorLimit").lean<Record<string, any> | null>());

    if (!barber || barber.isActive === false) {
      return NextResponse.json({ success: false, error: { message: "Barber not found" } }, { status: 404 });
    }

    const { closed } = await barberLinkUsage(barber._id, barber.linkBookingLimit ?? null);
    // The admin's cap on unique visitors per month: a NEW visitor beyond it sees the "closed" page (the booking cap above is unchanged).
    const { allowed } = await admitVisitor(req, "BARBER", barber._id, barber.visitorLimit ?? null);
    const publicFields = { ...barber };
    delete publicFields.linkBookingLimit; // admin-only numbers are never sent to customers
    delete publicFields.visitorLimit;
    return NextResponse.json({ success: true, data: { ...publicFields, linkClosed: closed || !allowed } });
  } catch (error) {
    console.error("Fetch public barber error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
