import { fail, isId, ok, ownerRoute } from "@/lib/catalogueApi";
import { deleteAsset } from "@/lib/mediaService";
import { BarberService } from "@/models/BarberService";
import { CatalogueSettings } from "@/models/CatalogueSettings";
import { MediaAsset } from "@/models/MediaAsset";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return ownerRoute(req, async ({ scope }) => {
    if (!isId(id)) return fail("Invalid file.");
    // Take the file out of this owner's services and branding first, so nothing is left pointing at a deleted file.
    const asset = await MediaAsset.findOne({ _id: id, ownerType: scope.ownerType, ownerId: scope.ownerId }).lean();
    if (asset) {
      const mine = { ownerType: scope.ownerType, ownerId: scope.ownerId };
      await BarberService.updateMany({ ...mine, $or: [{ images: asset.url }, { videos: asset.url }] }, { $pull: { images: asset.url, videos: asset.url } });
      await CatalogueSettings.updateOne({ ...mine, logoUrl: asset.url }, { $set: { logoUrl: "" } });
      await CatalogueSettings.updateOne({ ...mine, coverUrl: asset.url }, { $set: { coverUrl: "" } });
    }
    await deleteAsset(scope, id);
    return ok({ deleted: true });
  }, { write: true });
}
