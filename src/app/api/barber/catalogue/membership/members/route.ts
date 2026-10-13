import { z } from "zod";
import { planFor } from "@/lib/catalogue";
import { fail, ok, ownerRoute } from "@/lib/catalogueApi";
import { listMembers, resolveMemberCustomer, sellMembership } from "@/lib/membership";

/** The owner's current members (active + recently expired), newest first. */
export async function GET(req: Request) {
  return ownerRoute(req, async ({ scope }) => {
    const members = await listMembers(scope.ownerType, scope.ownerId);
    return ok({ members });
  });
}

// Sell a membership: the server resolves (or creates) the customer by phone + name, then records the sale.
const schema = z.object({
  planId: z.string(),
  customerName: z.string().max(80),
  customerPhone: z.string().max(20).optional(),
  paymentMode: z.enum(["CASH", "UPI", "OTHER"]).optional(),
});

export async function POST(req: Request) {
  return ownerRoute(req, async ({ scope, userId }) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    // Gate before touching the database: only the Business plan may run memberships.
    const plan = await planFor(scope);
    if (plan.membershipEnabled === 0) return fail("Memberships are part of the Business plan.", 403);

    const customerId = await resolveMemberCustomer(scope, parsed.data.customerName, parsed.data.customerPhone || "");
    if (!customerId) return fail("Enter the customer's name, and a phone number for a shop membership.");

    try {
      const member = await sellMembership(scope.ownerType, scope.ownerId, customerId, parsed.data.planId, parsed.data.paymentMode || "CASH", userId);
      return ok({ member });
    } catch (err) {
      return fail((err as Error).message || "Could not sell this membership.");
    }
  }, { write: true, ownerOrFullOnly: true });
}
