import { Slot } from "@/models/Slot";
import { User } from "@/models/User";

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
  if (!first) return await holdSeatForShopWaitlist(slotId, now);
  const until = new Date(now.getTime() + HOLD_MINUTES * 60_000);
  await Slot.updateOne({ _id: slotId }, { $push: { holds: { phone: first.phone, name: first.name, until } } });
  return { name: first.name as string, phone: first.phone as string, until };
}

/**
 * Nobody waits for THIS barber's seat, but someone may be waiting for "any barber of the shop" at this same
 * time (they joined the waitlist on a different barber's full slot). The oldest such customer gets the seat.
 */
async function holdSeatForShopWaitlist(slotId: unknown, now: Date) {
  const freed = await Slot.findById(slotId).select("barberId date startTime").lean<{ barberId: unknown; date: string; startTime: string } | null>();
  if (!freed) return null;
  const barber = await User.findById(freed.barberId).select("shopId").lean<{ shopId?: unknown } | null>();
  if (!barber?.shopId) return null;
  const members = await User.find({ shopId: barber.shopId }).select("_id").lean<{ _id: unknown }[]>();
  const siblings = await Slot.find({
    barberId: { $in: members.map((m) => m._id) },
    date: freed.date,
    startTime: freed.startTime,
    _id: { $ne: slotId },
    "waitlist.anyBarber": true,
  }).select("waitlist").lean<{ _id: unknown; waitlist: { name: string; phone: string; joinedAt: Date; anyBarber?: boolean; shopId?: unknown }[] }[]>();

  const candidates = siblings
    .flatMap((sl) => sl.waitlist.filter((w) => w.anyBarber && String(w.shopId) === String(barber.shopId)).map((w) => ({ slot: sl._id, w })))
    .sort((a, b) => new Date(a.w.joinedAt).getTime() - new Date(b.w.joinedAt).getTime());

  for (const c of candidates.slice(0, 6)) {
    const until = new Date(now.getTime() + HOLD_MINUTES * 60_000);
    // 1) reserve the free seat for him (only while a seat really is free and unheld)
    const held = await Slot.updateOne(
      { _id: slotId, $expr: { $lt: [{ $add: ["$bookingsCount", { $size: { $ifNull: ["$holds", []] } }] }, "$capacity"] } },
      { $push: { holds: { phone: c.w.phone, name: c.w.name, until } } }
    );
    if (held.modifiedCount === 0) return null; // seat already taken or held by someone else
    // 2) take him off the other barber's list (if someone beat us to it, give the seat back and try the next person)
    const removed = await Slot.updateOne({ _id: c.slot, waitlist: { $elemMatch: { phone: c.w.phone, anyBarber: true } } }, { $pull: { waitlist: { phone: c.w.phone, anyBarber: true } } });
    if (removed.modifiedCount === 1) return { name: c.w.name, phone: c.w.phone, until };
    await Slot.updateOne({ _id: slotId }, { $pull: { holds: { phone: c.w.phone } } });
  }
  return null;
}
