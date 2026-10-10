import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

/**
 * Customers' catalogue data is cached for a few seconds at Vercel's edge (light on the database), but a phone's own browser must
 * ask every time: otherwise an owner who has just published a service would still be shown the old, empty catalogue for a minute or more.
 */
export const PUBLIC_CACHE = "public, max-age=0, must-revalidate";
export const PUBLIC_EDGE_CACHE = "s-maxage=10";

export async function publicLimit(req: Request): Promise<NextResponse | null> {
  if (await rateLimit(`public-catalogue:${getClientIp(req)}`, 240, 60_000, { local: true })) return null;
  return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
}

export const publicJson = (data: unknown) => NextResponse.json({ success: true, data }, { headers: { "Cache-Control": PUBLIC_CACHE, "Vercel-CDN-Cache-Control": PUBLIC_EDGE_CACHE } });
export const publicError = (message: string, status: number) => NextResponse.json({ success: false, error: { message } }, { status });
