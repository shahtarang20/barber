import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { normalizePhone } from "@/lib/phone";

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
