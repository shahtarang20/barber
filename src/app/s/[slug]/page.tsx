"use client";

import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { getTodayISTString, minutesUntilSlot } from "@/lib/istTime";
import { parseDateOnly } from "@/lib/timeSort";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import useSWR from "swr";

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
  for (const sl of slots) {
    if (hasRoom(sl)) freeBarbersByTime.set(sl.startTime, (freeBarbersByTime.get(sl.startTime) || 0) + 1);
    const cur = bestByTime.get(sl.startTime);
    const better = !cur
      || (hasRoom(sl) && !hasRoom(cur))
      || (hasRoom(sl) === hasRoom(cur) && sl.capacity - sl.bookingsCount > cur.capacity - cur.bookingsCount);
    if (better) bestByTime.set(sl.startTime, sl);
  }
  const loading = shopLoading || (slotsLoading && !slotsData);

  const [selectedSlot, setSelectedSlot] = useState<ShopSlot | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
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
    setBookingLoading(true);
    setBookingError("");

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;

    try {
      const endpoint = selectedSlot.isWaitlist ? "/api/public/waitlist" : "/api/public/bookings";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selectedSlot._id, name, phone }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setBookingError(data.error?.code === "SEAT_HELD" ? t("seatHeld") : data.error?.message || "Operation failed");
        setBookingLoading(false);
        mutateSlots();
        return;
      }

      setBookingSuccess({ ...data.data, isWaitlist: selectedSlot.isWaitlist });
      setBookingLoading(false);
    } catch (err) {
      setBookingError("An unexpected error occurred.");
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
              <div className="font-medium text-right">{format(new Date(bookingSuccess.date || selectedDate), "MMMM d, yyyy")}</div>
              <div className="text-zinc-500">{t("time")}</div>
              <div className="font-medium text-right">{bookingSuccess.startTime || selectedSlot?.startTime}</div>
              <div className="text-zinc-500">Barber</div>
              <div className="font-medium text-right">{bookedBarber?.name || selectedSlot?.barberName}</div>
              <div className="text-zinc-500">{t("customer")}</div>
              <div className="font-medium text-right">{bookingSuccess.customerName || bookingSuccess.name}</div>
            </div>
          </div>

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
        <h1 className="text-2xl font-bold text-zinc-900">{shop?.name || "Loading..."}</h1>
        <p className="text-zinc-500 mt-2 max-w-md mx-auto">
          {shop?.barbers?.length || 0} barber{shop?.barbers?.length === 1 ? "" : "s"} available
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-8">
        {!selectedSlot ? (
          <>
            {/* Barber Selection */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">Choose a Barber</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedBarberId("ANY")}
                  className={`flex-shrink-0 px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
                    selectedBarberId === "ANY"
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-md"
                      : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  Any Available Barber
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
                      <span className={`text-xs ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>{format(date, "MMM")}</span>
                      <span className="text-xl font-bold mt-1">{format(date, "d")}</span>
                      <span className={`text-xs mt-1 ${isSelected ? "text-zinc-300" : "text-zinc-500"}`}>{format(date, "EEE")}</span>
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
                {selectedSlot.isWaitlist ? "Join Waitlist" : t("confirmBooking")}
              </h2>
              <button onClick={() => setSelectedSlot(null)} className="text-sm text-zinc-500 hover:text-zinc-900">
                {t("cancel")}
              </button>
            </div>

            <div className="bg-zinc-50 p-4 rounded-xl mb-8 flex justify-between items-center border border-zinc-100">
              <div>
                <p className="text-sm text-zinc-500">{t("time")}</p>
                <p className="font-semibold text-zinc-900 mt-1">
                  {format(selectedDate, "MMM d, yyyy")} at {selectedSlot.startTime} with {selectedSlot.barberName}
                </p>
              </div>
              <button onClick={() => setSelectedSlot(null)} className="text-blue-600 text-sm font-medium">{t("cancel")}</button>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-5">
              {bookingError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                  {bookingError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">{t("yourName")}</Label>
                <Input id="name" name="name" placeholder="Tarang" required className="h-12 text-base" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t("yourPhone")}</Label>
                <Input id="phone" name="phone" type="tel" placeholder="98XXXXXXXX" required className="h-12 text-base" />
              </div>

              <Button type="submit" className="w-full h-12 text-base mt-4" disabled={bookingLoading}>
                {bookingLoading ? t("loading") : t("confirmBooking")}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
