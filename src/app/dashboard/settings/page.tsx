"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";
import { useDateFormat } from "@/lib/dateLocale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

const formatTimeInput = (input: string, isEndTime: boolean): string => {
  if (!input) return "";
  const clean = input.trim().toLowerCase();
  
  const match = clean.match(/(\d+)(?::(\d+))?/);
  if (!match) return input;

  let hours = parseInt(match[1]);
  let mins = match[2] ? parseInt(match[2]) : 0;
  
  let ampm = "";
  if (clean.includes("a")) ampm = "AM";
  else if (clean.includes("p")) ampm = "PM";

  if (hours > 12 && hours < 24) {
    hours -= 12;
    ampm = "PM";
  } else if (hours === 12 && ampm === "") {
    ampm = "PM";
  }
  
  if (ampm === "") {
    if (isEndTime) {
      if (hours >= 1 && hours <= 11) ampm = "PM";
      else ampm = "AM"; 
    } else {
      if (hours >= 1 && hours <= 5) ampm = "PM";
      else ampm = "AM";
    }
  }

  if (hours === 0) {
    hours = 12;
    if (!ampm) ampm = "AM";
  }

  const hh = hours.toString().padStart(2, "0");
  const mm = mins.toString().padStart(2, "0");
  
  return `${hh}:${mm} ${ampm}`;
};

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const selectClass =
  "h-11 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-1.5 text-sm";

