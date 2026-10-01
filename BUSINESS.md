# BUSINESS GUIDE — What to pay, where, how, and when (from 0 to millions of shops)

This file is written in simple words. If you are 17 years old and have never run a software business, you should still be able to follow it.

> **Very important:** All prices below are **estimates** from when this file was written (October 2026). Companies change prices. Before you pay, open each company's pricing page (links are in Section 3) and check the real number. Dollar-to-rupee is taken as roughly **₹85 = $1**.
>
> The shop numbers ("25 shops can run on the free plan", "Pusher is full at about 30 shops") come from the real tests we ran on this app. The bigger numbers (500 shops, 5,000 shops and so on) are **calculated guesses**, not tested. When you get there, test again before you spend a lot of money.

---

## 1. What is this app, in one minute?

A barber shop has 3 barbers. Customers book a time slot on their phone. Barbers see the bookings on their own screen. Admin (you) controls everything.

To make this work on the internet, the app uses **5 outside companies**. Think of them like parts of a real shop:

| Company | Real-life comparison | What it does for us |
|---|---|---|
| **Vercel** | The shop building | Runs our app so people can open the website |
| **MongoDB Atlas** | The register book / cupboard | Stores every shop, barber, customer, booking |
| **Pusher** | The shop bell | Tells a barber's screen "a new booking just came!" instantly |
| **Upstash Redis** | The security guard at the door | Stops bad people from spamming (too many logins or bookings) |
| **Web Push (free, built in)** | A tap on the shoulder | Phone notification "New booking" (no company to pay) |

Also: a **domain name** (your website address like `yourapp.com`). You pay about ₹800–1,000 per year.

**Things that cost nothing and never will:** WhatsApp buttons (they only open WhatsApp with a ready message), phone notifications (Web Push), and the language switch.

---

## 2. The basic idea: when do I need to pay more?

Every company gives a **free plan** with limits, like a free bus pass that only works for a few trips. When you cross the limit, one of two things happens:

1. The service **stops working well** (slow, or some features switch off), or
2. They **ask you to upgrade**.

So the whole job is:

> **Watch the limits. Upgrade just BEFORE you cross them. Not too early (wastes money), not too late (customers suffer).**

The three limits that will hit you first, in this order:

1. **Vercel Hobby plan is not allowed for business.** The free "Hobby" plan is only for hobby projects. As soon as you charge shops money, you must pay for Vercel Pro ($20/month). This is a rule, not a technical limit. **Do this on the day you take your first payment.**
2. **Pusher free = 100 connections.** Each barber who has the app open uses 1 connection. 3 barbers per shop → free plan is full at about **30 shops**.
3. **MongoDB free = 512 MB and a speed limit.** Fine for the first few dozen shops. Gets slow somewhere around **40–60 shops** when many people book at once.

---

## 3. Where to pay (and where to watch)

| Company | Website to log in | What to look at |
|---|---|---|
| Vercel | vercel.com → your project `barber` | "Usage" tab (calls, bandwidth), "Billing" |
| MongoDB Atlas | cloud.mongodb.com | "Metrics" (speed, connections), "Data size" |
| Pusher | dashboard.pusher.com → Channels → `barber-saas` | "Overview": **Peak connections today** |
| Upstash | console.upstash.com (or Vercel → Storage) | Commands used per month |
| Domain | the shop where you bought it (GoDaddy, Namecheap, etc.) | Renewal date |

**Pricing pages (check the real price here):**
- vercel.com/pricing
- mongodb.com/pricing
- pusher.com/channels/pricing
- upstash.com/pricing/redis

---

## 4. How to pay (this is where Indian businesses get stuck)

All these companies are foreign, so they charge in **US dollars**.

