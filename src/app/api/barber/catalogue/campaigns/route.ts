import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { campaignSchema, campaignStatus, sendCampaign } from "@/lib/campaigns";

export const maxDuration = 60;

/** How many customers opted in, what the plan allows per week and what was sent. */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => ok(await campaignStatus(scope)));
}

/** Sends a short message to customers who opted in to this barber's / shop's offers. Owner or full-access staff only. */
export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const parsed = campaignSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    return ok(await sendCampaign(scope, userId, parsed.data), 201);
  }, { write: true, ownerOrFullOnly: true });
}
