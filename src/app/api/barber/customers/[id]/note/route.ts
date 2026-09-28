import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Customer } from "@/models/Customer";
import mongoose from "mongoose";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "BARBER") {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();
    
    // Resolve params for Next.js 15+
    const resolvedParams = await params;
    const customerId = resolvedParams.id;
    const barberId = new mongoose.Types.ObjectId(payload.userId);
    
    const body = await req.json();
    const { note } = body;
    
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return NextResponse.json({ success: false, error: { message: "Customer not found" } }, { status: 404 });
    }

    // Check if a note already exists for this barber
    let noteExists = false;
    if (!customer.barberNotes) {
      customer.barberNotes = [];
    } else {
      for (let n of customer.barberNotes) {
        if (n.barberId.toString() === barberId.toString()) {
          n.note = note;
          noteExists = true;
          break;
        }
      }
    }

    if (!noteExists) {
      customer.barberNotes.push({ barberId, note });
    }

    await customer.save();

    return NextResponse.json({ success: true, data: { note } });
  } catch (error) {
    console.error("Update note error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
