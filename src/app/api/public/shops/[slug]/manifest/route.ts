import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

/** Install manifest for a shop's booking page: the installed app carries the shop's name and opens the shop page. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(`shop-manifest:${getClientIp(req)}`, 60, 60_000))) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    await connectToDatabase();
    const { slug } = await params;
    const shop = await Shop.findOne({ slug, isActive: true }).select("name").lean<{ name: string } | null>();
    if (!shop) return new NextResponse("Not Found", { status: 404 });

    const manifest = {
      name: `${shop.name} - Booking App`,
      short_name: shop.name.length > 12 ? shop.name.slice(0, 12).trim() : shop.name,
      description: `Book your next haircut at ${shop.name}.`,
      id: `/s/${slug}`,
      start_url: `/s/${slug}`,
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#4f46e5",
      icons: [
        { src: `/api/public/shops/${slug}/icon?size=192`, sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
        { src: `/api/public/shops/${slug}/icon?size=512`, sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" },
        // Plain pictures for phones and browsers that do not draw SVG icons.
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    };

    return NextResponse.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
  } catch (error) {
    console.error("Shop manifest error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
