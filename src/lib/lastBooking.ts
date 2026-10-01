/** The customer's most recent booking, kept on his own phone so a refresh never loses his Booking ID. */
const KEY = "last-booking";
export interface LastBooking { id: string; date: string; time: string; barber?: string }

export function saveLastBooking(b: LastBooking) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch {}
}

export function loadLastBooking(): LastBooking | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as LastBooking;
    return b && b.id && b.date ? b : null;
  } catch { return null; }
}

export function clearLastBooking() {
  try { localStorage.removeItem(KEY); } catch {}
}
