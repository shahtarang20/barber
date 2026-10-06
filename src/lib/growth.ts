import { MediaAsset } from "@/models/MediaAsset";
import { CustomerPush } from "@/models/CustomerPush";
import { r2Config } from "@/lib/mediaConfig";
import { AppSetting } from "@/models/AppSetting";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import mongoose from "mongoose";
import { databaseSizeMB, getRetentionConfig } from "@/lib/retention";
import { getUsageTotals } from "@/lib/usage";
import { CronState } from "@/models/CronState";
import { getTodayISTString } from "@/lib/istTime";
import { isPushConfigured } from "@/lib/push";
import { getPusherServer } from "@/lib/realtime";

/** The growth stages from BUSINESS.md. Keep the two in step when prices or plans change. */
export const STAGES = [
  { name: "Stage 1 · Launch", from: 0, to: 25, cost: "about ₹1,700 / month", doNow: "Vercel Pro is required as soon as you charge money. Everything else can stay on the free plans.", next: "At 25 shops (or when barbers online reach 70): upgrade Pusher to Startup (about $49)." },
  { name: "Stage 2 · Pusher gets full", from: 25, to: 50, cost: "about ₹6,000 / month", doNow: "Pusher Startup is needed. Watch MongoDB speed.", next: "At about 45–50 shops, or when storage passes 350 MB: move MongoDB to M10 (about $57)." },
  { name: "Stage 3 · Own database", from: 50, to: 100, cost: "about ₹11,000 / month", doNow: "MongoDB M10 with backups, plus an uptime monitor.", next: "At about 100 shops: move MongoDB to M20." },
  { name: "Stage 4 · Grow the database", from: 100, to: 200, cost: "about ₹19,000–23,000 / month", doNow: "MongoDB M20. Replace the outside QR picture service with your own. Load-test at 150 shops.", next: "At about 200 shops: Pusher Pro, MongoDB M30, hire a developer and a support person." },
  { name: "Stage 5 · Real company", from: 200, to: 500, cost: "about ₹27,000–57,000 / month", doNow: "Pusher Pro, MongoDB M30, a part-time developer and support.", next: "At about 450 shops: Pusher Business and MongoDB M40." },
  { name: "Stage 6 · Spend smart", from: 500, to: 1000, cost: "about ₹73,000–1.3 lakh / month", doNow: "Pusher Business, MongoDB M40, database indexes, a second engineer.", next: "At about 900 shops: plan the bigger rebuild (see BUSINESS.md, Stage 7)." },
  { name: "Stage 7 · Rebuild the engine", from: 1000, to: 10000, cost: "about ₹2.5–10 lakh / month", doNow: "Pusher Premium or custom, MongoDB M50+ or sharding, a real engineering team.", next: "Plan own cloud and your own real-time system before 10,000 shops." },
  { name: "Stage 8 · Big technology company", from: 10000, to: 20000000, cost: "₹13 lakh and up / month", doNow: "Own cloud, own real-time system, large teams.", next: "Ask the engineers you hire then." },
];

const KEY = "growthPlan";
const ONLINE_WINDOW_MS = 12 * 60 * 1000;

/** What the admin told us about the plans they pay for, plus "I checked it today" marks. */
export interface GrowthSettings {
  pusherLimit: number; // connections on the Pusher plan
  pusherDailyMessages: number; // messages per day on the Pusher plan
  redisMonthlyCommands: number; // commands per month on the Upstash plan
  vercelPlan: "hobby" | "pro";
  checks: { vercel?: string; upstash?: string; backup?: string }; // ISO time of the last "I checked"
}
const DEFAULTS: GrowthSettings = { pusherLimit: 100, pusherDailyMessages: 200_000, redisMonthlyCommands: 500_000, vercelPlan: "hobby", checks: {} };
export const CHECK_KEYS = ["vercel", "upstash", "backup"] as const;

