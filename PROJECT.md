# Barber Appointment SaaS — Project Reference

Everything about this project in one place: what it is, how it is built, every screen and API, how data is stored, the rules that matter, how to set it up and launch it, how it was tested, and what is still open.

Companion files in the same folder:
- `BUSINESS.md` — costs and the growth stages (what to upgrade at 25, 50, 100… shops).
- `ADMIN_GUIDE.md` — how the admin uses the admin area.
- `GROWTH.md` — how to change the code when growing to 10,000 and 1,000,000 shops (what breaks first, stage-by-stage changes, safe rollout routine).
- `REQUIREMENTS.md` — the original product brief.
- `AGENTS.md` / `CLAUDE.md` — notes for AI coding assistants. **This is Next.js 16.3.6, which has breaking changes. Read `node_modules/next/dist/docs/` before changing framework-level code.**

---

## 1. What the product is

A booking system for **village and city barbers in India**. It is not a marketplace: there is no search, map or discovery.

1. A barber signs up with a name, **a mobile number** and a password (email is optional) and gets a **Barber Code** (`b001`, `b002`…) and a personal booking link `/b/<slug>`.
2. The app generates appointment slots from the barber's working hours.
3. The barber shares the link (WhatsApp, QR). Customers open it, pick a day and time, enter name and phone, and get a **Booking ID** (`B-0001`). No customer account or password.
4. The barber runs the day from a phone: sees the queue in time order, taps **Done**, **No-show** or **Cancel**, adds walk-ins, and calls or WhatsApps customers.
5. A **Shop** groups several barbers (3 per shop is the planning assumption). Customers use one shop link `/s/<slug>`, and can choose "Any available barber".
6. An **Admin** (the platform owner) manages barbers, shops, bookings, limits, cleanup, and sees warnings before free plans run out.

Launch plan: 25 shops × 3 barbers = 75 barbers, about 200 customers each, mostly on free plans.

### The three kinds of people
| Person | Logs in? | What they do |
|---|---|---|
| Customer | No | Books, cancels, reschedules, joins a waitlist using a link, Booking ID and phone number |
| Barber (and shop owner/member) | Yes, Barber Code + password | Runs the day, settings, link, shop |
| Admin | Yes, same login page, `ADMIN` role | Runs the platform |

### Rules decided by the owner
- **One phone number may book several seats of the same slot.** A father brings two children on his number. This is intended, not a bug. Do not add a duplicate block.
- India only. All times are IST (UTC+5:30, no daylight saving).
- No automatic SMS/WhatsApp to customers (no paid provider). Reminders are one tap per customer.

---

## 2. Technology

| Part | Choice |
|---|---|
| Framework | Next.js **16.3.6**, App Router, React 19.2, TypeScript 5 |
| Styling | Tailwind CSS 4, `shadcn` + `@base-ui/react` (Dialog, Toast), `lucide-react` icons, `tw-animate-css` |
| Data fetching | SWR (with a 30-second polling fallback) |
| State / language | `zustand` store + a `lang` cookie |
| Database | MongoDB through Mongoose 9 (needs a **replica set**, because cleanup uses transactions; Atlas has this) |
| Real time | Pusher (`pusher` on the server, `pusher-js` in the browser). Optional. |
| Rate limits / cache | Upstash Redis REST (`@upstash/redis`). Optional; falls back to per-server memory. |
| Phone notifications | `web-push` with VAPID keys (barbers only). Optional. |
| Auth | JWT (`jsonwebtoken`) in an `auth_token` cookie, 7 days; passwords hashed with scrypt (older admin scripts use `bcryptjs`) |
| Validation | `zod` 4 |
| Dates | `date-fns` 4 plus our own IST helpers |
| Hosting | Vercel (cron jobs in `vercel.json`) |
| PWA | `public/manifest.json`, `public/sw.js`, per-barber manifest and icon routes, install prompt |

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`. Helper scripts in `scripts/` (run with `tsx`): `create-admin.ts`, `reset-admin-password.ts`, `fix-admin.ts`, `seed.ts`, `update-working-hours.ts`, plus old test helpers (`e2e.ts`, `test-api.ts`, `test-db.ts`).

> `scripts/create-admin.ts` creates the first admin with a **fixed code and password written in the file**. Change that password at first login (Admin → Settings → Change My Password).

---

## 3. Folder map

```
src/
  app/
    page.tsx                     landing page (4 languages, "how it works")
    layout.tsx                   root layout, language provider, PWA register
    (auth)/login, register       sign in / sign up
    b/[slug]/                    a barber's public booking page (+ layout with "my booking" banner)
    s/[slug]/                    a shop's public booking page (+ layout, metadata)
    cancel/                      customer cancel / reschedule page (?id= prefill)
    dashboard/                   the barber app
      page.tsx                   Schedule (day view, slot actions, shift/run late)
      appointments/              Today / Upcoming / All / Completed / Cancelled / No-show, add booking
      customers/                 customer list, notes
      link/                      booking link, QR, share
      shop/                      create shop, invite barbers, shop customers, front desk
      settings/                  hours, slot length, capacity, notifications, logout
    admin/                       the admin area (overview, barbers, bookings, shops, data, settings)
    api/                         all server endpoints (section 7)
  components/                    dashboard, admin and shared UI (section 6)
  lib/                           business logic (section 8)
  models/                        Mongoose models (section 5)
  proxy.ts                       route guard for /dashboard and /admin
