# Add-on features — spec for approval

**Status:** DRAFT. Nothing is built yet. Review, mark each feature ✅ build / ⏸ later / ❌ skip, then I start only the approved ones.

**Written for:** you (owner/developer), to decide scope before any code.

This doc covers four add-ons: **Loyalty punch card**, **Birthday / win-back auto-offers**, **Spinning wheel**, **Membership**. Each says what it does, how it hooks into the code we already have, the data it needs, the plan tier it sells on, build effort, and open questions.

---

## What we already have (reused by these features)

- **Scope model:** everything is keyed by `ownerType` ("BARBER" | "SHOP") + `ownerId`. All new data follows the same shape.
- **Customers** (`src/models/Customer.ts`): phone-keyed, with a `barberStats[]` array holding `visits`, `lastVisit` per barber. Note: shared phones across family seats are intentional — a loyalty ledger must key on the *customer record*, not raw phone, to avoid merging families.
- **Bookings** (`src/models/Booking.ts`): have a `COMPLETED` status and price snapshots — the natural trigger for "earn a stamp."
- **Offers** (`src/models/Offer.ts`) + **Campaigns** (`src/models/Campaign.ts`) + **Push** (`src/lib/push.ts`, `src/lib/campaigns.ts`, `CustomerPush`): opted-in customer notifications already exist, with per-plan weekly limits in `plans.ts`.
- **Plan gating** (`src/lib/plans.ts`): `DEFAULT_TIER_LIMITS` per tier; add-ons get new boolean/number limits here.
- **IST time helpers** (`src/lib/istTime.ts`).

## The one real gap: customer payments

The app today only takes **owner** subscription payments (`PlanPayment`). There is **no customer-facing payment** (UPI/card). This matters:

- **Loyalty, birthday offers, spinning wheel** = no payment needed. Buildable fully now.
- **Membership (paid), prepaid packages** = need either (a) a real UPI/payment gateway integration, or (b) a "mark as paid in cash" manual flow where the barber confirms payment. Decision needed — see Membership section.

---

## 1. Loyalty punch card ✅ recommended first

**What the customer sees:** on the shop/barber page and booking-confirmed screen — "4 of 10 visits. 6 more for a free [reward]." A row of stamps that fills as they complete visits.

**What the owner sets:** stamps needed (e.g. 10), the reward (free service / % off / fixed ₹ off), and which services count.

**How it earns a stamp:** when a booking flips to `COMPLETED` (the owner already marks this). One completed booking = one stamp. Guardrails: max one stamp per day per customer; cancelled/no-show never earn.

**Redeeming:** at the counter the barber taps "Redeem" on that customer, which resets the card and logs the reward. (No customer-side money, so no payment risk.)

**New data:**
- `LoyaltyProgram` (per owner): `{ ownerType, ownerId, enabled, stampsNeeded, rewardType, rewardValue, rewardLabel, serviceIds[], perDayCap }`.
- `LoyaltyCard` (per customer per owner): `{ ownerType, ownerId, customerId, stamps, redeemedCount, lastStampDate, history[] }`.

**Hooks into existing code:**
- Booking-complete handler (wherever status → `COMPLETED`) calls `awardStamp(scope, customerId)`.
- Public page (`cataloguePublic` / `b/[slug]`, `s/[slug]`) surfaces the customer's current card when their phone is known.
- Owner dashboard: a "Loyalty" settings card (like `BrandingForm`) + a redeem button in the customer list.

**Plan tier:** PREMIUM.
**Effort:** Low–Medium (2 models, 1 award function, 1 settings form, 1 redeem action, public display).
**Open questions:**
- Reward = free service, or discount? (Suggest: owner picks either.)
- Shared-family-phone case: card per customer record is correct — confirm that's the intent.

---

## 2. Birthday / win-back auto-offers ✅ recommended

**What it does:** automatically sends an existing-style offer via push to two audiences:
- **Birthday:** customers whose birthday is today (needs a DOB — see below).
- **Win-back:** customers who haven't completed a visit in N days (we already store `lastVisit` in `barberStats`), e.g. "We miss you — 20% off this week."

