# Admin guide

Sign in at `/login` with the admin code and password. The admin area is at `/admin`. Barbers cannot open it.

## 0. Before anything else
- **Creating the admin:** `scripts/create-admin.ts` makes the first admin, using a fixed code and password written in the file. Anyone who has seen that file knows them. After your first login, go to **Settings → Change My Password** and set your own.
- **Staying signed in:** a login lasts 7 days.

## 1. Overview (`/admin`)
- Totals: barbers, bookings, customers, today's bookings.
- Bookings by Status and Last 7 Days charts.
- **Growth & limits** panel: which barbers are active and how close they are to their link limits.
- Active Stores table: Barber Code, name, public URL, total bookings. **View Public Page** opens the barber's customer page.

## 2. Manage Stores (`/admin/barbers`)
Manage each barber here.
- **Search** by name, code, phone, email or link.
- **Status:** suspend or re-activate a barber. A suspended barber is locked out at once and their public page closes to customers.
- **Premium (₹) and Due Date:** record the amount a barber pays and the day of the month it is due.
- **Link limit / month:** how many bookings per month can come through that barber's link. Empty means the platform default.
- **Reset Password:** use it when a barber is locked out, then tell them the new password.

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

## Everyday routine
| When | Do this |
|---|---|
| Every morning | Overview: check bookings and the Growth & limits panel |
| A barber can't log in | Manage Stores → Reset Password |
| A customer can't find a booking | Bookings → search by phone |
| A barber stops paying | Manage Stores → Suspend |
| Monthly | Check Premium / Due Date, then check Data & Storage |
| Before the database fills up | Download the CSV, then run the cleanup |
