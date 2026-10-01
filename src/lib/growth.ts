import { AppSetting } from "@/models/AppSetting";
import { Shop } from "@/models/Shop";
import { User } from "@/models/User";
import { databaseSizeMB, getRetentionConfig } from "@/lib/retention";

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

export async function getPusherLimit(): Promise<number> {
  const doc = await AppSetting.findOne({ key: KEY }).lean<{ value?: { pusherLimit?: number } } | null>();
  const n = Number(doc?.value?.pusherLimit);
  return Number.isFinite(n) && n >= 1 ? n : 100;
}

export async function setPusherLimit(pusherLimit: number) {
  await AppSetting.findOneAndUpdate({ key: KEY }, { $set: { value: { pusherLimit } } }, { upsert: true });
}

export type Level = "ok" | "warn" | "danger";
const level = (pct: number): Level => (pct >= 90 ? "danger" : pct >= 70 ? "warn" : "ok");

export async function computeGrowth() {
  const [shops, barbers, online, sizeMB, retention, pusherLimit] = await Promise.all([
    Shop.countDocuments({ isActive: true }),
    User.countDocuments({ role: "BARBER", isActive: { $ne: false } }),
    User.countDocuments({ role: "BARBER", lastSeenAt: { $gte: new Date(Date.now() - ONLINE_WINDOW_MS) } }),
    databaseSizeMB(),
    getRetentionConfig(),
    getPusherLimit(),
  ]);

  // The plans in BUSINESS.md assume 3 barbers per shop, so size is measured in "shops of 3".
  const shopEquivalents = Math.ceil(barbers / 3);
  const idx = STAGES.findIndex((s) => shopEquivalents < s.to);
  const stage = STAGES[idx === -1 ? STAGES.length - 1 : idx];
  const stageProgress = Math.round(((shopEquivalents - stage.from) / (stage.to - stage.from)) * 100);

  const storagePct = sizeMB !== null ? Math.round((sizeMB / retention.storageLimitMB) * 100) : null;
  const pusherPct = Math.round((online / pusherLimit) * 100);

  const items = [
    { key: "stage", label: "Shops (stage progress)", value: `${shopEquivalents} shop-equivalents of ${stage.to} for this stage`, pct: stageProgress, level: level(stageProgress), advice: stageProgress >= 70 ? stage.next : "Nothing to do yet." },
    { key: "pusher", label: "Barbers online now (about Pusher connections)", value: `${online} of ${pusherLimit} on your Pusher plan`, pct: pusherPct, level: level(pusherPct), advice: pusherPct >= 70 ? "Upgrade Pusher now (or raise the plan number below if you already upgraded). Check 'Peak connections today' on the Pusher dashboard." : "Fine. Also check Pusher's own 'Peak connections today' once a week." },
    { key: "storage", label: "Database storage", value: sizeMB !== null ? `${sizeMB.toFixed(1)} MB of ${retention.storageLimitMB} MB` : "unknown", pct: storagePct ?? 0, level: storagePct === null ? "ok" : level(storagePct), advice: storagePct !== null && storagePct >= 70 ? "Clean up old bookings (Data & Storage page) or upgrade the MongoDB plan." : "Fine." },
  ] as { key: string; label: string; value: string; pct: number; level: Level; advice: string }[];

  return { shops, barbers, online, shopEquivalents, stage: { ...stage, index: STAGES.indexOf(stage) + 1 }, pusherLimit, items };
}
