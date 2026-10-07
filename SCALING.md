# Scalability

Target: hundreds of shops, tens of thousands of customers, on Vercel serverless + MongoDB Atlas shared/free tier.

## What was done (backend)

- **Customer lookup on every booking was a collection scan.** `createConfirmedBooking` finds the customer with a
  case-insensitive collation, which cannot use a normal index. Added a collation-matched index
  `phone_name_owner_ci` on `{ phone, name, ownerBarberId }` (verified with `explain`: IXSCAN).
- **Redundant indexes removed** from Booking and Slot schemas (single-field `barberId`, `date`, `slotId`, `status`,
  duplicate `bookingNumber`, `{barberId,date}`); every query is served by a compound index. Fewer indexes = cheaper
  writes and less RAM on a small cluster. Existing databases keep the old indexes until dropped by hand (harmless).
- New indexes: `User {role,isActive,_id}` (daily job batches), `User {role,createdAt}` and `Shop {createdAt}` (admin lists).
- **TTL**: AuditLog now expires after 365 days. Already TTL'd: DashboardAlert (15 min), LinkVisitor (100 days).
- **Daily job**: the "bookings missing startMinutes" backfill scanned the whole bookings collection every day; it now
  runs until it finds nothing and records that (`AppSetting backfill:startMinutes`). Barber batches use `.lean()`.
- **Admin lists** (barbers, shops): 2 count queries per row replaced by 2 grouped queries per page; page/limit parsing
  hardened (NaN / negative values) on every paginated route.
- **Per-instance memo cache** (`src/lib/memo.ts`, 10-15 s TTL, never caches "not found", never personal data) for the admin
  default limits (read on every public page view) and the public barber/shop profile lookups. The visitor counter and
  monthly booking cap still run on every request.
- **Public routes**: barber profile and barber slots had no rate limit (added, same ceilings as the shop routes);
  public barber directory rate limited and sent with `s-maxage=60, stale-while-revalidate=300`; slots/profile queries now
  `select` only needed fields (the barber document used to be loaded in full, password hash included) and use `.lean()`.
  Slot sorting parses each time once instead of per comparison.
- **Push notifications** to the barber after a booking/cancel/reschedule now go out after the response (`after()`), so a
  slow push service no longer slows the customer's request.
- Waitlist array per slot capped at 200 entries (a slot document can no longer grow without limit).
- Mongo pool per serverless instance 10 -> 5 (`MONGODB_MAX_POOL` to override): Atlas M0 allows 500 connections in total.
- In-memory rate-limit fallback map is swept so it cannot grow forever.
- `.lean()` on the barber's booking and slot lists, slot generator (bulk update instead of one update per slot).

## Deliberately NOT cached at the CDN
`/api/public/barbers/[slug]`, `/slots` and the shop equivalents call `admitVisitor` (the monthly unique-visitor cap counts
each request). Putting them behind a CDN would hide visitors from the counter, so they stay dynamic. The catalogue
endpoint already uses `s-maxage=15`.

## Expected capacity (estimates, not load-tested)
- Public booking: ~10 DB round trips; a single M0/M2 handles roughly 20-40 bookings/s before the shared CPU limits.
  Real peak load for hundreds of shops is a few bookings/s.
- Public page views: 2-4 DB reads (profile memoised; slots one indexed query) + 1-2 Redis commands for rate limiting.
  Hundreds of requests/s are fine on the shared tier; the Upstash free quota (commands/month) is the first limit to watch.
- Customers: tens of thousands of documents are trivially indexed. Bookings grow without bound until the admin enables
  Retention (off by default): turn it on before the cluster approaches the 512 MB free limit (~1M bookings with indexes).

## Known remaining items
- `requireAuth` does one primary-key User read per authenticated request (cheap; not cached to keep logout/suspension instant).
- Barber customer directory (`/api/barber/customers`) aggregates all of that barber's bookings per request; fine for
  barbers with thousands of bookings, consider a cache or a materialised customer list beyond ~50k bookings per barber.
- `cleanupMedia` rescans all media assets daily (bounded to 20k per run).
