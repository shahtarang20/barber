import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await connectToDatabase();
    
    const resolvedParams = await params;
    const slug = resolvedParams.slug;
    
    // Find barber by slug, only return safe public fields
    const barber = await User.findOne({ slug, role: "BARBER" })
      .select("name profileImage bio workingHours isActive");
    
    if (!barber) {
      return NextResponse.json({ success: false, error: { message: "Barber not found" } }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: barber });
  } catch (error) {
    console.error("Fetch public barber error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
