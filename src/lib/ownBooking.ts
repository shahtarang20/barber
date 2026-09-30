import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { normalizePhone } from "@/lib/phone";

/**
 * Finds a booking from Booking ID + phone. Returns null for both "no such
 * booking" and "wrong phone" so callers can't be used to probe booking IDs.
 */
export async function findOwnBooking(bookingNumber: string, phone: string) {
  const booking = await Booking.findOne({ bookingNumber: bookingNumber.trim().toUpperCase() });
  if (!booking) return null;
  const customer = await Customer.findById(booking.customerId);
  if (!customer || customer.phone !== normalizePhone(phone)) return null;
  return { booking, customer };
}
