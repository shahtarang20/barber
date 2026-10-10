import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { publicOrigin } from "@/lib/origin";
import { CatalogueSettings } from "@/models/CatalogueSettings";
import { appIconUrl, normalizeHex } from "@/lib/brandColor";

/** Install manifest for a shop's booking page: the installed app carries the shop's name and opens the shop page. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await rateLimit(`shop-manifest:${getClientIp(req)}`, 60, 60_000, { local: true }))) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    await connectToDatabase();
    const { slug } = await params;
    const shop = await Shop.findOne({ slug, isActive: true }).select("name").lean<{ _id: import("mongoose").Types.ObjectId; name: string } | null>();
    if (!shop) return new NextResponse("Not Found", { status: 404 });

    // The owner's brand colour (if any) colours the installed app and gives it a matching generated icon.
    const settings = await CatalogueSettings.findOne({ ownerType: "SHOP", ownerId: shop._id }).select("brandColor").lean<{ brandColor?: string } | null>();
    const brand = normalizeHex(settings?.brandColor);

    const manifest = {
      name: `${shop.name} - Booking App`,
      short_name: shop.name.length > 12 ? shop.name.slice(0, 12).trim() : shop.name,
      description: `Book your next haircut at ${shop.name}.`,
      id: `/s/${slug}`,
      start_url: `/s/${slug}`,
      display: "standalone",
      // Lets Chrome on Android answer "is this app already installed?", so we keep asking until it is and stop once it is.
      related_applications: [{ platform: "webapp", url: `${publicOrigin(req)}/api/public/shops/${slug}/manifest` }],
      prefer_related_applications: false,
      background_color: brand ?? "#ffffff",
      theme_color: brand ?? "#4f46e5",
      icons: brand
        ? [
            // Generated PNGs in the owner's colour (the address carries the colour, so a changed colour is a new picture and caches refresh).
            { src: appIconUrl({ color: brand, name: shop.name, size: 192 }), sizes: "192x192", type: "image/png", purpose: "any" },
            { src: appIconUrl({ color: brand, name: shop.name, size: 512 }), sizes: "512x512", type: "image/png", purpose: "any" },
            { src: appIconUrl({ color: brand, name: shop.name, size: 192, maskable: true }), sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: appIconUrl({ color: brand, name: shop.name, size: 512, maskable: true }), sizes: "512x512", type: "image/png", purpose: "maskable" },
          ]
        : [
            // Real PNG pictures only: phones build the installed app from these, and an SVG (or a mislabelled file) can make the install fall back to a plain shortcut.
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
    };

    return NextResponse.json(manifest, { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    console.error("Shop manifest error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
