/**
 * One place that lists every environment variable the app reads, and checks them at server start
 * (src/instrumentation.ts). Values are NEVER printed: only variable names.
 *
 *  required     the app cannot work without it -> in production the server refuses to start with a clear message
 *  recommended  the app runs but a launch-critical feature is off or weak -> loud error in the log
 *  optional     a feature that degrades gracefully when absent -> one info line
 */
interface Group {
  name: string;
  level: "required" | "recommended" | "optional";
  /** Every name in a list must be set; a list inside `anyOf` means "one of these alternatives". */
  vars: string[];
  anyOf?: string[][];
  whenMissing: string;
}

const GROUPS: Group[] = [
  { name: "Database", level: "required", vars: ["MONGODB_URI"], whenMissing: "no data can be read or saved" },
  { name: "Login signing key", level: "required", vars: ["AUTH_SECRET"], whenMissing: "nobody can log in (use a random string of 32+ characters)" },
  { name: "Cron secret", level: "recommended", vars: ["CRON_SECRET"], whenMissing: "the daily job (slot extension, cleanup, reminders) answers 401 and never runs" },
  {
    name: "Upstash Redis (rate limiting)",
    level: "recommended",
    vars: [],
    anyOf: [["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"], ["UPSTASH_REDIS_REST_REDIS_URL", "UPSTASH_REDIS_REST_REDIS_TOKEN"], ["KV_REST_API_URL", "KV_REST_API_TOKEN"]],
    whenMissing: "rate limits fall back to per-instance memory, which a serverless fleet does not share",
  },
  { name: "Pusher (live refresh)", level: "optional", vars: ["PUSHER_APP_ID", "PUSHER_KEY", "PUSHER_SECRET", "NEXT_PUBLIC_PUSHER_KEY", "NEXT_PUBLIC_PUSHER_CLUSTER"], whenMissing: "pages refresh only on reload / polling" },
  { name: "Web push (VAPID)", level: "optional", vars: ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"], whenMissing: "push notifications are off" },
  { name: "Cloudflare R2 (media)", level: "optional", vars: ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"], whenMissing: "video uploads are off and pictures stay in the database" },
];

const isSet = (name: string) => !!process.env[name]?.trim();

export interface EnvReport { errors: string[]; warnings: string[]; info: string[] }

export function checkEnv(): EnvReport {
  const report: EnvReport = { errors: [], warnings: [], info: [] };
  for (const g of GROUPS) {
    const missing = g.vars.filter((v) => !isSet(v));
    let line: string | null = null;
    if (g.anyOf) {
      if (!g.anyOf.some((set) => set.every(isSet))) line = `${g.name}: none of ${g.anyOf.map((s) => `[${s.join(" + ")}]`).join(" or ")} is set -> ${g.whenMissing}`;
    } else if (missing.length === g.vars.length) {
      line = `${g.name}: ${missing.join(", ")} not set -> ${g.whenMissing}`;
    } else if (missing.length) {
      // Half-configured is almost always a mistake, whatever the level.
      report.warnings.push(`${g.name}: only partly configured, missing ${missing.join(", ")} -> ${g.whenMissing}`);
    }
    if (!line) continue;
    (g.level === "required" ? report.errors : g.level === "recommended" ? report.warnings : report.info).push(line);
  }
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length < 32) report.warnings.push("AUTH_SECRET is shorter than 32 characters; use a long random value");
  if (process.env.PUSH_ALLOW_ANY_HOST === "1" && process.env.NODE_ENV === "production") report.errors.push("PUSH_ALLOW_ANY_HOST=1 is for local testing only; remove it in production");
  return report;
}

/** Called once at server start. Throws in production when a required variable is missing. */
export function assertEnv(): void {
  const { errors, warnings, info } = checkEnv();
  const prod = process.env.NODE_ENV === "production";
  for (const m of info) console.info(`[env] ${m}`);
  for (const m of warnings) console.warn(`[env] WARNING ${m}`);
  for (const m of errors) console.error(`[env] ERROR ${m}`);
  if (prod && errors.length) throw new Error(`Refusing to start, fix the environment: ${errors.join(" | ")}`);
}