1. **Use a card that works internationally.** Before you start, ask your bank to enable "international online payments" on your debit or credit card. Many Indian cards have this switched off by default and the payment will fail.
2. **A business credit card is best.** It gives monthly bills you can use for accounting.
3. **Monthly auto-payments can be rejected** by Indian banks if the amount is big (RBI rule about recurring payments needs your approval). If a payment fails, check your phone for an approval message from the bank, or pay manually from the company's Billing page.
4. **Keep a small buffer.** Keep money in the card so a payment never fails. If Vercel payment fails, your website can stop.
5. **Get invoices and save them.** Download the invoice every month. You need them for taxes.
6. **GST:** Foreign services bought by an Indian business usually have GST rules (reverse charge). **Talk to a Chartered Accountant (CA) once** and ask: "I buy Vercel, MongoDB, Pusher services in dollars. How do I handle GST and TDS?" It costs a small fee and saves big trouble.
7. **Turn on billing alerts** in each dashboard (email when spending crosses a number). Especially Vercel ("Spend Management") and MongoDB. This stops surprise bills.

---

## 5. Know your customers' money too

You charge shops. The shop count tells you how much money comes in. A simple rule:

> **Your monthly cost per shop should be less than 20% of what you charge per shop.**

From our estimates below, the cost per shop is roughly **₹40 to ₹150 per month**. So if you charge **₹500 per shop per month**, you keep most of it. If you charge ₹99, it will be tight at small sizes.

(How much to charge is your business decision. These numbers are just to help you think.)

---

## 6. The big plan: what to pay at each size

The tables show: **how many shops**, **what changes**, **rough monthly cost in dollars and rupees**, and **what to do next**.

How we counted: each shop has **3 barbers**, each shop has about **200 customers**. At any moment, about half of the barbers have the app open (they are not all online together).

---

### STAGE 1: 0 to 25 shops — "Launch"

**What to pay**

| What | Plan | Cost |
|---|---|---|
| Vercel | **Pro** (required for a paying business) | $20/month ≈ ₹1,700 |
| MongoDB Atlas | Free (M0) | ₹0 |
| Pusher | Free (Sandbox) | ₹0 |
| Upstash Redis | Free | ₹0 |
| Domain | Yearly | ≈ ₹1,000 per **year** |

**Total ≈ $20/month ≈ ₹1,700/month.**

**Why it is fine:** We tested 25 shops with 5,000 customers. Everything was fast and worked.

**Do this stage:**
- Turn on the admin "cleanup old bookings" setting.
- Check Pusher's **Peak connections today** once a week.
- Set billing alerts everywhere.
- Take a backup (see Section 7).

**Move to Stage 2 when:** Pusher peak connections reach **70 or more** (about 23 shops) — or you reach **25 shops**, whichever comes first.

---

### STAGE 2: 25 to 50 shops — "Pusher gets full"

**What changes:** Pusher's free plan has only 100 connections. At 30 shops you hit it. Above that, barbers' screens stop updating instantly and only refresh every 30 seconds. The app still works, but it feels slow.

| What | Plan | Cost |
|---|---|---|
| Vercel | Pro | $20 |
| **Pusher** | **Startup** (about 500 connections) | **$49** |
| MongoDB Atlas | Free (M0) — watch speed | ₹0 |
| Upstash | Free | ₹0 |

**Total ≈ $70/month ≈ ₹6,000/month.**

**Do this stage:**
- Upgrade Pusher **before** you pass 30 shops.
- Watch MongoDB "Operations per second". The free plan allows about 100 per second. If you often touch 80+, go to Stage 3 early.

**Move to Stage 3 when:** MongoDB feels slow (pages taking 3+ seconds), data size is above **350 MB**, or you reach **45–50 shops**.

---

### STAGE 3: 50 to 100 shops — "Database gets its own room"

**What changes:** The free database is shared with many other people, so its speed is not guaranteed. At 50+ shops you need a **paid database with guaranteed speed**.

| What | Plan | Cost |
|---|---|---|
| Vercel | Pro | $20 |
| Pusher | Startup | $49 |
| **MongoDB Atlas** | **M10** (own server, 10 GB) | **≈ $57** |
| Upstash | Free or pay-as-you-go | $0–5 |
| Error tracking (Sentry, free plan) | Free | $0 |

**Total ≈ $130/month ≈ ₹11,000/month.**

**Do this stage:**
- Switch MongoDB from free to M10 (Atlas has an "Upgrade" button, takes a few minutes, no data loss).
- Turn on **automatic backups** (M10 includes them).
- Add a free **uptime monitor** (like UptimeRobot) so you get a message if the site is down.
- Choose one person to answer shop owners' problems (support).

