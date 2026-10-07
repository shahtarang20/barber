# Launch checklist

Tick every box in order. Things marked (you) cannot be done by code.

## 1. Accounts and domain
- [ ] (you) Buy/point the domain. In Vercel -> Domains add it, set the DNS records Vercel shows (A/CNAME), wait for the green tick. HTTPS is automatic; HSTS is sent by the app.
- [ ] (you) Set `NEXT_PUBLIC_APP_URL=https://yourdomain.com` (no trailing slash), then redeploy.
- [ ] Vercel plan: Hobby allows 2 cron jobs, each at most once a day (what `vercel.json` uses, and the job is safe to run twice). Hobby is for non-commercial use; take Pro once barbers pay you.

## 2. Environment variables on Vercel (Production)
Full list and meaning: README.md -> Environment variables.
- [ ] `MONGODB_URI`, `AUTH_SECRET` (32+ random chars), `CRON_SECRET` (random, 32+ chars).
- [ ] Upstash Redis: create a database near the app region; set URL and token (or install the Vercel Marketplace integration, which sets `KV_REST_API_*`).
- [ ] Pusher (5 vars, cluster `ap2` for India), VAPID keys (`npx web-push generate-vapid-keys`; keep the private key secret, mark Sensitive) and `VAPID_SUBJECT`.
- [ ] R2 (5 vars) if you want videos. Mark secrets as Sensitive in Vercel.
- [ ] `PUSH_ALLOW_ANY_HOST` is NOT set. No `.env.local` is committed.
- [ ] After deploy, Vercel -> Logs: look for `[env]` lines. An `ERROR` there means a required variable is missing; `WARNING` means a recommended one is.

## 3. MongoDB Atlas
- [ ] Network Access: add `0.0.0.0/0` (Vercel's serverless IPs change; protect with a strong database user password instead). 
- [ ] Database user has a long random password and only readWrite on this database.
- [ ] Cluster region should be the same region as the Vercel functions. If the cluster is in Mumbai (AWS ap-south-1), add `"regions": ["bom1"]` to `vercel.json`; the repo leaves it unset because the region is not known from code. Check Vercel -> Settings -> Functions.
- [ ] **Backups:** Atlas free (M0) has NO automatic backups. Either upgrade to M10+ and enable Cloud Backup (continuous/snapshot, point-in-time restore), or on M0 export weekly with `mongodump --uri "<uri>" --gzip --archive=barber-$(date +%F).gz` and store it off the machine (Google Drive/R2). Test a restore once into a scratch cluster. Tick "I checked it today" for backups in the admin Growth panel.
- [ ] Atlas -> Alerts: enable e-mail alerts for connections, disk and CPU.

## 4. Cloudflare R2 (only if media is used)
- [ ] Bucket public access on (r2.dev address or custom domain) and put it in `R2_PUBLIC_BASE_URL`.
- [ ] CORS on the bucket (videos upload straight from the browser): AllowedOrigins `https://yourdomain.com`; AllowedMethods `PUT, GET, HEAD`; AllowedHeaders `*` (or `content-type`); ExposeHeaders `ETag`; MaxAgeSeconds `3600`.
- [ ] API token limited to this bucket (Object Read & Write).

## 5. First admin and security
- [ ] Create the admin with `scripts/create-admin.ts` (see README), sign in at `/login`, change the password at Admin -> Settings -> Change My Password. Never keep a default or shared password.
- [ ] Check response headers: `curl -sI https://yourdomain.com | grep -i -E "strict-transport|content-security|x-frame|nosniff|powered"` (no `x-powered-by`).
- [ ] `https://yourdomain.com/robots.txt` and `/sitemap.xml` load; dashboard/admin/api are disallowed.
- [ ] `https://yourdomain.com/api/health` returns 200.
- [ ] Add that URL to an uptime monitor (alert e-mail/WhatsApp) with a 5-minute interval.

## 6. Smoke test on production
- [ ] Register a test barber, log in, set hours, copy the public link.
- [ ] Open the link on a phone (private tab): the page loads, install prompt/manifest works, book a slot, see it live on the dashboard, cancel it from the customer link.
- [ ] Enable notifications on the dashboard and confirm a push arrives (needs VAPID).
- [ ] Upload a picture (and a short video if R2 is on). 
- [ ] Vercel -> Settings -> Cron Jobs: run `/api/cron/daily` once; it must return 200 (not 401).
- [ ] Delete the test barber (Admin -> Stores) afterwards.
- [ ] Share the public link in WhatsApp: the preview card shows the shop name and image.

## 7. Rollback plan
- Every deploy is immutable. If a release is bad: Vercel -> Deployments -> the last good one -> "Promote to Production" (instant, no rebuild). Env var changes need a redeploy to take effect; changing them back and redeploying is the second rollback.
- Database changes: the app does not run destructive migrations on start. Before any manual data script, take a fresh export (section 3). Restore from the Atlas snapshot or `mongorestore --gzip --archive=<file>` into a scratch cluster first, then copy back only what is needed.
- Keep the previous `AUTH_SECRET`/VAPID keys if you rotate: rotating `AUTH_SECRET` logs everyone out; rotating VAPID keys drops all existing push subscriptions.

## 8. Ongoing
- Weekly: Vercel usage, Upstash usage, Atlas storage and backup (admin Growth panel has the buttons).
- `npm audit --omit=dev` monthly; update Next.js patch versions after reading the release notes.
