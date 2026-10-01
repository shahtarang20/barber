"use client";

import { useState, useEffect, useRef } from "react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useDateFormat } from "@/lib/dateLocale";
import { toast } from "@/components/ui/toast";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { getWhatsAppNumber } from "@/lib/phone";
import useSWR from "swr";
import { minutesUntilSlotEnd, getTodayISTString } from "@/lib/istTime";
import { sortByStartTime, parseDateOnly } from "@/lib/timeSort";
import { Check, X, Phone, MessageCircle, UserPlus } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface BookingView {
  _id: string;
  bookingNumber: string;
  date: string;
  startTime: string;
  endTime?: string;
  status: string;
  customerId?: { name?: string; phone?: string };
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AppointmentsPage() {
  const fmt = useDateFormat();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [filter, setFilter] = useState("TODAY");
  const { t } = useTranslation();

  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [whatsappPromptData, setWhatsappPromptData] = useState<{
    phone: string;
    name: string;
    time: string;
    prompt: string;
    waitlistCustomers?: { name: string, phone: string }[];
    byCustomer?: boolean;
    holdMinutes?: number;
  } | null>(null);

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInSlotId, setWalkInSlotId] = useState("");
  const [walkInSaving, setWalkInSaving] = useState(false);

  const todayStr = getTodayISTString();
  // The barber can book for any day in the next two weeks (a customer who phoned for tomorrow, or who is here now).
  const [walkInDate, setWalkInDate] = useState(todayStr);
  const dayChoices = Array.from({ length: 14 }).map((_, i) => {
    const d = addDays(parseDateOnly(todayStr), i);
    return { value: format(d, "yyyy-MM-dd"), label: `${i === 0 ? t('apptToday') + " · " : ""}${fmt(d, "EEE d MMM")}` };
  });
  const { data: walkInSlotsData, isLoading: walkInSlotsLoading, mutate: mutateWalkInSlots } = useSWR(walkInOpen ? `/api/barber/slots?date=${walkInDate}` : null, fetcher);
  const walkInSlots: { _id: string; startTime: string; endTime: string; status: string; bookingsCount: number; capacity: number }[] = walkInSlotsData?.success
    ? walkInSlotsData.data.filter((sl: { status: string; endTime: string; bookingsCount: number; capacity: number }) =>
        sl.status === "AVAILABLE" && sl.bookingsCount < sl.capacity && minutesUntilSlotEnd(walkInDate, sl.endTime) > 0)
    : [];
  // Use the chosen time only while it is still open; otherwise fall back to the first open time.
  const selectedWalkInSlot = walkInSlots.some((sl) => sl._id === walkInSlotId) ? walkInSlotId : walkInSlots[0]?._id || "";
  const walkInDigits = walkInPhone.replace(/\D/g, "");
  const walkInNameBad = walkInName.trim().length > 0 && walkInName.trim().length < 2;
  const walkInPhoneBad = walkInDigits.length > 0 && walkInDigits.length < 10;

  const handleWalkIn = async () => {
    setWalkInSaving(true);
    try {
      const res = await fetch("/api/barber/bookings/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selectedWalkInSlot, name: walkInName, phone: walkInPhone }),
      });
      const data = await res.json();
      if (data.success) {
        // Say exactly what was booked and for which day, so a booking made for another day is not mistaken for "nothing happened".
        const pickedSlot = walkInSlots.find((sl) => sl._id === selectedWalkInSlot);
        toast.add({
          title: t('bookingAddedTitle'),
          description: `${walkInName.trim()} · ${fmt(parseDateOnly(walkInDate), "EEE d MMM")}${pickedSlot ? ` · ${pickedSlot.startTime}` : ""} · ${data.data.bookingNumber}`,
          type: "success",
        });
        // A booking for a later day lives under Upcoming, not Today: take the barber there so he can see it.
        if (walkInDate !== todayStr) { setFilter("UPCOMING"); setPage(1); }
        setWalkInOpen(false);
        setWalkInName("");
        setWalkInPhone("");
        setWalkInSlotId("");
        setWalkInDate(todayStr);
        mutateBookings();
        mutateWalkInSlots();
      } else {
        // Most likely someone else took the time meanwhile: refresh the list so a free time can be picked.
        mutateWalkInSlots();
        setWalkInSlotId("");
        toast.add({ title: "Error", description: data.error?.message || "Failed to add walk-in", type: "error" });
      }
    } catch {
      toast.add({ title: t('error'), description: t('genericError'), type: "error" });
    } finally {
      setWalkInSaving(false);
    }
  };

  const { data: bookingsData, isLoading: loading, mutate: mutateBookings } = useSWR(
    `/api/barber/bookings?filter=${filter}&page=${page}&limit=${limit}`,
    fetcher
  );

  useRealtimeRefresh((event) => {
    mutateBookings();
    if (event?.type === "BOOKING_CANCELLED_BY_CUSTOMER" && event.data) {
      const { name, phone, time, waitlistCustomers, holdMinutes } = event.data;
      setWhatsappPromptData({
        phone, name, time,
        prompt: `${name} cancelled their ${time} booking. The slot is open again.`,
        waitlistCustomers,
        holdMinutes,
        byCustomer: true,
      });
    }
  });

  const bookings: BookingView[] = bookingsData?.success ? bookingsData.data : [];
  const pagination = bookingsData?.success ? bookingsData.pagination : null;

  const handleAction = async (id: string, action: "cancel" | "complete" | "no-show") => {
    if (action === "cancel") {
      setCancelBookingId(id);
      return;
    }
    await processAction(id, action);
  };

  // A booking being updated ignores further taps, so a double-tap never sends a second request.
  const busyRef = useRef<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const processAction = async (id: string, action: "cancel" | "complete" | "no-show") => {
    if (busyRef.current.has(id)) return;
    busyRef.current.add(id);
    setBusyIds([...busyRef.current]);
    try {
      const res = await fetch(`/api/bookings/${id}/${action}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        mutateBookings();
        
        if (action === "cancel" && data.data?.customer?.phone) {
          const { name, phone } = data.data.customer;
          const time = data.data.booking.startTime;
          
          const prompt = t('cancelPrompt' as any).replace('{name}', name);
          setWhatsappPromptData({ phone, name, time, prompt, waitlistCustomers: data.data.waitlistCustomers, holdMinutes: data.data.holdMinutes });
        }
      } else if (res.status === 400 && /^Cannot /.test(data.error?.message || "")) {
        // Someone (or another phone) already changed it — just show the current state, no scary error.
        mutateBookings();
      } else {
        toast.add({ title: t('error'), description: data.error?.message || t('genericError'), type: "error" });
      }
    } catch (error) {
      toast.add({ title: t('error'), description: t('genericError'), type: "error" });
    } finally {
      busyRef.current.delete(id);
      setBusyIds([...busyRef.current]);
    }
  };

  const executeCancel = async () => {
    if (!cancelBookingId) return;
    const id = cancelBookingId;
    setCancelBookingId(null);
    await processAction(id, "cancel");
  };

  const handleSendWhatsApp = () => {
    if (!whatsappPromptData) return;
    const { phone, name, time } = whatsappPromptData;
    const cleanPhone = getWhatsAppNumber(phone);
    const msgStr = t('cancelMessage' as any).replace('{name}', name).replace('{time}', time);
    const msg = encodeURIComponent(msgStr);
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
    setWhatsappPromptData(null);
  };

  // The server already applied the tab filter (and paging), so the rows are used as they come.
  const filteredBookingsRaw = bookings;

  const filteredBookings = filter === "TODAY" ? sortByStartTime(filteredBookingsRaw) : filteredBookingsRaw;
  const needsActionCount: number = bookingsData?.success ? bookingsData.meta?.needsAction ?? 0 : 0;
  const nextBooking = filter === "TODAY"
    ? filteredBookings.find((b) => !b.endTime || minutesUntilSlotEnd(b.date, b.endTime) >= 0)
    : undefined;

  const renderBookingCard = (b: BookingView, highlight = false) => {
    const ended = b.status === "CONFIRMED" && b.endTime && minutesUntilSlotEnd(b.date, b.endTime) < 0;
    const statusStyle: Record<string, string> = {
      CONFIRMED: "border-l-blue-500",
      COMPLETED: "border-l-green-500",
      CANCELLED: "border-l-red-500",
      NO_SHOW: "border-l-zinc-400",
    };
    const statusLabel: Record<string, string> = { CONFIRMED: t('apptConfirmed'), COMPLETED: t('apptCompleted'), CANCELLED: t('apptCancelled'), NO_SHOW: t('apptNoShow') };
    const phone = b.customerId?.phone;
    return (
      <div
        key={b._id}
        className={`rounded-2xl border border-zinc-200 dark:border-zinc-800 border-l-4 ${statusStyle[b.status] || ""} bg-white dark:bg-zinc-900 p-4 space-y-3 ${highlight ? "ring-2 ring-zinc-900 dark:ring-zinc-100" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{b.startTime}</div>
            <div className="text-lg text-zinc-900 dark:text-zinc-100 truncate">{b.customerId?.name || "Unknown"}</div>
            <div className="text-sm text-zinc-500">
              {b.date !== getTodayISTString() && <>{fmt(parseDateOnly(b.date), "d MMM")} · </>}{phone || t('custNoPhone')}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs font-medium text-zinc-500">{statusLabel[b.status]}</span>
            {ended && <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">{t('apptNeedsAction')}</span>}
          </div>
        </div>
        {b.status === "CONFIRMED" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-12 text-base bg-green-600 hover:bg-green-700 text-white" disabled={busyIds.includes(b._id)} onClick={() => handleAction(b._id, "complete")}>
                <Check className="w-5 h-5 mr-1" /> {t('done')}
              </Button>
              <Button variant="outline" className="h-12 text-base" disabled={busyIds.includes(b._id)} onClick={() => handleAction(b._id, "no-show")}>
                <X className="w-5 h-5 mr-1" /> {t('apptNoShow')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {phone && (
                <>
                  <a href={`tel:${phone}`} className="flex-1 h-11 inline-flex items-center justify-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm">
                    <Phone className="w-4 h-4" /> {t('callLabel')}
                  </a>
                  <a href={`https://wa.me/${getWhatsAppNumber(phone)}`} target="_blank" rel="noreferrer" className="flex-1 h-11 inline-flex items-center justify-center gap-1 rounded-lg border border-green-200 text-green-700 text-sm">
                    <MessageCircle className="w-4 h-4" /> {t('whatsappLabel')}
                  </a>
                </>
              )}
              <button onClick={() => handleAction(b._id, "cancel")} disabled={busyIds.includes(b._id)} className="h-11 px-3 text-sm text-red-600 disabled:opacity-50">{t('cancel')}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { label: t('apptToday'), value: "TODAY" },
    { label: t('apptUpcoming'), value: "UPCOMING" },
    { label: t('apptAll'), value: "ALL" },
    { label: t('apptCompleted'), value: "COMPLETED" },
    { label: t('apptCancelled'), value: "CANCELLED" },
    { label: t('apptNoShow'), value: "NO_SHOW" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('appointments')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">{t('apptSubtitle')}</p>
        <Button className="mt-4 h-12 text-base w-full sm:w-auto" onClick={() => setWalkInOpen(true)}>
          <UserPlus className="w-5 h-5 mr-2" /> {t('addBookingTitle')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setFilter(tab.value); setPage(1); }}
            className={`px-4 py-3 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === tab.value 
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" 
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {needsActionCount > 0 && (
        <button
          onClick={() => { setFilter("ALL"); setPage(1); }}
          className="w-full text-left rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900 text-orange-800 dark:text-orange-300 px-4 py-3 text-sm font-medium"
        >
          {t('apptNeedsActionBanner').replace('{count}', String(needsActionCount))}
        </button>
      )}

      {nextBooking && (
        <div className="xl:hidden space-y-2">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">{t('apptNextCustomer')}</h2>
          {renderBookingCard(nextBooking, true)}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-zinc-500">{t('loading')}</div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">{t('apptNone')}</div>
        ) : (
          <>
          <div className="xl:hidden p-3 space-y-3">
            {filteredBookings.filter((b) => b._id !== nextBooking?._id).map((b) => renderBookingCard(b))}
          </div>
          <div className="hidden xl:block overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('customer')}</th>
                  <th className="px-4 py-3 font-medium">{t('yourPhone')}</th>
                  <th className="px-4 py-3 font-medium">{t('apptColDateTime')}</th>
                  <th className="px-4 py-3 font-medium">{t('apptColStatus')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('apptColActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredBookings.map((b) => (
                  <tr key={b._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{b.customerId?.name || "Unknown"}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{b.customerId?.phone || "N/A"}</td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                      {fmt(parseDateOnly(b.date), "d MMM yyyy")} <span className="text-zinc-500 ml-2">{b.startTime}</span>
                    </td>
                    <td className="px-4 py-3">
                      {b.status === "CONFIRMED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{t('apptConfirmed')}</span>}
                      {b.status === "CONFIRMED" && b.endTime && minutesUntilSlotEnd(b.date, b.endTime) < 0 && <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">{t('apptNeedsAction')}</span>}
                      {b.status === "COMPLETED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t('apptCompleted')}</span>}
                      {b.status === "CANCELLED" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">{t('apptCancelled')}</span>}
                      {b.status === "NO_SHOW" && <span className="px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">{t('apptNoShow')}</span>}
                    </td>
                    <td className="px-4 py-3"><div className="flex items-center justify-end gap-2">
                      {b.status === "CONFIRMED" && (
                        <>
                          {b.customerId?.phone && (
                            <>
                              <a href={`tel:${b.customerId.phone}`} aria-label={t('callLabel')} title={t('callLabel')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                                <Phone className="w-4 h-4" />
                              </a>
                              <a href={`https://wa.me/${getWhatsAppNumber(b.customerId.phone)}`} target="_blank" rel="noreferrer" aria-label={t('whatsappLabel')} title={t('whatsappLabel')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 text-green-700 hover:bg-green-50">
                                <MessageCircle className="w-4 h-4" />
                              </a>
                            </>
                          )}
                          <Button variant="outline" size="sm" disabled={busyIds.includes(b._id)} onClick={() => handleAction(b._id, "complete")}>{t('done')}</Button>
                          <Button variant="outline" size="sm" disabled={busyIds.includes(b._id)} onClick={() => handleAction(b._id, "cancel")} className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">{t('cancel')}</Button>
                          <Button variant="ghost" size="sm" disabled={busyIds.includes(b._id)} onClick={() => handleAction(b._id, "no-show")}>{t('apptNoShow')}</Button>
                        </>
                      )}
                      {b.status !== "CONFIRMED" && (
                        <span className="text-zinc-400 text-xs italic">{t('apptNoActions')}</span>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        
        <PaginationControls
          pagination={pagination}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      </div>

      <Dialog open={!!cancelBookingId} onOpenChange={(open) => !open && setCancelBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('apptCancelTitle')}</DialogTitle>
            <DialogDescription>
              {t('apptCancelDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCancelBookingId(null)}>
              {t('apptKeepIt')}
            </Button>
            <Button variant="default" className="bg-red-600 hover:bg-red-700 text-white" onClick={executeCancel}>
              Yes, cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={walkInOpen} onOpenChange={setWalkInOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('addBookingTitle')}</DialogTitle>
            <DialogDescription>{t('addBookingDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              className="w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base"
              placeholder={t('yourName')}
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
            />
            {walkInNameBad && <p className="text-sm text-red-600">{t('nameRequired')}</p>}
            <input
              className="w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base"
              placeholder={t('phoneOptional')}
              type="tel"
              inputMode="numeric"
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
            />
            {walkInPhoneBad && <p className="text-sm text-red-600">{t('phoneInvalid')}</p>}
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('chooseDay')}</label>
            <select
              className="w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base"
              value={walkInDate}
              onChange={(e) => { setWalkInDate(e.target.value); setWalkInSlotId(""); }}
            >
              {dayChoices.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            {walkInSlotsLoading ? (
              <p className="text-sm text-zinc-500">{t('loading')}</p>
            ) : walkInSlots.length === 0 ? (
              <p className="text-sm text-zinc-500">{walkInDate === todayStr ? t('noOpenSlots') : t('noOpenSlotsDay')}</p>
            ) : (
              <>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('chooseTime')}</label>
              <select
                className="w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base"
                value={selectedWalkInSlot}
                onChange={(e) => setWalkInSlotId(e.target.value)}
              >
                {walkInSlots.map((sl) => (
                  <option key={sl._id} value={sl._id}>{sl.startTime} – {sl.endTime}</option>
                ))}
              </select>
              </>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setWalkInOpen(false)}>{t('apptClose')}</Button>
            <Button
              disabled={walkInSaving || !selectedWalkInSlot || walkInName.trim().length < 2 || walkInPhoneBad}
              onClick={handleWalkIn}
            >
              {walkInSaving ? t('loading') : t('addBookingTitle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!whatsappPromptData} onOpenChange={(open) => !open && setWhatsappPromptData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{whatsappPromptData?.byCustomer ? t('customerCancelledTitle') : t('apptCancelledOk')}</DialogTitle>
            <DialogDescription>
              {whatsappPromptData?.prompt}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            {!whatsappPromptData?.byCustomer && (
              <Button variant="default" onClick={handleSendWhatsApp}>
                {t('apptMessageCustomer').replace('{name}', whatsappPromptData?.name || '')}
              </Button>
            )}
            
            {whatsappPromptData?.waitlistCustomers && whatsappPromptData.waitlistCustomers.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">{t('apptWaitlistTitle')}</h4>
                {whatsappPromptData.waitlistCustomers.map((wc, i) => (
                  <Button 
                    key={i} 
                    variant="outline" 
                    className="w-full justify-start mb-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100" 
                    onClick={() => {
                      const cleanPhone = getWhatsAppNumber(wc.phone);
                      const msgStr = t('apptWaitlistMessage').replace('{name}', wc.name).replace('{time}', whatsappPromptData.time).replace('{mins}', String(whatsappPromptData.holdMinutes ?? 15)).replace('{link}', window.location.origin);
                      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgStr)}`, '_blank');
                    }}
                  >
                    {t('apptMessagePerson').replace('{name}', wc.name).replace('{phone}', wc.phone)}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setWhatsappPromptData(null)}>
              {t('apptClose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
