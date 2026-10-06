import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { rateLimit } from "@/lib/rateLimit";
import { CatalogueError, catalogueAllowed, resolveScope, type Scope } from "@/lib/catalogue";

export const ok = (data: unknown, status = 200) => NextResponse.json({ success: true, data }, { status });
export const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });
export const isId = (v: unknown): v is string => typeof v === "string" && mongoose.isValidObjectId(v);

/**
 * Wraps an owner endpoint: signed-in barber, rate limit (writes), catalogue switched on by the admin, and the catalogue
 * ("me" or "shop") he is allowed to change. Errors become clean JSON.
 */
export async function ownerRoute(req: Request, handler: (ctx: { scope: Scope; userId: string; url: URL }) => Promise<NextResponse>, opts: { write?: boolean; need?: "catalogue" | "analytics"; ownerOrFullOnly?: boolean } = {}) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return fail("Unauthorized", 401);
    await connectToDatabase();
    if (opts.write && !(await rateLimit(`catalogue-write:${payload.userId}`, 120, 60_000))) return fail("Too many changes too quickly. Please wait a minute.", 429);
    if (opts.need !== "analytics" && !(await catalogueAllowed(payload.userId))) return fail("The catalogue is switched off for your account. Please contact support.", 403);
    const url = new URL(req.url);
    const scope = await resolveScope(payload.userId, url.searchParams.get("scope"), opts.need);
    if (opts.need !== "analytics" && scope.ownerUserId !== payload.userId && !(await catalogueAllowed(scope.ownerUserId))) return fail("The catalogue is switched off for this shop. Please contact support.", 403);
    if (opts.ownerOrFullOnly && scope.role === "STAFF_BASIC") return fail("This needs the shop owner or full-access staff.", 403);
    return await handler({ scope, userId: payload.userId, url });
  } catch (err) {
    if (err instanceof CatalogueError) return fail(err.message, err.status);
    console.error("Catalogue error:", err);
    return fail("Internal server error", 500);
  }
}
