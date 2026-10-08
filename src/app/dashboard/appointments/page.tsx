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
import dynamic from "next/dynamic";
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
  // The catalogue service the customer picked, if any (saved with the booking).
  serviceNameSnapshot?: string;
  servicePriceSnapshot?: number;
  serviceDurationSnapshot?: number;
}

// The dialogs (and the dialog library) are downloaded only when one is first opened.
const CancelBookingDialog = dynamic(() => import("@/components/dashboard/AppointmentDialogs").then((m) => m.CancelBookingDialog), { ssr: false });
const WalkInDialog = dynamic(() => import("@/components/dashboard/AppointmentDialogs").then((m) => m.WalkInDialog), { ssr: false });
const WhatsappPromptDialog = dynamic(() => import("@/components/dashboard/AppointmentDialogs").then((m) => m.WhatsappPromptDialog), { ssr: false });
import type { WhatsappPromptData } from "@/components/dashboard/AppointmentDialogs";

export default function AppointmentsPage() {
  const fmt = useDateFormat();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [filter, setFilter] = useState("TODAY");
  const { t } = useTranslation();

  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [whatsappPromptData, setWhatsappPromptData] = useState<WhatsappPromptData | null>(null);

  const [walkInOpen, setWalkInOpen] = useState(false);
  // Keep a dialog mounted after its first use so it can play its closing animation.
  const [walkInUsed, setWalkInUsed] = useState(false);
  const todayStr = getTodayISTString();

  const { data: profileData } = useSWR("/api/barber/profile", fetcher);
  const myProfile: { slug?: string; name?: string } | undefined = profileData?.success ? profileData.data : undefined;
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
  // The last booking on the last page was just cancelled / completed: step back instead of showing an empty page with no way back.
  useEffect(() => {
    if (pagination && page > Math.max(1, pagination.pages)) setPage(Math.max(1, pagination.pages));
  }, [pagination, page]);

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

  // Ready-written reminder (customer's language = the barber's language here), opened in WhatsApp in one tap.
  const reminderLink = (b: { date: string; startTime: string; bookingNumber: string; customerId?: { name?: string; phone?: string } }) => {
    const today = getTodayISTString();
    const tomorrow = format(addDays(parseDateOnly(today), 1), "yyyy-MM-dd");
    const when = b.date === today ? t('apptReminderToday') : b.date === tomorrow ? t('apptReminderTomorrow') : fmt(parseDateOnly(b.date), "d MMM");
    const msg = t('apptReminderMessage')
      .replace('{name}', b.customerId?.name || '')
      .replace('{barber}', myProfile?.name || '')
      .replace('{when}', when)
      .replace('{time}', b.startTime)
      .replace('{id}', b.bookingNumber)
      .replace('{link}', `${typeof window !== 'undefined' ? window.location.origin : ''}/cancel?id=${encodeURIComponent(b.bookingNumber)}`);
    return `https://wa.me/${getWhatsAppNumber(b.customerId?.phone || '')}?text=${encodeURIComponent(msg)}`;
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
            {b.serviceNameSnapshot && <div className="text-sm font-medium text-indigo-700 dark:text-indigo-300 truncate">{b.serviceNameSnapshot}{b.servicePriceSnapshot !== undefined ? ` · ₹${b.servicePriceSnapshot}` : ""}{b.serviceDurationSnapshot ? ` · ${b.serviceDurationSnapshot} min` : ""}</div>}
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
                  <a href={reminderLink(b)} target="_blank" rel="noreferrer" className="flex-1 h-11 inline-flex items-center justify-center gap-1 rounded-lg border border-green-200 text-green-700 text-sm">
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
        <Button className="mt-4 h-12 text-base w-full sm:w-auto" onClick={() => { setWalkInUsed(true); setWalkInOpen(true); }}>
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
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{b.customerId?.name || "Unknown"}{b.serviceNameSnapshot && <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{b.serviceNameSnapshot}{b.servicePriceSnapshot !== undefined ? ` · ₹${b.servicePriceSnapshot}` : ""}</div>}</td>
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
                              <a href={reminderLink(b)} target="_blank" rel="noreferrer" aria-label={t('whatsappLabel')} title={t('whatsappLabel')} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 text-green-700 hover:bg-green-50">
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

      {cancelBookingId && (
        <CancelBookingDialog open onClose={() => setCancelBookingId(null)} onConfirm={executeCancel} />
      )}

      {(walkInOpen || walkInUsed) && (
        <WalkInDialog
          open={walkInOpen}
          onOpenChange={setWalkInOpen}
          onBooked={(bookedDate) => {
            // A booking for a later day lives under Upcoming, not Today: take the barber there so he can see it.
            if (bookedDate !== todayStr) { setFilter("UPCOMING"); setPage(1); }
            mutateBookings();
          }}
        />
      )}

      {whatsappPromptData && (
        <WhatsappPromptDialog data={whatsappPromptData} onClose={() => setWhatsappPromptData(null)} profileSlug={myProfile?.slug} />
      )}
    </div>
  );
}