**How it sends:** reuses `Offer` + `campaigns.ts` + `push.ts`. A daily cron (there's `CronState` already) picks eligible customers and sends. Each auto-send counts against — or is exempt from — the weekly campaign limit (decision needed).

**New data:**
- Customer DOB: add optional `birthday` ("MM-DD", no year needed) to `Customer`. Captured at booking ("add your birthday for a treat") or by the barber. **Birthday feature is blocked without this field** — win-back works today without it.
- `AutoOffer` config (per owner): `{ type: "BIRTHDAY" | "WINBACK", enabled, offerId, winbackDays, lastRunDate }`.

**Hooks into existing code:**
- New daily cron route (pattern of existing cron) → selects audience → calls the existing campaign send path.
- Owner dashboard: toggle + pick which offer + win-back day count.

**Plan tier:** PREMIUM (it's an auto-campaign).
**Effort:** Low–Medium. Win-back is mostly wiring (data already there). Birthday needs the DOB capture UI.
**Open questions:**
- Do auto-sends count against `maxCampaignsPerWeek`, or get a separate small budget? (Suggest: separate, capped, so manual campaigns aren't eaten.)
- Where do we ask for birthday? (Suggest: optional field on the booking form.)

---

## 3. Spinning wheel 🎡

**What it does:** a gamified "spin to win" wheel the customer spins (once per visit, or once per booking) to win a prize the owner configured — e.g. 10% off, free beard trim, "better luck next time," a loyalty stamp.

**When they spin:** best tied to a real action so it drives behaviour — e.g. after a completed visit, or after booking. Not free unlimited spins (that's just giving away discounts).

**Prize = a one-time coupon:** a win creates a `Reward` coupon on the customer's account, redeemed at the counter by the barber (same redeem pattern as loyalty). Keeps it abuse-resistant and needs no payment.

**New data:**
- `WheelConfig` (per owner): `{ enabled, segments[] (label, weight, rewardType, rewardValue), spinTrigger: "AFTER_VISIT" | "AFTER_BOOKING", cooldownDays }`.
- `Reward` (per customer per owner): `{ source: "WHEEL" | "LOYALTY", rewardType, rewardValue, label, status: "ACTIVE" | "REDEEMED" | "EXPIRED", expiresOn }`. (This `Reward` model is shared with loyalty redemption — build it once.)

**Hooks into existing code:**
- Public page: a wheel component (client-side animation) that calls a `spin` API; the **server** picks the weighted outcome (never trust the client) and writes the `Reward`.
- Owner dashboard: configure segments + weights + trigger.
- Barber redeem UI (shared with loyalty).

**Plan tier:** PREMIUM or BUSINESS (it's a flashy differentiator).
**Effort:** Medium (server-side weighted draw, anti-abuse cooldown, wheel animation, shared Reward model + redeem).
**Risk/abuse notes:** outcome decided server-side; cooldown per customer; segment weights validated so total payout is controllable. Owner should see "coupons issued vs redeemed."
**Open question:** spin trigger — after visit (rewards loyalty) or after booking (drives bookings)? Suggest after a **completed visit**.

---

## 4. Membership 💳

**What it does:** customer buys a plan from the shop — e.g. ₹499/month = 2 haircuts + unlimited beard trims, or ₹2000 = 10 cuts valid 6 months. At booking, a membership visit is drawn down instead of paid per-visit.

**The payment decision (must settle before build):**
- **Option A — Cash/UPI-at-counter, app just tracks:** barber marks "membership sold" and "paid in cash/UPI manually." App tracks remaining visits + expiry. **No gateway, buildable now, lowest risk.** Recommended to start.
- **Option B — In-app paid (UPI gateway):** integrate Razorpay/Cashfree/PhonePe, auto-activate on payment, optional autopay renewal. Bigger build, KYC, fees, refunds, reconciliation. A real project on its own.

**New data:**
- `MembershipPlan` (per owner): `{ name, price, durationDays, includedVisits (or "unlimited" per service), serviceIds[], active }`.
- `Membership` (per customer): `{ ownerType, ownerId, customerId, planId, startsOn, expiresOn, remainingVisits, status, paymentMode }`.

**Hooks into existing code:**
- Booking flow: if the customer has an active membership covering the chosen service, mark the booking as membership-covered and decrement.
- Owner dashboard: create plans, sell a membership to a customer, see active members.
- Optional later: customer self-buy on the public page (needs Option B).

**Plan tier:** BUSINESS.
**Effort:** Medium (Option A) → High (Option B with gateway).
**Open questions:**
- Start with Option A (manual payment) and add gateway later? (Recommended.)
- Visit-count plans, time-unlimited plans, or both?

---

## Shared building blocks (build once, reused)

- **`Reward` / coupon model + redeem flow** — used by loyalty, wheel, and auto-offers. Build this first; the three features plug into it.
- **Owner "Engagement" dashboard section** — one place for loyalty, wheel, auto-offers, membership settings (mirrors the existing catalogue settings UI).
- **Plan gating** — new flags in `plans.ts` `DEFAULT_TIER_LIMITS` (e.g. `loyaltyEnabled`, `wheelEnabled`, `membershipEnabled`, `autoOffersPerWeek`).
- **i18n** — every new string in all four dictionaries (en/gu/hi/mr), same as existing keys.

## Suggested build order

1. **Shared `Reward` model + barber redeem UI** (foundation).
2. **Loyalty punch card** (cheapest, uses `COMPLETED` bookings).
3. **Win-back auto-offer** (mostly wiring; birthday after DOB capture is added).
4. **Spinning wheel** (reuses Reward).
5. **Membership — Option A** (manual payment), gateway later if wanted.

---

### Your call
For each: ✅ build / ⏸ later / ❌ skip. And answer the per-feature open questions (especially: membership payment Option A vs B, and where we capture birthday). Once you approve, I'll build the approved set in the order above, one focused commit per piece.
