/**
 * Normalizes an Indian phone number to a canonical 10-digit form, so
 * "+91 98765 43210", "09876543210", and "9876543210" all resolve to the
 * same Customer record instead of silently fragmenting into duplicates.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits.replace(/^0+/, "");
}

/**
 * Returns a clean, WhatsApp-ready phone number (prepends country code 91 for Indian numbers)
 */
export function getWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If they entered exactly 10 digits, it's missing the country code
  if (digits.length === 10) {
    return "91" + digits;
  }
  return digits;
}
