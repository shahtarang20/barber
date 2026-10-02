import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/** The shop's app icon: its first letter on the brand colour. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(`shop-icon:${getClientIp(req)}`, 60, 60_000))) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    const url = new URL(req.url);
    const requested = parseInt(url.searchParams.get("size") || "192", 10);
    const size = Number.isFinite(requested) ? Math.min(Math.max(requested, 16), 1024) : 192;

    await connectToDatabase();
    const { slug } = await params;
    const shop = await Shop.findOne({ slug, isActive: true }).select("name").lean<{ name: string } | null>();

    // Escaped because it goes straight into SVG markup.
    const initial = (shop ? shop.name.trim().charAt(0).toUpperCase() : "B").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}"><rect width="512" height="512" fill="#4f46e5" rx="100"/><text x="50%" y="50%" font-family="system-ui, sans-serif" font-weight="bold" font-size="280" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initial}</text></svg>`;

    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
  } catch (error) {
    console.error("Shop icon error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
