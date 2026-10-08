import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { loadPublicCatalogue } from "@/lib/cataloguePublic";
import { memo } from "@/lib/memo";
import { admitVisitor } from "@/lib/visitorLimit";
import { publicError, publicJson, publicLimit } from "@/lib/cataloguePublicApi";

/** A barber's published catalogue. Draft and unpublished content is never returned. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const limited = await publicLimit(req);
    if (limited) return limited;
    await connectToDatabase();
    const { slug } = await params;
    const barber = await memo(`pub:barber-cat:${slug}`, 10_000, () => User.findOne({ slug, role: "BARBER", isActive: true }).select("name visitorLimit").lean<{ _id: import("mongoose").Types.ObjectId; name: string; visitorLimit?: number } | null>());
    if (!barber) return publicError("Barber not found", 404);
    if (!(await admitVisitor(req, "BARBER", barber._id, barber.visitorLimit ?? null)).allowed) return publicError("This page is not available right now.", 403);
    return publicJson(await loadPublicCatalogue("BARBER", barber._id, barber.name));
  } catch (error) {
    console.error("Public barber catalogue error:", error);
    return publicError("Internal server error", 500);
  }
}