public/                          manifest, service worker, icons
scripts/                         one-off admin/seed scripts
vercel.json                      daily cron
next.config.ts                   security headers
```

---

## 4. Environment variables

Set them in `.env.local` for development and in Vercel → Settings → Environment Variables for production. **Anything starting with `NEXT_PUBLIC_` is baked in at build time, must be a normal (not Sensitive) variable, and needs a redeploy (without build cache) when changed.**

| Variable | Needed? | What it does |
|---|---|---|
| `MONGODB_URI` | **Yes** | MongoDB connection string (replica set) |
| `AUTH_SECRET` | **Yes** | Signs login tokens (the app refuses to start without it). Long and random. |
| `CRON_SECRET` | **Yes** | Protects `/api/cron/daily` (Vercel sends it as a Bearer token) |
| `NEXT_PUBLIC_APP_URL` | Recommended | The public address of the site |
| `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET` | Optional | Live updates (server side). `PUSHER_SECRET` should be Sensitive. |
| `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | Optional | Live updates (browser side). Cluster for India: `ap2`. |
| `PUSHER_HOST`, `PUSHER_PORT`, `PUSHER_TLS` | Tests only | Point Pusher at a fake/self-hosted server |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Optional | Rate limiting and cache. Also accepted: `UPSTASH_REDIS_REST_REDIS_URL/TOKEN`, `KV_REST_API_URL/TOKEN` (Vercel's names). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Optional | Phone notifications for barbers |
| `VAPID_SUBJECT` | Optional | `mailto:you@example.com`, sent with notifications |
| `SLOT_WINDOW_DAYS` | Optional | How many days ahead slots exist (7–90, default 30) |
| `CRON_BATCH`, `CRON_CONCURRENCY`, `CRON_TIME_BUDGET_MS` | Optional | Tuning for the daily job on big fleets (defaults: 50 barbers per batch, 10 at a time, 45 s). See `GROWTH.md` section 3b. |

What happens when optional services are missing:
- No Pusher → the barber's screens refresh every 30 seconds instead of instantly.
- No Redis → rate limits only work per server instance (weaker abuse protection).
- No VAPID → no phone notifications.

---

## 5. Data model (MongoDB)

| Collection (model) | What it holds |
|---|---|
| **User** | Barbers and admins. `name`, `barberCode` (unique), optional `email`/`phone`, `passwordHash`, `role` (`BARBER`/`ADMIN`), `slug` (unique), `bio`, `workingHours[]` (day, isClosed, start, end, breaks), `slotDuration` (10–60, default 30), `defaultCapacity` (1–50, default 1), `premiumAmount`, `premiumDueDay` (default 28), `linkBookingLimit`, `lastSeenAt`, `isActive`, `tokenVersion`, `shopId` |
| **Slot** | One bookable time. `barberId`, `date` (`YYYY-MM-DD`), `startTime`/`endTime` (e.g. `10:30 AM`), `status` (`AVAILABLE`/`BOOKED`/`BLOCKED`), `capacity`, `bookingsCount`, `waitlist[]` (name, phone, joinedAt, anyBarber, shopId), `holds[]` (phone, name, until), `isCustomCapacity`, `shiftedAt` |
| **Booking** | `bookingNumber` (`B-0001`, unique), `barberId`, `slotId`, `customerId`, `date`, `startTime`, `endTime`, `status` (`CONFIRMED`/`COMPLETED`/`CANCELLED`/`NO_SHOW`), `notes`, `viaLink`, `viaShopId`, `startMinutes` (for time-order sorting) |
| **Customer** | `name`, `phone` (may be empty for walk-ins), `ownerBarberId`, `barberStats[]` (visits and last visit per barber), `barberNotes[]` |
| **Shop** | `name`, `slug`, `ownerId`, `barberIds[]`, `isActive`, `linkBookingLimit` |
| **ShopInvite** | `shopId`, `barberId` (invited), `invitedBy`, `status` (`PENDING`/`ACCEPTED`/`DECLINED`/`CANCELLED`) |
| **PushSubscription** | A barber's phone/browser notification subscription |
| **Counter** | Running numbers (booking IDs, barber codes) |
| **AppSetting** | Platform settings, one document per key (see below) |
| **CronState** | Progress of the daily job so it can resume |
| **Stat** | Cached admin numbers |
| **AuditLog** | What admins changed |

`AppSetting` keys in use:
| Key | Meaning |
|---|---|
| `retention` | Cleanup on/off, months to keep, database plan size, last run |
| `linkLimit` | Default monthly link-booking limit |
| `growthPlan` | Pusher connections/messages plan, Redis monthly commands, Vercel plan (hobby/pro), "I checked it today" marks |
| `usage:YYYY-MM-DD` | Daily counts of Pusher events and Redis commands (the app's own estimates) |

Customers are shared across barbers by phone number. A customer with no phone belongs to the barber who recorded them.

---

## 6. Screens

### Public (customer)
| Path | What it does |
|---|---|
| `/` | Landing page in English, Hindi, Gujarati, Marathi. Language selector, "how it works" section. |
| `/b/<slug>` | A barber's booking page: 7-day date strip, time buttons, name and phone form. Shows the barber's name. Full times offer the waitlist. Confirmation shows Booking ID, date, time. |
| `/s/<slug>` | A shop's page: choose "Any Available Barber" or one barber, then a day and time. Times show "N barbers free" or WAITLIST. If the chosen time fills at the last second, the page quietly retries with another free barber at the same time. |
| `/cancel` | Enter Booking ID and phone to cancel or move a booking. `?id=B-0001` pre-fills the ID. |
| `/login`, `/register` | Sign in / sign up (barbers and admins use the same login) |
| Banner | After booking, a "my booking" banner (kept in the phone's localStorage) offers a link back to manage it |

### Barber app (`/dashboard`, needs login)
| Page | What it does |
|---|---|
| **Schedule** (`/dashboard`) | One day at a time (remembers the last day viewed). Shows slots with bookings; block/unblock a slot; change a slot's seats; **Run Late / shift** today's remaining slots; generate or sync slots; walk-in booking. Past slots hide once finished; in-progress or unfinished slots stay. |
| **Appointments** | Tabs: Today, Upcoming, All, Completed, Cancelled, No-show. 15 per page by default. Phone: cards with **Done / No Show / Call / WhatsApp / Cancel**. Desktop (wide screens): a table with the same actions. **Add a booking** dialog: pick the day, then a time (any day, not just today), name, phone (optional). The WhatsApp button opens a **ready-written reminder** in the barber's language ("Hi Ramesh! Reminder from Raju: your haircut is tomorrow at 2:00 PM (Booking ID B-0004). Can't come? Please cancel here…" with a link to `/cancel?id=…`). Cancelling shows an optional WhatsApp message to the customer and offers to notify waitlisted people. |
| **Customers** | Search (name or phone), visit counts, last visit, private notes |
| **My link** | The booking link, QR code, copy/share, link usage for the month |
| **Shop** | Create a shop, invite barbers by Barber Code, see members, shop customers, and the **front desk** (any member can book on behalf of any member). Invited barbers accept or decline. |
| **Settings** | Your Barber Code, working hours (per day, breaks), slot length, seats per slot, notifications on/off, **Logout** |
| Always present | Language dropdown, offline banner, session guard (a suspended or logged-out barber is sent to login), install prompt, heartbeat every 8 minutes (used for "barbers online") |

### Admin (`/admin`, ADMIN role only)
| Page | What it does |
|---|---|
| **Overview** | Totals, bookings by status, last 7 days, **Growth & limits panel**, barbers table |
| **Manage Stores** (`/admin/barbers`) | Search (incl. phone); a **Phone** column the admin can edit; suspend/re-activate; premium amount and due day; link limit; default link limit; reset password |
| **Bookings** | Every booking; search by Booking ID, customer name/phone, barber name/code. A search like `B-0001` finds only that booking. |
| **Shops** | Add/remove members, switch a shop on/off, delete, shop link limit |
| **Data & Storage** | Database size, automatic cleanup (keep 1–60 months), preview, CSV download, run now |
| **Settings** | Change my password, reset other admins' passwords, audit log |

Full admin instructions: `ADMIN_GUIDE.md`.

### Shared components (`src/components`)
`dashboard/` (Header, Sidebar, MobileNav, SessionGuard, OfflineBanner, EnableNotifications, MyBarberCode, FrontDeskBooking, ShopCustomers), `admin/` (AdminSidebar, AdminMobileNav, GrowthPanel), `ui/` (button, input, label, textarea, dialog, toast, pagination-controls), plus `InstallPrompt`, `LanguageProvider`, `LanguageSelector`, `MyBookingBanner`, `PWARegister`.

### Languages
English, Hindi (हिन्दी), Gujarati (ગુજરાતી), Marathi (मराठी). All text lives in `src/lib/i18n.ts` (one block per language, same keys). The choice is saved in the `lang` cookie. Dates use localized month names (`dateLocale.ts`). Messages that come from the server (some error texts) may still be English only.

---

## 7. API reference (`src/app/api`)

Every barber/admin route checks the login cookie and the account's current state (active, token version), so a suspended or logged-out account stops working at once. Errors come back as `{ success:false, error:{ message } }`.

### Auth
| Method and path | Purpose |
|---|---|
| `POST /api/auth/register` | Barber sign-up (name, **mobile number**, password; email, slug optional). The phone is required, stored as 10 plain digits, and may be shared by two barbers. Creates default hours (Mon–Sat 10 AM–8 PM, Sunday closed) and generates slots straight away. |
| `POST /api/auth/login` | Login by Barber Code (or email) + password. Rate limited per IP and per account. |
| `POST /api/auth/logout` | Ends the session on **all** devices (bumps `tokenVersion`) |
| `PUT /api/auth/change-password` | Admin password change |

### Barber
| Path | Purpose |
|---|---|
| `GET /api/barber/profile` | The barber's own data plus this month's link usage |
| `PUT /api/barber/settings` | Working hours, slot length, seats; regenerates future slots |
| `GET /api/barber/slots?date=` | A day's slots with bookings |
| `POST /api/barber/slots/generate` | Create/sync slots |
| `POST /api/barber/slots/[id]/block`, `unblock`; `PATCH …/capacity` | Slot controls |
| `POST /api/barber/slots/shift` | Run Late: move today's remaining slots later |
| `GET /api/barber/bookings` | Booking list (filter, page, limit, search) |
| `POST /api/barber/bookings/walk-in` | Barber books a customer (phone optional, any day) |
| `GET /api/barber/customers`, `PATCH …/[id]/note` | Customer list and private notes |
| `POST /api/barber/heartbeat` | "I'm online" ping |
| `POST/DELETE /api/barber/push` | Turn phone notifications on / off |
| `PUT /api/barber/slug` | Change booking link name |
| `GET/POST/DELETE /api/barber/shop` | Shop details, create, leave/delete |
| `POST /api/barber/shop/members`, `DELETE …/[id]` | Invite / remove a member |
| `GET /api/barber/shop/invites`, `POST/DELETE …/[id]` | See, accept/decline, cancel invites |
| `POST /api/barber/shop/book`, `GET /api/barber/shop/customers` | Front desk for any shop member |
| `POST /api/bookings/[id]/complete`, `no-show`, `cancel` | The Done / No-show / Cancel actions (cancel frees the seat and may hold it for the waitlist) |

### Public (customers, no login)
| Path | Purpose |
|---|---|
| `GET /api/public/barbers/[slug]` and `…/slots?date=` | Barber page data and slots |
| `GET /api/public/barbers/[slug]/manifest`, `…/icon` | Per-barber install manifest and icon |
| `GET /api/public/shops/[slug]` and `…/slots?date=` | Shop data and merged slots of all active members |
| `POST /api/public/bookings` | Book a slot (atomic; refuses full/held slots with `SLOT_ALREADY_BOOKED`) |
| `POST /api/public/waitlist` | Join a full slot's waitlist (`anyBarber` for shop-wide) |
| `POST /api/public/bookings/lookup` | Find own booking (Booking ID + phone) |
| `POST /api/public/bookings/cancel` | Cancel own booking (not within 30 minutes of the start) |
| `POST /api/public/bookings/reschedule` | Move own booking to another open slot of the same barber |

### Admin (all need ADMIN)
`GET /api/admin/stats`; `GET /api/admin/barbers` and `PATCH …/[id]` (suspend, premium, link limit), `POST …/[id]/reset-password`; `GET /api/admin/bookings`; `GET /api/admin/shops`, `GET/PATCH/DELETE …/[id]`, `POST …/[id]/members`, `DELETE …/[id]/members/[barberId]`; `GET/PUT /api/admin/link-limit`; `GET/PUT /api/admin/retention`, `POST …/run`, `GET …/export`; `GET/PUT /api/admin/growth`; `GET /api/admin/audit-log`; `GET /api/admin/admins`, `POST …/[id]/reset-password`.

### Other
`GET /api/cron/daily` (needs `Authorization: Bearer <CRON_SECRET>`), `POST /api/pusher/auth` (private channel sign-in).

---

## 8. How the important parts work (`src/lib`)

### Time
`istTime.ts` and `timeSort.ts`: everything is IST. A shifted "IST Date" must be read with `getUTC*` methods. `startMinutes` on bookings and `timeStringToMinutes` make "9:00 AM" sort before "10:00 AM". The server never trusts the device clock for "today".

### Slots
`slotGenerator.ts`: builds slots from working hours, slot length and seats for `SLOT_WINDOW_DAYS` days ahead; never deletes a slot that has bookings; keeps custom per-slot seats. `slotCleanup.ts` removes slots that no longer fit new hours.

### Booking safely under a rush
`createBooking.ts` and the public bookings route claim a seat with one atomic database update (`bookingsCount < capacity`, counting held seats), so two customers can never take the last seat. The loser gets `SLOT_ALREADY_BOOKED`; the shop page then silently tries another barber at the same time. Booking IDs come from a counter.

### Waitlist and seat holds (`waitlistHold.ts`)
When a seat frees (cancel, reschedule), the **first** waiting customer gets a **15-minute hold** on it. Others (and strangers) are refused until the hold ends. For "any barber" waiters, the oldest shop-wide waiter gets a freed seat at that time on any barber of the shop. Holds are cleaned on the next event.

### Cancel / reschedule rules
Customers cancel with Booking ID + phone, but **not within 30 minutes** of the start ("Too late to cancel online — please contact your barber"). A wrong phone returns "not found" (no hint). Per-phone attempts are limited.

### Link limit (`linkLimit.ts`)
The admin can cap how many bookings per month come through a barber's or shop's public link (0 = unlimited, empty = platform default). Counted from the 1st (IST). Bookings over the limit are ranked after the fact (`isOverLinkLimit`); barber-entered (walk-in/front desk) bookings don't count.

### Auto-complete (`bookingMaintenance.ts`)
The daily job marks `CONFIRMED` bookings complete about 2 hours after they ended. **A no-show the barber forgot to mark is counted as a visit.**

### Cleanup (`retention.ts`)
Off by default. When on, deletes finished bookings (completed/cancelled/no-show) older than N months and empty old slots. Never touches confirmed/upcoming bookings. Completed visits are first added to a per-barber tally on the customer so visit counts and "last visit" survive. Runs in a transaction, 2000 at a time, up to 20,000 per run. Customers (name, phone) are kept.

### Growth and usage (`growth.ts`, `usage.ts`)
Builds the admin warning panel (section 10). `usage.ts` counts Pusher events and Redis commands in memory and saves them to the database at most every 10 seconds (estimates).

### Rate limits (`rateLimit.ts`)
Fixed window, Redis if configured, else memory; fails open on Redis errors.
| What | Limit |
|---|---|
| Login | 200/min per IP; 10/min per account |
| Public booking | 200/min per IP; 20/min per phone |
| Public waitlist | 200/min per IP; 20/min per phone |
| Public cancel | per IP, and 5/min per phone |
| Lookup, reschedule, shop pages | per IP / per phone (generous for shared mobile networks) |

### Notifications
- **Pusher** (`realtime.ts`): a private channel per barber (`private-<barberId>`); events trigger a refresh of the barber's lists. Without Pusher, `useRealtimeRefresh` polls every 30 seconds.
- **Web push** (`push.ts`): new booking and customer cancel/reschedule alerts to a barber's enabled devices. Dead subscriptions are removed.
- **Reminders to customers:** one-tap WhatsApp from the barber's Appointments page (section 6).

### Security
- Passwords hashed with scrypt; JWT 7 days; every request re-checks the account is active and the token version matches.
- `proxy.ts` guards `/dashboard` and `/admin` (admin also needs the ADMIN role).
- Headers (`next.config.ts`): `nosniff`, `X-Frame-Options: SAMEORIGIN`, strict referrer policy, camera/mic/geolocation disabled.
- Customer names are rendered as text (a name with `<script>` does not run).
- The service worker is network-first, so a deploy reaches everyone immediately.

### Daily job (`/api/cron/daily`)
`vercel.json` calls it at 12:30 and 12:50 UTC (6:00 and 6:20 PM IST). Steps: extend every active barber's slots in batches (resumable, with a lock and saved progress), then when all barbers are done: delete old empty slots (older than 7 days), auto-complete stale bookings, refresh admin stats, fill missing `startMinutes`, run cleanup if enabled. Running it again the same day does nothing. **Vercel's free Hobby plan runs crons once a day at most.**

---

## 9. Setting up and launching

### Run it locally
1. `npm install`
2. Create `.env.local` with at least `MONGODB_URI`, `AUTH_SECRET`, `CRON_SECRET`.
3. `npm run dev` (http://localhost:3000)
4. Create the first admin: `npx tsx scripts/create-admin.ts` (then change its password).

### Launch checklist (Vercel + MongoDB Atlas)
1. Create the Atlas cluster and database user; put the connection string in `MONGODB_URI`.
2. Set `AUTH_SECRET` (long random) and `CRON_SECRET`.
3. **Pusher:** create an app (cluster `ap2`), set the 5 variables (secret as Sensitive; `NEXT_PUBLIC_*` as normal). Redeploy **without** the build cache.
4. **Redis:** create an Upstash database, set the URL and token.
5. **Phone notifications:** generate VAPID keys; set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:…`).
6. Commit and push, redeploy.
7. Create the first admin on the live database and change its password.
8. Run the daily job once by hand: call `/api/cron/daily` with `Authorization: Bearer <CRON_SECRET>` and confirm it returns 200.
9. **Live smoke test on a real phone:** register a barber, book as a customer, tap Done, cancel, log in as admin.
10. Take a manual MongoDB export (the free plan has no backups).
11. Turn on usage-alert emails in Pusher, Upstash and Vercel.

### Things to remember
- Vercel's free **Hobby** plan is for non-commercial use. Once barbers pay you, move to **Pro**.
- The MongoDB free tier (M0) has 512 MB and 500 connections and no automatic backups.
- The service worker caches only the home page; everything else is network-first.

---

## 10. Admin warnings (Growth & limits panel)

Green below 70%, orange from 70%, red from 90% (or broken). Red/orange items are listed first.

| Item | Measured how |
|---|---|
| Growth stage | Shops (barbers ÷ 3) against the stage size in `BUSINESS.md` |
| Pusher connections | Barbers seen in the last 12 minutes vs your plan |
| Pusher messages today | The app's own count × 2 vs your daily limit (estimate) |
| Redis commands this month | The app's own count vs your monthly limit (estimate) |
| Database storage | `dbStats` vs your plan size |
| MongoDB connections | `serverStatus` if the plan allows it |
| Vercel plan | Red if Hobby while any barber has a premium amount |
| Daily job | Shows progress while running ("1,800 of 3,000 barbers done"); orange if unfinished, red if stalled 6 hours or not run since before yesterday; orange if never run |
| Pusher / Redis / phone notifications | Orange if not configured |
| Vercel usage, Upstash usage, MongoDB backup | "I checked it today" buttons; orange after 7 days, red after 14 |

You must keep the plan sizes (bottom of the panel) up to date when you upgrade a service.

---

## 11. Testing history (what was verified)

All tests ran on throwaway databases (an in-memory MongoDB replica set), never the real one, with Playwright Chromium emulating phones (360–390 px wide) and desktop (1280 px), plus Node scripts for the API.

| Test | Result |
|---|---|
| 1 shop, 3 barbers, 25 customers booking at once (latest run) | 25/25 seated, median 316 ms, slowest 5% under 450 ms, no overbooking, load 9/7/9, special names safe |
| 25 shops × 3 barbers × 200 customers | Passed (earlier run) |
| Barber daily features in a real browser (login, Done, No-show, Cancel with confirmation, walk-in on a later day, search, settings, logout) | 19/19 |
| Barber rush (rapid taps, list ordering, totals match the database) | Passed; no wrong-customer tap in any run |
| Waitlist and seat holds, including "any barber" | Passed |
| Admin (suspend/re-activate, search, growth, cleanup, cron) | Passed |
| Cleanup: removes only old finished bookings, keeps visit tallies, refuses 0 and 61 months | 17/17 |
| Growth panel, including Pusher/Redis counters against fake servers | 27/27 |
| Pages on phone and desktop | No JavaScript errors, no sideways scrolling |

Bugs found and fixed along the way (examples): settings couldn't open a closed day; new barbers had no slots until saving settings; stale lists during an "any barber" rush (now silent retry); per-phone limits locking out retrying customers; suspended barbers' pages staying open; dashboard hydration error and wrong "today" (now IST); past/in-progress slot visibility; dead "How it works" link; banner covering the language menu; waitlist WhatsApp link pointing to the site root; toast messages cut off on phones; admin Booking-ID search flooded by phone matches.

---

## 12. Known gaps and open items

| Item | Detail |
|---|---|
| No automatic reminders | Reminders are one tap per customer (WhatsApp). Automatic SMS/WhatsApp needs a paid provider (MSG91, Fast2SMS, WhatsApp Business). |
| Auto-complete counts no-shows | After about 2 hours, a forgotten booking becomes "completed". |
| Barbers can't change their own password | Only an admin reset; logins last 7 days. |
| Logout logs out every device | The session version is per account. |
| Cancel prompt | After every barber cancel, a WhatsApp prompt appears (one extra tap). |
| Server messages in English | Some server error texts (for example "Too late to cancel online") may not be translated. |
| Run Late near midnight | The rejection message is English only. |
| Online bookings without Pusher | Appear within about 30 seconds. |
| First-visit page weight | About 280–350 KB. |
| No alerts for admin | Warnings appear only when the Overview page is opened; nothing emails or messages the admin. |
| Counts are estimates | Pusher/Redis usage counts can miss a few; each service's own dashboard is exact. |
| Not yet tested live | Everything above was tested locally; the live Vercel + Atlas + Pusher + Redis set-up still needs the smoke test (section 9). |

---

## 13. Quick answers for later

- **Why does a booking say "slot already booked"?** The seat was taken or is held for a waitlisted person. The shop page retries another barber by itself.
- **A barber can't log in.** Admin → Manage Stores → Reset Password. Check the barber isn't suspended.
- **Customer lost their Booking ID.** Admin → Bookings → search by their phone.
- **Slots stopped appearing for the future.** The daily job isn't running. Check `CRON_SECRET`, Vercel → Cron Jobs, and the admin panel's "Daily job" item.
- **Database nearly full.** Admin → Data & Storage → download the CSV → switch cleanup on → run.
- **Bookings take 30 seconds to show.** Pusher isn't set up or its variables are wrong. Fix them and redeploy without cache.
- **Customers can't cancel.** It is blocked inside 30 minutes of the start; the barber can cancel.
- **Where are the prices/stages?** `BUSINESS.md` and `src/lib/growth.ts` (keep them in step).
