import { z } from "zod";
import { planFor } from "@/lib/catalogue";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { getLoyaltyConfig, saveLoyaltyConfig } from "@/lib/loyalty";

// The owner's punch-card settings. saveLoyaltyConfig clamps every value, so validation here only keeps the shapes sane.
const schema = z.object({
  enabled: z.boolean().optional(),
  stampsNeeded: z.number().int().optional(),
  rewardType: z.enum(["FREE_SERVICE", "PERCENTAGE", "FIXED"]).optional(),
  rewardValue: z.number().optional(),
  rewardLabel: z.string().max(60).optional(),
  rewardValidDays: z.number().int().optional(),
});

/** The loyalty settings the owner reads, plus whether his plan allows the card at all. */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const [config, plan] = await Promise.all([getLoyaltyConfig(scope.ownerType, scope.ownerId), planFor(scope)]);
    return ok({ config, plan: { loyaltyEnabled: plan.loyaltyEnabled } });
  });
}

export async function PUT(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    // Gate before touching the database: a free plan may never keep a running loyalty card.
    const plan = await planFor(scope);
    if (plan.loyaltyEnabled === 0) return fail("Loyalty is part of the Premium plan.", 403);
    const config = await saveLoyaltyConfig(scope.ownerType, scope.ownerId, parsed.data);
    return ok({ config, plan: { loyaltyEnabled: plan.loyaltyEnabled } });
  }, { write: true, ownerOrFullOnly: true });
}
