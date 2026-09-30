"use client";

import { useState } from "react";
import useSWR from "swr";
import { addDays, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { useDateFormat } from "@/lib/dateLocale";
import { getTodayISTString, minutesUntilSlotEnd } from "@/lib/istTime";
import { parseDateOnly, timeStringToMinutes } from "@/lib/timeSort";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Member { _id: string; name: string }
interface ShopSlot { _id: string; startTime: string; endTime: string; status: string; capacity: number; bookingsCount: number; barberId: string; barberName: string }

/** Shop front desk: the owner books a customer with any barber of the shop (phone call or walk-in). */
export function FrontDeskBooking({ shopSlug, members, onBooked }: { shopSlug: string; members: Member[]; onBooked?: () => void }) {
  const { t } = useTranslation();
  const fmt = useDateFormat();
  const today = getTodayISTString();
  const [date, setDate] = useState(today);
  const [barberId, setBarberId] = useState("ANY");
  const [slotId, setSlotId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, mutate } = useSWR(`/api/public/shops/${shopSlug}/slots?date=${date}`, fetcher);
  const all: ShopSlot[] = data?.success ? data.data : [];
  // A barber's quietest time first when "any barber": show every (time, barber) choice, earliest first.
  const options = all
    .filter((s) => s.status === "AVAILABLE" && s.bookingsCount < s.capacity && minutesUntilSlotEnd(date, s.endTime) > 0)
    .filter((s) => barberId === "ANY" || s.barberId === barberId)
    .sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime) || a.barberName.localeCompare(b.barberName));
  const chosen = options.find((o) => o._id === slotId) || options[0];

  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = addDays(parseDateOnly(today), i);
    return { value: format(d, "yyyy-MM-dd"), label: `${i === 0 ? t("apptToday") + " · " : ""}${fmt(d, "EEE d MMM")}` };
  });

  const book = async () => {
    if (!chosen) return;
    setSaving(true);
    try {
      const res = await fetch("/api/barber/shop/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barberId: chosen.barberId, slotId: chosen._id, name, phone }),
      });
      const r = await res.json();
      if (r.success) {
        toast.add({ title: t("walkInAdded"), description: t("shopBookedOk").replace("{barber}", r.data.barberName).replace("{time}", r.data.startTime), type: "success" });
        setName(""); setPhone(""); setSlotId("");
        mutate();
        onBooked?.();
      } else {
        toast.add({ title: t("error"), description: r.error?.message || t("genericError"), type: "error" });
        mutate();
      }
    } catch {
      toast.add({ title: t("error"), description: t("genericError"), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "w-full h-12 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-base";
  return (
    <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t("shopBookTitle")}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("shopBookDesc")}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("chooseDay")}</label>
          <select className={selectClass} value={date} onChange={(e) => { setDate(e.target.value); setSlotId(""); }}>
            {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("shopBarberLabel")}</label>
          <select className={selectClass} value={barberId} onChange={(e) => { setBarberId(e.target.value); setSlotId(""); }}>
            <option value="ANY">{t("shopAnyBarber")}</option>
            {members.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("chooseTime")}</label>
        {options.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("noOpenSlots")}</p>
        ) : (
          <select className={selectClass} value={chosen?._id || ""} onChange={(e) => setSlotId(e.target.value)}>
            {options.map((o) => <option key={o._id} value={o._id}>{o.startTime} · {o.barberName}</option>)}
          </select>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Input placeholder={t("yourName")} value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
        <Input placeholder={t("phoneOptional")} type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12" />
      </div>
      <Button className="h-12 w-full sm:w-auto px-8" disabled={saving || !chosen || name.trim().length < 2 || !(phone.replace(/\D/g, "").length === 0 || phone.replace(/\D/g, "").length >= 10)} onClick={book}>
        {saving ? t("loading") : t("shopBookTitle")}
      </Button>
    </div>
  );
}
