import { z } from "zod";
import { planFor } from "@/lib/catalogue";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { listPlans, createPlan, updatePlan } from "@/lib/membership";

// The plan fields the owner writes. createPlan / updatePlan clamp every value, so validation here only keeps shapes sane.
const schema = z.object({
  name: z.string().max(60).optional(),
  price: z.number().optional(),
  durationDays: z.number().int().optional(),
  includedVisits: z.number().int().optional(),
  serviceIds: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});
const putSchema = schema.extend({ id: z.string() });

/** The owner's membership plans, plus whether his plan allows memberships at all. */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const [plans, plan] = await Promise.all([listPlans(scope.ownerType, scope.ownerId), planFor(scope)]);
    return ok({ plans, plan: { membershipEnabled: plan.membershipEnabled } });
  });
}

/** Create a membership plan. */
export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    if (!parsed.data.name?.trim()) return fail("Give the plan a name.");
    // Gate before touching the database: only the Business plan may run memberships.
    const plan = await planFor(scope);
    if (plan.membershipEnabled === 0) return fail("Memberships are part of the Business plan.", 403);
    const created = await createPlan(scope.ownerType, scope.ownerId, parsed.data);
    return ok({ plan: created });
  }, { write: true, ownerOrFullOnly: true });
}

/** Update (or deactivate, via `active:false`) a membership plan. */
export async function PUT(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const plan = await planFor(scope);
    if (plan.membershipEnabled === 0) return fail("Memberships are part of the Business plan.", 403);
    const { id, ...rest } = parsed.data;
    const updated = await updatePlan(id, scope, rest);
    if (!updated) return fail("That plan was not found.", 404);
    return ok({ plan: updated });
  }, { write: true, ownerOrFullOnly: true });
}
