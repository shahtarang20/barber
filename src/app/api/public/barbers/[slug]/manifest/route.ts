import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

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
      background_color: "#ffffff",
      theme_color: "#4f46e5", // Indigo color from our theme
      icons: [
        {
          src: `/api/public/barbers/${slug}/icon?size=192`,
          sizes: "192x192",
          type: "image/svg+xml",
          purpose: "any maskable"
        },
        {
          src: `/api/public/barbers/${slug}/icon?size=512`,
          sizes: "512x512",
          type: "image/svg+xml",
          purpose: "any maskable"
        },
        // Plain pictures: Android needs a PNG icon to install the page as a proper app.
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
      ]
    };

    return NextResponse.json(manifest);
  } catch (error) {
    console.error("Manifest generation error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