// Working-hours time picker in the 12-hour style people use in India: hour 1–12, minutes, AM/PM.
function TimeSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const m = formatTimeInput(value || "", false).match(/^(\d+):(\d+)\s*(AM|PM)$/);
  const hour = m ? parseInt(m[1]) : 10;
  const minute = m ? m[2] : "00";
  const ampm = m ? m[3] : "AM";
  // Legacy minutes that aren't on the 5-minute list are still shown, not lost.
  const minuteOptions = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute].sort();
  const emit = (h: number, mi: string, ap: string) => onChange(`${h.toString().padStart(2, "0")}:${mi} ${ap}`);

  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <select className={selectClass} value={hour} onChange={(e) => emit(Number(e.target.value), minute, ampm)} aria-label={`${label} hour`}>
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-zinc-500">:</span>
      <select className={selectClass} value={minute} onChange={(e) => emit(hour, e.target.value, ampm)} aria-label={`${label} minutes`}>
        {minuteOptions.map((mi) => <option key={mi} value={mi}>{mi}</option>)}
      </select>
      <select className={selectClass} value={ampm} onChange={(e) => emit(hour, minute, e.target.value)} aria-label={`${label} AM or PM`}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [workingHours, setWorkingHours] = useState<any[]>([]);
  const [slotDuration, setSlotDuration] = useState(30);
  const [defaultCapacity, setDefaultCapacity] = useState(1);
  // What's typed in the capacity box. Kept as text so the field can be emptied
  // while typing (a number state snaps an empty box straight back to 1).
  const [capacityText, setCapacityText] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [warningCount, setWarningCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };
  const fmt = useDateFormat();
  // Monday..Sunday in the chosen language (2024-01-01 was a Monday).
  const ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayLabel = (day: string) => fmt(new Date(2024, 0, 1 + Math.max(0, ORDER.indexOf(day))), "EEEE");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/barber/profile");
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setBio(data.data.bio || "");
        setWorkingHours(data.data.workingHours || []);
        setSlotDuration(data.data.slotDuration || 30);
        setDefaultCapacity(data.data.defaultCapacity || 1);
        setCapacityText(String(data.data.defaultCapacity || 1));
      }
    } catch (error) {
      console.error("Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  const handleWorkingHourChange = (index: number, field: string, value: any) => {
    const updated = [...workingHours];
    updated[index] = { ...updated[index], [field]: value };
    setWorkingHours(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formattedWorkingHours = workingHours.map(wh => ({
        ...wh,
        startTime: wh.isClosed ? wh.startTime : formatTimeInput(wh.startTime, false),
        endTime: wh.isClosed ? wh.endTime : formatTimeInput(wh.endTime, true)
      }));
      setWorkingHours(formattedWorkingHours);

      const res = await fetch("/api/barber/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, workingHours: formattedWorkingHours, slotDuration, defaultCapacity }),
      });
      const data = await res.json();
      if (data.success) {
        const { removedSlots, slotsNeedingManualCancellation, capacityKeptSlots } = data.data;
        if (capacityKeptSlots > 0) {
          toast.add({
            title: t('settingsCapacityKeptTitle'),
            description: t('settingsCapacityKeptDesc').replace('{count}', capacityKeptSlots.toString()),
            type: "error",
          });
        }
        if (slotsNeedingManualCancellation > 0) {
          setWarningCount(slotsNeedingManualCancellation);
          setShowWarningModal(true);
        } else if (removedSlots > 0) {
          toast.add({
            title: t('settingsSuccessTitle'),
            description: t('settingsSuccessRemovedDesc').replace('{count}', removedSlots.toString()),
            type: "success",
          });
        } else {
          toast.add({ 
            title: t('settingsSuccessTitle'), 
            description: t('settingsSuccessDesc'), 
            type: "success" 
          });
        }
      } else {
        toast.add({ title: t('error'), description: data.error?.message || t('settingsSaveFailed'), type: "error" });
      }
    } catch (error) {
      toast.add({ title: t('error'), description: t('settingsSaveFailed'), type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-zinc-500">{t('loading')}</div>;

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('settings')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          {t('setSubtitle')}
        </p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('setPublicProfile')}</h2>
        
        <div className="space-y-2">
          <Label>{t('setName')}</Label>
          <Input disabled value={profile?.name} className="bg-zinc-50 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400" />
          <p className="text-xs text-zinc-500">{t('setNameHint')}</p>
        </div>

        <div className="space-y-2">
          <Label>{t('setPremium')}</Label>
          <div className="flex items-center gap-3">
            <Input disabled value={`₹${profile?.premiumAmount || 0} / month`} className="bg-zinc-50 text-zinc-800 font-semibold dark:bg-zinc-950 dark:text-zinc-200 w-48" />
            <span className="text-sm font-medium bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
              {profile?.premiumAmount > 0 ? t('setPremiumActive') : t('setFreeTier')}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {profile?.premiumAmount > 0 
              ? t('setPremiumDue').replace('{day}', String(profile?.premiumDueDay || 28))
              : t('setSetByAdmin')}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t('setBio')}</Label>
          <Textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)} 
            placeholder={t('setBioPh')}
            className="h-24 resize-none"
          />
        </div>
      </div>

      {/* Working Hours */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('setWorkingHours')}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {t('setWorkingHoursDesc')}
          </p>
        </div>

        <details className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <summary className="cursor-pointer min-h-11 flex items-center text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('settingsMoreOptions')}</summary>
          <div className="space-y-6 mt-4">
        <div className="space-y-2">
          <Label>{t('setSlotLength')}</Label>
          <div className="flex items-center gap-3">
            <select
              value={slotDuration}
              onChange={(e) => setSlotDuration(Number(e.target.value))}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 h-11 text-sm w-40"
            >
              <option value={10}>{t('setMinutes').replace('{n}', '10')}</option>
              <option value={15}>{t('setMinutes').replace('{n}', '15')}</option>
              <option value={20}>{t('setMinutes').replace('{n}', '20')}</option>
              <option value={30}>{t('setMinutes').replace('{n}', '30')}</option>
              <option value={45}>{t('setMinutes').replace('{n}', '45')}</option>
              <option value={60}>{t('setMinutes').replace('{n}', '60')}</option>
            </select>
            <p className="text-xs text-zinc-500">
              {t('setSlotHint')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('setDefaultCapacity')}</Label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={50}
              value={capacityText}
              onChange={(e) => {
                const text = e.target.value.replace(/\D/g, "").slice(0, 2);
                setCapacityText(text);
                const n = Number(text);
                if (n >= 1 && n <= 50) setDefaultCapacity(n);
              }}
              onBlur={() => setCapacityText(String(defaultCapacity))}
              className="w-20 h-11 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm"
            />
            <p className="text-xs text-zinc-500">
              {t('setCapacityHint')}
            </p>
          </div>
        </div>

          </div>
        </details>

        <Button
          variant="outline"
          onClick={() => {
            const first = workingHours.find((wh) => !wh.isClosed);
            if (!first) return;
            setWorkingHours(workingHours.map((wh) => (wh.isClosed ? wh : { ...wh, startTime: first.startTime, endTime: first.endTime })));
          }}
        >
          {t('settingsCopyHours')}
        </Button>

        <div className="space-y-4">
          {workingHours.map((wh, index) => (
            <div key={wh.day} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
              <label className="w-32 min-h-11 font-medium text-zinc-900 dark:text-zinc-100 flex items-center justify-between cursor-pointer sm:pointer-events-none">
                {dayLabel(wh.day)}
                <input 
                  type="checkbox" 
                  checked={!wh.isClosed} 
                  onChange={(e) => handleWorkingHourChange(index, "isClosed", !e.target.checked)}
                  className="w-7 h-7 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 ml-2 sm:hidden"
                />
              </label>
              
              <div className="flex-1 flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {wh.isClosed ? (
                  <span className="text-sm text-zinc-500 italic py-2">{t('setClosed')}</span>
                ) : (
                  <>
                    <TimeSelect label={t('setOpening')} value={wh.startTime} onChange={(v) => handleWorkingHourChange(index, "startTime", v)} />
                    <span className="text-zinc-500 text-sm">to</span>
                    <TimeSelect label={t('setClosing')} value={wh.endTime} onChange={(v) => handleWorkingHourChange(index, "endTime", v)} />
                  </>
                )}
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id={`open-${wh.day}`}
                  checked={!wh.isClosed} 
                  onChange={(e) => handleWorkingHourChange(index, "isClosed", !e.target.checked)}
                  className="w-6 h-6 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <Label htmlFor={`open-${wh.day}`} className="font-normal cursor-pointer min-h-11 flex items-center pr-2">{t('setOpen')}</Label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving} className="px-8">
          {saving ? t('settingsSaving') : t('settingsSaveChanges')}
        </Button>
      </div>

      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={handleLogout} disabled={loggingOut} className="h-12 px-8 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30">
          <LogOut className="w-5 h-5 mr-2" /> {t('logout')}
        </Button>
      </div>

      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              {t('settingsWarningTitle')}
            </DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400 pt-2 text-base leading-relaxed">
              {t('settingsWarningDesc').replace('{count}', warningCount.toString())}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <Button variant="default" onClick={() => setShowWarningModal(false)} className="w-full sm:w-auto">
              {t('done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
