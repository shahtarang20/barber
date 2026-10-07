# BarberSaaS

Multi-tenant barber appointment platform: Next.js 16 (App Router), React 19, MongoDB Atlas (Mongoose), Upstash Redis, Pusher, Cloudflare R2, web-push. Deployed on Vercel. Product and architecture notes: `PROJECT.md`. Admin operations: `ADMIN_GUIDE.md`. Going live: **`LAUNCH_CHECKLIST.md`**.

## Run locally

```bash
npm install
cp .env.example .env.local   # or create it by hand; see the table below
npm run dev                  # http://localhost:3000
```

Checks before every release: `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Environment variables

Set in `.env.local` locally and in Vercel -> Project -> Settings -> Environment Variables (Production). The server checks them at start (`src/lib/envCheck.ts`, run from `src/instrumentation.ts`): a missing **Required** one stops a production start with a clear message (names only, never values); **Recommended** and **Optional** ones are logged. `/api/health` never exposes any of them.

| Variable | Level | What it does / if missing |
|---|---|---|
| `MONGODB_URI` | **Required** | MongoDB Atlas connection string. |
| `AUTH_SECRET` | **Required** | Signs login cookies. 32+ random characters (`openssl rand -base64 48`). Changing it logs everyone out. Also salts visitor-IP hashes. |
| `CRON_SECRET` | Recommended (needed for launch) | Vercel sends it as `Authorization: Bearer ...` to `/api/cron/daily`. Without it the daily job returns 401 and slots stop extending. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public site URL (`https://yourdomain.com`, no trailing slash). Used for sitemap, robots and social-preview absolute URLs. Falls back to Vercel's production domain, then localhost. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Recommended | Shared rate limiting and cache. Also accepted: `UPSTASH_REDIS_REST_REDIS_URL/TOKEN`, `KV_REST_API_URL/TOKEN`. Without it limits fall back to per-instance memory. |
| `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | Optional | Live refresh of the dashboard. All five or none. Cluster for India: `ap2`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Optional | Phone notifications. Generate once: `npx web-push generate-vapid-keys`. |
| `VAPID_SUBJECT` | Optional | `mailto:you@yourdomain.com`, sent with notifications. |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` | Optional | Cloudflare R2 for pictures/videos. All five or none. The public URL's host is added to the CSP and image config automatically. |
| `CRON_BATCH`, `CRON_CONCURRENCY`, `CRON_TIME_BUDGET_MS`, `SLOT_WINDOW_DAYS` | Tuning | Defaults 50 / 10 / 45000 / 30. |
| `PUSHER_HOST`, `PUSHER_PORT`, `PUSHER_TLS`, `PUSH_ALLOW_ANY_HOST` | Tests only | **Never set in production** (the app refuses to start with `PUSH_ALLOW_ANY_HOST=1`). |

First admin account: `ADMIN_CODE=<code> ADMIN_PASSWORD='<long private password>' npx tsx scripts/create-admin.ts` (the script prints which database it will change). Change that password in the admin Settings afterwards.

Scripts in `scripts/` load `.env.local`. If that points at your real database, override `MONGODB_URI` on the command line before running anything destructive.

## Health and monitoring

`GET /api/health` returns `200 {"ok":true,"db":"up"}` when MongoDB answers a ping within 4 s, otherwise `503`. Point an uptime monitor (UptimeRobot, BetterStack) at it. See `LAUNCH_CHECKLIST.md` for backups and rollback.
