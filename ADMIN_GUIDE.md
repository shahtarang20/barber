# Admin guide

Sign in at `/login` with the admin code and password. The admin area is at `/admin`. Barbers cannot open it.

## 0. Before anything else
- **Creating the first admin:** run `ADMIN_CODE=<code> ADMIN_PASSWORD='<a long private password>' npx tsx scripts/create-admin.ts`. The code and password come from the command line (nothing secret is stored in the script), and the script tells you which database it is about to change. Then change the password at **Settings → Change My Password**.
- **Staying signed in:** a login lasts 7 days.

## 1. Overview (`/admin`)
- Totals: barbers, bookings, customers, today's bookings.
- Bookings by Status and Last 7 Days charts.
- **Growth & limits** panel: the warning board for every outside service (details in section 7). Red items come first.
- Active Stores table: Barber Code, name, public URL, total bookings. **View Public Page** opens the barber's customer page.

## 2. Manage Stores (`/admin/barbers`)
Manage each barber here.
- **Search** by name, code, phone (any style: `98765`, `+91 98765 43210`), email or link.
- **Phone column:** every new barber gives a mobile number at sign-up. You can type or fix a number right in the table (10 digits; it saves when you click away; empty removes it). Older barbers who signed up before this show an empty box, so fill those in. Call and WhatsApp links appear under a saved number.
- **Status:** suspend or re-activate a barber. A suspended barber is locked out at once and their public page closes to customers.
- **Premium (₹) and Due Date:** record the amount a barber pays and the day of the month it is due.
- **Link limit / month:** how many bookings per month can come through that barber's link. Empty means the platform default.
- **Reset Password:** use it when a barber is locked out, then tell them the new password.
- **Catalogue:** a switch per barber for the Premium Catalogue (on by default). Switching it off hides the catalogue from customers and stops the barber editing it; nothing is deleted. A barber's catalogue size follows the amount in **Premium (₹)**: nothing = Free, any amount = Premium, ₹1500 or more = Business. Barbers can upload pictures (and, with Premium, short videos); storage per barber is Free 25 MB / Premium 500 MB / Business 2000 MB. Videos only work after you connect Cloudflare R2 (see PROJECT.md, "Media, branding and share card").
- **Plans and payments:** set the barber's monthly **Premium (₹)**, then open **Payments** in their row after you receive the money and record the amount, months and how it was paid (a mistake can be voided with a reason; it stays in the history). The plan end date moves forward by the months paid. Barbers are reminded in the last 3 days; after the plan ends they get a grace period (default 7 days, changeable in Settings → Plans and limits) and then fall back to the Free limits. Nothing they created is deleted, and recording a payment brings it back immediately. Every payment, void, price change and plan-size change appears under Settings → Recent Admin Actions.
- **Plan features:** besides catalogue sizes, Settings → Plans and limits now sets **live offers** and **messages to customers per week** for each plan. Advanced numbers (revenue, top services, busy times) are part of Premium and Business. Shop owners decide which of their barbers can help edit the shop catalogue; that needs a Premium plan (and a Business plan for staff to see numbers and send messages). Customer messages only work when the phone-notification (VAPID) variables are set, and only reach customers who chose "Get offers" on the page.

## 3. Shops (`/admin/shops`)
- **Add or remove members:** type a barber code (for example `b002`) and press add.
- **Switch a shop on or off,** or delete it.
- **Link limit per month** for the shop link. Empty means the platform default; 0 means no limit.
- **View Public Page** opens the shop's customer page.

## 4. Bookings (`/admin/bookings`)
- Every booking on the platform: Booking ID, barber, customer, date and time, status.
- **Search** by Booking ID, customer name or phone, or barber name or code. This is the first place to look when a customer says "my booking is missing".

## 5. Data & Storage (`/admin/data`)
Keeps the database small by removing old finished bookings.
1. Check the database size and what would be removed.
2. Set how many months of finished bookings to keep (1–60).
3. Click **Download them as CSV first** to save a backup.
4. Switch cleanup on, then run it now, or let the daily job do it.

Good to know:
- It removes finished bookings only (completed, cancelled, no-show) and empty past schedule days.
- Customer records (name and phone) stay, with their visit count and "last visited", so the barber's Customers page still looks right.
- Upcoming and confirmed bookings are never removed. A stale confirmed booking is auto-completed first, then removed once it is old enough.
- It applies to all barbers at once, not per barber.
- Set "Database plan size (MB)" to your MongoDB plan's size so the warning works (the free plan is 512 MB).

## 6. Settings (`/admin/settings`)
- **Change My Password:** current password, then the new one twice.
- **Other Admin Accounts:** reset another admin's password (you confirm with your own password).
- **Recent Admin Actions:** audit log of changes made by admins.

## 7. Growth & limits panel (Overview page)
Shows green, orange (70%) or red (90% / broken). The badge says "All fine", "Upgrade soon" or "Upgrade now". Red and orange items are listed first.

**Measured by the app**
| Item | Warns when |
|---|---|
| Shops (growth stage) | the stage is 70% / 90% full |
| Barbers online (Pusher connections) | online barbers reach 70% / 90% of your Pusher plan |
| Pusher messages today | about 70% / 90% of the daily message limit (estimate: events × 2) |
| Redis commands this month | about 70% / 90% of the monthly limit (estimate) |
| Database storage | 70% / 90% of your plan size |
| MongoDB connections | 70% / 90% of the limit (if the plan lets the app read it) |
| Vercel plan | red if the plan is Hobby but any barber has a premium amount recorded (Hobby is not allowed for paid products) |
| Daily job (new slots, cleanup) | orange if it never ran, red if it has not run since before yesterday |
| Pusher / Redis / phone notifications | orange if not set up on the server |

**Checked by you (the app cannot see them)**
Vercel usage, Upstash usage, and a MongoDB backup. Each has an **I checked it today** button and goes orange after 7 days and red after 14 days. The free MongoDB plan has no automatic backups, so export your data every week.

**Plan sizes you must keep up to date** (bottom of the panel): Pusher connections, Pusher messages per day, Redis commands per month, and your Vercel plan (Hobby / Pro). When you upgrade a service, change the number here, or the warnings will be wrong.

The message and command counts are the app's own estimates. The exact numbers are always on each service's own dashboard.

## Everyday routine
| When | Do this |
|---|---|
| Every morning | Overview: check bookings and the Growth & limits panel (anything red or orange?) |
| Weekly | Click "I checked it today" on Vercel, Upstash and backup after really checking them |
| A barber can't log in | Manage Stores → Reset Password |
| A customer can't find a booking | Bookings → search by phone |
| A barber stops paying | Manage Stores → Suspend |
| Monthly | Check Premium / Due Date, then check Data & Storage |
| Before the database fills up | Download the CSV, then run the cleanup |
