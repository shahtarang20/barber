import { z } from "zod";
import { fail, isId, ok, ownerRoute } from "@/lib/catalogueApi";
import { finishVideo } from "@/lib/mediaService";

export const runtime = "nodejs";
const schema = z.object({ id: z.string() });

/** Step 2: checks the uploaded file is a real video of an allowed size and length, then makes it usable. */
export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || !isId(parsed.data.id)) return fail("Invalid upload.");
    return ok({ asset: await finishVideo(scope, parsed.data.id) });
  }, { write: true });
}
