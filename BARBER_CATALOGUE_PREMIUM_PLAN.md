# BARBER Catalogue and Premium Expansion Plan

## 1. Purpose

Add a premium service and style catalogue to the BARBER application without changing the jewellery project.

The existing appointment-booking experience must remain fully functional. The catalogue is an additional customer experience, not a replacement for booking.

All implementation work belongs only in:

```text
/home/root509/barber
```

The jewellery repository must be treated as read-only. Reusable ideas and UI patterns may be adapted, but BARBER must use its own authentication, database models, Pusher integration, translations and design system.

---

## 2. Main customer experience

At the top of every public barber and shop page, show a full-width segmented control with two equal sections:

```text
┌──────────────────────────┬──────────────────────────┐
│     Book Appointment     │        Catalogue         │
└──────────────────────────┴──────────────────────────┘
             50%                          50%
```

### Left side: Book Appointment

- Opens the existing slot-booking experience.
- Keeps all current behaviour: barber selection, date, slot, waitlist, booking, rescheduling and installation prompts.
- This is the default tab when a customer opens an existing booking link.
- Existing shared links must continue working without migration.

### Right side: Catalogue

- Opens the premium service and hairstyle catalogue for the same barber or shop.
- Shows cover banner, logo/profile image, categories, service cards, style gallery, offers and WhatsApp contact.
- Customers can select a service and continue to booking with that service preselected.
- Switching between the two tabs must be instant and must not reload the entire page.
- The active tab must be clearly highlighted and keyboard/screen-reader accessible.
- On mobile, the control must remain easy to tap and must not cover booking content.

Recommended URL behaviour:

```text
/b/<slug>?view=booking
/b/<slug>?view=catalogue
/s/<slug>?view=booking
/s/<slug>?view=catalogue
```

The query parameter makes catalogue links directly shareable while preserving one public URL per barber/shop.

---

## 3. Owner settings experience

Add a new card to the barber owner Settings page.

### Card title

**Premium Catalogue**

### Card description

“Create service categories, add hairstyle photos or videos, publish prices and offers, and give customers a premium catalogue beside online booking.”

### Primary button

**Manage Catalogue**

When the owner selects the button, open a dedicated catalogue-management page. Do not place a large catalogue editor directly inside Settings.

Recommended routes:

```text
/dashboard/catalogue
/dashboard/catalogue/categories
/dashboard/catalogue/services/new
/dashboard/catalogue/services/<id>/edit
```

The owner must be able to:

1. Enable or disable the public catalogue.
2. Add, rename, reorder, publish, unpublish and delete categories.
3. Add services and hairstyle/style entries under a category.
4. Upload service images and short videos.
5. Configure price, duration, discount and availability.
6. Mark services as Featured, Popular, New or Premium.
7. Preview the public catalogue before sharing it.
8. Copy or share a direct catalogue link.

For a multi-barber shop, only the shop owner or an explicitly permitted manager should control shop-wide categories and branding. Individual barbers may manage their personal services only when the shop owner allows it.

---

## 4. Category requirements

Example categories:

- Haircut
- Beard
- Hair + Beard Combos
- Hair Colour
- Facial and Grooming
- Kids
- Bridal/Groom Packages
- Hair Treatments
- Premium Styles

Each category should contain:

| Field | Requirement |
|---|---|
| Name | Required; translated display name may be added later |
| Slug | Unique inside the owning barber/shop |
| Description | Optional |
| Cover image | Optional |
| Display order | Required |
| Published | Yes/No |
| Created/updated timestamps | Required |

Deleting a category with services must require confirmation. Prefer moving its services to another category or archiving the category instead of silently deleting content.

---

## 5. Service and style-card requirements

Each service/style entry should support:

| Field | Requirement |
|---|---|
| Name | Required |
| Category | Required |
| Short description | Optional |
| Images | Up to the configured plan limit |
| Videos | Optional and controlled by the plan |
| Duration | Required, for example 15, 30 or 45 minutes |
| Price type | Fixed price, Starting from, or Ask shop |
| Price | Optional depending on price type |
| Original price | Optional |
| Discount type | Percentage or fixed amount |
| Discount value | Optional |
| Available barbers | One, many or any barber in the shop |
| Featured/Popular/New/Premium | Optional badges |
| Published/Draft | Required |
| Display order | Required |

### Premium card design

- Square or 4:5 high-quality image area.
- Clear service name, duration and price.
- Discount displayed without misleading calculations.
- Visible “Book this service” primary action.
- Optional “Ask on WhatsApp” secondary action.
- Favourite/Save may be added later; it is not required for the first release.
- Skeleton loading and graceful image fallback are required.
- Cards must remain readable on low-cost Android phones and slower mobile networks.

