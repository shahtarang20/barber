import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { loadPublicCatalogue } from "@/lib/cataloguePublic";
import { memo } from "@/lib/memo";
import { admitVisitor } from "@/lib/visitorLimit";
import { publicError, publicJson, publicLimit } from "@/lib/cataloguePublicApi";

/** A shop's published catalogue (shop-wide categories and services). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const limited = await publicLimit(req);
    if (limited) return limited;
    await connectToDatabase();
    const { slug } = await params;
    const shop = await memo(`pub:shop-cat:${slug}`, 10_000, () => Shop.findOne({ slug, isActive: true }).select("name visitorLimit").lean<{ _id: import("mongoose").Types.ObjectId; name: string; visitorLimit?: number } | null>());
    if (!shop) return publicError("Shop not found", 404);
    if (!(await admitVisitor(req, "SHOP", shop._id, shop.visitorLimit ?? null)).allowed) return publicError("This page is not available right now.", 403);
    return publicJson(await loadPublicCatalogue("SHOP", shop._id, shop.name));
  } catch (error) {
    console.error("Public shop catalogue error:", error);
    return publicError("Internal server error", 500);
  }
}
