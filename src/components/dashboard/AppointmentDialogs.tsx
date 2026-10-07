"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { useDateFormat } from "@/lib/dateLocale";
import { getWhatsAppNumber } from "@/lib/phone";
import { minutesUntilSlotEnd, getTodayISTString } from "@/lib/istTime";
import { parseDateOnly } from "@/lib/timeSort";

// These three dialogs sit in their own file so the (large) dialog library is only downloaded when
// a dialog is first opened, not with every visit to the appointments page.

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function CancelBookingDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('apptCancelTitle')}</DialogTitle>
          <DialogDescription>{t('apptCancelDesc')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>{t('apptKeepIt')}</Button>
          <Button variant="default" className="bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>
            Yes, cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface WhatsappPromptData {
  phone: string;
  name: string;
  time: string;
  prompt: string;
  waitlistCustomers?: { name: string; phone: string }[];
  byCustomer?: boolean;
  holdMinutes?: number;
}

export function WhatsappPromptDialog({ data, onClose, profileSlug }: { data: WhatsappPromptData | null; onClose: () => void; profileSlug?: string }) {
  const { t } = useTranslation();
  const handleSendWhatsApp = () => {
    if (!data) return;
    const { phone, name, time } = data;
    const cleanPhone = getWhatsAppNumber(phone);
    const msgStr = t('cancelMessage' as any).replace('{name}', name).replace('{time}', time);
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msgStr)}`, '_blank');
    onClose();
  };
  return (
    <Dialog open={!!data} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{data?.byCustomer ? t('customerCancelledTitle') : t('apptCancelledOk')}</DialogTitle>
          <DialogDescription>{data?.prompt}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          {!data?.byCustomer && (
            <Button variant="default" onClick={handleSendWhatsApp}>
              {t('apptMessageCustomer').replace('{name}', data?.name || '')}
            </Button>
          )}

          {data?.waitlistCustomers && data.waitlistCustomers.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">{t('apptWaitlistTitle')}</h4>
              {data.waitlistCustomers.map((wc, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="w-full justify-start mb-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                  onClick={() => {
                    const cleanPhone = getWhatsAppNumber(wc.phone);
                    const msgStr = t('apptWaitlistMessage').replace('{name}', wc.name).replace('{time}', data.time).replace('{mins}', String(data.holdMinutes ?? 15)).replace('{link}', `${window.location.origin}${profileSlug ? `/b/${profileSlug}` : ""}`);
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
          <Button variant="ghost" onClick={onClose}>{t('apptClose')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Add booking" for a customer who is here or phoned: owns all of its own form state. */
export function WalkInDialog({ open, onOpenChange, onBooked }: { open: boolean; onOpenChange: (open: boolean) => void; onBooked: (bookedDate: string) => void }) {
  const { t } = useTranslation();
  const fmt = useDateFormat();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [slotId, setSlotId] = useState("");
  const [saving, setSaving] = useState(false);

  const todayStr = getTodayISTString();
  // The barber can book for any day in the next two weeks (a customer who phoned for tomorrow, or who is here now).
  const [date, setDate] = useState(todayStr);
  const dayChoices = Array.from({ length: 14 }).map((_, i) => {
    const d = addDays(parseDateOnly(todayStr), i);
    return { value: format(d, "yyyy-MM-dd"), label: `${i === 0 ? t('apptToday') + " · " : ""}${fmt(d, "EEE d MMM")}` };
  });
  const { data: slotsData, isLoading: slotsLoading, mutate: mutateSlots } = useSWR(open ? `/api/barber/slots?date=${date}` : null, fetcher);
  const slots: { _id: string; startTime: string; endTime: string; status: string; bookingsCount: number; capacity: number }[] = slotsData?.success
    ? slotsData.data.filter((sl: { status: string; endTime: string; bookingsCount: number; capacity: number }) =>
        sl.status === "AVAILABLE" && sl.bookingsCount < sl.capacity && minutesUntilSlotEnd(date, sl.endTime) > 0)
    : [];
  // Use the chosen time only while it is still open; otherwise fall back to the first open time.
  const selectedSlot = slots.some((sl) => sl._id === slotId) ? slotId : slots[0]?._id || "";
  const digits = phone.replace(/\D/g, "");
  const nameBad = name.trim().length > 0 && name.trim().length < 2;
  const phoneBad = digits.length > 0 && digits.length < 10;

  const handleWalkIn = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/barber/bookings/walk-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: selectedSlot, name, phone }),
      });
      const data = await res.json();
      if (data.success) {
        // Say exactly what was booked and for which day, so a booking made for another day is not mistaken for "nothing happened".
        const pickedSlot = slots.find((sl) => sl._id === selectedSlot);
        toast.add({
          title: t('bookingAddedTitle'),
          description: `${name.trim()} · ${fmt(parseDateOnly(date), "EEE d MMM")}${pickedSlot ? ` · ${pickedSlot.startTime}` : ""} · ${data.data.bookingNumber}`,
          type: "success",
        });
        const bookedDate = date;
        onOpenChange(false);
        setName("");
        setPhone("");
        setSlotId("");
        setDate(todayStr);
        mutateSlots();
        onBooked(bookedDate);
      } else {
        // Most likely someone else took the time meanwhile: refresh the list so a free time can be picked.
        mutateSlots();
        setSlotId("");
        toast.add({ title: t('error'), description: data.error?.message || t('genericError'), type: "error" });
      }
    } catch {
      toast.add({ title: t('error'), description: t('genericError'), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addBookingTitle')}</DialogTitle>
          <DialogDescription>{t('addBookingDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <input
            className="w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base"
            placeholder={t('yourName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {nameBad && <p className="text-sm text-red-600">{t('nameRequired')}</p>}
          <input
            className="w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base"
            placeholder={t('phoneOptional')}
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {phoneBad && <p className="text-sm text-red-600">{t('phoneInvalid')}</p>}
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('chooseDay')}</label>
          <select
            className="w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base"
            value={date}
            onChange={(e) => { setDate(e.target.value); setSlotId(""); }}
          >
            {dayChoices.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          {slotsLoading ? (
            <p className="text-sm text-zinc-500">{t('loading')}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-zinc-500">{date === todayStr ? t('noOpenSlots') : t('noOpenSlotsDay')}</p>
          ) : (
            <>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('chooseTime')}</label>
              <select
                className="w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base"
                value={selectedSlot}
                onChange={(e) => setSlotId(e.target.value)}
              >
                {slots.map((sl) => (
                  <option key={sl._id} value={sl._id}>{sl.startTime} – {sl.endTime}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('apptClose')}</Button>
          <Button disabled={saving || !selectedSlot || name.trim().length < 2 || phoneBad} onClick={handleWalkIn}>
            {saving ? t('loading') : t('addBookingTitle')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
