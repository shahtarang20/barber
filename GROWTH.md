# GROWTH.md — How to change the code when the product grows

This is the **code** side of growth. `BUSINESS.md` covers the **money** side (which plan to buy at which size). `PROJECT.md` describes how the app works today. Read `PROJECT.md` first.

Today the app is built and tested for **about 25 shops (75 barbers, ~15,000 customers)**. This file explains what has to change in the code to reach **10,000 shops** and then **1 million shops**, in what order, how to know it is time, and how to make each change without breaking live barbers.

> **Be honest about the numbers.** Only the first row of the table below was ever tested (25 shops × 3 barbers × 200 customers, one machine). Everything beyond it is arithmetic and experience, not measurement. Treat it as a map, not a promise, and re-measure at every step. One million barber shops is also more than India is likely to have; the 1M section is a design exercise for when (if) you get there.

---

## 1. The size ladder, in plain numbers

Assumptions (change them when real data arrives): 3 barbers per shop; ~500 stored slots per barber (a 30-day window, 20 slots a day, six days a week); about 12–15 bookings per barber per day; about 14,000 requests per shop per month (from the earlier load test, also used in `BUSINESS.md`).

| | Tested today | 10,000 shops | 1,000,000 shops |
|---|---|---|---|
| Barbers | 75 | 30,000 | 3,000,000 |
| Customers (200 each) | 15,000 | 6 million | 600 million (many share a phone, so fewer) |
| **Stored slots (today's design)** | ~40,000 | **~15 million** | **~1.5 billion** |
| Bookings per day | ~1,000 | ~400,000 | ~40 million |
| Requests per month | ~1 million | ~140 million | ~14 billion |
| Average requests per second | <1 | ~55 | ~5,400 |
| Peak (about 10× the average, 10–11 AM) | ~5 | ~550 | ~54,000 |
| Barbers online at once (peak) | ~25 | ~10,000 | ~1,000,000 |

What this means: the app as written is a good design for hundreds of shops. Between about 1,000 and 2,000 shops, **the way slots are stored becomes the main problem**, then the database, then real-time, then the single-region/single-service shape of the app itself.

---

## 2. What breaks first (found by reading today's code)

| # | Weak spot in today's code | Why it breaks | Where |
|---|---|---|---|
| 1 | **Every empty time slot is a database document**, created 30 days ahead for every barber | 15 million slots at 10k shops, 1.5 billion at 1M. Big storage, slow indexes, and the daily job must touch all of them | `src/lib/slotGenerator.ts`, `src/models/Slot.ts` |
| 2 | **The daily job walks every barber** in batches of 50 inside one 60-second function; the free plan allows a daily trigger | At 30,000 barbers it needs on the order of 60+ runs a day; at 3M, thousands | `src/app/api/cron/daily/route.ts` |
| 3 | **Every barber request reads the User document** to check "still active, same token version" | One extra database read per request; at 550 requests/s peak that is a lot of pointless reads | `requireAuth` in `src/lib/auth.ts` |
| 4 | **Each Vercel function instance opens up to 10 database connections** | Many instances × 10 connections can exceed the database's connection limit (free plan: 500) | `src/lib/mongodb.ts` |
| 5 | **Barber "online" heartbeat writes to MongoDB** every 8 minutes per barber | Fine at 30k (~60 writes/s); heavy at 3M (~6,000 writes/s) for a number nobody needs to be exact | `/api/barber/heartbeat`, `src/lib/growth.ts` |
| 6 | **Usage counters (Pusher/Redis) are written to MongoDB** | Extra writes on a hot path; belongs in Redis or a metrics system | `src/lib/usage.ts` |
| 7 | **Admin and customer searches use unanchored case-insensitive regex** (`new RegExp(search, "i")`) | Cannot use an index, so each search scans a whole collection | `src/app/api/admin/*`, `barber/customers`, `barber/shop/customers`, `public/barbers` |
| 8 | **Admin statistics group over all bookings** (`$group` by status) | Cost grows with every booking ever made; the 5-minute cache only hides it | `src/lib/adminStats.ts` |
| 9 | **One Pusher channel per barber**, Pusher plan sizes in the hundreds to ~10,000 connections | Connection count, not code, is the limit; cost jumps steeply | `src/lib/realtime.ts`, `src/lib/useRealtimeRefresh.ts` |
| 10 | **Cleanup deletes old bookings** (and keeps only a visit tally) | At 400,000 bookings a day, deletion becomes a heavy job and loses history you may need | `src/lib/retention.ts` |
| 11 | **Customers are one global collection keyed by phone**, with arrays inside (`barberStats`, `barberNotes`) | Fine for millions; at hundreds of millions it must be split by a shard key, and the arrays must stay small | `src/models/Customer.ts` |
| 12 | **One app does everything** (customer booking, barber dashboard, admin, cron) | A slow admin report can slow a customer's booking; deploys are all-or-nothing | the whole repo |

What is already good and should be kept: the **atomic seat claim** (no double booking), booking IDs from a counter, IST helpers, rate limiting with a Redis option, the `cached()` helper in `src/lib/redis.ts` (written but barely used), the daily job's resumable design, and the admin Growth panel.

---

## 3. The stages of code change

Each stage says: **the trigger** (a number you can read in the admin panel or on a dashboard), **what to change**, **where**, and **how to prove it worked**. Do a stage only when its trigger appears. Doing it earlier costs time you need for customers.

### Stage A — now to ~500 shops: tidy, don't rebuild
Trigger: none; this is just hygiene.
- Turn on the slow-query log in MongoDB Atlas and look at it weekly.
- Add the quick wins from section 4 that cost an hour each (cache public slot lists for a few seconds, anchor regex searches, move the heartbeat counter to Redis).
- Add an **automated load test** (k6 or similar) that books 25, then 200, then 1,000 customers at once, and run it before every release. The manual tests we did become a script.
- Keep `STAGES` in `src/lib/growth.ts` and `BUSINESS.md` in step.

### Stage B — ~500 to ~2,000 shops: stop paying for empty slots
Trigger (any one): slot collection above ~3 million documents; the daily job needs more than 3–4 runs to finish; the admin panel shows the daily job as late.

**Change 1 — "virtual slots".** Stop storing empty slots. Compute them from the barber's working hours when someone looks, and store a document **only when something happens** to that time (a booking, a waitlist entry, a hold, a block, a changed number of seats, a "running late" shift).
- New collection `SlotState` (or reuse `Slot`): same fields as `Slot`, created on first use. Unique index `{barberId, date, startTime}` stays.
- A function `listSlots(barber, date)` builds the day's grid from `workingHours`, `slotDuration`, `defaultCapacity`, then overlays the stored documents. The customer page, barber Schedule page and shop merge all call it.
- **The seat claim becomes an upsert**, which stays atomic:
  ```ts
  // Claims one seat. The document is created on the first booking, so empty times cost nothing.
  try {
    await SlotState.findOneAndUpdate(
      { barberId, date, startTime,
        $expr: { $lt: [{ $add: ["$bookingsCount", { $size: { $ifNull: ["$holds", []] } }] }, "$capacity"] } },
      { $inc: { bookingsCount: 1 }, $setOnInsert: { endTime, capacity } },
      { upsert: true, returnDocument: "after" }
    );
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new Error("SLOT_ALREADY_BOOKED"); // exists and is full
    throw e;
  }
  ```
  This is a design sketch: **test it under a 200-customers-at-once load before trusting it**, exactly like the current claim was tested.
- A barber who changes working hours no longer triggers mass slot creation/deletion; only days with bookings need care (today's `slotCleanup.ts` logic about "never delete a slot that has bookings" becomes "bookings outside the new hours stay, as exceptions").
- `SLOT_WINDOW_DAYS` can then grow (60–90 days) for free.
- The daily job no longer generates slots at all. It keeps only cleanup and stats, so it shrinks to seconds.

**Change 2 — move scheduled work off the web request.** Replace the Vercel cron loop with a queue/worker (Upstash QStash, AWS SQS + a worker, or BullMQ on Redis): one small job per barber or per batch, retried automatically. Keep the CronState idea (progress saved) for any job that still sweeps all barbers.

**Change 3 — cache the hottest reads.** Use the existing `cached()` helper in `src/lib/redis.ts` for the public barber page, shop page and day slot lists (5–10 seconds). Invalidate with `invalidateCache` on booking/cancel (helper exists). This takes most customer traffic off the database because many customers look at the same barber.

**Change 4 — stop one database read per request.** In `requireAuth` (`src/lib/auth.ts`), keep `{isActive, tokenVersion}` for a barber in Redis for ~30 seconds and refresh it when the admin suspends someone or on logout (bump the version and delete the key). Suspension still takes effect within seconds.

**Proof:** daily job finishes in one run with 5,000+ barbers; slot collection stays small; the 200-customer load test still shows no overbooking.

### Stage C — ~2,000 to ~10,000 shops: a database that can grow
Trigger: Atlas CPU above ~60% at the 10–11 AM peak; p95 booking time above ~1 second; a single replica set nearing its size limit (plan for sharding well before a few TB); Pusher connections near your plan.

- **Search without regex scans.** Replace "contains" searches with exact or prefix lookups on indexed fields: phone (normalised), Booking ID, Barber Code, slug. For names, use an Atlas Search / text index, or search only inside one barber's own customers (small). Update the admin and barber search routes (item 7).
- **Admin numbers from counters.** Keep a small `Counters` collection (bookings by status, bookings per day) updated when a booking changes status, or fed from a MongoDB change stream. Delete the `$group` over all bookings from `src/lib/adminStats.ts`.
- **Read replicas for admin and reports.** Send admin and export queries to secondaries (`readPreference: "secondaryPreferred"`), so a big report never slows a booking.
- **Connections.** Move the API from serverless functions to a few long-running containers (or keep serverless and add a connection pooler), so connection count is steady. If staying on Vercel, lower `maxPoolSize` in `src/lib/mongodb.ts` and watch the Atlas connection chart.
- **Heartbeat and usage counters to Redis.** `SET barber:online:<id> 1 EX 720` (or a sorted set by time); "online now" = a count of live keys. Move `src/lib/usage.ts` counters to Redis `INCR`. This removes two kinds of constant MongoDB writes.
- **Shard-ready keys.** Before the data is huge, decide shard keys and make sure every hot query includes them:
  - Bookings and slot states: `barberId` (hashed) plus `date`. All the barber's queries already include `barberId`.
  - Customers: hashed `phone`. Customer lookups already go by phone; the per-barber arrays must stay small.
  - Move the `barberNotes` and `barberStats` arrays into their own collection `{customerId, barberId, visits, lastVisit, note}` if a customer can visit many barbers.
- **Split the app in two** (the first cut of item 12): a **booking service** (public pages, booking/cancel/waitlist, barber day actions) and an **admin/reporting service**, deployed separately, so a slow report never touches customers.
- **Real-time off Pusher** when connections pass ~5,000 at peak. Options: a managed WebSocket service with higher limits, an own WebSocket/SSE gateway (for example Centrifugo) fed by Redis pub/sub, or smarter polling (SWR with `ETag`/`If-None-Match`, so unchanged lists cost almost nothing). Keep `notifyBarber(barberId, type)` in `src/lib/realtime.ts` as the single doorway so only that file changes.
- **Archive instead of delete.** Change `retention.ts` from "delete after N months" to "copy to cheap storage, then delete" (object storage as compressed files), so you can answer disputes and analytics later. Add a TTL or monthly-collection strategy so deleting is dropping a whole collection, not millions of single deletes.
- **Observability.** Add structured logs, error tracking (Sentry), metrics and alerts (Grafana/Datadog), and set targets (for example booking p95 < 800 ms, error rate < 0.5%). The admin Growth panel then becomes a summary, not the only warning.
- **Security and law.** Yearly penetration test, secrets rotation, audit of admin actions, and a privacy/retention policy covering customer phone numbers (India's DPDP Act).

**Proof:** peak-hour load test at 3× today's real peak passes on a staging copy with realistic data volume (millions of bookings), not an empty database.

### Stage D — ~10,000 to ~100,000 shops: a platform, not an app
Trigger: one team can no longer ship safely; any outage costs real money; regional peaks (all shops open at once) overload a single region.
- **A sharded MongoDB cluster** (several shards) in the Mumbai region with multi-zone replicas; test failover quarterly.
- **Event-driven core.** When a booking is created, cancelled or completed, publish an event (Kafka/Redpanda/SQS+SNS). Consumers send phone notifications, update counters, feed analytics and (later) message customers. Today these are inline calls (`notifyBarber`, `pushToBarber`, `trackUsage`); each becomes an event consumer. This is also how automatic reminders will run at scale.
- **Own the front door.** Put a CDN in front of public pages and short-lived cached API responses (a barber page can be cached for 5–10 seconds at the edge). Rate limiting moves to the edge/gateway.
- **Separate services with clear owners:** Booking (the money maker), Identity (login, sessions), Notifications, Billing/Subscriptions (replace the manual `premiumAmount` field), Analytics.
- **CQRS-style read models.** The barber's "today" screen reads from a small read-optimised collection updated by events, instead of joining several collections each time.
- **Automated releases:** staging with production-like data, automated load tests in the pipeline, feature flags (turn a feature on for 1% of barbers), blue/green or canary deploys, one-command rollback.
- **On-call and runbooks** (what to do when X is red), status page, and a support tool that lets staff look up a booking by phone without database access.
- **Cost control.** Cost per shop per month becomes a number you watch.

### Stage E — ~100,000 to 1,000,000 shops (3 million barbers)
Trigger: you will know. This is a company with a platform team.
- **Partition by barber.** Treat one barber's day as the unit of work: all writes for a barber go to the same partition/shard and are processed in order. This removes cross-barber locking entirely and is the natural shard key.
- **Customers as their own service** with a phone index that is sharded and cached; "what bookings does this phone have" must answer in a few milliseconds.
- **Real-time gateway** that serves around a million concurrent connections (own cluster, or a vendor on a custom contract). Most of the load is "nothing changed," so push *deltas*, not full lists.
- **Reminders and customer messages become a product line.** At tens of millions of bookings a day, even one reminder per booking is tens of millions of messages. Use a WhatsApp Business / SMS provider on a volume contract, make reminders a paid plan feature, and send them from the event stream with per-provider rate limits and retries. Price this before promising it.
- **Analytics warehouse** (BigQuery/ClickHouse/Snowflake) fed from the event stream; the production database is never used for reports.
- **Multi-tenant safety.** Per-tenant limits (a single noisy barber or shop cannot slow others), abuse detection, and a data-protection team.
- **Resilience.** Multi-zone everything, tested disaster recovery, defined recovery time and data-loss targets, regular chaos/failure drills.
- **Architecture review by the engineers you hire then.** Do not build this stage now; each earlier stage is designed to make it possible without a rewrite.

---

## 3b. Daily-job capacity: measured, and how to add headroom (500–1,000 shops)

**Measured** (a test machine with a fast local database, one run = one call of `/api/cron/daily` with the 45-second budget):

| Case | Barbers handled per run | Runs for 3,000 barbers (≈1,000 shops) |
|---|---|---|
| Normal day (slots already exist) | about 2,450 | 2 |
| First-ever slot generation for brand-new barbers (heaviest case; new barbers already get their slots at sign-up, so this is rare) | about 950 | 4 |
| Raising `CRON_BATCH` to 200 and `CRON_CONCURRENCY` to 30 | no gain on the test machine | 2 |

**Read this carefully:** a hosted database (Atlas) is slower per request than the test machine, so on Vercel + Atlas expect fewer barbers per run, perhaps **2–4× fewer (about 600–1,200)**. That has not been measured live. Two daily triggers (what `vercel.json` has now) would then cover roughly **1,200–2,400 barbers, i.e. 400–800 shops**. This is why the admin Growth panel now shows the daily job's progress ("1,800 of 3,000 barbers done today") and turns orange if it hasn't finished and red if it stalls for 6 hours.

**Ways to add headroom without code changes (in this order):**
1. **Add triggers (needs Vercel Pro).** Replace the crons in `vercel.json` with one entry that fires every 10 minutes for three hours. Once the day is finished, the extra runs return "already finished today" instantly, so they cost nothing:
   ```json
   {
     "crons": [
       { "path": "/api/cron/daily", "schedule": "*/10 12-14 * * *" }
     ]
   }
   ```
   (12:00–14:50 UTC = 5:30–8:20 PM IST; 18 runs a day. The job's lock stops two runs overlapping and its saved cursor resumes where the last one stopped.) **Do not put this in `vercel.json` on the free Hobby plan: Hobby only allows daily triggers and the whole deployment will be refused.**
2. **Tune with environment variables** (no code): `CRON_BATCH` (barbers per batch, default 50), `CRON_CONCURRENCY` (barbers worked on at once, default 10), `CRON_TIME_BUDGET_MS` (default 45000; the function limit is 60 s, so do not go above about 50000). Change one at a time and watch the panel. On a remote database a higher `CRON_CONCURRENCY` (20–30) usually helps; that is untested here.
3. **Past about 1,000 shops this stops being enough** and Stage B (virtual slots, queue) is needed.

## 3c. Tested with a 1,000-shop-sized database (local machine)

Data: 3,000 barbers in 1,000 shops, **1.56 million slots, 300,000 past bookings, 200,000 customers** (about 640 MB of data plus indexes). One test machine, fast local database, no network delay to the database.

| Screen / action | Median | Slowest 5% |
|---|---|---|
| Customer: barber page, day slots, shop page, merged shop slots | 7–13 ms | under 40 ms |
| Customer: book a slot | 100 ms | 129 ms |
| Barber: profile, day slots, appointment lists | 6–7 ms | under 12 ms |
| Barber: customers list / search | ~91 ms | ~96 ms |
| Admin: overview, barbers, shops, growth, cleanup preview | 5–24 ms | under 125 ms |
| Admin: bookings page 1 | 183 ms | 190 ms |
| Admin: bookings search (by Booking ID, phone, name, barber code) | ~570–590 ms | ~600–625 ms |
| 100 customers rushing one shop at once | booking median 645 ms | 1.47 s; no overbooking |

What to take from it:
- The code structure held up at 1,000-shop data size. No screen was slow, and nothing overbooked.
- **Admin booking search is the one that grows**: it scans (~0.6 s here) and gets slower in step with the customer count. Expect about 2 s around 3,000 shops. Anchor the search and index it (Stage C) before then.
- Real hosting adds network time to every database call (a booking makes several), so add roughly 100–300 ms to the booking numbers on Vercel + Atlas. Not measured live.
- Storage: ~640 MB of data and indexes at this size, so the free 512 MB MongoDB plan is **already too small**. New bookings add roughly 200 MB a month at 1,000 shops, so turn cleanup on (keep 3–6 months) and use a paid plan with room to grow.

## 4. Quick wins you can do at any time (an hour or a day each)

| Win | Change | Files |
|---|---|---|
| Cache the public barber/shop pages and day slot lists for 5–10 s | wrap the reads in `cached()` and call `invalidateCache` after booking/cancel/block | `src/lib/redis.ts`, `public/barbers/[slug]`, `public/barbers/[slug]/slots`, `public/shops/[slug]/slots` |
| Anchor regex searches (`^abc`) and search only exact phone/ID/code first | edit the regex lines; add the indexes | `admin/bookings`, `admin/barbers`, `barber/customers`, `barber/shop/customers`, `public/barbers` |
| Heartbeat and usage counters in Redis | `SET … EX`, `INCR` | `barber/heartbeat`, `src/lib/growth.ts`, `src/lib/usage.ts` |
| Cache `{isActive, tokenVersion}` for 30 s | Redis key per barber; delete it on logout/suspend/password reset | `src/lib/auth.ts` and the places that bump `tokenVersion` |
| Lower `maxPoolSize` if connections approach the limit | one number | `src/lib/mongodb.ts` |
| Add missing indexes found in the slow-query log | `Schema.index(...)` | `src/models/*` |
| Increase `SLOT_WINDOW_DAYS` only after virtual slots | env var | `src/lib/slotGenerator.ts` |

---

## 5. How to make a big change safely (the routine)

Use this every time, for every stage above.

1. **Measure first.** Write down the number that hurts (p95 time, CPU %, connections, job duration, document count) and the number that would mean "fixed." If you cannot measure it, add the measurement first.
2. **Write a one-page plan** (see the template in section 6): problem, trigger, design, data migration, rollout, rollback, tests.
3. **Build a test that fails today.** For a booking change: the "200 customers at once, no overbooking, no wrong seat" test. For search: a query-time test with millions of rows.
4. **Test with realistic volume.** An empty database lies. Load a staging copy with the target data size (for the next stage, not the current one).
5. **Ship behind a switch.** A setting (in `AppSetting`, or an environment variable) turns the new path on **per barber** or per percentage. Start with your own test shop, then 1%, 10%, 50%, 100%.
6. **Migrate data in four steps, never one:**
   1. *Add* the new structure next to the old (new collection/field/index). Nothing reads it yet.
   2. *Dual-write*: every new change writes to both old and new.
   3. *Backfill* old data into the new structure in small resumable batches (copy the pattern of `CronState` so a stopped job continues, and of `runRetention`'s batches).
   4. *Switch reads* to the new path (behind the switch), watch, then *stop writing the old one*, and only much later delete it.
7. **Watch the numbers** (error rate, p95, queue depth, DB CPU, the admin Growth panel) for at least a full peak period before going wider.
8. **Keep rollback one click.** Flip the switch back. Because of dual-writes, old data is still correct. Do not drop the old structure until a full cycle (a month) has passed.
9. **Update the documents** in the same change: `PROJECT.md` (how it works now), this file (what's done), `BUSINESS.md` (cost), `STAGES` in `src/lib/growth.ts`, and the admin Growth panel if you add a new thing to watch.
10. **Re-run the earlier tests** (the 25-customer rush, the barber daily checks, admin checks, cleanup) so the old promises still hold.

### Rules that must never be broken
- A seat is claimed with **one atomic database operation**. Never "read, check, then write" in separate steps.
- All business times are **IST** and computed on the server.
- `requireAuth` (or its cached version) must still reject a suspended or logged-out account within seconds.
- Customer data is personal data: do not log phone numbers, and keep the retention rules.
- Never test against the real database; use throwaway or staging data.
- One phone number may book several seats (family) — this is intended, do not "fix" it.

---

## 6. Template for a change plan (copy into a new file or a pull request)

```
Title:
Stage / trigger (the number that told us):
Problem in one sentence:
How we measured it (before):  p95=   CPU=   jobs=   docs=
Target after:
Design (what changes, which files):
Data migration (add / dual-write / backfill / switch / remove):
Switch name and how to roll out (me → 1% → 10% → 50% → 100%):
Tests that must pass (load, no overbooking, auth, IST times):
Rollback (how, and how long it stays possible):
Cost change per month:
Documents to update:
Who reviews:
```

---

## 7. When to do what: one-page cheat sheet

| You see… | Do… |
|---|---|
| Fewer than ~500 shops, all fine | Stage A: tidy, cache, add a load-test script, nothing big |
| Slots collection > ~3 million, or daily job takes more than a few runs | Stage B: virtual slots, queue for scheduled work, cache public reads, cache auth checks |
| Atlas CPU > 60% at peak, p95 booking > 1 s | Stage C: indexes/search rewrite, counters for admin, read replicas, Redis for heartbeat/usage, split app, replace Pusher |
| Pusher connections near plan limit | Replace or upgrade real-time (Stage C), keep `notifyBarber` as the one doorway |
| Database near its size limit | Archive instead of delete; plan sharding with the shard keys in Stage C |
| One outage would cost real money, many engineers | Stage D: events, services, CDN, canary releases, on-call |
| Millions of barbers | Stage E: partition by barber, own real-time gateway, paid reminders, warehouse |

Look at the admin **Growth & limits** panel every morning. It already warns about shops, Pusher, Redis, storage, connections, the daily job and the Vercel plan. As you go through the stages, add each new thing you need to watch to that panel (`src/lib/growth.ts`, `src/components/admin/GrowthPanel.tsx`).

---

## 8. Honest limits of this document
- Only the 75-barber scale was tested. Throughput numbers above 1,000 shops are estimates from the assumptions in section 1.
- The virtual-slot upsert in Stage B is a sketch and **must** be load-tested before use; getting the claim wrong means double bookings.
- Prices and vendor limits change; recheck them in `BUSINESS.md` and on each vendor's site before deciding.
- At 100,000+ shops, decisions belong to the engineers you hire then. This file exists so the early code choices don't paint them into a corner.
