"use client";

import { useState, useEffect } from "react";
import { format, addDays, subDays, parse, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface SlotView {
  _id: string;
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
  capacity: number;
  bookingsCount: number;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<any>(null);
  const [showPremiumPopup, setShowPremiumPopup] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("dashboardSelectedDate");
      if (stored) {
        const storedDate = new Date(stored);
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const storedStr = format(storedDate, "yyyy-MM-dd");
        // If stored date is in the past (before today), reset to today.
        // String comparison works perfectly for yyyy-MM-dd
        if (storedStr >= todayStr) return storedDate;
      }
    }
    return new Date();
  });
  const [capacity, setCapacity] = useState(1);
  const formattedDate = format(selectedDate, "yyyy-MM-dd");

  const { data: slotsData, isLoading: loading, mutate: mutateSlots } = useSWR(
    `/api/barber/slots?date=${formattedDate}`,
    fetcher
  );

  useRealtimeRefresh(() => mutateSlots());

  const slots: SlotView[] = slotsData?.success ? slotsData.data : [];

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    sessionStorage.setItem("dashboardSelectedDate", selectedDate.toISOString());
  }, [selectedDate]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/barber/profile");
      const data = await res.json();
      if (data.success) {
        const p = data.data;
        setProfile(p);
        
        // Premium popup logic
        if (p.premiumAmount > 0) {
          const today = new Date();
          const dueDay = p.premiumDueDay || 28;
          const currentDay = today.getDate();
          
          // Check if today is within [dueDay - 3, dueDay]
          const isDueWindow = currentDay >= (dueDay - 3) && currentDay <= dueDay;
          
          if (isDueWindow) {
            const todayStr = format(today, "yyyy-MM-dd");
            const storageKey = `premium_pop_${p._id}_${todayStr}`;
            const popCount = parseInt(localStorage.getItem(storageKey) || "0");
            
            if (popCount < 3) {
              setShowPremiumPopup(true);
              localStorage.setItem(storageKey, (popCount + 1).toString());
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile");
    }
  };


  const generateSlots = async () => {
    setGenerating(true);
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const res = await fetch("/api/barber/slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formattedDate, capacity }),
      });
      const data = await res.json();
      if (data.success) {
        mutateSlots();
      } else {
        const removedSlots = data.data?.removedSlots || 0;
        const needsAttention = data.data?.slotsNeedingManualCancellation || 0;
        if (removedSlots > 0) mutateSlots();
        const message = needsAttention > 0
          ? `${data.error?.message || ""} ${needsAttention} existing booking(s) on this date need manual cancellation.`.trim()
          : data.error?.message || "Failed to generate slots";
        toast.add({ title: "Error", description: message, type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "An unexpected error occurred", type: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const [showBlockModal, setShowBlockModal] = useState<any>(null);

  const handleBlockSlot = async (id: string, force = false) => {
    try {
      const url = force ? `/api/barber/slots/${id}/block?force=true` : `/api/barber/slots/${id}/block`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        mutateSlots();
        if (force && data.cancelledCustomers) {
           setShowBlockModal(null);
           if (data.cancelledCustomers.length > 0) {
             const cust = data.cancelledCustomers[0];
             const cleanPhone = cust.phone.replace(/\D/g, "");
             const slotTime = slots.find((s: SlotView) => s._id === id)?.startTime || "your slot";
             const msgStr = t('cancelMessage' as any).replace('{name}', cust.name).replace('{time}', slotTime);
             window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgStr)}`, '_blank');
             
             if (data.cancelledCustomers.length > 1) {
               toast.add({ title: "Notice", description: `Note: Only the first customer (${cust.name}) was messaged via WhatsApp automatically to prevent browser pop-up blocking. Please message the others manually.`, type: "info" });
             }
           }
        }
      } else if (data.requiresConfirmation) {
        setShowBlockModal({ slotId: id, customers: data.customers });
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to block slot", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error blocking slot", type: "error" });
    }
  };

  const handleUnblockSlot = async (id: string) => {
    try {
      const res = await fetch(`/api/barber/slots/${id}/unblock`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        mutateSlots();
        if (data.waitlistCustomer) {
           const cust = data.waitlistCustomer;
           const cleanPhone = cust.phone.replace(/\D/g, "");
           const slotTime = slots.find((s: SlotView) => s._id === id)?.startTime || "your slot";

           const msgStr = data.autoBooking
             ? t('waitlistAutoBookedMessage' as any)
                 .replace('{name}', cust.name)
                 .replace('{time}', slotTime)
                 .replace('{bookingId}', data.autoBooking.bookingNumber)
             : t('waitlistNotifyMessage' as any)
                 .replace('{name}', cust.name)
                 .replace('{time}', slotTime)
                 .replace('{link}', `${window.location.origin}/b/${profile?.slug}`);

           window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgStr)}`, '_blank');
        }
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to unblock slot", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error unblocking slot", type: "error" });
    }
  };

  const handleInlineCapacityChange = async (slotId: string, newCapacity: number) => {
    try {
      const res = await fetch(`/api/barber/slots/${slotId}/capacity`, { 
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacity: newCapacity })
      });
      const data = await res.json();
      if (data.success) {
        mutateSlots();
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to update capacity", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error updating capacity", type: "error" });
    }
  };

  const availableSlots = slots.filter((s: SlotView) => s.status === "AVAILABLE").length;
  const bookedSlots = slots.filter((s: SlotView) => s.status === "BOOKED").length;

  if (profile && profile.isActive === false) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
         <div className="text-6xl mb-6">🚫</div>
         <h1 className="text-4xl font-bold text-red-600 mb-4">Account Suspended</h1>
         <p className="text-zinc-500 text-lg">Your store has been suspended by the administrator.</p>
         <p className="text-zinc-400 mt-2">Please contact support for more information.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      {showPremiumPopup && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative">
            <button onClick={() => setShowPremiumPopup(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div className="w-20 h-20 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">💎</span>
            </div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mb-2">{t('premiumDueTitle' as any)}</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {t('premiumDueDesc' as any).replace('{amount}', profile.premiumAmount.toString())}
            </p>
            <Button className="w-full h-12 text-lg font-bold bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => setShowPremiumPopup(false)}>
              {t('payNow' as any)}
            </Button>
          </div>
        </div>
      )}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Good morning, {profile?.name.split(" ")[0] || "Barber"} 👋
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            Here is your schedule for today.
          </p>
        </div>
        <LanguageSelector />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{t('appointments')}</p>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-50">{slots.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 p-4 sm:p-6 rounded-2xl border border-green-100 dark:border-green-900/30 shadow-sm">
          <p className="text-sm font-medium text-green-600 dark:text-green-500">{t('available')}</p>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-green-700 dark:text-green-400">{availableSlots}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 p-4 sm:p-6 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm sm:col-span-2 md:col-span-1">
          <p className="text-sm font-medium text-red-600 dark:text-red-500">{t('booked')}</p>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-red-700 dark:text-red-400">{bookedSlots}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2 sm:gap-3">
              {format(selectedDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd") && (
                <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">←</button>
              )}
              <span className="whitespace-nowrap">{format(selectedDate, "EEE, MMM d, yyyy")}</span>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">→</button>
            </h2>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <label className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hidden sm:block pl-2">Capacity:</label>
              <input type="number" min="1" max="50" value={capacity || ""} onChange={(e) => setCapacity(e.target.value === "" ? 0 : Number(e.target.value))} className="w-14 h-8 rounded-md border border-zinc-300 px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
              {slots.length > 0 && (
                 <Button variant="default" size="sm" className="h-8 text-xs px-3" onClick={generateSlots} disabled={generating}>
                   {generating ? "..." : "Apply"}
                 </Button>
              )}
            </div>
            {slots.length === 0 && (
              <Button variant="outline" size="sm" className="sm:size-default" onClick={generateSlots} disabled={generating}>
                {generating ? t('loading') : t('generateSlots')}
              </Button>
            )}
          </div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">{t('loading')}</div>
          ) : slots.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{t('noSchedule')}</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                {t('noScheduleDesc')}
              </p>
              <div className="mt-6 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('bookingsPerSlot')}</label>
                  <input type="number" min="1" max="50" value={capacity || ""} onChange={(e) => setCapacity(e.target.value === "" ? 0 : Number(e.target.value))} className="w-20 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                </div>
                <Button onClick={generateSlots} disabled={generating}>
                  {generating ? t('loading') : t('generateSlots')}
                </Button>
              </div>
            </div>
          ) : (
            (() => {
              const visibleSlots = slots.filter((slot: SlotView) => {
                if (format(selectedDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd")) return true;
                
                try {
                  let slotDate;
                  const cleanStr = slot.startTime.trim().toLowerCase();
                  if (cleanStr.includes("am") || cleanStr.includes("pm")) {
                    const strWithSpace = cleanStr.replace(/([0-9])(am|pm)/, "$1 $2");
                    slotDate = parse(strWithSpace, "h:mm a", new Date());
                  } else {
                    slotDate = parse(slot.startTime, "HH:mm", new Date());
                  }
                  return isAfter(slotDate, new Date());
                } catch(e) {
                  return true;
                }
              });

              if (visibleSlots.length === 0 && format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")) {
                return (
                  <div className="p-12 text-center flex flex-col items-center justify-center">
                    <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">{t('allDone')}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                      {t('allDoneDesc')}
                    </p>
                    <Button className="mt-6" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                      {t('focusTomorrow')}
                    </Button>
                  </div>
                );
              }

              return visibleSlots.map((slot) => (
                <div key={slot._id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors gap-4 sm:gap-0">
                  <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
                    <div className="text-base sm:text-lg font-semibold w-20 sm:w-24 text-zinc-900 dark:text-zinc-50">
                      {slot.startTime}
                    </div>
                    
                    {slot.status === "AVAILABLE" && (
                      <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {t('available')} ({slot.bookingsCount || 0}/{slot.capacity || 1})
                      </span>
                    )}
                    {slot.status === "BOOKED" && (
                      <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {t('booked')}
                      </span>
                    )}
                    {slot.status === "BLOCKED" && (
                      <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                        {t('blocked')}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end border-t border-zinc-100 dark:border-zinc-800/50 sm:border-0 pt-4 sm:pt-0">
                    <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 group" title="Maximum Capacity for this slot">
                      <CapacityEditor 
                        slot={slot} 
                        onSave={(val) => handleInlineCapacityChange(slot._id, val)} 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {slot.status === "AVAILABLE" && <Button variant="outline" size="sm" className="font-medium shadow-sm hover:bg-zinc-50 text-xs sm:text-sm h-7 sm:h-8" onClick={() => handleBlockSlot(slot._id)}>{t('blockSlot')}</Button>}
                      {(slot.status === "BOOKED" || slot.bookingsCount > 0) && (
                        <Link href="/dashboard/appointments" className="inline-block">
                          <Button variant="secondary" size="sm" className="font-medium shadow-sm text-xs sm:text-sm h-7 sm:h-8">{t('viewDetails')}</Button>
                        </Link>
                      )}
                      {slot.status === "BLOCKED" && <Button variant="outline" size="sm" className="font-medium shadow-sm hover:bg-zinc-50 text-xs sm:text-sm h-7 sm:h-8" onClick={() => handleUnblockSlot(slot._id)}>{t('unblock')}</Button>}
                    </div>
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      </div>

      {showBlockModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl relative">
            <button onClick={() => setShowBlockModal(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-3xl font-black text-zinc-900 mb-4">{t('warningBookedTitle' as any)}</h2>
            <p className="text-lg text-zinc-600 mb-8">
              {t('warningBookedDesc' as any).replace('{count}', showBlockModal.customers.length.toString())}
            </p>

            <div className="bg-zinc-50 p-4 rounded-xl mb-8 text-left max-h-40 overflow-y-auto border border-zinc-200">
              {showBlockModal.customers.map((c: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 border-zinc-100">
                   <span className="font-semibold text-zinc-800">{c.name}</span>
                   <span className="text-zinc-500 font-mono text-sm">{c.phone}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <Button variant="outline" className="w-full h-14 text-lg font-bold" onClick={() => setShowBlockModal(null)}>{t('goBack' as any)}</Button>
              <Button className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700 text-white" onClick={() => handleBlockSlot(showBlockModal.slotId, true)}>
                {t('cancelAllAndBlock' as any)}
              </Button>
            </div>
            
            <p className="text-xs text-zinc-400 mt-6 flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.711.927 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.666.596 1.216.78 1.391.867.174.086.275.072.376-.044.101-.115.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z"/></svg>
              {t('whatsappNotice' as any)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CapacityEditor({ slot, onSave }: { slot: SlotView, onSave: (val: number) => void }) {
  const [val, setVal] = useState<number | string>(slot.capacity || 1);

  useEffect(() => {
    setVal(slot.capacity || 1);
  }, [slot.capacity]);

  const isChanged = val !== "" && Number(val) !== (slot.capacity || 1);

  return (
    <div className="flex items-center gap-1">
      <svg className="w-3 h-3 sm:w-4 sm:h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <input 
        type="number" 
        min={slot.bookingsCount > 0 ? slot.bookingsCount : 1} 
        value={val}
        onChange={(e) => {
          if (e.target.value === "") {
            setVal("");
          } else {
            setVal(parseInt(e.target.value) || 1);
          }
        }}
        onBlur={() => {
          if (val === "" || Number(val) < 1) setVal(slot.capacity || 1);
        }}
        className="w-8 sm:w-10 h-5 sm:h-6 bg-transparent text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400/50 rounded text-center transition-all"
      />
      {isChanged && (
        <button 
          onClick={() => {
            const numVal = Number(val);
            if (numVal >= (slot.bookingsCount || 0) && numVal > 0) {
              onSave(numVal);
            } else {
              setVal(slot.capacity || 1);
            }
          }}
          className="ml-1 bg-zinc-900 text-white rounded p-0.5 hover:bg-zinc-800 transition-colors"
          title="Save Capacity"
        >
          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
