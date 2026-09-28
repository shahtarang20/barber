import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { z } from "zod";

const waitlistSchema = z.object({
  slotId: z.string().min(1, "Slot is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Valid phone number is required"),
});

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    const body = await req.json();
    const result = waitlistSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: (result.error as any).errors[0].message } }, { status: 400 });
    }
    
    const { slotId, name, phone } = result.data;
    
    // Add to waitlist array using atomic push
    const slot = await Slot.findOneAndUpdate(
      { _id: slotId, status: { $ne: "BLOCKED" } },
      { 
        $push: { 
          waitlist: { name, phone, joinedAt: new Date() } 
        } 
      },
      { new: true }
    );

    if (!slot) {
      return NextResponse.json({ 
        success: false, 
        error: { message: "Slot is no longer available for waitlisting." } 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        date: slot.date,
        startTime: slot.startTime,
        customerName: name,
        isWaitlist: true
      } 
    }, { status: 201 });
    
  } catch (error) {
    console.error("Public waitlist error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
