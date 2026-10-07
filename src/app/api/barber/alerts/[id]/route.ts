import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { DashboardAlert } from "@/models/DashboardAlert";

/** The details behind a live alert (customer name, phone, waitlist). Only the barber the alert was made for can read it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    await connectToDatabase();
    const alert = await DashboardAlert.findOne({ _id: id, barberId: payload.userId }).lean<{ type: string; data?: unknown } | null>();
    if (!alert) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    return NextResponse.json({ success: true, data: { type: alert.type, data: alert.data } });
  } catch (error) {
    console.error("Alert fetch error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
