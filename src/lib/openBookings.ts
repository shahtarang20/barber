import { Booking } from "@/models/Booking";

/**
 * Number of still-CONFIRMED bookings on each of the given slots. A slot's
 * bookingsCount also includes completed and no-show visits (those seats stay
 * used), but only confirmed ones are appointments that still need the barber's
 * attention — so that's what "existing bookings" warnings must count.
 */
export async function confirmedCountBySlot(slotIds: unknown[]): Promise<Map<string, number>> {
  if (slotIds.length === 0) return new Map();
  const rows = await Booking.aggregate([
    { $match: { slotId: { $in: slotIds }, status: "CONFIRMED" } },
    { $group: { _id: "$slotId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n as number]));
}
