import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Customer } from "@/models/Customer";
import mongoose from "mongoose";
import { z } from "zod";
import { notifyBarber } from "@/lib/realtime";

const noteSchema = z.object({
  note: z.string().max(1000, "Note must be 1000 characters or fewer"),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();

    // Resolve params for Next.js 15+
    const resolvedParams = await params;
    const customerId = resolvedParams.id;
    const barberId = new mongoose.Types.ObjectId(payload.userId);

    const body = await req.json();
    const result = noteSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }
    const { note } = result.data;

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

    notifyBarber(payload.userId, "CUSTOMERS_UPDATED");

    return NextResponse.json({ success: true, data: { note } });
  } catch (error) {
    console.error("Update note error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
