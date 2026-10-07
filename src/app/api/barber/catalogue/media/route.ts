import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { listAssets, uploadImage } from "@/lib/mediaService";
import { IMAGE_MAX_UPLOAD_BYTES } from "@/lib/mediaConfig";

export const runtime = "nodejs";

/** The owner's uploaded files and how much of the plan's storage they use. */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => ok(await listAssets(scope)));
}

/** Upload one picture (multipart field "file"). It is checked, resized, converted to WebP and a thumbnail is made. */
export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    // Refuse an oversized body before the server reads any of it.
    if (Number(req.headers.get("content-length") || 0) > IMAGE_MAX_UPLOAD_BYTES + 512 * 1024) return fail("That picture is too large. Please choose a smaller one.", 413);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail("Please choose a picture.");
    if (file.size > IMAGE_MAX_UPLOAD_BYTES) return fail("That picture is too large. Please choose a smaller one.", 413);
    const asset = await uploadImage(scope, Buffer.from(await file.arrayBuffer()));
    return ok({ asset }, 201);
  }, { write: true });
}
