import { z } from "zod";
import { planFor } from "@/lib/catalogue";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { getWheelConfig, saveWheelConfig } from "@/lib/wheel";

// saveWheelConfig clamps every value and segment, so validation here only keeps the shapes sane.
const segment = z.object({
  label: z.string().max(40).optional(),
  weight: z.number().optional(),
  rewardType: z.enum(["NONE", "FREE_SERVICE", "PERCENTAGE", "FIXED"]).optional(),
  rewardValue: z.number().optional(),
});
const schema = z.object({
  enabled: z.boolean().optional(),
  segments: z.array(segment).max(8).optional(),
  cooldownDays: z.number().int().optional(),
  rewardValidDays: z.number().int().optional(),
});

/** The spin-to-win wheel the owner reads, plus whether the plan allows it. */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const [config, plan] = await Promise.all([getWheelConfig(scope.ownerType, scope.ownerId), planFor(scope)]);
    return ok({ config, plan: { wheelEnabled: plan.wheelEnabled } });
  });
}

export async function PUT(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const plan = await planFor(scope);
    if (plan.wheelEnabled === 0) return fail("The spin-to-win wheel is part of the Premium plan.", 403);
    const config = await saveWheelConfig(scope.ownerType, scope.ownerId, parsed.data);
    return ok({ config, plan: { wheelEnabled: plan.wheelEnabled } });
  }, { write: true, ownerOrFullOnly: true });
}
