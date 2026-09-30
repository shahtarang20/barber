import { getTodayISTString, minutesUntilSlot } from "@/lib/istTime";
import { Slot } from "@/models/Slot";
import { confirmedCountBySlot } from "@/lib/openBookings";

/**
 * How many days ahead a barber's schedule is kept created. Customers can only pick from the next
 * 7 days, so a month is plenty; the daily job tops it up every day. (Was 90 — 3x the storage and a
 * slow first save.) Override with SLOT_WINDOW_DAYS (7–90).
 */
export const SLOT_WINDOW_DAYS = Math.min(90, Math.max(7, Number(process.env.SLOT_WINDOW_DAYS) || 30));
import { format, addDays, parse, isValid, addMinutes } from "date-fns";
import { parseDateOnly, timeStringToMinutes } from "@/lib/timeSort";

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
  // "Today" is always the IST calendar date, not the server's (UTC on Vercel).
  const todayStr = getTodayISTString();
  const today = parseDateOnly(todayStr);

  // Only the window we manage. Slots further out (made back when 90 days were created) are
  // left alone and get reconciled once they come inside the window.
  const windowEnd = format(addDays(today, SLOT_WINDOW_DAYS - 1), "yyyy-MM-dd");
  const existingSlots = await Slot.find({
    barberId,
    date: { $gte: todayStr, $lte: windowEnd },
  });

  // A day the barber shifted ("running late") is deliberately off the normal
  // grid. Reconciling it would recreate the early slots and delete the shifted
  // ones, silently undoing the shift — so those dates are left alone.
  const shiftedDates = new Set<string>(existingSlots.filter((s: any) => s.shiftedAt).map((s: any) => s.date));

  const existingMap = new Map<string, any>();
  for (const s of existingSlots) {
    if (shiftedDates.has(s.date)) continue;
    existingMap.set(`${s.date}_${s.startTime}`, s);
  }

  let capacityKeptCount = 0;
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

  for (let i = 0; i < SLOT_WINDOW_DAYS; i++) {
    const currentDate = addDays(today, i);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    if (shiftedDates.has(dateStr)) continue;
    const dayOfWeek = format(currentDate, "EEEE");

    const dayConfig = workingHours.find((h) => h.day === dayOfWeek);
    if (!dayConfig || dayConfig.isClosed || !dayConfig.startTime || !dayConfig.endTime) {
      continue; // No valid grid at all for this date — every existing slot on it is stale.
    }

    try {
      const startObj = parseTime(dayConfig.startTime, currentDate);
      let endObj = parseTime(dayConfig.endTime, currentDate);
      // A closing time of "12:00 AM" means midnight at the END of this day.
      if (timeStringToMinutes(dayConfig.endTime) === 0) endObj = addDays(endObj, 1);

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
          // Don't create slots for times that have already passed today —
          // nobody can book them. (validKeys above still keeps existing ones.)
          if (minutesUntilSlot(dateStr, startTimeStr) < 0) {
            currentSlotStart = currentSlotEnd;
            continue;
          }
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
        } else if (!existing.isCustomCapacity && existing.capacity !== capacity && capacity < (existing.bookingsCount || 0)) {
          // The new default is below what's already booked — the slot must keep
          // its higher capacity; count it so the barber is told.
          capacityKeptCount++;
        } else if (!existing.isCustomCapacity && existing.capacity !== capacity) {
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
  const staleBooked = [...existingMap.entries()].filter(([key, slot]) => !validKeys.has(key) && slot.bookingsCount > 0).map(([, slot]) => slot._id);
  const confirmedBySlot = await confirmedCountBySlot(staleBooked);
  for (const [key, slot] of existingMap.entries()) {
    if (validKeys.has(key)) continue;
    if (slot.bookingsCount > 0) {
      // Kept either way (history must survive); only still-confirmed bookings are flagged.
      blockedByBookings += confirmedBySlot.get(String(slot._id)) ?? 0;
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
    capacityKeptCount,
  };
}
