import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const url = new URL(req.url);
    const size = parseInt(url.searchParams.get("size") || "192", 10);
    
    await connectToDatabase();
    const { slug } = await params;
    const barber = await User.findOne({ slug, role: "BARBER" });

    // The letter for the logo (e.g., "R" for "Rahul")
    const initial = barber ? barber.name.charAt(0).toUpperCase() : "B";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
        <rect width="512" height="512" fill="#4f46e5" rx="100"/>
        <text x="50%" y="50%" font-family="system-ui, sans-serif" font-weight="bold" font-size="280" fill="#ffffff" text-anchor="middle" dominant-baseline="central">
          ${initial}
        </text>
      </svg>
    `;

    return new NextResponse(svg.trim(), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (error) {
    console.error("Icon generation error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
