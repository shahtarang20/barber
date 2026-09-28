"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [bio, setBio] = useState("");
  const [workingHours, setWorkingHours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      const res = await fetch("/api/barber/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, workingHours }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Settings saved successfully!");
      } else {
        alert(data.error?.message || "Failed to save settings");
      }
    } catch (error) {
      alert("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-zinc-500">Loading settings...</div>;

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Manage your public profile and working hours.
        </p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Public Profile</h2>
        
        <div className="space-y-2">
          <Label>Name</Label>
          <Input disabled value={profile?.name} className="bg-zinc-50 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400" />
          <p className="text-xs text-zinc-500">To change your name, contact support.</p>
        </div>

        <div className="space-y-2">
          <Label>Bio / Description</Label>
          <Textarea 
            value={bio} 
            onChange={(e) => setBio(e.target.value)} 
            placeholder="Tell customers about your services and experience..."
            className="h-24 resize-none"
          />
        </div>
      </div>

      {/* Working Hours */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Working Hours</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            These hours are used when generating your daily slots.
          </p>
        </div>

        <div className="space-y-4">
          {workingHours.map((wh, index) => (
            <div key={wh.day} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
              <div className="w-32 font-medium text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                {wh.day}
                <input 
                  type="checkbox" 
                  checked={!wh.isClosed} 
                  onChange={(e) => handleWorkingHourChange(index, "isClosed", !e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 ml-4 sm:hidden"
                />
              </div>
              
              <div className="flex-1 flex items-center gap-2 w-full sm:w-auto">
                {wh.isClosed ? (
                  <span className="text-sm text-zinc-500 italic py-2">Closed</span>
                ) : (
                  <>
                    <Input 
                      type="time" 
                      value={wh.startTime} 
                      onChange={(e) => handleWorkingHourChange(index, "startTime", e.target.value)}
                      className="w-full sm:w-32"
                    />
                    <span className="text-zinc-500 text-sm">to</span>
                    <Input 
                      type="time" 
                      value={wh.endTime} 
                      onChange={(e) => handleWorkingHourChange(index, "endTime", e.target.value)}
                      className="w-full sm:w-32"
                    />
                  </>
                )}
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id={`open-${wh.day}`}
                  checked={!wh.isClosed} 
                  onChange={(e) => handleWorkingHourChange(index, "isClosed", !e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <Label htmlFor={`open-${wh.day}`} className="font-normal cursor-pointer">Open</Label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving} className="px-8">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
