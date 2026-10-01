"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getTodayISTString } from "@/lib/istTime";
import { loadLastBooking, clearLastBooking, type LastBooking } from "@/lib/lastBooking";

/** Shown on the booking pages when this phone already has an upcoming booking: its ID, and a link to change or cancel it. */
export function MyBookingBanner() {
  const { t } = useTranslation();
  const [b, setB] = useState<LastBooking | null>(null);

  useEffect(() => {
    const saved = loadLastBooking();
    if (!saved) return;
    if (saved.date < getTodayISTString()) { clearLastBooking(); return; }
    setB(saved);
  }, []);

  if (!b) return null;
  return (
    <div className="mx-auto max-w-2xl px-4 pt-16 pb-1">
      <Link href={`/cancel?id=${encodeURIComponent(b.id)}`} className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-900 min-h-12">
        <CalendarCheck className="w-5 h-5 shrink-0" />
        <span className="flex-1 text-sm">
          <span className="font-semibold">{t("myBookingTitle")} {b.id}</span>
          <span className="block text-xs opacity-80">{new Date(`${b.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {b.time}{b.barber ? ` · ${b.barber}` : ""}</span>
        </span>
        <span className="text-sm font-medium underline">{t("myBookingManage")}</span>
      </Link>
    </div>
  );
}
