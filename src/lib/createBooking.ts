import { Customer } from "@/models/Customer";
import { Booking } from "@/models/Booking";
import { Counter } from "@/models/Counter";
import { normalizePhone } from "@/lib/phone";
import { timeStringToMinutes } from "@/lib/timeSort";

interface ClaimedSlot {
  _id: unknown;
  barberId: unknown;
  date: string;
  startTime: string;
  endTime: string;
}

/**
 * Shared by the public booking route and the barber's walk-in route: finds or
 * creates the customer, takes the next booking number and saves a CONFIRMED
 * booking for a slot the caller has ALREADY claimed atomically.
 *
 * On failure it throws; the caller is responsible for releasing the slot.
 */
export async function createConfirmedBooking(slot: ClaimedSlot, name: string, phone: string, notes?: string) {
  const normalizedPhone = normalizePhone(phone);
  const cleanName = name.trim();

  // Exact, case-insensitive match via collation — never build a RegExp from
  // user input. Phone + name lets a family share one number.
  // With no phone number, the customer belongs to this barber alone (so two barbers' "Ramu" never merge).
  const noPhone = normalizedPhone === "";
  const scope = noPhone ? { ownerBarberId: slot.barberId } : {};
  let customer = await Customer.findOne({ phone: normalizedPhone, name: cleanName, ...scope })
    .collation({ locale: "en", strength: 2 });
  if (!customer) customer = await new Customer({ name: cleanName, phone: normalizedPhone, ...scope }).save();

  const counter = await Counter.findByIdAndUpdate(
    { _id: "bookingNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  // A failed save leaves a gap in the booking numbers on purpose: handing the
  // number back (decrementing) could let two bookings end up with the same one.
  const booking = await new Booking({
    bookingNumber: `B-${counter.seq.toString().padStart(4, "0")}`,
    barberId: slot.barberId,
    slotId: slot._id,
    customerId: customer._id,
    date: slot.date,
    startTime: slot.startTime,
    startMinutes: timeStringToMinutes(slot.startTime),
    endTime: slot.endTime,
    status: "CONFIRMED",
    notes,
  }).save();
  return { booking, customer };
}
