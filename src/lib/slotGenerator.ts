import { Slot } from "@/models/Slot";
import { format, addDays, parse, isValid, addMinutes, startOfDay } from "date-fns";
import { parseDateOnly } from "@/lib/timeSort";

/**
 * Reconciles a barber's future (unbooked) schedule against their current
 * working hours, slot duration, and default capacity — this is the single
 * source of truth both the Settings page (after any change) and the
 * Schedule page's manual "Generate"/"Sync" button rely on being consistent.
 *
 * Three things can be wrong with an existing slot relative to the *current*
 * settings, and each needs different handling:
 *  - It falls on a day that's now closed, or outside the day's (possibly
 *    shrunk) hours -> delete it if unbooked, otherwise leave it and flag it.
 *  - It falls within hours but its startTime doesn't line up with the
 *    *current* slot-duration grid (e.g. duration changed from 30 to 20
 *    minutes) -> same treatment: an old, no-longer-valid time slot.
 *  - It's a perfectly valid slot for today's settings, but its capacity is
 *    stale relative to a just-changed default -> update it in place, unless
 *    the barber deliberately set a custom capacity on that specific slot.
 */
export async function autoGenerateFutureSlots(
  barberId: string,
  workingHours: any[],
  slotDuration: number,
  capacity: number = 1
) {
  const today = startOfDay(new Date());
  const todayStr = format(today, "yyyy-MM-dd");

  const existingSlots = await Slot.find({
    barberId,
    date: { $gte: todayStr },
  });

  const existingMap = new Map<string, any>();
  for (const s of existingSlots) {
    existingMap.set(`${s.date}_${s.startTime}`, s);
  }

  const validKeys = new Set<string>();
  const newSlots: any[] = [];
  const toUpdateCapacity: { _id: any; capacity: number; status: string }[] = [];
  const parseTimeCache = new Map<string, Date>();

  const parseTime = (timeStr: string, dateObj: Date) => {
    const cleanStr = timeStr.trim().toLowerCase();
    const cacheKey = `${cleanStr}_${dateObj.getTime()}`;
    if (parseTimeCache.has(cacheKey)) return parseTimeCache.get(cacheKey)!;

    if (cleanStr.includes("am") || cleanStr.includes("pm")) {
      const strWithSpace = cleanStr.replace(/([0-9])(am|pm)/, "$1 $2");
      const parsed = parse(strWithSpace, "h:mm a", dateObj);
      if (isValid(parsed)) {
        parseTimeCache.set(cacheKey, parsed);
        return parsed;
      }
    }
    const parsed24h = parse(cleanStr, "HH:mm", dateObj);
    if (isValid(parsed24h)) {
      parseTimeCache.set(cacheKey, parsed24h);
      return parsed24h;
    }
    throw new Error(`Unable to parse time: ${timeStr}`);
  };

  for (let i = 0; i < 90; i++) {
    const currentDate = addDays(today, i);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayOfWeek = format(currentDate, "EEEE");

    const dayConfig = workingHours.find((h) => h.day === dayOfWeek);
    if (!dayConfig || dayConfig.isClosed || !dayConfig.startTime || !dayConfig.endTime) {
      continue; // No valid grid at all for this date — every existing slot on it is stale.
    }

    try {
      const startObj = parseTime(dayConfig.startTime, currentDate);
      const endObj = parseTime(dayConfig.endTime, currentDate);

      let currentSlotStart = startObj;
      while (currentSlotStart < endObj) {
        const currentSlotEnd = addMinutes(currentSlotStart, slotDuration);
        if (currentSlotEnd > endObj) break;

        const startTimeStr = format(currentSlotStart, "h:mm a");
        const endTimeStr = format(currentSlotEnd, "h:mm a");
        const key = `${dateStr}_${startTimeStr}`;
        validKeys.add(key);

        const existing = existingMap.get(key);
        if (!existing) {
          newSlots.push({
            barberId,
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            status: "AVAILABLE",
            capacity,
            bookingsCount: 0,
            isCustomCapacity: false,
          });
        } else if (!existing.isCustomCapacity && existing.capacity !== capacity && capacity >= (existing.bookingsCount || 0)) {
          // A valid, still-current slot whose capacity is stale relative to
          // a just-changed default — bring it in line, and reconcile its
          // status the same way a manual capacity edit would.
          let newStatus = existing.status;
          if (capacity > (existing.bookingsCount || 0) && existing.status === "BOOKED") newStatus = "AVAILABLE";
          else if (capacity === (existing.bookingsCount || 0) && existing.status === "AVAILABLE") newStatus = "BOOKED";
          toUpdateCapacity.push({ _id: existing._id, capacity, status: newStatus });
        }

        currentSlotStart = currentSlotEnd;
      }
    } catch (e) {
      console.error(`Error generating slots for ${dateStr}:`, e);
    }
  }

  // Anything that exists but isn't a valid slot under the current settings
  // (wrong day, outside hours, or doesn't align with the current duration
  // grid) is stale. Delete it if unbooked; otherwise leave it and count it
  // so the barber knows it needs manual attention.
  let deletedCount = 0;
  let blockedByBookings = 0;
  const toDelete: any[] = [];
  for (const [key, slot] of existingMap.entries()) {
    if (validKeys.has(key)) continue;
    if (slot.bookingsCount > 0) {
      blockedByBookings++;
      continue;
    }
    toDelete.push(slot._id);
  }

  if (toDelete.length > 0) {
    await Slot.deleteMany({ _id: { $in: toDelete } });
    deletedCount = toDelete.length;
  }

  for (const update of toUpdateCapacity) {
    await Slot.updateOne({ _id: update._id }, { $set: { capacity: update.capacity, status: update.status } });
  }

  if (newSlots.length > 0) {
    try {
      // ordered: false tolerates a duplicate-key conflict from a concurrent
      // request already having inserted that exact slot.
      await Slot.insertMany(newSlots, { ordered: false });
    } catch (err: any) {
      if (err?.code !== 11000 && !(err?.writeErrors?.every((e: any) => e.code === 11000))) {
        throw err;
      }
    }
  }

  return {
    createdCount: newSlots.length,
    updatedCount: toUpdateCapacity.length,
    deletedCount,
    blockedByBookings,
  };
}
