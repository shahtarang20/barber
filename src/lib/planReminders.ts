import { User } from "@/models/User";
import { pushToBarber } from "@/lib/push";
import { getTodayISTString } from "@/lib/istTime";
import { REMINDER_DAYS, addDaysStr, getPlansConfig, subscriptionState } from "@/lib/plans";

/**
 * Daily renewal push: from 3 days before the plan ends until the end of the grace period, once a day
 * (the job runs twice a day, so the date of the last reminder is kept to avoid doubles). Returns how many were sent.
 * Barbers with no push subscription simply see the in-app banner instead.
 */
export async function sendPlanReminders(): Promise<number> {
  const today = getTodayISTString();
  const cfg = await getPlansConfig();
  const candidates = await User.find({
    role: "BARBER", isActive: true, premiumAmount: { $gt: 0 }, planReminderOn: { $ne: today },
    $or: [{ planEndsOn: { $exists: false } }, { planEndsOn: { $gte: addDaysStr(today, -cfg.graceDays - 1), $lte: addDaysStr(today, REMINDER_DAYS) } }],
  }).select("premiumAmount premiumDueDay planEndsOn").limit(500).lean<{ _id: unknown; premiumAmount?: number; premiumDueDay?: number; planEndsOn?: string }[]>();

  let sent = 0;
  for (const u of candidates) {
    const s = subscriptionState(u, cfg, today);
    if (!s.reminder || s.status === "EXPIRED" || s.status === "FREE") continue;
    const days = s.daysLeft ?? 0;
    const body = s.status === "GRACE"
      ? `Your plan ended on ${s.endsOn}. Features stay on until ${s.graceEndsOn}. Please renew to keep your full catalogue.`
      : days === 0 ? "Your plan ends today. Please renew to keep your full catalogue." : `Your plan ends in ${days} day${days === 1 ? "" : "s"} (${s.endsOn}). Please renew to avoid interruption.`;
    await pushToBarber(String(u._id), { title: "Plan renewal", body, url: "/dashboard/settings" });
    await User.updateOne({ _id: u._id }, { $set: { planReminderOn: today } });
    sent++;
  }
  return sent;
}
