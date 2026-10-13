import { z } from "zod";
import { planFor } from "@/lib/catalogue";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { getAutoOfferConfig, saveAutoOfferConfig } from "@/lib/autoOffers";

// The owner's birthday-greeting settings. saveAutoOfferConfig clamps every value, so validation here only keeps shapes sane.
const schema = z.object({
  birthdayEnabled: z.boolean().optional(),
  birthdayMessage: z.string().max(120).optional(),
  birthdayOfferId: z.string().optional(),
});

/** The birthday settings the owner reads, plus how many auto-offers a week his plan allows (0 = none). */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const [config, plan] = await Promise.all([getAutoOfferConfig(scope.ownerType, scope.ownerId), planFor(scope)]);
    return ok({ config, plan: { autoOffersPerWeek: plan.autoOffersPerWeek } });
  });
}

export async function PUT(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    // Gate before touching the database: a free plan may never send automatic birthday offers.
    const plan = await planFor(scope);
    if (plan.autoOffersPerWeek === 0) return fail("Birthday offers are part of the Premium plan.", 403);
    const config = await saveAutoOfferConfig(scope.ownerType, scope.ownerId, parsed.data);
    return ok({ config, plan: { autoOffersPerWeek: plan.autoOffersPerWeek } });
  }, { write: true, ownerOrFullOnly: true });
}