export async function getGrowthSettings(): Promise<GrowthSettings> {
  const doc = await AppSetting.findOne({ key: KEY }).lean<{ value?: Partial<GrowthSettings> } | null>();
  const v = doc?.value || {};
  const pos = (n: unknown, d: number) => (Number.isFinite(Number(n)) && Number(n) >= 1 ? Number(n) : d);
  return {
    pusherLimit: pos(v.pusherLimit, DEFAULTS.pusherLimit),
    pusherDailyMessages: pos(v.pusherDailyMessages, DEFAULTS.pusherDailyMessages),
    redisMonthlyCommands: pos(v.redisMonthlyCommands, DEFAULTS.redisMonthlyCommands),
    vercelPlan: v.vercelPlan === "pro" ? "pro" : "hobby",
    checks: v.checks || {},
  };
}

/** Saves only the fields given (dotted $set, so other settings are never wiped). */
export async function saveGrowthSettings(patch: Partial<Omit<GrowthSettings, "checks">> & { checkedNow?: (typeof CHECK_KEYS)[number] }) {
  const set: Record<string, unknown> = {};
  if (patch.pusherLimit !== undefined) set["value.pusherLimit"] = patch.pusherLimit;
  if (patch.pusherDailyMessages !== undefined) set["value.pusherDailyMessages"] = patch.pusherDailyMessages;
  if (patch.redisMonthlyCommands !== undefined) set["value.redisMonthlyCommands"] = patch.redisMonthlyCommands;
  if (patch.vercelPlan !== undefined) set["value.vercelPlan"] = patch.vercelPlan;
  if (patch.checkedNow) set[`value.checks.${patch.checkedNow}`] = new Date().toISOString();
  if (Object.keys(set).length === 0) return;
  await AppSetting.findOneAndUpdate({ key: KEY }, { $set: set }, { upsert: true });
}

export type Level = "ok" | "warn" | "danger";
const level = (pct: number): Level => (pct >= 90 ? "danger" : pct >= 70 ? "warn" : "ok");
const worse = (a: Level, b: Level): Level => (a === "danger" || b === "danger" ? "danger" : a === "warn" || b === "warn" ? "warn" : "ok");

export interface GrowthItem {
  key: string;
  label: string;
  value: string;
  pct: number;
  level: Level;
  advice: string;
  kind: "meter" | "status";
  checkKey?: (typeof CHECK_KEYS)[number]; // shows an "I checked it today" button
  link?: string;
}

const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);

async function mongoConnections(): Promise<{ current: number; available: number } | null> {
  try {
    const st = await mongoose.connection.db!.command({ serverStatus: 1 });
    const c = st?.connections;
    return c && Number.isFinite(c.current) && Number.isFinite(c.available) ? { current: c.current, available: c.available } : null;
  } catch {
    return null; // shared free plans may not allow this
  }
}

