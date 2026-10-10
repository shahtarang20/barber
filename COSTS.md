# Monthly cost plan (for planning only)

**Prices below are from memory of the vendors' public price lists. Recheck them before you quote a shop.**
Exchange rate used: $1 = ₹85.

## Traffic assumed
30 shops x 500 customers a day x 5 visits each = 75,000 visits a day = about **2.25 million visits a month**.
Each shop: 30 photos (prepared in the browser to at most 1600 px WebP, plus a 480 px thumbnail made on the server) and 1 video.

## What one visit costs this app (measured on a production build)
| Item | Per visit |
|---|---|
| Server requests | about 4 on opening (page, shop profile, catalogue, slots) + one slot refresh every 10 s while the page stays open (about 6 more) = **about 10** |
| MongoDB operations | **about 9 on opening** (page 1, profile 5, catalogue 1, slots 2) + 1 per slot refresh = about 15 |
| Redis (Upstash) commands | **0 for these reads** (public read routes are rate-limited in server memory); Redis is used only for bookings, cancels, logins and sign-ups |
| Photos and video | straight from Cloudflare R2 (free downloads) - they never pass through the app or Vercel's image service |

## Monthly bill at 30 shops
| Service | Plan | Estimate |
|---|---|---|
| Vercel | Pro, $20 + usage. About 22M function calls (1M included, then about $0.60 per million) and about 120 CPU-hours | **$35 - $45** |
| MongoDB Atlas | M10 ($57). About 34M operations a month is about 13 per second on average and about 60 at peak (the free M0 stops at 100 per second and 512 MB) | **$57** |
| Upstash Redis | Pay-as-you-go ($0.2 per 100k commands). Only bookings, logins and the like: about 1.5M commands | **$3** |
| Pusher (live refresh of owner screens) | Free is 100 connections and 200k messages a day. 30 shops with a few devices each reach the connection limit, so plan for the next plan up | **$0 - $49** |
| Cloudflare R2 | 30 shops x (30 photos x about 0.2 MB + 1 video of up to 50 MB) is under 2 GB, inside the free 10 GB. Downloads are free | **$0** |
| Domain | | about $1 |
| **Total** | | **about $96 - $155, which is about ₹8,200 - ₹13,200 a month** |

That is about **₹275 - ₹440 per shop**. Charge each shop **at least ₹500 a month**.

If the same photos went through Vercel's image optimisation instead, the image-transformation charges alone would add several
times this amount. Keeping them as prepared WebP files on R2 is the single biggest saving.

## What can push the bill up
- **Pusher**: the cheapest plan above is only enough for a handful of shops. Without it the owner screens refresh every 30 s instead of live.
- **Bookings per day**: 15,000 customers a day booking once each is about 450,000 bookings a month (about 250 MB a month of database). Switch on **Retention** (3 to 6 months) so the database stays small.
- **Videos**: each shop's promo video is capped at 50 MB and 1 per service on the Premium plan.
- **Atlas region**: keep Vercel functions and Atlas in the same region (Mumbai), otherwise every booking waits on about 17 database round trips across regions.

## Monthly budget alert
The project has no cost-monitoring feature to attach a budget to (the admin "Growth & limits" panel only counts Pusher events and Redis
commands). Set the alert in the vendors' own dashboards: Vercel "Spend Management", Atlas "Billing alerts", Upstash "Budget", Cloudflare "Billing notifications".
A reasonable total alert for 30 shops is **₹11,000** (about $130), with each vendor alert set a little above its row in the table.

## Known limits
- Photos uploaded before the browser-side preparation was added are not re-encoded.
- An app that is already installed on a phone may keep its old icon and colour until it is reinstalled.
- This is an installable web app, not an App Store or Play Store listing.
- Use a custom domain for the R2 bucket's public address (the default `r2.dev` address is rate-limited).
