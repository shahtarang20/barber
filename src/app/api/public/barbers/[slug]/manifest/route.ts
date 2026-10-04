import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { publicOrigin } from "@/lib/origin";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(`manifest:${getClientIp(req)}`, 60, 60_000))) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    await connectToDatabase();
    const { slug } = await params;
    const barber = await User.findOne({ slug, role: "BARBER", isActive: true });

    if (!barber) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const manifest = {
      name: `${barber.name} - Booking App`,
      short_name: barber.name,
      description: `Book your next haircut with ${barber.name}.`,
      start_url: `/b/${slug}`,
      display: "standalone",
      // Lets Chrome on Android answer "is this app already installed?", so we keep asking until it is and stop once it is.
      related_applications: [{ platform: "webapp", url: `${publicOrigin(req)}/api/public/barbers/${slug}/manifest` }],
      prefer_related_applications: false,
      background_color: "#ffffff",
      theme_color: "#4f46e5", // Indigo color from our theme
      icons: [
        // Real PNG pictures only: phones build the installed app from these, and an SVG (or a mislabelled file) can make the install fall back to a plain shortcut.
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ]
    };

    return NextResponse.json(manifest, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    console.error("Manifest generation error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