**Move to Stage 4 when:** you reach about **100 shops**, or MongoDB CPU stays above 70% for hours.

---

### STAGE 4: 100 to 200 shops — "Grow the database"

| What | Plan | Cost |
|---|---|---|
| Vercel | Pro (plus a little usage) | $20–40 |
| Pusher | Startup (500 connections is enough up to ~250 shops) | $49 |
| **MongoDB Atlas** | **M20** (more memory) | **≈ $140** |
| Upstash | Pay-as-you-go | $5–10 |
| Error tracking / monitoring | small paid plan | $0–26 |

**Total ≈ $220–$270/month ≈ ₹19,000–₹23,000/month.**

**Do this stage:**
- Move the QR code to **our own** QR maker. Right now the QR picture comes from a free outside site (`api.qrserver.com`). At this size, if that site is slow, every shop's QR page breaks. (This is a small coding job.)
- Run the same kind of test we ran for 25 shops again, but for 150 shops, **before** you reach that number.
- Start keeping a simple list of problems shops report.

**Move to Stage 5 when:** about **180–200 shops**, or Pusher peak connections reach **400**.

---

### STAGE 5: 200 to 500 shops — "You are a real company now"

| What | Plan | Cost |
|---|---|---|
| Vercel | Pro + extra usage | $40–100 |
| **Pusher** | **Pro** (about 2,000 connections) from ~250 shops | **$99** |
| **MongoDB Atlas** | M20 → **M30** (more power) around 300–400 shops | $140 → **$390** |
| Upstash | Pay-as-you-go | $10–30 |
| Sentry/monitoring | Team plan | $26–50 |

**Total ≈ $320 → $670/month ≈ ₹27,000 → ₹57,000/month.**

**Do this stage:**
- **Hire help.** One part-time developer (to fix bugs, watch the system) and one support person (to answer shop owners). You cannot do everything alone now.
- Put your database in the **Mumbai region** near the users (we already use Mumbai for Redis; do the same for Atlas).
- Add a **status page** (like statuspage.io free) so shops can see "all systems working".
- Review costs every month.

**Move to Stage 6 when:** about **450 shops**, or MongoDB size passes **25 GB**, or Pusher peak connections reach **1,600**.

---

### STAGE 6: 500 to 1,000 shops — "Spend smart"

| What | Plan | Cost |
|---|---|---|
| Vercel | Pro + usage (maybe 5–15 million calls/month) | $100–300 |
| **Pusher** | **Business** (about 5,000 connections) | **$299** |
| **MongoDB Atlas** | M30 → **M40** | $390 → **$760** |
| Upstash | Pay-as-you-go | $20–60 |
| Monitoring + error tracking | Paid | $50–150 |

**Total ≈ $860 → $1,570/month ≈ ₹73,000 → ₹1.3 lakh/month.**

**Do this stage:**
- **Reduce database load:** make sure every common search has an index (a "shortcut" in the database). Ask your developer to check slow queries from Atlas "Performance Advisor".
- Think about **cutting Pusher cost**: because barbers are only online in working hours, a developer can disconnect idle screens after 10 minutes to save connections.
- Get a **second person** who can fix the system when the first is away (never depend on just one person).
- Think about **business insurance** and a proper **company** (Private Limited) if you have not yet.

**Move to Stage 7 when:** around **900 shops**, or you see regular slowness at 10–11 AM (peak booking time).

---

### STAGE 7: 1,000 to 10,000 shops — "Rebuild the engine"

At this size the simple setup starts to creak. Plan a bigger rebuild. This is the point where you need a **real engineering team** (3–10 people).

| What | Plan | Cost (per month) |
|---|---|---|
| Vercel | Pro with big usage or Enterprise; or move to your own servers | $300 → **$3,000+** |
| **Pusher** | **Premium** (about 10,000 connections, up to ~3,300 shops online) — beyond that you need a custom deal | **$499 → custom** |
| **MongoDB Atlas** | **M50 → M80**, then **sharding** (splitting data across servers) | $1,500 → **$6,000+** |
| Redis (Upstash or bigger) | Fixed plan | $50 → $300 |
| Monitoring, logs, security checks | Paid | $200 → $1,000 |
| People | Developers, support, accountant | the biggest cost |

