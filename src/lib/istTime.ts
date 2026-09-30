import { timeStringToMinutes } from "@/lib/timeSort";

/**
 * This app only serves India — every barber's working hours and every
 * customer's booking are meant to be interpreted in India Standard Time,
 * regardless of which timezone the server happens to run in (a US-hosted
 * Vercel deployment, say) or which timezone a customer's browser reports.
 * IST never observes daylight saving, so a fixed +5:30 offset is exact,
 * not an approximation — no timezone library is needed for correctness.
 *
 * Important: once shifted, this Date's *UTC* getters (getUTCHours, etc.)
 * hold the IST wall-clock values — its *local* getters (getHours, etc.)
 * would re-apply whatever timezone the runtime itself happens to be in,
 * silently corrupting the result. Always read it back with getUTC*.
 */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

export function getISTNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MINUTES * 60_000);
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Today's date in IST, as "YYYY-MM-DD" — the same value no matter where the server or browser physically is. */
export function getTodayISTString(): string {
  const ist = getISTNow();
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}`;
}

/**
 * Minutes remaining until a given slot's start time, computed against IST
 * "now" rather than the server or browser's ambient local time. Negative
 * means the slot's start time has already passed.
 */
export function minutesUntilSlot(dateStr: string, startTimeStr: string): number {
  const todayStr = getTodayISTString();

  if (dateStr > todayStr) return Number.MAX_SAFE_INTEGER;
  if (dateStr < todayStr) return -Number.MAX_SAFE_INTEGER;

  const ist = getISTNow();
  const nowMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return timeStringToMinutes(startTimeStr) - nowMinutes;
}

/**
 * Like minutesUntilSlot, but for a slot's END time: an end of "12:00 AM" means
 * the end of that day (24:00), not the start of it, so a slot finishing at
 * midnight isn't treated as already over all day.
 */
export function minutesUntilSlotEnd(dateStr: string, endTimeStr: string): number {
  const todayStr = getTodayISTString();

  if (dateStr > todayStr) return Number.MAX_SAFE_INTEGER;
  if (dateStr < todayStr) return -Number.MAX_SAFE_INTEGER;

  const ist = getISTNow();
  const nowMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const endMinutes = timeStringToMinutes(endTimeStr) || 24 * 60;
  return endMinutes - nowMinutes;
}
