import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import { BarberService } from "@/models/BarberService";
import { loadPublicCatalogue } from "@/lib/cataloguePublic";
import { publicError, publicJson, publicLimit } from "@/lib/cataloguePublicApi";

/** One published service (for a direct link to a hairstyle). Found through its owner's public catalogue, so every visibility rule applies. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const limited = await publicLimit(req);
    if (limited) return limited;
    await connectToDatabase();
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return publicError("Service not found", 404);
    const service = await BarberService.findOne({ _id: id, status: "PUBLISHED" }).select("ownerType ownerId").lean<{ ownerType: "BARBER" | "SHOP"; ownerId: mongoose.Types.ObjectId } | null>();
    if (!service) return publicError("Service not found", 404);
    const catalogue = await loadPublicCatalogue(service.ownerType, service.ownerId, "");
    for (const category of catalogue.categories) {
      const found = category.services.find((s) => s.id === id);
      if (found) return publicJson({ service: found, category: { id: category.id, name: category.name }, branding: catalogue.branding });
    }
    return publicError("Service not found", 404);
  } catch (error) {
    console.error("Public service error:", error);
    return publicError("Internal server error", 500);
  }
}
