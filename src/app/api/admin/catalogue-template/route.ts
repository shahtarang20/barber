import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { CatalogueSettings } from "@/models/CatalogueSettings";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { isTemplateId, hashTemplate } from "@/lib/catalogueTemplate";

const denied = () => NextResponse.json({ success: false, error: { message: "Unauthorized: Admins only" } }, { status: 401 });
const bad = (message: string) => NextResponse.json({ success: false, error: { message } }, { status: 400 });
const ownerTypeOf = (v: unknown) => (v === "SHOP" || v === "BARBER" ? v : null);

/** Customer page style of several shops / barbers at once: { id: { template: 1-5 | null (auto), effective: 1-5 } }. */
export async function GET(req: Request) {
  try {
    if (!(await requireAuth(["ADMIN"]))) return denied();
    const url = new URL(req.url);
    const ownerType = ownerTypeOf(url.searchParams.get("ownerType"));
    const ids = (url.searchParams.get("ids") || "").split(",").filter((x) => mongoose.isValidObjectId(x)).slice(0, 200);
    if (!ownerType) return bad("ownerType must be SHOP or BARBER.");
    await connectToDatabase();
    const rows = await CatalogueSettings.find({ ownerType, ownerId: { $in: ids } }).select("ownerId template").lean<{ ownerId: mongoose.Types.ObjectId; template?: number }[]>();
    const stored = new Map(rows.map((r) => [String(r.ownerId), isTemplateId(r.template) ? r.template : null]));
    return NextResponse.json({ success: true, data: Object.fromEntries(ids.map((id) => { const t = stored.get(id) ?? null; return [id, { template: t, effective: t ?? hashTemplate(id) }]; })) });
  } catch (error) {
    console.error("Get catalogue template error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}

/** Pin a style (1-5), or send template: null for Auto (back to the owner-id based one). */
export async function PUT(req: Request) {
  try {
    if (!(await requireAuth(["ADMIN"]))) return denied();
    const body = await req.json().catch(() => ({}));
    const ownerType = ownerTypeOf(body.ownerType);
    if (!ownerType || !mongoose.isValidObjectId(body.ownerId)) return bad("ownerType and ownerId are required.");
    const template = body.template === null ? null : Number(body.template);
    if (template !== null && !isTemplateId(template)) return bad("Style must be 1 to 5, or Auto.");
    await connectToDatabase();
    const exists = ownerType === "SHOP" ? await Shop.exists({ _id: body.ownerId }) : await User.exists({ _id: body.ownerId, role: "BARBER" });
    if (!exists) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    const filter = { ownerType, ownerId: new mongoose.Types.ObjectId(body.ownerId) };
    if (template === null) await CatalogueSettings.updateOne(filter, { $unset: { template: 1 } });
    else await CatalogueSettings.updateOne(filter, { $set: { template }, $setOnInsert: filter }, { upsert: true });
    return NextResponse.json({ success: true, data: { template, effective: template ?? hashTemplate(body.ownerId) } });
  } catch (error) {
    console.error("Set catalogue template error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