When a customer selects **Book this service**:

1. Switch to the Booking tab.
2. Keep the selected service in state or the URL.
3. Show only barbers who can perform that service when applicable.
4. Use the service duration when calculating valid appointment availability.
5. Save the selected service and price snapshot with the booking.

---

## 6. Branding and media

Add barber/shop branding fields:

- Logo or barber profile image
- Cover banner
- Short introduction
- Address and map link
- Phone and WhatsApp number
- Instagram/Facebook links
- Theme/accent colour from an accessible predefined palette

Recommended initial media rules:

| Media | Suggested limit |
|---|---:|
| Image upload | 10 MB maximum before optimisation |
| Video upload | 50 MB maximum |
| Video duration | 30 seconds recommended; admin range 5–120 seconds |
| Images per service | 6 initially |
| Videos per service | 1 initially |

Images should be resized and converted to an efficient format where supported. Media ownership keys must use the BARBER shop/barber ID and must never reuse jewellery IDs or paths.

Cloudflare R2 may be added to BARBER for media storage, but its credentials must be new BARBER-specific environment variables. Never copy secret values from the jewellery project.

---

## 7. Suggested database models

### CatalogueCategory

```text
ownerType: BARBER | SHOP
ownerId
name
slug
description
coverUrl
displayOrder
isPublished
createdAt
updatedAt
```

Unique index:

```text
ownerType + ownerId + slug
```

### BarberService

```text
ownerType: BARBER | SHOP
ownerId
categoryId
name
description
images[]
videos[]
durationMinutes
priceType: FIXED_PRICE | STARTING_FROM | ASK_SHOP
price
originalPrice
discountType: PERCENTAGE | FIXED
discountValue
barberIds[]
isFeatured
isPopular
isNew
isPremium
status: DRAFT | PUBLISHED
displayOrder
createdAt
updatedAt
```

### Booking additions

```text
serviceId
serviceNameSnapshot
serviceDurationSnapshot
servicePriceSnapshot
```

Snapshots protect old booking records if the owner later changes or deletes a service.

### MediaAsset

Optional but recommended for reliable cleanup:

```text
ownerType
ownerId
storageKey
publicUrl
mediaType
sizeBytes
durationSeconds
createdAt
```

---

## 8. Suggested APIs

Owner APIs require BARBER authentication and ownership checks:

```text
GET/POST       /api/barber/catalogue/categories
PATCH/DELETE   /api/barber/catalogue/categories/<id>
GET/POST       /api/barber/catalogue/services
GET/PATCH/DELETE /api/barber/catalogue/services/<id>
POST           /api/barber/catalogue/reorder
POST           /api/barber/catalogue/media/upload
DELETE         /api/barber/catalogue/media/<id>
```

Public APIs expose published content only:

```text
GET /api/public/barbers/<slug>/catalogue
GET /api/public/shops/<slug>/catalogue
GET /api/public/catalogue/services/<id>
```

Admin APIs should control plan limits without editing shop content directly:

```text
maxCategories
maxServices
maxImagesPerService
maxVideosPerService
maxVideoDurationSeconds
catalogueEnabled
videoUploadsEnabled
```

All create/update endpoints must use schema validation, safe URL handling, ownership checks and rate limits.

---

## 9. Premium plans and renewal

Replace the current amount-and-due-day-only approach with explicit subscription data:

```text
planCode
planPrice
planStartsAt
planEndsAt
paymentStatus
graceEndsAt
lastPaymentAt
catalogueEnabled
```

Suggested behaviour:

- `planPrice = 0`: free tier.
- Paid amount: premium tier.
- Show renewal reminders during the final three days.
- Remind up to three times per day, without covering important owner actions.
- After expiry, apply a configurable grace period.
- Never delete catalogue data when a plan expires; unpublish premium functionality and preserve data for renewal.
- Keep payment history and admin audit records.

Suggested initial plans:

| Feature | Free | Premium | Business |
|---|---:|---:|---:|
| Categories | 3 | 15 | Unlimited/fair use |
| Published services | 10 | 100 | 500 |
| Images per service | 2 | 6 | 10 |
| Video | No | 1 per service | Configurable |
| Custom branding | Basic | Full | Full |
| Analytics | Basic | Advanced | Advanced |
| Staff permissions | No | Basic | Full |

---

## 10. Realtime updates and notifications

BARBER already uses Pusher and a 30-second polling fallback. Continue using that system; do not add Ably from the jewellery project.

Catalogue events:

