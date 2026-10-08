"use client";

import { useEffect, useRef, useState } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useTranslation } from "@/lib/i18n";
import { getTodayISTString } from "@/lib/istTime";
import { parseDateOnly } from "@/lib/timeSort";
import { loadLastBooking, saveLastBooking, clearLastBooking } from "@/lib/lastBooking";

interface Found { date: string; startTime: string; barberSlug: string; barberName?: string }
interface OpenSlot { _id: string; startTime: string; endTime: string; status: string; capacity: number; bookingsCount: number }

/** "b-0012", "B12" and "12" are the same booking. */
const sameBookingId = (a: string, b: string) => {
  const x = parseInt(a.replace(/\D/g, ""), 10), y = parseInt(b.replace(/\D/g, ""), 10);
  return Number.isFinite(x) && x === y;
};

export default function ManageBookingPage() {
  const { t } = useTranslation();
  const [bookingNumber, setBookingNumber] = useState("");
  // A link from the "Your booking" banner brings the ID along, so the customer only has to type his phone.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setBookingNumber(id);
  }, []);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [found, setFound] = useState<Found | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [slotId, setSlotId] = useState("");
  const [done, setDone] = useState(false);

  // Show the server's error in the customer's language via its error code, falling back to the English message.
  const errText = (data: { error?: { code?: string; message?: string } }) => {
    const key = `err_${data.error?.code}` as Parameters<typeof t>[0];
    return (data.error?.code && t(key)) || data.error?.message || t("genericError");
  };

  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json();
  };

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setResult(null);
    try {
      await fn();
    } catch {
      setResult({ ok: false, message: t("genericError") });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => run(async () => {
    const data = await post("/api/public/bookings/cancel", { bookingNumber, phone });
    setResult({ ok: data.success, message: data.success ? t("successCancelled") : errText(data) });
    if (data.success) {
      setDone(true);
      // The "Your booking" banner on the booking pages must not keep offering a booking that is gone.
      const saved = loadLastBooking();
      if (saved && sameBookingId(saved.id, bookingNumber)) clearLastBooking();
    }
  });

  const handleFind = () => run(async () => {
    const data = await post("/api/public/bookings/lookup", { bookingNumber, phone });
    if (!data.success) {
      setResult({ ok: false, message: errText(data) });
      return;
    }
    setFound(data.data);
    setDate("");
    setSlots([]);
    setSlotId("");
  });

  // Only the latest date picked may fill the list (a slow earlier answer must not overwrite it).
  const slotsReq = useRef(0);
  const loadSlots = async (newDate: string) => {
    const reqId = ++slotsReq.current;
    setDate(newDate);
    setSlotId("");
    setSlots([]);
    if (!newDate || !found) return;
    setResult(null);
    try {
      const res = await fetch(`/api/public/barbers/${found.barberSlug}/slots?date=${newDate}`);
      const data = await res.json();
      if (reqId !== slotsReq.current) return;
      if (data.success) {
        setSlots(data.data.filter((s: OpenSlot) => s.status === "AVAILABLE" && s.bookingsCount < s.capacity));
      }
    } catch {
      setResult({ ok: false, message: t("genericError") });
    }
  };

  const handleConfirmChange = () => run(async () => {
    const data = await post("/api/public/bookings/reschedule", { bookingNumber, phone, newSlotId: slotId });
    if (data.success) {
      setResult({ ok: true, message: `${t("successMoved")} ${format(parseDateOnly(data.data.date), "d MMM")}, ${data.data.startTime}` });
      setDone(true);
      // ...and must show the new time, not the old one.
      const saved = loadLastBooking();
      if (saved && sameBookingId(saved.id, bookingNumber)) saveLastBooking({ ...saved, date: data.data.date, time: data.data.startTime });
    } else {
      setResult({ ok: false, message: errText(data) });
      if (date) loadSlots(date);
    }
  });

  const today = getTodayISTString();
  const maxDate = format(addDays(parseDateOnly(today), 90), "yyyy-MM-dd");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 space-y-5">
        <div className="flex justify-end"><LanguageSelector /></div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{t("cancelPageTitle")}</h1>
          <p className="text-zinc-500 mt-1 text-sm">{t("cancelPageDesc")}</p>
        </div>

        {!found && !done && (
          <>
            <div className="space-y-2">
              <Label htmlFor="bookingNumber">{t("bookingId")}</Label>
              <Input id="bookingNumber" placeholder="B-0042" value={bookingNumber} onChange={(e) => setBookingNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t("yourPhone")}</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={loading || !bookingNumber || !phone} onClick={handleFind}>
                {loading ? t("findingBooking") : t("changeTimeBtn")}
              </Button>
              <Button variant="destructive" disabled={loading || !bookingNumber || !phone} onClick={handleCancel}>
                {t("cancelBookingBtn")}
              </Button>
            </div>
          </>
        )}

        {found && !done && (
          <>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 text-sm">
              <div className="text-zinc-500">{t("currentBookingLabel")}</div>
              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                {format(parseDateOnly(found.date), "d MMM yyyy")}, {found.startTime}{found.barberName ? ` · ${found.barberName}` : ""}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDate">{t("pickNewDate")}</Label>
              <Input id="newDate" type="date" min={today} max={maxDate} value={date} onChange={(e) => loadSlots(e.target.value)} />
            </div>
            {date && (
              <div className="space-y-2">
                <Label>{t("pickNewTime")}</Label>
                {slots.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t("noSlotsForDate")}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((s) => (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => setSlotId(s._id)}
                        className={`h-11 rounded-lg border text-sm ${slotId === s._id ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900" : "border-zinc-200 dark:border-zinc-700"}`}
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => { setFound(null); setResult(null); }}>{t("backBtn")}</Button>
              <Button disabled={loading || !slotId} onClick={handleConfirmChange}>{t("confirmChangeBtn")}</Button>
            </div>
          </>
        )}

        {result && <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.message}</p>}
      </div>
    </div>
  );
}
