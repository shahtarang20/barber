import { z } from "zod";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { startVideo } from "@/lib/mediaService";

export const runtime = "nodejs";
const schema = z.object({ contentType: z.string().max(60), size: z.number().int().positive() });

/** Step 1 of a video upload: returns an address the phone sends the file to directly. */
export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("Invalid video details.");
    return ok(await startVideo(scope, parsed.data.contentType, parsed.data.size), 201);
  }, { write: true });
}
