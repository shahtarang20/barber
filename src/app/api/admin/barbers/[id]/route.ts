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
      updateData.premiumAmount = Number(body.premiumAmount);
    }
    
    if (body.premiumDueDay !== undefined) {
      updateData.premiumDueDay = Number(body.premiumDueDay);
    }
    
    if (body.isActive !== undefined) {
      updateData.isActive = Boolean(body.isActive);
    }

    const updatedUser = await User.findByIdAndUpdate(id, { $set: updateData }, { new: true }).select("-passwordHash");
    
    if (!updatedUser) {
      return NextResponse.json({ success: false, error: { message: "Barber not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Update barber error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