```text
catalogue.category.updated
catalogue.service.created
catalogue.service.updated
catalogue.service.published
catalogue.service.deleted
catalogue.branding.updated
```

Customer notification templates may later include:

- New haircut style added by `{shopName}`
- New grooming package available
- Festival offer now live
- Service price updated
- Limited-time discount

Only notify customers who explicitly opted in. Owners must not be able to send unlimited spam.

---

## 11. Infrastructure monitoring

Extend the admin Growth & Limits panel with provider cards for:

- Vercel
- MongoDB Atlas
- Pusher
- Upstash Redis
- Cloudflare R2, if media storage is enabled

Each card should show provider name/logo, configuration state, measured usage when an official API is available, warning threshold and a direct dashboard link.

Never expose provider API tokens to the browser. Monitoring calls must execute on the server and require admin authorization.

---

## 12. Jewellery-to-BARBER feature map

| Jewellery feature | BARBER equivalent | Status |
|---|---|---|
| Multi-shop admin | Multi-barber-shop admin | Already available |
| Owner seven-day login | Barber seven-day login | Already available |
| Installable owner/customer PWA | Barber and booking-link PWA | Already available |
| Realtime updates with fallback | Pusher plus 30-second polling | Already available |
| Multiple languages | English, Hindi, Gujarati and Marathi | Already available |
| Per-shop limits | Monthly booking limits | Already available |
| Product catalogue | Haircut/service catalogue | Add in this project |
| Product prices and discounts | Service prices, packages and offers | Add in this project |
| Product photos/videos | Haircut-style gallery and barber portfolio | Add in this project |
| Cover banner and logo | Shop cover, logo and barber profile | Improve |
| Customer favourites | Favourite barber/service | Optional later |
| WhatsApp enquiries | Booking reminder and customer contact | Improve |
| Custom sharing card | Premium shop booking preview on WhatsApp | Add |
| Premium plan expiry | Subscription start/expiry/payment status | Must add |
| Three-day payment reminders | Premium renewal reminders | Add |
| Infrastructure monitoring | Vercel, MongoDB, Pusher and Upstash cards | Add |
| Configurable notifications | Booking, promotion and renewal templates | Add |
| Media limits | Gallery image/video limits per shop | Add |
| Analytics | Revenue, bookings, no-shows and repeat customers | Improve |

Do not copy the jewellery unique-IP storefront cap. BARBER should continue using monthly successful-booking limits because that matches the appointment business model.

---

## 13. Implementation phases

### Phase 0 — Launch safety

- Remove and rotate hardcoded MongoDB credentials.
- Remove the fixed admin password from scripts.
- Resolve lint and dependency-security failures.
- Repair automated E2E tests.

### Phase 1 — Catalogue foundation

- Category and service models.
- Owner Manage Catalogue card and pages.
- Draft/publish controls.
- Customer 50/50 segmented switch.
- Premium service cards.
- Service selection passed into booking.

### Phase 2 — Media and branding

- Logo and cover banner.
- Image/video uploads and cleanup.
- Shop theme options.
- Premium WhatsApp/Open Graph sharing card.

### Phase 3 — Plans and monetisation

- Subscription periods and payment history.
- Feature/usage limits.
- Three-day renewal reminders and grace period.
- Admin audit trail.

### Phase 4 — Growth features

- Customer opt-in notifications.
- Offers and configurable campaigns.
- Revenue and service analytics.
- Staff permissions.
- Optional favourites and loyalty.

---

## 14. Acceptance criteria

The first catalogue release is complete only when:

1. Existing booking links and slot booking work exactly as before.
2. Public barber and shop pages show an equal-width Booking/Catalogue switch.
3. Owners can reach Manage Catalogue from Settings.
4. Owners can create, edit, reorder, publish and archive categories.
5. Owners can create draft and published services with duration and price.
6. Public users can see published content only.
7. Selecting a service carries it into booking and saves a booking snapshot.
8. Shop/barber ownership is enforced on every write API.
9. Catalogue changes appear without requiring customers to reinstall the PWA.
10. Mobile, keyboard, screen-reader and slow-network behaviour is tested.
11. Lint, TypeScript, production build, security audit and end-to-end booking tests pass.
12. The jewellery repository has no modified files.

---

## 15. Non-goals for the first release

- Do not add a general barber marketplace or nearby-shop discovery.
- Do not replace Pusher with Ably.
- Do not copy jewellery database documents or credentials.
- Do not add the jewellery unique-IP cap.
- Do not add customer accounts unless separately approved.
- Do not build virtual hairstyle try-on in the first release.
- Do not hold customer money directly; use a regulated payment provider if deposits are added later.

