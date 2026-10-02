import { after } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { AppSetting } from "@/models/AppSetting";
import { getTodayISTString } from "@/lib/istTime";

/**
 * Counts how much of the paid-for outside services we use (Pusher events, Redis commands), so the admin's
 * "Growth & limits" panel can warn before a free plan runs out. The counts are ESTIMATES: each server instance
 * adds up its own numbers and saves them to the database at most every 10 seconds, so a few counts can be lost
 * when a server is shut down. One small document per day: `usage:YYYY-MM-DD` -> { pusher, redis }.
 */
export type UsageKind = "pusher" | "redis";

const pending: Record<UsageKind, number> = { pusher: 0, redis: 0 };
let lastFlush = 0;
const FLUSH_EVERY_MS = 10_000;

async function flush() {
  const inc: Record<string, number> = {};
  for (const k of Object.keys(pending) as UsageKind[]) {
    if (pending[k] > 0) { inc[`value.${k}`] = pending[k]; pending[k] = 0; }
  }
  if (Object.keys(inc).length === 0) return;
  try {
    await connectToDatabase();
    await AppSetting.updateOne({ key: `usage:${getTodayISTString()}` }, { $inc: inc }, { upsert: true });
  } catch (err) {
    console.error("Usage count not saved (non-fatal):", err);
  }
}

function startFlush() {
  lastFlush = Date.now();
  try {
    after(flush); // keeps a serverless function alive until the save is done
  } catch {
    void flush(); // not inside a request (script / test)
  }
}

let trailing: ReturnType<typeof setTimeout> | null = null;

/** Never throws and never slows the caller: counting is best-effort. */
export function trackUsage(kind: UsageKind, n = 1) {
  pending[kind] += n;
  const total = pending.pusher + pending.redis;
  if (Date.now() - lastFlush >= FLUSH_EVERY_MS || total >= 50) return startFlush();
  // Quiet spell right after a burst: still save what was counted, shortly after the last call.
  if (!trailing) {
    trailing = setTimeout(() => { trailing = null; void flush(); lastFlush = Date.now(); }, FLUSH_EVERY_MS);
    (trailing as { unref?: () => void }).unref?.();
  }
}

export interface UsageTotals { pusherToday: number; redisMonth: number; redisToday: number }

/** Today's Pusher events and this month's Redis commands (as saved so far). */
export async function getUsageTotals(): Promise<UsageTotals> {
  const today = getTodayISTString();
  const month = today.slice(0, 7);
  const docs = await AppSetting.find({ key: { $regex: `^usage:${month}-` } }).lean<{ key: string; value?: { pusher?: number; redis?: number } }[]>();
  let pusherToday = 0, redisMonth = 0, redisToday = 0;
  for (const d of docs) {
    redisMonth += d.value?.redis || 0;
    if (d.key === `usage:${today}`) { pusherToday = d.value?.pusher || 0; redisToday = d.value?.redis || 0; }
  }
  return { pusherToday, redisMonth, redisToday };
}
