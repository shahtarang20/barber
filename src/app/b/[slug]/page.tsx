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

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface SlotView {
  _id: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
  capacity: number;
  bookingsCount: number;
  isWaitlist?: boolean;
}

interface BookingSuccessView {
  bookingNumber: string;
  date: string;
  startTime: string;
  customerName?: string;
  name?: string;
  isWaitlist?: boolean;
}

export default function BarberBookingPage() {
  const { slug } = useParams();
  const { t, language } = useTranslation();
  
  const [selectedDate, setSelectedDate] = useState<Date>(() => parseDateOnly(getTodayISTString()));
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  
  const { data: barberData, isLoading: barberLoading, error: barberLoadError } = useSWR(
    slug ? `/api/public/barbers/${slug}` : null, 
    fetcher
  );

  const { data: slotsData, isLoading: slotsLoading, mutate: mutateSlots } = useSWR(
    slug ? `/api/public/barbers/${slug}/slots?date=${formattedDate}` : null, 
    fetcher,
    { refreshInterval: 10000 }
  );

  const barber = barberData?.success ? barberData.data : null;
  const barberError = barberLoadError || (barberData && !barberData.success);
  const slots: SlotView[] = slotsData?.success ? slotsData.data : [];
  const loading = barberLoading || (slotsLoading && !slotsData);

  // Booking state
  const [selectedSlot, setSelectedSlot] = useState<SlotView | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState<BookingSuccessView | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service Worker registration failed:', err);
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
        body: JSON.stringify({ 
          slotId: selectedSlot._id,
          name, 
          phone 
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setBookingError(data.error?.message || "Operation failed");
        setBookingLoading(false);
        // Refresh slots in case it was double booked
        mutateSlots();
        return;
      }

      // Hack to pass waitlist status to success screen
      setBookingSuccess({ ...data.data, isWaitlist: selectedSlot.isWaitlist });
      setBookingLoading(false);
      
    } catch (err) {
      setBookingError("An unexpected error occurred.");
      setBookingLoading(false);
    }
  };

  if (barberError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
        <div className="text-4xl mb-4">✂️</div>
        <h1 className="text-2xl font-bold text-zinc-800">{t('barberNotFound' as any)}</h1>
        <p className="text-zinc-500 mt-2">{t('checkUrl' as any)}</p>
      </div>
    );
  }

  if (barber && barber.isActive === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
        <div className="text-6xl mb-6">🚫</div>
        <h1 className="text-3xl font-bold text-zinc-800 text-center px-4">Service Suspended</h1>
        <p className="text-zinc-500 mt-3 text-center px-6 max-w-md">
          This store's booking system is currently suspended. Please contact the barber directly.
        </p>
      </div>
    );
  }



  if (loading && !barber) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
        <div className="w-12 h-12 border-4 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-500 font-medium">{t('loading')}</p>
      </div>
    );
  }

  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-zinc-200 text-center">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${bookingSuccess.isWaitlist ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
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
            {bookingSuccess.isWaitlist ? (t('waitlistConfirmed' as any) || "Waitlist Confirmed") : t('appointmentConfirmed')}
          </h1>
          <p className="text-zinc-500 mb-8">
            {bookingSuccess.isWaitlist 
              ? (t('waitlistSuccess' as any) || "You will be notified via WhatsApp if a spot opens up!") 
              : `${t('bookingSuccess')} ${barber?.name}.`}
          </p>
          {!bookingSuccess.isWaitlist && (
            <p className="text-sm text-zinc-500 -mt-6 mb-8">
              {t('cancelLinkPrompt')} <a href="/cancel" className="underline">{t('cancelLinkText')}</a> {t('cancelLinkSuffix')}
            </p>
          )}
          
          <div className="bg-zinc-50 rounded-xl p-6 mb-8 text-left border border-zinc-100">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {!bookingSuccess.isWaitlist && (
                <>
                  <div className="text-zinc-500">{t('bookingId')}</div>
                  <div className="font-medium text-right">{bookingSuccess.bookingNumber}</div>
                </>
              )}
              
              <div className="text-zinc-500">{t('date')}</div>
              <div className="font-medium text-right">{format(new Date(bookingSuccess.date || selectedDate), "MMMM d, yyyy")}</div>
              
              <div className="text-zinc-500">{t('time')}</div>
              <div className="font-medium text-right">{bookingSuccess.startTime || selectedSlot?.startTime}</div>
              
              <div className="text-zinc-500">{t('customer')}</div>
              <div className="font-medium text-right">{bookingSuccess.customerName || bookingSuccess.name}</div>
            </div>
          </div>
          
          <Button className="w-full h-12" onClick={() => window.location.reload()}>{t('done')}</Button>
        </div>
      </div>
    );
  }

  // Generate simple next 7 days for selection
  const upcomingDates = Array.from({ length: 7 }).map((_, i) => addDays(parseDateOnly(getTodayISTString()), i));

  return (
    <div className="min-h-screen bg-zinc-50 pb-20">
      {/* Top Banner with Language Selector */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      {/* Barber Header */}
      <div className="bg-white border-b border-zinc-200 pt-12 pb-8 px-4 text-center">
        <div className="w-20 h-20 bg-zinc-200 rounded-full mx-auto mb-4 overflow-hidden border-4 border-white shadow-sm flex items-center justify-center text-2xl font-bold text-zinc-400">
          {barber?.name?.charAt(0)}
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">{barber?.name || "Loading..."}</h1>
        <p className="text-zinc-500 mt-2 max-w-md mx-auto">
          {barber?.bio || "Professional Haircut & Grooming"}
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-8">
        {!selectedSlot ? (
          <>
            {/* Date Selection */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">{t('chooseDate')}</h2>
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
              <h2 className="text-lg font-semibold text-zinc-900 mb-4">{t('availableTimes')}</h2>
              
              {loading ? (
                <div className="py-12 text-center text-zinc-500">{t('loading')}</div>
              ) : slots.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-zinc-200 text-center text-zinc-500">
                  {t('noSlots')}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slots
                    .filter((slot: SlotView) => {
                      // Judged against a fixed IST "now", not this browser's
                      // local clock — a customer in a different timezone
                      // than India must see exactly the same "is this slot
                      // still bookable" answer the server will give them.
                      try {
                        const dateStr = format(selectedDate, "yyyy-MM-dd");
                        return minutesUntilSlot(dateStr, slot.startTime) >= 0;
                      } catch(e) {
                        return true; // If parsing fails, show it to be safe
                      }
                    })
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
                          onClick={() => {
                            setSelectedSlot({ ...slot, isWaitlist: isFull });
                          }}
                          className={`py-4 rounded-xl border font-medium text-sm transition-all flex flex-col items-center justify-center ${btnStyle}`}
                        >
                          <span>{slot.startTime}</span>
                          {isFull && <span className="text-[10px] uppercase font-bold mt-1 tracking-wider opacity-80">{t('waitlist' as any) || "Waitlist"}</span>}
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
                {selectedSlot.isWaitlist ? (t('joinWaitlist' as any) || "Join Waitlist") : t('confirmBooking')}
              </h2>
              <button onClick={() => setSelectedSlot(null)} className="text-sm text-zinc-500 hover:text-zinc-900">
                {t('cancel')}
              </button>
            </div>

            <div className="bg-zinc-50 p-4 rounded-xl mb-8 flex justify-between items-center border border-zinc-100">
              <div>
                <p className="text-sm text-zinc-500">{t('time')}</p>
                <p className="font-semibold text-zinc-900 mt-1">{format(selectedDate, "MMM d, yyyy")} at {selectedSlot.startTime}</p>
              </div>
              <button onClick={() => setSelectedSlot(null)} className="text-blue-600 text-sm font-medium">{t('cancel')}</button>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-5">
              {bookingError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                  {bookingError}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name">{t('yourName')}</Label>
                <Input id="name" name="name" placeholder="Tarang" required className="h-12 text-base" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">{t('yourPhone')}</Label>
                <Input id="phone" name="phone" type="tel" placeholder="98XXXXXXXX" required className="h-12 text-base" />
              </div>

              <Button type="submit" className="w-full h-12 text-base mt-4" disabled={bookingLoading}>
                {bookingLoading ? t('loading') : t('confirmBooking')}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