**Total ≈ $3,000 → $12,000+ per month ≈ ₹2.5 lakh → ₹10 lakh+ per month.** (Cost per shop falls as you grow.)

**Do this stage:**
- Add **load tests** to every release (we did one manually; make it automatic).
- Split the app: separate the booking system (most important) from reports and admin.
- Add **caching** (store common answers so you don't ask the database every time). The code already has a cache helper waiting.
- Add **database read replicas** (copies used only for reading) so reports don't slow bookings.
- Get a security check (penetration test) once a year.
- Legal: privacy policy, terms, and data protection (India's DPDP law) — customer phone numbers are personal data.

---

### STAGE 8: 10,000 to 20 million shops — "A big technology company"

Be honest with yourself: **20 million shops is more than there are barber shops in all of India.** Reaching even 100,000 shops would make you one of India's biggest service software companies. Treat this as a dream plan, not a to-do list. But here is what would be true if it ever happened:

| Size | What changes | Rough monthly infrastructure cost (guess) |
|---|---|---|
| **10,000 – 100,000 shops** | Database split across many servers (sharding). Real-time system moved off Pusher to your own. App moved from Vercel to your own cloud (AWS / Google Cloud / Azure) or Vercel Enterprise. | $15,000 – $100,000 |
| **100,000 – 1 million shops** | Many database clusters in many regions. Message queues for notifications. A full engineering team (30–100 people). 24×7 on-call. | $100,000 – $600,000 |
| **1 million – 20 million shops** | Own platform team. Multiple countries. Custom hardware deals with cloud companies. Dedicated security and data teams. | $1 million – $10 million+ |

**Why it is so big:** each shop makes roughly 14,000 requests per month (our test numbers). At 20 million shops that is around **280 billion requests a month** — about **100,000 requests every second, all day**. No single database or hosting plan can do that. That needs a completely different design.

**The honest truth:** the exact cost at that size can only be known by the engineers you hire then. This table is only to show how big the numbers become.

---

## 7. Things you must do at EVERY stage

1. **Backups.** Free MongoDB has no automatic backup. From Stage 3 (M10) backups are included. Until then, ask a developer to export the database once a week and save it somewhere safe (Google Drive). Test restoring it **once** — a backup you never tested is not a backup.
2. **Watch dashboards weekly.** 10 minutes every Monday: Pusher peak connections, MongoDB data size and speed, Vercel usage, Upstash commands.
3. **Turn on billing alerts** so no bill surprises you.
4. **Keep 2–3 months of costs saved.** If revenue drops, you can still keep the app running.
5. **Never share secret keys** (database password, secret codes) in WhatsApp or screenshots. If a key leaks, **rotate** it (make a new one and replace the old).
6. **Test before big growth.** Before you cross a stage, run a load test at the **next stage's** size.
7. **Renew your domain** on time. If the domain expires, your whole business goes offline.
8. **Keep an admin account safe.** There is only the admins you create. Keep the password in a password manager.

---

## 8. Quick table: "What if I ignore the limit?"

| If this limit is crossed | What happens | How bad |
|---|---|---|
| Pusher 100 connections (free) | Extra barbers lose instant updates. Screens refresh every ~30 seconds instead. | Annoying, not broken |
| MongoDB 512 MB full (free) | **New bookings cannot be saved. The app stops working.** | **Very bad — avoid** |
| MongoDB free speed limit | Pages become slow at busy times | Bad |
| Upstash free commands finished | App switches to a simpler protection built in. Still works. | Mild |
| Vercel Hobby (not allowed for business) | Vercel can suspend your project | **Very bad — avoid** |
| Vercel payment fails | Site can go offline | **Very bad** |
| Card expires or bank blocks payment | Same as above for any company | **Very bad** |
| Domain expires | Website disappears | **Very bad** |
| Daily job (cron) stops | Old slots pile up, new days are not created | Bad after a few days |

---

## 9. Warning signs (check these before you upgrade)

- **Pusher** → Overview → "Peak connections today" above **70 / 100** → upgrade soon.
- **MongoDB** → "Data Size" above **350 MB** of 512 MB, or "Operations per second" often above **80** → upgrade soon.
- **Vercel** → Usage → function calls close to the plan limit, or many errors → look at it.
- **Customers say** "booking page is slow" → look at MongoDB first, then Vercel.
- **Shops say** "new bookings don't appear until I refresh" → look at Pusher.
- **Shops say** "no notification on phone" → check `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` in Vercel.
- **Old finished bookings** pile up → use the admin "cleanup" setting.

---

## 9b. The "Growth & limits" panel in the admin area

At the top of the admin **Overview** page there is a box called **Growth & limits**. It reads this file's stages for you:

- It shows which **stage** you are in and the rough monthly cost at that stage.
- Three coloured bars: **shop progress** toward the next stage, **barbers online now** (about the same as Pusher connections), and **database storage**.
- Green means fine, orange means "upgrade soon" (70% full), red means "upgrade now" (90% full). Each bar has one line saying what to do.
- Type your real Pusher plan size in the box ("free = 100, Startup = 500, Pro = 2000") so the bar measures against what you actually pay for. Do this each time you upgrade Pusher.
- Also set the database plan size on the **Data & Storage** page each time you upgrade MongoDB.

What the panel **cannot** do: it can't see your real bills, Vercel usage, MongoDB speed or Pusher's own peak number. Check those on their dashboards (Section 3). The panel's "online" number counts barbers whose dashboard was open in the last 12 minutes, so it is an estimate.

---

## 10. One-page summary (stick this on your wall)

| Shops | Do this | Total / month (≈) |
|---|---|---|
| **0–25** | Vercel **Pro** (required for business), everything else free | **₹1,700** |
| **25–50** | + Pusher **Startup** ($49) | **₹6,000** |
| **50–100** | + MongoDB **M10** ($57), backups, uptime monitor | **₹11,000** |
| **100–200** | MongoDB **M20**, own QR maker, load test | **₹19,000–23,000** |
| **200–500** | Pusher **Pro**, MongoDB **M30**, hire developer + support | **₹27,000–57,000** |
| **500–1,000** | Pusher **Business**, MongoDB **M40**, indexes, second engineer | **₹73,000–1.3 lakh** |
| **1,000–10,000** | Pusher **Premium**/custom, MongoDB **M50–M80**/sharding, real team | **₹2.5–10 lakh+** |
| **10,000 → 20 million** | Own cloud, own real-time system, big teams | **₹13 lakh → crores** (honest guess) |

**The golden rules:**
1. Upgrade just **before** a limit, not after.
2. Pay on time and keep a money buffer.
3. Test before you grow.
4. Keep backups.
5. Check your dashboards every Monday.

---

## 11. Variables and keys (so you never lose track)

These live in **Vercel → your project → Settings → Environment Variables**. Never put them in the code or in chat.

| Name | What it is | Secret? |
|---|---|---|
| `MONGODB_URI` | Database address + password | Secret |
| `AUTH_SECRET` | Signs every login | Secret |
| `CRON_SECRET` | Lets only Vercel run the daily job | Secret |
| `VAPID_PRIVATE_KEY` | Phone notification key (private half) | Secret |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Phone notification key (public half) | Normal |
| `VAPID_SUBJECT` | Your contact email for notifications (`mailto:...`) | Normal |
| `PUSHER_APP_ID`, `PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | Pusher connection details | Normal |
| `PUSHER_SECRET` | Pusher private key | **Secret** |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis (from the Vercel Storage tab) | Secret |

**Rules:**
- Anything starting with `NEXT_PUBLIC_` is visible to everyone's browser. Never put a password there.
- After changing a variable, **Redeploy** so the change takes effect.

---

## 12. When something goes wrong — who to look at first

1. **Website not opening** → Vercel → Deployments (is the last one "Ready"?), and is payment OK?
2. **Bookings not saving** → MongoDB Atlas (is storage full? is the cluster paused?).
3. **Screens not updating by themselves** → Pusher dashboard (connections full? keys correct?).
4. **No phone notifications** → the three VAPID variables in Vercel; barber must tap "Enable notifications" on the phone.
5. **Too many login failures or spam** → Upstash dashboard and the app's rate limits.
6. **Old slots, no new days** → Vercel → Settings → Cron Jobs → click Run on the daily job, read the result.

---

*Last updated: October 2026. Update this file whenever prices change or you move to a new stage.*
