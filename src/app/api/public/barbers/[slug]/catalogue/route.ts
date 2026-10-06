import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { loadPublicCatalogue } from "@/lib/cataloguePublic";
import { publicError, publicJson, publicLimit } from "@/lib/cataloguePublicApi";

/** A barber's published catalogue. Draft and unpublished content is never returned. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const limited = await publicLimit(req);
    if (limited) return limited;
    await connectToDatabase();
    const { slug } = await params;
    const barber = await User.findOne({ slug, role: "BARBER", isActive: true }).select("name").lean<{ _id: import("mongoose").Types.ObjectId; name: string } | null>();
    if (!barber) return publicError("Barber not found", 404);
    return publicJson(await loadPublicCatalogue("BARBER", barber._id, barber.name));
  } catch (error) {
    console.error("Public barber catalogue error:", error);
    return publicError("Internal server error", 500);
  }
}
