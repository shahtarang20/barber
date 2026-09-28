"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "@/components/ui/toast";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/barber/customers");
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data);
        const initialNotes: Record<string, string> = {};
        data.data.forEach((c: any) => {
          initialNotes[c._id] = c.note || "";
        });
        setNoteInputs(initialNotes);
      }
    } catch (error) {
      console.error("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (customerId: string) => {
    setSavingId(customerId);
    try {
      const note = noteInputs[customerId];
      const res = await fetch(`/api/barber/customers/${customerId}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: "Success", description: "Note saved successfully", type: "success" });
      } else {
        toast.add({ title: "Error", description: "Failed to save note", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error saving note", type: "error" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Customer Directory</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Manage your regular customers and private notes.
        </p>
      </div>

      {loading ? (
        <div className="text-zinc-500 py-12 text-center">Loading customers...</div>
      ) : customers.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl text-center shadow-sm">
          <div className="text-4xl mb-4">👥</div>
          <p className="text-zinc-500 dark:text-zinc-400">No customers yet. When customers book with you, they will appear here!</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {customers.map((c) => {
              const isExpanded = expandedId === c._id;
              
              return (
                <div key={c._id} className="transition-all">
                  {/* Row Header */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : c._id)}
                    className="p-4 sm:p-6 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg font-bold text-zinc-700 dark:text-zinc-300">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{c.name}</h3>
                        <p className="text-sm text-zinc-500">{c.phone}</p>
                      </div>
                    </div>
                    
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded-full">
                          {c.totalVisits} {c.totalVisits === 1 ? 'Visit' : 'Visits'}
                        </span>
                        <svg className={`w-5 h-5 text-zinc-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 sm:px-6 pb-6 bg-zinc-50/50 dark:bg-zinc-950/20 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                      <div className="text-sm text-zinc-500 mb-4">
                        Last visited: {format(new Date(c.lastVisit), "MMMM d, yyyy")}
                      </div>
                      
                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Private Note</label>
                        <textarea
                          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-zinc-900 outline-none resize-none h-24"
                          placeholder="E.g., Likes a low fade, always arrives 5 mins early..."
                          value={noteInputs[c._id] || ""}
                          onChange={(e) => setNoteInputs({ ...noteInputs, [c._id]: e.target.value })}
                        />
                        <div className="flex justify-end">
                          <Button 
                            onClick={() => handleSaveNote(c._id)}
                            disabled={savingId === c._id}
                            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900"
                          >
                            {savingId === c._id ? "Saving..." : "Save Note"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
