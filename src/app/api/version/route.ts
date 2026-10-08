import { NextResponse } from "next/server";

/** The version of the app that is live right now. The page compares it with the version it was loaded with. No database, no secrets. */
export function GET() {
  return NextResponse.json({ version: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
