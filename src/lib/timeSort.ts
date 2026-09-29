import { parse, isValid } from "date-fns";

/**
 * Converts a stored slot time string ("10:30 AM" or "14:00") into minutes
 * since midnight, so slots can be sorted chronologically. Plain string
 * sorting breaks on 12-hour AM/PM times (e.g. "10:00 AM" < "2:00 PM"
 * alphabetically, which is backwards).
 */
export function timeStringToMinutes(timeStr: string): number {
  const cleanStr = timeStr.trim().toLowerCase();
  const base = new Date(2000, 0, 1);

  if (cleanStr.includes("am") || cleanStr.includes("pm")) {
    const strWithSpace = cleanStr.replace(/([0-9])(am|pm)/, "$1 $2");
    const parsed = parse(strWithSpace, "h:mm a", base);
    if (isValid(parsed)) return parsed.getHours() * 60 + parsed.getMinutes();
  }

  const parsed24h = parse(cleanStr, "HH:mm", base);
  if (isValid(parsed24h)) return parsed24h.getHours() * 60 + parsed24h.getMinutes();

  // Unparseable — push to the end rather than crash the sort.
  return Number.MAX_SAFE_INTEGER;
}

export function sortByStartTime<T extends { startTime: string }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));
}
