"use client";

import { PlanSettingsCard } from "@/components/admin/PlanSettingsCard";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

interface AdminRow {
  _id: string;
  name: string;
  barberCode: string;
  email: string;
  isSelf: boolean;
}

interface AuditEntry {
  _id: string;
  action: string;
  actorName: string;
  targetName?: string;
  metadata?: { bookingsDeleted?: number; after?: { enabled?: boolean; months?: number }; amount?: number; months?: number; periodEnd?: string; reason?: string; tier?: string; until?: string; shop?: string; changed?: Record<string, { from: unknown; to: unknown }> };
  createdAt: string;
}

function describeAudit(entry: AuditEntry) {
  if (entry.action === "RETENTION_SETTINGS_CHANGED") {
    const a = entry.metadata?.after;
    return a ? `changed old-booking cleanup (${a.enabled ? `on, keep ${a.months} months` : "off"})` : "changed old-booking cleanup settings";
  }
  if (entry.action === "RETENTION_RUN_MANUALLY") return `ran cleanup now (${entry.metadata?.bookingsDeleted ?? 0} bookings removed)`;
  if (entry.action === "ADMIN_PASSWORD_RESET") return `reset the password for ${entry.targetName ?? "an admin"}`;
  const m = entry.metadata;
  if (entry.action === "PLAN_PAYMENT_RECORDED") return `recorded ₹${m?.amount ?? 0} for ${entry.targetName ?? "a barber"} (${m?.months ?? "?"} month(s), plan now ends ${m?.periodEnd ?? "?"})`;
  if (entry.action === "PLAN_PAYMENT_VOIDED") return `voided a ₹${m?.amount ?? 0} payment for ${entry.targetName ?? "a barber"} (${m?.reason ?? "no reason"})`;
  if (entry.action === "PLAN_GRANTED") return `gave ${entry.targetName ?? "a barber"}${m?.shop ? ` (shop ${m.shop})` : ""} free ${String(m?.tier ?? "").toLowerCase()} access until ${m?.until ?? "?"}`;
  if (entry.action === "PLAN_GRANT_REMOVED") return `removed the free access of ${entry.targetName ?? "a barber"}${m?.shop ? ` (shop ${m.shop})` : ""}`;
  if (entry.action === "PLAN_SETTINGS_CHANGED") return "changed plan sizes / grace period";
  if (entry.action === "BARBER_SETTINGS_CHANGED") return `changed ${Object.entries(m?.changed ?? {}).map(([k, v]) => `${k} ${String(v.from)} → ${String(v.to)}`).join(", ") || "settings"} for ${entry.targetName ?? "a barber"}`;
  return entry.action.toLowerCase().replace(/_/g, " ");
}

export default function AdminSettingsPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<AdminRow | null>(null);
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [adminsRes, auditRes] = await Promise.all([
        fetch("/api/admin/admins"),
        fetch("/api/admin/audit-log"),
      ]);
      const adminsData = await adminsRes.json();
      const auditData = await auditRes.json();
      if (adminsData.success) setAdmins(adminsData.data);
      if (auditData.success) setAuditLog(auditData.data);
    } catch (error) {
      console.error("Failed to fetch admin settings data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.add({ title: "Error", description: "New passwords don't match.", type: "error" });
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.add({ title: "Success", description: "Password changed. Please log in again.", type: "success" });
        setTimeout(() => {
          document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
          router.push("/login");
        }, 1500);
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to change password", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error changing password", type: "error" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleResetOtherAdmin = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/admins/${resetTarget._id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actingAdminPassword: resetConfirmPassword }),
      });
      const data = await res.json();
      if (data.success) {
        window.prompt(
          `New temporary password for ${resetTarget.name} (copy this now — it won't be shown again). Share it with them securely:`,
          data.data.tempPassword
        );
        setResetTarget(null);
        setResetConfirmPassword("");
        fetchData();
      } else {
        toast.add({ title: "Error", description: data.error?.message || "Failed to reset password", type: "error" });
      }
    } catch (error) {
      toast.add({ title: "Error", description: "Error resetting password", type: "error" });
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-zinc-500">Loading...</div>;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Admin Settings</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">Manage your own password and other admin accounts.</p>
      </div>

      {/* Change own password */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Change My Password</h2>
        <div className="space-y-2">
          <Label>Current Password</Label>
          <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>New Password</Label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Confirm New Password</Label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <Button
          onClick={handleChangePassword}
          disabled={changingPassword || !currentPassword || newPassword.length < 6}
        >
          {changingPassword ? "Changing..." : "Change Password"}
        </Button>
      </div>

      {/* Other admins */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Other Admin Accounts</h2>
        <p className="text-sm text-zinc-500">
          If another admin is locked out, you can reset their password here — you'll need to confirm with your own current password first, and it's recorded in the audit log below.
        </p>
        {admins.filter((a) => !a.isSelf).length === 0 ? (
          <p className="text-sm text-zinc-500 italic">You're the only admin account.</p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl">
            {admins.filter((a) => !a.isSelf).map((a) => (
              <div key={a._id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{a.name}</p>
                  <p className="text-xs text-zinc-500">{a.barberCode} &middot; {a.email || "—"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setResetTarget(a)}>
                  Reset Password
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <PlanSettingsCard />

      {/* Audit log */}
      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent Admin Actions</h2>
        {auditLog.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">No recorded actions yet.</p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {auditLog.map((entry) => (
              <div key={entry._id} className="py-2 text-sm flex justify-between">
                <span className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">{entry.actorName}</span> {describeAudit(entry)}
                </span>
                <span className="text-zinc-400 text-xs whitespace-nowrap ml-4">{format(new Date(entry.createdAt), "MMM d, h:mm a")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step-up confirmation modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">Confirm Your Identity</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Enter your own current password to confirm you want to reset the password for <span className="font-medium">{resetTarget.name}</span>.
            </p>
            <Input
              type="password"
              placeholder="Your current password"
              value={resetConfirmPassword}
              onChange={(e) => setResetConfirmPassword(e.target.value)}
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setResetTarget(null); setResetConfirmPassword(""); }}>
                Cancel
              </Button>
              <Button onClick={handleResetOtherAdmin} disabled={resetting || !resetConfirmPassword}>
                {resetting ? "Resetting..." : "Confirm Reset"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
