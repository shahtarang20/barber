"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CancelBookingPage() {
  const [bookingNumber, setBookingNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/public/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingNumber, phone }),
      });
      const data = await res.json();
      setResult({ ok: data.success, message: data.success ? data.data.message : data.error?.message || "Something went wrong" });
    } catch {
      setResult({ ok: false, message: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Cancel your booking</h1>
          <p className="text-zinc-500 mt-1 text-sm">Enter the Booking ID you received and the phone number you booked with.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bookingNumber">Booking ID</Label>
          <Input id="bookingNumber" placeholder="B-0042" value={bookingNumber} onChange={(e) => setBookingNumber(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        {result && (
          <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>{result.message}</p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Cancelling..." : "Cancel booking"}</Button>
      </form>
    </div>
  );
}
