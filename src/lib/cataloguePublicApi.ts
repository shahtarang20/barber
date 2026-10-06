import { NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

/** Customers' catalogue pages are cached for a few seconds at the edge: fresh enough for owner edits, light on the database. */
export const PUBLIC_CACHE = "public, max-age=0, s-maxage=15, stale-while-revalidate=60";

export async function publicLimit(req: Request): Promise<NextResponse | null> {
  if (await rateLimit(`public-catalogue:${getClientIp(req)}`, 240, 60_000)) return null;
  return NextResponse.json({ success: false, error: { message: "Too many requests. Please try again shortly." } }, { status: 429 });
}

export const publicJson = (data: unknown) => NextResponse.json({ success: true, data }, { headers: { "Cache-Control": PUBLIC_CACHE } });
export const publicError = (message: string, status: number) => NextResponse.json({ success: false, error: { message } }, { status });
