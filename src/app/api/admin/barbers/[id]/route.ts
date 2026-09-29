import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["ADMIN"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
    }

    await connectToDatabase();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await req.json();
    const updateData: any = {};

    if (body.premiumAmount !== undefined) {
      const amount = Number(body.premiumAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ success: false, error: { message: "Premium amount must be a non-negative number." } }, { status: 400 });
      }
      updateData.premiumAmount = amount;
    }

    if (body.premiumDueDay !== undefined) {
      const day = Number(body.premiumDueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        return NextResponse.json({ success: false, error: { message: "Premium due day must be a whole number between 1 and 31." } }, { status: 400 });
      }
      updateData.premiumDueDay = day;
    }

    let suspending = false;
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
      suspending = updateData.isActive === false;
    }

    if (suspending) {
      // Force an immediate logout of any session this barber currently has
      // open — flipping isActive alone only blocks *future* requests once
      // requireAuth re-checks it; this makes existing tokens invalid too.
      updateData.$inc = { tokenVersion: 1 };
    }

    const { $inc, ...setFields } = updateData;
    const updateQuery: any = { $set: setFields };
    if ($inc) updateQuery.$inc = $inc;

    const updatedUser = await User.findByIdAndUpdate(id, updateQuery, { new: true }).select("-passwordHash -tokenVersion");

    if (!updatedUser) {
      return NextResponse.json({ success: false, error: { message: "Barber not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Update barber error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
