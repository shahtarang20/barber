import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rateLimit";

/**
 * Finds a booking from Booking ID + phone. Returns null for both "no such
 * booking" and "wrong phone" so callers can't be used to probe booking IDs.
 */
/** "b-0012", "B0012", " 12 " and "B - 12" all mean booking B-0012. */
export function normalizeBookingNumber(input: string) {
  const cleaned = input.replace(/\s+/g, "").toUpperCase();
  const m = cleaned.match(/^B?-?(\d{1,8})$/);
  return m ? `B-${m[1].padStart(4, "0")}` : cleaned;
}

export async function findOwnBooking(bookingNumber: string, phone: string) {
  const booking = await Booking.findOne({ bookingNumber: normalizeBookingNumber(bookingNumber) });
  if (!booking) return null;
  const customer = await Customer.findById(booking.customerId);
  if (!customer || customer.phone !== normalizePhone(phone)) return null;
  return { booking, customer };
}

/**
 * A daily ceiling on Booking ID + phone attempts for one phone number (lookup, cancel and reschedule together). On top of
 * the per-minute limits, it stops someone who only knows a victim's phone from slowly guessing booking IDs for days.
 * A real customer never needs more than a handful of tries in a day.
 */
export async function withinDailyOwnBookingLimit(phone: string): Promise<boolean> {
  return rateLimit(`own-booking-day:${normalizePhone(phone)}`, 40, 24 * 60 * 60_000);
}
