import { Slot } from "@/models/Slot";

/** How long a freed seat is held for the first waitlisted customer. */
export const HOLD_MINUTES = 15;

/** Mongo expression: how many seats on this slot are currently held for someone other than `phone`. */
export function heldByOthersExpr(phone: string, now = new Date()) {
  return {
    $size: {
      $filter: {
        input: { $ifNull: ["$holds", []] },
        as: "h",
        cond: { $and: [{ $gt: ["$$h.until", now] }, { $ne: ["$$h.phone", phone] }] },
      },
    },
  };
}

/** Number of seats currently held (for anyone) on a loaded slot document. */
export function activeHoldCount(slot: { holds?: { until: Date }[] }, now = new Date()) {
  return (slot.holds || []).filter((h) => new Date(h.until) > now).length;
}

/**
 * A seat just opened on `slotId`: move the first waitlisted customer into a
 * timed hold so nobody else can grab the seat while they're told. Returns that
 * customer, or null if nobody is waiting. Expired holds are cleaned out first.
 */
export async function holdSeatForWaitlist(slotId: unknown) {
  const now = new Date();
  await Slot.updateOne({ _id: slotId }, { $pull: { holds: { until: { $lte: now } } } });
  // Atomically take the first waitlisted person (only while the slot really has a free, unheld seat).
  const before = await Slot.findOneAndUpdate(
    {
      _id: slotId,
      "waitlist.0": { $exists: true },
      $expr: { $lt: [{ $add: ["$bookingsCount", { $size: { $ifNull: ["$holds", []] } }] }, "$capacity"] },
    },
    { $pop: { waitlist: -1 } },
    { new: false }
  );
  const first = before?.waitlist?.[0];
  if (!first) return null;
  const until = new Date(now.getTime() + HOLD_MINUTES * 60_000);
  await Slot.updateOne({ _id: slotId }, { $push: { holds: { phone: first.phone, name: first.name, until } } });
  return { name: first.name as string, phone: first.phone as string, until };
}
