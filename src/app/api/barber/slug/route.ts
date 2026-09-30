import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { isValidSlug } from "@/lib/slug";

const schema = z.object({ slug: z.string().trim().toLowerCase() });

/** The barber chooses their own booking link (the part after /b/). */
export async function PUT(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || !isValidSlug(parsed.data.slug)) {
      return NextResponse.json({
        success: false,
        error: { code: "INVALID_SLUG", message: "Use 3–40 letters, numbers and single dashes (like ramesh-hair-cut)." },
      }, { status: 400 });
    }
    const { slug } = parsed.data;

    await connectToDatabase();
    const me = await User.findById(payload.userId);
    if (!me) return NextResponse.json({ success: false, error: { message: "User not found" } }, { status: 404 });
    if (me.slug === slug) return NextResponse.json({ success: true, data: { slug } });

    if (await User.exists({ slug, _id: { $ne: me._id } })) {
      return NextResponse.json({ success: false, error: { code: "SLUG_TAKEN", message: "That link is already taken." } }, { status: 409 });
    }
    me.slug = slug;
    try {
      await me.save();
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        return NextResponse.json({ success: false, error: { code: "SLUG_TAKEN", message: "That link is already taken." } }, { status: 409 });
      }
      throw err;
    }
    return NextResponse.json({ success: true, data: { slug } });
  } catch (error) {
    console.error("Change slug error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
