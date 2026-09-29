import { Slot } from "@/models/Slot";
import { timeStringToMinutes, parseDateOnly } from "@/lib/timeSort";
import { format } from "date-fns";

interface WorkingHourDay {
  day: string;
  isClosed: boolean;
  startTime?: string;
  endTime?: string;
}

/**
 * Removes slots that no longer fit a barber's working hours (day marked
 * closed, or hours shortened) — needed because saving working-hours
 * settings only updates the User document; it never touched already
 * -generated Slot documents on its own.
 *
 * `dateFilter` can be an exact "YYYY-MM-DD" string (a single date, used by
 * the generate-slots route) or `{ $gte: "YYYY-MM-DD" }` (every future date,
 * used when working hours are saved from Settings).
 *
 * Slots with existing bookings are never deleted — they're counted and
 * returned instead, so the barber knows they still need manual attention.
 */
export async function cleanupStaleSlots(
  barberId: string,
  workingHours: WorkingHourDay[],
  dateFilter: string | { $gte: string }
) {
  const slots = await Slot.find({ barberId, date: dateFilter });

  const toDelete: string[] = [];
  let blockedByBookings = 0;

  for (const slot of slots) {
    const dayOfWeek = format(parseDateOnly(slot.date), "EEEE");
    const dayConfig = workingHours.find((h) => h.day === dayOfWeek);

    let outsideHours = false;
    if (!dayConfig || dayConfig.isClosed) {
      outsideHours = true;
    } else if (dayConfig.startTime && dayConfig.endTime) {
      const slotStart = timeStringToMinutes(slot.startTime);
      const openStart = timeStringToMinutes(dayConfig.startTime);
      const openEnd = timeStringToMinutes(dayConfig.endTime);
      if (slotStart < openStart || slotStart >= openEnd) outsideHours = true;
    }

    if (!outsideHours) continue;

    if (slot.bookingsCount > 0) {
      blockedByBookings++;
      continue;
    }
    toDelete.push(slot._id.toString());
  }

  if (toDelete.length > 0) {
    await Slot.deleteMany({ _id: { $in: toDelete } });
  }

  return { deletedCount: toDelete.length, blockedByBookings };
}