export async function computeGrowth() {
  const [shops, barbers, online, sizeMB, retention, gs, usage, conns, cron, paying] = await Promise.all([
    Shop.countDocuments({ isActive: true }),
    User.countDocuments({ role: "BARBER", isActive: { $ne: false } }),
    User.countDocuments({ role: "BARBER", lastSeenAt: { $gte: new Date(Date.now() - ONLINE_WINDOW_MS) } }),
    databaseSizeMB(),
    getRetentionConfig(),
    getGrowthSettings(),
    getUsageTotals(),
    mongoConnections(),
    CronState.findOne({ key: "daily-sync" }).lean<{ date: string; done: boolean; processed?: number; updatedAt?: Date } | null>(),
    User.aggregate([{ $match: { role: "BARBER", premiumAmount: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$premiumAmount" }, n: { $sum: 1 } } }]),
  ]);
  const pusherLimit = gs.pusherLimit;

  // The plans in BUSINESS.md assume 3 barbers per shop, so size is measured in "shops of 3".
  const shopEquivalents = Math.ceil(barbers / 3);
  const idx = STAGES.findIndex((s) => shopEquivalents < s.to);
  const stage = STAGES[idx === -1 ? STAGES.length - 1 : idx];
  const stageProgress = Math.round(((shopEquivalents - stage.from) / (stage.to - stage.from)) * 100);

  const storagePct = sizeMB !== null ? Math.round((sizeMB / retention.storageLimitMB) * 100) : null;
  const pusherPct = Math.round((online / pusherLimit) * 100);

  const pusherOn = Boolean(getPusherServer());
  const redisOn = Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_REDIS_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_REDIS_TOKEN || process.env.KV_REST_API_TOKEN)
  );

  const items: GrowthItem[] = [
    { kind: "meter", key: "stage", label: "Shops (stage progress)", value: `${shopEquivalents} shop-equivalents of ${stage.to} for this stage`, pct: stageProgress, level: level(stageProgress), advice: stageProgress >= 70 ? stage.next : "Nothing to do yet." },
    { kind: "meter", key: "pusher", label: "Barbers online now (about Pusher connections)", value: `${online} of ${pusherLimit} on your Pusher plan`, pct: pusherPct, level: level(pusherPct), advice: pusherPct >= 70 ? "Upgrade Pusher now (or raise the plan number below if you already upgraded). Check 'Peak connections today' on the Pusher dashboard." : "Fine. Also check Pusher's own 'Peak connections today' once a week." },
    { kind: "meter", key: "storage", label: "Database storage", value: sizeMB !== null ? `${sizeMB.toFixed(1)} MB of ${retention.storageLimitMB} MB` : "unknown", pct: storagePct ?? 0, level: storagePct === null ? "ok" : level(storagePct), advice: storagePct !== null && storagePct >= 70 ? "Clean up old bookings (Data & Storage page) or upgrade the MongoDB plan." : "Fine." },
  ];

  // --- Pusher messages per day (our own count; Pusher counts each delivery, so we estimate events x 2) ---
  if (pusherOn) {
    const est = usage.pusherToday * 2;
    const pct = Math.round((est / gs.pusherDailyMessages) * 100);
    items.push({ kind: "meter", key: "pusherMsgs", label: "Pusher messages today (estimate)", value: `about ${est.toLocaleString("en-IN")} of ${gs.pusherDailyMessages.toLocaleString("en-IN")} a day`, pct, level: level(pct), advice: pct >= 70 ? "Close to the daily message limit. When it is reached, live updates stop for the rest of the day (the app falls back to 30-second refresh). Upgrade Pusher." : "Fine. Pusher's own dashboard shows the exact number." });
  } else {
    items.push({ kind: "status", key: "pusherOff", label: "Pusher (live updates)", value: "not set up on this server", pct: 0, level: "warn", advice: "Bookings take up to 30 seconds to show. Add the 5 Pusher variables in Vercel and redeploy." });
  }

  // --- Redis commands per month ---
  if (redisOn) {
    const pct = Math.round((usage.redisMonth / gs.redisMonthlyCommands) * 100);
    items.push({ kind: "meter", key: "redisCmds", label: "Redis commands this month (estimate)", value: `about ${usage.redisMonth.toLocaleString("en-IN")} of ${gs.redisMonthlyCommands.toLocaleString("en-IN")} a month`, pct, level: level(pct), advice: pct >= 70 ? "When the free limit is used up, the app quietly falls back to per-server rate limiting. Upgrade Upstash or raise the plan number below." : "Fine. Upstash's own dashboard shows the exact number.", link: "https://console.upstash.com" });
  } else {
    items.push({ kind: "status", key: "redisOff", label: "Redis (rate limiting)", value: "not set up on this server", pct: 0, level: "warn", advice: "Rate limits only work per server, so abuse protection is weak. Add the Upstash variables in Vercel and redeploy." });
  }

  // --- MongoDB connections ---
  if (conns) {
    const pct = Math.round((conns.current / (conns.current + conns.available)) * 100);
    items.push({ kind: "meter", key: "mongoConns", label: "MongoDB connections", value: `${conns.current} open, ${conns.available} still available`, pct, level: level(pct), advice: pct >= 70 ? "Close to the connection limit. Upgrade the MongoDB plan (the free plan allows 500)." : "Fine." });
  } else {
    items.push({ kind: "status", key: "mongoConnsUnknown", label: "MongoDB connections", value: "this plan does not let the app read it", pct: 0, level: "ok", advice: "Look at Atlas → Metrics → Connections now and then. The free plan allows 500.", link: "https://cloud.mongodb.com" });
  }

  // --- Vercel plan vs charging money ---
  const payingTotal = paying[0]?.total || 0;
  const payingCount = paying[0]?.n || 0;
  if (gs.vercelPlan === "hobby" && payingCount > 0) {
    items.push({ kind: "status", key: "vercelPlan", label: "Vercel plan", value: `Hobby, but ${payingCount} barbers pay you ₹${payingTotal.toLocaleString("en-IN")}`, pct: 0, level: "danger", advice: "Vercel's free Hobby plan is for non-commercial use only. Upgrade to Pro (then set the plan to Pro below).", link: "https://vercel.com/pricing" });
  } else {
    items.push({ kind: "status", key: "vercelPlan", label: "Vercel plan", value: gs.vercelPlan === "pro" ? "Pro" : "Hobby (nobody is paying you yet)", pct: 0, level: "ok", advice: gs.vercelPlan === "pro" ? "Fine." : "Fine until you start charging. Hobby is not allowed for paid products.", link: "https://vercel.com/dashboard" });
  }

  // --- Daily job (slot generation, cleanup) ---
  const today = getTodayISTString();
  const yesterday = new Date(new Date(`${today}T00:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10);
  if (!cron) {
    items.push({ kind: "status", key: "cron", label: "Daily job (new slots, cleanup)", value: "has never run", pct: 0, level: "warn", advice: "Check CRON_SECRET in Vercel and that the cron is listed under Project → Settings → Cron Jobs." });
  } else if (cron.date < yesterday) {
    items.push({ kind: "status", key: "cron", label: "Daily job (new slots, cleanup)", value: `last ran on ${cron.date}`, pct: 0, level: "danger", advice: "Barbers will run out of future slots. Check CRON_SECRET and the Cron Jobs page in Vercel." });
  } else if (cron.date === today && !cron.done) {
    // Started today but has not reached every barber yet (normal for a big fleet: later triggers continue it).
    const left = Math.max(0, barbers - (cron.processed || 0));
    const stuck = cron.updatedAt && Date.now() - new Date(cron.updatedAt).getTime() > 6 * 3600_000;
    items.push({ kind: "status", key: "cron", label: "Daily job (new slots, cleanup)", value: `in progress today: ${(cron.processed || 0).toLocaleString("en-IN")} of ${barbers.toLocaleString("en-IN")} barbers done`, pct: 0, level: stuck ? "danger" : left > 0 ? "warn" : "ok", advice: stuck ? "It stopped part-way. Add more daily-job triggers (needs Vercel Pro) or raise CRON_BATCH — see GROWTH.md." : "Later triggers continue it. If it is often unfinished, add triggers or raise CRON_BATCH (see GROWTH.md)." });
  } else {
    items.push({ kind: "status", key: "cron", label: "Daily job (new slots, cleanup)", value: `finished ${cron.date}${cron.processed ? ` · ${cron.processed.toLocaleString("en-IN")} barbers` : ""}`, pct: 0, level: "ok", advice: "Fine." });
  }

  // --- Phone notifications for barbers ---
  items.push(isPushConfigured
    ? { kind: "status", key: "vapid", label: "Phone notifications (barbers)", value: "switched on", pct: 0, level: "ok", advice: "Fine." }
    : { kind: "status", key: "vapid", label: "Phone notifications (barbers)", value: "not set up on this server", pct: 0, level: "warn", advice: "Barbers will not get new-booking alerts on their phone. Add the VAPID variables in Vercel and redeploy." });

  // --- Pictures and videos (Cloudflare R2 when set up, otherwise pictures live in MongoDB) ---
  const [mediaAgg, customerDevices] = await Promise.all([
    MediaAsset.aggregate([{ $group: { _id: "$driver", bytes: { $sum: { $add: ["$sizeBytes", { $ifNull: ["$thumbSizeBytes", 0] }] } }, n: { $sum: 1 } } }]),
    CustomerPush.estimatedDocumentCount(),
  ]);
  const bytesOf = (d: string) => mediaAgg.find((m) => m._id === d)?.bytes ?? 0;
  const R2_FREE_GB = 10; // Cloudflare R2's free allowance is 10 GB of storage
  if (r2Config()) {
    const gb = bytesOf("R2") / 1024 ** 3, pct = Math.round((gb / R2_FREE_GB) * 100);
    items.push({ kind: "meter", key: "r2", label: "Cloudflare R2 storage (pictures and videos)", value: `${gb.toFixed(2)} GB stored by barbers of the ${R2_FREE_GB} GB free allowance (${(mediaAgg.find((m) => m._id === "R2")?.n ?? 0).toLocaleString("en-IN")} files)`, pct, level: level(pct), advice: pct >= 70 ? "Close to the free allowance. Paid R2 storage is cheap, but check the bill on the Cloudflare dashboard, and lower the storage per plan in Settings → Plans and limits if needed." : "Fine. Cloudflare's dashboard shows the exact bill and downloads.", link: "https://dash.cloudflare.com" });
  } else {
    const mb = bytesOf("MONGO") / 1024 ** 2;
    items.push({ kind: "status", key: "r2Off", label: "Cloudflare R2 (pictures and videos)", value: `not set up: ${mb.toFixed(1)} MB of pictures are kept inside MongoDB, videos are switched off`, pct: 0, level: mb > 100 ? "warn" : "ok", advice: "Fine to start. Pictures in MongoDB use your database storage and bandwidth, so set up R2 (see PROJECT.md, Media) before many barbers upload, and to allow videos.", link: "https://dash.cloudflare.com" });
  }
  items.push({ kind: "status", key: "customerPush", label: "Customer offer notifications", value: `${customerDevices.toLocaleString("en-IN")} customer devices opted in${isPushConfigured ? "" : " (phone notifications are not set up, so nothing can be sent)"}`, pct: 0, level: isPushConfigured ? "ok" : "warn", advice: isPushConfigured ? "Fine. Each barber is limited per plan and each phone gets at most one message a day." : "Add the VAPID variables in Vercel and redeploy." });

  // --- Things only their own dashboards can show: "I checked it" reminders ---
  const manual: { key: (typeof CHECK_KEYS)[number]; label: string; what: string; link: string }[] = [
    { key: "vercel", label: "Vercel usage (bandwidth, function time)", what: "Open Vercel → Usage and make sure nothing is near 100%.", link: "https://vercel.com/dashboard" },
    { key: "upstash", label: "Upstash daily/monthly usage", what: "Open the Upstash database page and check usage.", link: "https://console.upstash.com" },
    { key: "backup", label: "MongoDB backup", what: "The free MongoDB plan has no automatic backups. Export the data (Atlas → Data Services → Export, or mongodump).", link: "https://cloud.mongodb.com" },
  ];
  for (const m of manual) {
    const d = daysSince(gs.checks[m.key]);
    const lvl: Level = d === null ? "warn" : d > 14 ? "danger" : d > 7 ? "warn" : "ok";
    items.push({ kind: "status", key: `check-${m.key}`, label: m.label, value: d === null ? "never checked" : d === 0 ? "checked today" : `checked ${d} day${d === 1 ? "" : "s"} ago`, pct: 0, level: lvl, advice: lvl === "ok" ? "Fine. Check again within a week." : m.what, checkKey: m.key, link: m.link });
  }

  const rank = { danger: 0, warn: 1, ok: 2 } as const;
  items.sort((a, b) => rank[a.level] - rank[b.level]);
  const overall = items.reduce<Level>((acc, i) => worse(acc, i.level), "ok");

  return { shops, barbers, online, shopEquivalents, stage: { ...stage, index: STAGES.indexOf(stage) + 1 }, pusherLimit, settings: gs, overall, items };
}
