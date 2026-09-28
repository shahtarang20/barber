"use client";

import { useState, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [capacity, setCapacity] = useState(1);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    fetchSlots(selectedDate);
  }, [selectedDate]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/barber/profile");
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch profile");
    }
  };

  const fetchSlots = async (date: Date) => {
    setLoading(true);
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const res = await fetch(`/api/barber/slots?date=${formattedDate}`);
      const data = await res.json();
      if (data.success) {
        setSlots(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch slots");
    } finally {
      setLoading(false);
    }
  };

  const generateSlots = async () => {
    setGenerating(true);
    try {
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const res = await fetch("/api/barber/slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formattedDate, slotDuration: 30, capacity }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSlots(selectedDate);
      } else {
        alert(data.error?.message || "Failed to generate slots");
      }
    } catch (error) {
      alert("An unexpected error occurred");
    } finally {
      setGenerating(false);
    }
  };

  const handleBlockSlot = async (id: string) => {
    try {
      const res = await fetch(`/api/barber/slots/${id}/block`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchSlots(selectedDate);
      } else {
        alert(data.error?.message || "Failed to block slot");
      }
    } catch (error) {
      alert("Error blocking slot");
    }
  };

  const handleUnblockSlot = async (id: string) => {
    try {
      const res = await fetch(`/api/barber/slots/${id}/unblock`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchSlots(selectedDate);
      } else {
        alert(data.error?.message || "Failed to unblock slot");
      }
    } catch (error) {
      alert("Error unblocking slot");
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
        fetchSlots(selectedDate);
      } else {
        alert(data.error?.message || "Failed to update capacity");
      }
    } catch (error) {
      alert("Error updating capacity");
    }
  };

  const availableSlots = slots.filter((s) => s.status === "AVAILABLE").length;
  const bookedSlots = slots.filter((s) => s.status === "BOOKED").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Good morning, {profile?.name.split(" ")[0] || "Barber"} 👋
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Here is your schedule for today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Appointments</p>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-zinc-900 dark:text-zinc-50">{slots.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/20 p-4 sm:p-6 rounded-2xl border border-green-100 dark:border-green-900/30 shadow-sm">
          <p className="text-sm font-medium text-green-600 dark:text-green-500">Available</p>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-green-700 dark:text-green-400">{availableSlots}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 p-4 sm:p-6 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm sm:col-span-2 md:col-span-1">
          <p className="text-sm font-medium text-red-600 dark:text-red-500">Booked</p>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-red-700 dark:text-red-400">{bookedSlots}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2 sm:gap-3">
              <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">←</button>
              <span className="whitespace-nowrap">{format(selectedDate, "EEE, MMM d, yyyy")}</span>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md">→</button>
            </h2>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-between md:justify-end">
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 hidden sm:block">Bookings per slot:</label>
              <label className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:hidden">Cap:</label>
              <input type="number" min="1" max="50" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-14 sm:w-16 h-9 rounded-md border border-zinc-200 px-2 sm:px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
            </div>
            <Button variant="outline" size="sm" className="sm:size-default" onClick={generateSlots} disabled={generating}>
              {generating ? "Generating..." : "Generate Slots"}
            </Button>
          </div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">Loading schedule...</div>
          ) : slots.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">No schedule created</h3>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                You haven&apos;t generated any slots for this date yet. Generate your daily schedule to start accepting bookings.
              </p>
              <div className="mt-6 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Bookings per slot:</label>
                  <input type="number" min="1" max="50" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className="w-20 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                </div>
                <Button onClick={generateSlots} disabled={generating}>
                  {generating ? "Generating..." : "Generate Today's Slots"}
                </Button>
              </div>
            </div>
          ) : (
            slots.map((slot) => (
              <div key={slot._id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors gap-4 sm:gap-0">
                <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
                  <div className="text-base sm:text-lg font-semibold w-20 sm:w-24 text-zinc-900 dark:text-zinc-50">
                    {slot.startTime}
                  </div>
                  
                  {slot.status === "AVAILABLE" && (
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Available ({slot.bookingsCount || 0}/{slot.capacity || 1})
                    </span>
                  )}
                  {slot.status === "BOOKED" && (
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      Booked
                    </span>
                  )}
                  {slot.status === "BLOCKED" && (
                    <span className="px-2 sm:px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      Blocked
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end border-t border-zinc-100 dark:border-zinc-800/50 sm:border-0 pt-4 sm:pt-0">
                  <div className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 group" title="Maximum Capacity for this slot">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <input 
                      type="number" 
                      min={slot.bookingsCount > 0 ? slot.bookingsCount : 1} 
                      defaultValue={slot.capacity || 1}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val !== slot.capacity && val >= (slot.bookingsCount || 0) && val > 0) {
                          handleInlineCapacityChange(slot._id, val);
                        } else {
                          e.target.value = slot.capacity || 1; // reset if invalid
                        }
                      }}
                      className="w-8 sm:w-10 h-5 sm:h-6 bg-transparent text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-400/50 rounded text-center transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {slot.status === "AVAILABLE" && <Button variant="outline" size="sm" className="font-medium shadow-sm hover:bg-zinc-50 text-xs sm:text-sm h-7 sm:h-8" onClick={() => handleBlockSlot(slot._id)}>Block Slot</Button>}
                    {(slot.status === "BOOKED" || slot.bookingsCount > 0) && (
                      <Link href="/dashboard/appointments" className="inline-block">
                        <Button variant="secondary" size="sm" className="font-medium shadow-sm text-xs sm:text-sm h-7 sm:h-8">View Details</Button>
                      </Link>
                    )}
                    {slot.status === "BLOCKED" && <Button variant="outline" size="sm" className="font-medium shadow-sm hover:bg-zinc-50 text-xs sm:text-sm h-7 sm:h-8" onClick={() => handleUnblockSlot(slot._id)}>Unblock</Button>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
