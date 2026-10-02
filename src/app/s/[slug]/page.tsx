"use client";

import { InstallCard } from "@/components/InstallCard";
import { useState, useEffect } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { format, addDays } from "date-fns";
import { getTodayISTString, minutesUntilSlot } from "@/lib/istTime";
import { parseDateOnly } from "@/lib/timeSort";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { useDateFormat } from "@/lib/dateLocale";
import { LanguageSelector } from "@/components/LanguageSelector";
import useSWR from "swr";
import { saveLastBooking } from "@/lib/lastBooking";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ShopBarber {
  _id: string;
  name: string;
  slug: string;
  profileImage?: string;
  bio?: string;
}

interface ShopSlot {
  _id: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
  capacity: number;
  bookingsCount: number;
  barberId: string;
  barberName: string;
  isWaitlist?: boolean;
}

interface BookingSuccessView {
  queueNumber?: number;
  bookingNumber: string;
  date: string;
  startTime: string;
  customerName?: string;
  name?: string;
  isWaitlist?: boolean;
}

export default function ShopBookingPage() {
  const fmt = useDateFormat();
  const hydrated = useHydrated();
  const { slug } = useParams();
  const { t } = useTranslation();

  const [selectedDate, setSelectedDate] = useState<Date>(() => parseDateOnly(getTodayISTString()));
  const [selectedBarberId, setSelectedBarberId] = useState<string | "ANY">("ANY");
  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  const { data: shopData, isLoading: shopLoading, error: shopLoadError } = useSWR(
    slug ? `/api/public/shops/${slug}` : null,
    fetcher
  );

  const { data: slotsData, isLoading: slotsLoading, mutate: mutateSlots } = useSWR(
    slug ? `/api/public/shops/${slug}/slots?date=${formattedDate}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const shop = shopData?.success ? shopData.data : null;
  const shopError = shopLoadError || (shopData && !shopData.success);
  const allSlots: ShopSlot[] = slotsData?.success ? slotsData.data : [];
  const slots = selectedBarberId === "ANY" ? allSlots : allSlots.filter((s) => s.barberId === selectedBarberId);

  // "Any available barber": show each time once (not once per barber). Pick the barber with the most free seats
  // for that time, and remember how many barbers still have room.
  const hasRoom = (x: ShopSlot) => x.status === "AVAILABLE" || (x.capacity > 1 && x.bookingsCount < x.capacity);
  const bestByTime = new Map<string, ShopSlot>();
  const freeBarbersByTime = new Map<string, number>();
  // How busy each barber already is that day: when several barbers are equally free at a time,
  // the quietest one gets the customer, so "any barber" spreads the work instead of piling on the first.
  const dayLoad = new Map<string, number>();
  for (const sl of slots) dayLoad.set(sl.barberId, (dayLoad.get(sl.barberId) || 0) + (sl.bookingsCount || 0));
  for (const sl of slots) {
    if (hasRoom(sl)) freeBarbersByTime.set(sl.startTime, (freeBarbersByTime.get(sl.startTime) || 0) + 1);
    const cur = bestByTime.get(sl.startTime);
    const seats = sl.capacity - sl.bookingsCount;
    const better = !cur
      || (hasRoom(sl) && !hasRoom(cur))
      || (hasRoom(sl) === hasRoom(cur) && (seats > cur.capacity - cur.bookingsCount
        || (seats === cur.capacity - cur.bookingsCount && (dayLoad.get(sl.barberId) || 0) < (dayLoad.get(cur.barberId) || 0))));
    if (better) bestByTime.set(sl.startTime, sl);
  }
  const loading = shopLoading || (slotsLoading && !slotsData);

  const [selectedSlot, setSelectedSlot] = useState<ShopSlot | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [bookingSuccess, setBookingSuccess] = useState<BookingSuccessView | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service Worker registration failed:", err);
      });
    }
  }, []);

  const handleBookingSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setBookingError("");

    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string) || "";
    const phone = (formData.get("phone") as string) || "";

    // Say exactly what is missing, next to the field, in the customer's language (not the browser's pop-up).
    const digits = phone.replace(/\D/g, "");
    const errors: { name?: string; phone?: string } = {};
    if (name.trim().length < 2) errors.name = t("nameRequired");
    if (digits.length === 0) errors.phone = t("phoneRequired");
    else if (digits.length < 10) errors.phone = t("phoneInvalid");
    setFieldErrors(errors);
    if (errors.name || errors.phone) {
      (e.currentTarget.elements.namedItem(errors.name ? "name" : "phone") as HTMLInputElement | null)?.focus();
      return;
    }
    setBookingLoading(true);

    try {
      const endpoint = selectedSlot.isWaitlist ? "/api/public/waitlist" : "/api/public/bookings";
      const post = (slotId: string) =>
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId, name, phone, shopSlug: slug, ...(selectedSlot.isWaitlist && selectedBarberId === "ANY" ? { anyBarber: true } : {}) }),
        });
      let res = await post(selectedSlot._id);
      let data = await res.json();

      // "Any barber" in a rush: someone else took the barber we picked a moment ago. If another barber is
      // still free at the SAME time, quietly book with him instead of making the customer start again.
      const tried = new Set<string>([selectedSlot._id]);
      for (let attempt = 0; attempt < 3 && !selectedSlot.isWaitlist && selectedBarberId === "ANY" && !res.ok && data?.error?.code === "SLOT_ALREADY_BOOKED"; attempt++) {
        const fresh = await fetch(`/api/public/shops/${slug}/slots?date=${formattedDate}`).then((r) => r.json()).catch(() => null);
        const list: ShopSlot[] = fresh?.success ? fresh.data : [];
        const load = new Map<string, number>();
        for (const sl of list) load.set(sl.barberId, (load.get(sl.barberId) || 0) + (sl.bookingsCount || 0));
        const next = list
          .filter((x) => x.startTime === selectedSlot.startTime && hasRoom(x) && !tried.has(x._id))
          .sort((a, b) => (b.capacity - b.bookingsCount) - (a.capacity - a.bookingsCount) || (load.get(a.barberId) || 0) - (load.get(b.barberId) || 0))[0];
        if (!next) break;
        tried.add(next._id);
        res = await post(next._id);
        data = await res.json();
      }

      if (!res.ok || !data.success) {
        setBookingError(
          data.error?.code === "LINK_LIMIT" ? t("linkClosedMsg")
          : data.error?.code === "SEAT_HELD" ? t("seatHeld")
          : res.status === 400 && /phone/i.test(data.error?.message || "") ? t("phoneInvalid")
          : res.status === 400 && /name/i.test(data.error?.message || "") ? t("nameRequired")
          : data.error?.message || t("genericError")
        );
        setBookingLoading(false);
        mutateSlots();
        return;
      }

      if (!selectedSlot.isWaitlist && data.data?.bookingNumber) saveLastBooking({ id: data.data.bookingNumber, date: data.data.date, time: data.data.startTime, barber: shop?.name });
      setBookingSuccess({ ...data.data, isWaitlist: selectedSlot.isWaitlist });
      setBookingLoading(false);
    } catch (err) {
      setBookingError(typeof navigator !== "undefined" && navigator.onLine === false ? t("noInternet") : t("genericError"));
      setBookingLoading(false);
    }
  };

  if (shopError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
        <div className="text-4xl mb-4">✂️</div>
        <h1 className="text-2xl font-bold text-zinc-800">Shop not found</h1>
        <p className="text-zinc-500 mt-2">Please check the URL and try again.</p>
      </div>
    );
  }

  if (loading && !shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-medium">{t("loading")}</p>
      </div>
    );
  }

  if (bookingSuccess) {
    const bookedBarber = shop?.barbers.find((b: ShopBarber) => b._id === selectedSlot?.barberId);
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${bookingSuccess.isWaitlist ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
            {bookingSuccess.isWaitlist ? (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">
            {bookingSuccess.isWaitlist ? "Waitlist Confirmed" : t("appointmentConfirmed")}
          </h1>
          <p className="text-zinc-500 mb-8">
            {bookingSuccess.isWaitlist
              ? "You will be notified via WhatsApp if a spot opens up!"
              : `${t("bookingSuccess")} ${bookedBarber?.name || selectedSlot?.barberName || ""}.`}
          </p>
          {!bookingSuccess.isWaitlist && (
            <p className="text-sm text-zinc-500 -mt-6 mb-8">
              {t('cancelLinkPrompt')} <a href="/cancel" className="underline">{t('cancelLinkText')}</a> {t('cancelLinkSuffix')}
            </p>
          )}

          <div className="bg-zinc-50 rounded-xl p-6 mb-8 text-left border border-zinc-100">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {!bookingSuccess.isWaitlist && bookingSuccess.queueNumber && (
                <>
                  <div className="text-zinc-500">{t("yourTurn")}</div>
                  <div className="font-bold text-right">#{bookingSuccess.queueNumber}</div>
                </>
              )}
              {!bookingSuccess.isWaitlist && (
                <>
                  <div className="text-zinc-500">{t("bookingId")}</div>
                  <div className="font-medium text-right">{bookingSuccess.bookingNumber}</div>
                </>
              )}
              <div className="text-zinc-500">{t("date")}</div>
              <div className="font-medium text-right">{fmt(new Date(bookingSuccess.date || selectedDate), "d MMMM yyyy")}</div>
              <div className="text-zinc-500">{t("time")}</div>
              <div className="font-medium text-right">{bookingSuccess.startTime || selectedSlot?.startTime}</div>
              <div className="text-zinc-500">{t("barberLabel")}</div>
              <div className="font-medium text-right">{bookedBarber?.name || selectedSlot?.barberName}</div>
              <div className="text-zinc-500">{t("customer")}</div>
              <div className="font-medium text-right">{bookingSuccess.customerName || bookingSuccess.name}</div>
            </div>
          </div>

          <InstallCard appName={shop?.name || "BarberSaaS"} />
          <Button className="w-full h-12" onClick={() => window.location.reload()}>{t("done")}</Button>
        </div>
      </div>
    );
  }

  const upcomingDates = Array.from({ length: 7 }).map((_, i) => addDays(parseDateOnly(getTodayISTString()), i));

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      {/* Shop Header */}
      <div className="bg-white border-b border-zinc-200 pt-12 pb-8 px-4 text-center">
        <div className="w-20 h-20 bg-zinc-200 rounded-full mx-auto mb-4 overflow-hidden border-4 border-white shadow-sm flex items-center justify-center text-2xl font-bold text-zinc-400">
          {shop?.name?.charAt(0)}
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">{shop?.name || t("loading")}</h1>
        <p className="text-zinc-500 mt-2 max-w-md mx-auto">
          {shop?.barbers?.length === 1 ? t("shopBarberOne") : t("shopBarbersN").replace("{n}", String(shop?.barbers?.length || 0))}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-8">
        {(shop?.linkClosed) ? (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 text-center text-orange-800">{t("linkClosedMsg")}</div>
        ) : !selectedSlot ? (
          <>
            {/* Barber Selection */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">{t("chooseBarber")}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedBarberId("ANY")}
                  className={`flex-shrink-0 px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                    selectedBarberId === "ANY"
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-md"
                      : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {t("anyBarber")}
                </button>
                {shop?.barbers?.map((b: ShopBarber) => (
                  <button
                    key={b._id}
                    onClick={() => setSelectedBarberId(b._id)}
                    className={`flex-shrink-0 px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                      selectedBarberId === b._id
                        ? "bg-zinc-900 border-zinc-900 text-white shadow-md"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">{t("chooseDate")}</h2>
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                {upcomingDates.map((date, i) => {
                  const isSelected = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDate(date)}
                      className={`flex-shrink-0 w-20 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                        isSelected
                          ? "bg-zinc-900 border-zinc-900 text-white shadow-md"
                          : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      <span className={`text-xs ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>{fmt(date, "MMM")}</span>
                      <span className="text-xl font-bold mt-1">{format(date, "d")}</span>
                      <span className={`text-xs mt-1 ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>{fmt(date, "EEE")}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Selection */}
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">{t("availableTimes")}</h2>

              {loading ? (
                <div className="py-12 text-center text-zinc-500">{t("loading")}</div>
              ) : slots.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center text-zinc-500">
                  {t("noSlots")}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slots
                    .filter((slot) => {
                      try {
                        const dateStr = format(selectedDate, "yyyy-MM-dd");
                        return minutesUntilSlot(dateStr, slot.startTime) >= 0;
                      } catch (e) {
                        return true;
                      }
                    })
                    .filter((slot) => selectedBarberId !== "ANY" || bestByTime.get(slot.startTime)?._id === slot._id)
                    .map((slot) => {
                      const isAvailable = slot.status === "AVAILABLE" || (slot.capacity && slot.capacity > 1 && slot.bookingsCount < slot.capacity);
                      const isFull = !isAvailable && slot.status !== "BLOCKED";
                      const isBlocked = slot.status === "BLOCKED";

                      let btnStyle = "bg-white border-zinc-200 text-zinc-900 hover:border-zinc-900 hover:shadow-sm";
                      if (isFull) {
                        btnStyle = "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100";
                      } else if (isBlocked) {
                        btnStyle = "bg-zinc-50 border-zinc-100 text-zinc-400 cursor-not-allowed line-through";
                      }

                      return (
                        <button
                          key={slot._id}
                          disabled={isBlocked}
                          onClick={() => setSelectedSlot({ ...slot, isWaitlist: isFull })}
                          className={`py-4 rounded-xl border font-medium text-sm transition-all flex flex-col items-center justify-center ${btnStyle}`}
                        >
                          <span>{slot.startTime}</span>
                          {selectedBarberId === "ANY" && (
                            <span className="text-[10px] text-zinc-500 mt-0.5">
                              {(freeBarbersByTime.get(slot.startTime) || 0) > 0
                                ? t("barbersFree").replace("{n}", String(freeBarbersByTime.get(slot.startTime)))
                                : slot.barberName}
                            </span>
                          )}
                          {isFull && <span className="text-[10px] uppercase font-bold mt-1 tracking-wider opacity-80">{t("waitlist" as any) || "Waitlist"}</span>}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Booking Confirmation Form */
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-semibold text-zinc-900">
                {selectedSlot.isWaitlist ? t("joinWaitlist") : t("confirmBooking")}
              </h2>
              <button onClick={() => setSelectedSlot(null)} className="text-sm text-zinc-500 hover:text-zinc-900">
                {t("cancel")}
              </button>
            </div>

            <div className="bg-zinc-50 p-4 rounded-xl mb-8 flex justify-between items-center border border-zinc-100">
              <div>
                <p className="text-sm text-zinc-500">{t("time")}</p>
                <p className="font-semibold text-zinc-900 mt-1">
                  {fmt(selectedDate, "d MMM yyyy")} at {selectedSlot.startTime} with {selectedSlot.barberName}
                </p>
              </div>
              <button onClick={() => setSelectedSlot(null)} className="text-blue-600 text-sm font-medium">{t("cancel")}</button>
            </div>

            <form method="post" noValidate onSubmit={handleBookingSubmit} className="space-y-5">
              {bookingError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                  {bookingError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">{t("yourName")}</Label>
                <Input id="name" name="name" placeholder={t('yourNamePlaceholder')} autoComplete="name" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "name-error" : undefined} onChange={() => fieldErrors.name && setFieldErrors((x) => ({ ...x, name: undefined }))} className={`h-12 text-base ${fieldErrors.name ? "border-red-500" : ""}`} />
                {fieldErrors.name && <p id="name-error" role="alert" className="text-sm font-medium text-red-600">{fieldErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t("yourPhone")}</Label>
                <Input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" placeholder="98XXXXXXXX" aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? "phone-error" : undefined} onChange={() => fieldErrors.phone && setFieldErrors((x) => ({ ...x, phone: undefined }))} className={`h-12 text-base ${fieldErrors.phone ? "border-red-500" : ""}`} />
                {fieldErrors.phone && <p id="phone-error" role="alert" className="text-sm font-medium text-red-600">{fieldErrors.phone}</p>}
              </div>

              <Button type="submit" className="w-full h-12 text-base mt-4" disabled={bookingLoading || !hydrated}>
                {bookingLoading ? t("loading") : selectedSlot.isWaitlist ? t("joinWaitlist") : t("confirmBooking")}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
