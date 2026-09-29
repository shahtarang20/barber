import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit)(`icon:${getClientIp(req)}`, 60, 60_000)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    const url = new URL(req.url);
    const requestedSize = parseInt(url.searchParams.get("size") || "192", 10);
    const size = Number.isFinite(requestedSize) ? Math.min(Math.max(requestedSize, 16), 1024) : 192;

    await connectToDatabase();
    const { slug } = await params;
    const barber = await User.findOne({ slug, role: "BARBER", isActive: true });

    // The letter for the logo (e.g., "R" for "Rahul"). Escaped since it's
    // interpolated directly into raw SVG/XML — a name starting with "<" or
    // "&" would otherwise produce malformed markup.
    const rawInitial = barber ? barber.name.charAt(0).toUpperCase() : "B";
    const initial = rawInitial.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
