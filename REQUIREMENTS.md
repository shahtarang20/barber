# PROJECT: Barber Slot Booking SaaS

Build a production-ready, full-stack **Barber Slot Booking Web Application**.

The product is NOT a barber marketplace.

Do NOT build:

* Barber/shop search
* Nearby barber discovery
* Maps
* Location-based recommendations
* Multiple service marketplaces
* Complex salon marketplace functionality

The core concept is extremely simple:

> **A barber creates and manages appointment slots. The barber shares a unique booking link. Customers open that link, see available/booked slots, and reserve an available slot.**

The platform must support **multiple independent barbers**, with each barber having their own account, booking link, schedule, slots, customers, and appointments.

---

# 1. PRODUCT VISION

Build a SaaS product similar in concept to a lightweight appointment scheduling system, specifically optimized for individual barbers.

The primary workflow is:

```text
BARBER
Create account
      ↓
Create booking profile
      ↓
Set working hours
      ↓
Generate appointment slots
      ↓
Share booking link
      ↓
Customer books a slot
      ↓
Slot becomes BOOKED
      ↓
Barber manages appointment
```

Customer workflow:

```text
Open barber booking link
      ↓
Select date
      ↓
View available slots
      ↓
Select slot
      ↓
Enter name + phone
      ↓
Confirm booking
      ↓
Receive confirmation
```

The application should be simple enough for a barber with limited technical knowledge to use.

---

# 2. PRIMARY GOAL

The most important functionality is:

### Barber

* Create account
* Login
* Create public booking profile
* Set working hours
* Generate slots
* Add slots manually
* Block slots
* View booked slots
* View customer information
* Cancel appointments
* Mark appointments as completed
* Manage schedule
* Copy/share booking link

### Customer

* Open barber's public booking page
* Select date
* See available/booked slots
* Select an available slot
* Enter name and phone
* Confirm appointment
* Receive booking confirmation
* View booking details

---

# 3. TECHNOLOGY STACK

Use the following stack.

## Frontend

* Next.js latest stable version
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* Lucide React
* React Hook Form
* Zod

Use the Next.js App Router.

Use strict TypeScript.

---

# 4. BACKEND

Use Next.js server-side functionality / Route Handlers.

Backend:

* Next.js API Route Handlers
* TypeScript
* MongoDB
* Mongoose

Keep backend logic separated from UI.

Use service-layer architecture where appropriate.

Recommended:

```text
src/
├── app/
├── components/
├── lib/
├── models/
├── services/
├── validations/
├── types/
└── utils/
```

Do not put database queries directly throughout React components.

---

# 5. DATABASE

Use **MongoDB Atlas** for production.

Use Mongoose.

Keep the database architecture intentionally simple.

Required collections:

```text
users
slots
customers
bookings
```

Do not create unnecessary collections.

---

# 6. USER MODEL

Create a User model.

Fields:

```text
_id
name
barberCode
email
phone
passwordHash
role
slug
profileImage
bio
timezone
workingHours
settings
createdAt
updatedAt
```

Role:

```text
BARBER
ADMIN
```

The system should primarily be designed around the BARBER role.

---

# 7. BARBER PROFILE

Every barber must have a unique public profile.

Example:

```text
https://yourapp.com/b/rahul-barber
```

The slug must be unique.

Example:

```text
rahul-barber
amit-barber
vijay-barber
```

The barber should be able to edit:

* Name
* Profile photo
* Bio
* Phone
* Booking URL
* Working hours
* Booking settings

The public profile should NOT expose sensitive account information.

---

# 8. SLOT MODEL

Create a Slot model.

Fields:

```text
_id
barberId
date
startTime
endTime
status
bookingId
createdAt
updatedAt
```

Status values:

```text
AVAILABLE
BOOKED
BLOCKED
```

A slot belongs to exactly one barber.

Example:

```text
Barber: Rahul
Date: 2026-09-28

10:00 - 10:30 → AVAILABLE
10:30 - 11:00 → BOOKED
11:00 - 11:30 → AVAILABLE
11:30 - 12:00 → BLOCKED
```

---

# 9. CUSTOMER MODEL

Create a Customer model.

Fields:

```text
_id
name
phone
email
createdAt
updatedAt
```

Email should be optional.

Phone and name should be required for a booking.

Do not require customers to create an account for basic booking.

The booking process must be fast.

---

# 10. BOOKING MODEL

Create a Booking model.

Fields:

```text
_id
bookingNumber
barberId
slotId
customerId
date
startTime
endTime
status
notes
createdAt
updatedAt
```

Booking statuses:

```text
CONFIRMED
COMPLETED
CANCELLED
NO_SHOW
```

Generate a human-readable booking number.

Example:

```text
RB-1042
RB-1043
RB-1044
```

---

# 11. BARBER DASHBOARD

Create a professional dashboard:

```text
/dashboard
```

The dashboard should immediately show:

```text
Today's Appointments
Available Slots
Booked Slots
Completed Appointments
```

Example:

```text
Good morning, Rahul 👋

Today's Schedule

8 Appointments
5 Available
3 Booked
```

---

# 12. TODAY'S SCHEDULE

Display the barber's slots in chronological order.

Example:

```text
10:00 AM
Available
[Block Slot]

10:30 AM
Booked
Tarang
98XXXXXXXX
[View]

11:00 AM
Available
[Block Slot]

11:30 AM
Booked
Amit
97XXXXXXXX
[View]
```

Use clear visual states:

```text
AVAILABLE → Green/positive state
BOOKED    → Red/occupied state
BLOCKED   → Neutral/dark state
```

Do not rely only on colors.

Also show text labels for accessibility.

---

# 13. SLOT GENERATION

Provide two methods.

## A. Generate slots automatically

Barber selects:

```text
Date
Start time
End time
Slot duration
Breaks
```

Example:

```text
Date:
28 September 2026

Start:
10:00 AM

End:
8:00 PM

Slot duration:
30 minutes

Break:
1:00 PM - 2:00 PM
```

The system generates:

```text
10:00
10:30
11:00
11:30
12:00
12:30

BREAK

2:00
2:30
3:00
...
7:30
```

## B. Add individual slot

Barber can manually add:

```text
Date
Start time
End time
```

Then:

```text
[Add Slot]
```

---

# 14. WORKING HOURS

Allow barber to configure weekly working hours.

Example:

```text
Monday
10:00 AM - 8:00 PM

Tuesday
10:00 AM - 8:00 PM

Wednesday
10:00 AM - 8:00 PM

Thursday
10:00 AM - 8:00 PM

Friday
10:00 AM - 8:00 PM

Saturday
10:00 AM - 9:00 PM

Sunday
Closed
```

Allow breaks.

Example:

```text
1:00 PM - 2:00 PM
```

Working hours should be used when automatically generating slots.

---

# 15. BLOCK SLOT

Barber must be able to block an available slot.

Example:

```text
11:30 AM
AVAILABLE

[Block]
```

After blocking:

```text
11:30 AM
BLOCKED
```

Customers must never be able to book blocked slots.

If a barber needs personal time, they should be able to block one or multiple slots.

---

# 16. CUSTOMER BOOKING PAGE

Public route:

```text
/b/[barberSlug]
```

Example:

```text
/b/rahul-barber
```

This page is the most important customer-facing page.

Design it beautifully but keep it simple.

Display:

```text
Barber profile
Name
Photo
Bio

Select Date

Available slots
Booked slots
```

Example:

```text
Rahul Barber
Professional Haircut & Grooming

Choose a date

September 28

Available Times

10:00 AM    Available
10:30 AM    Available
11:00 AM    Booked
11:30 AM    Available
12:00 PM    Booked
```

---

# 17. DATE SELECTION

Customers should be able to select a date.

Provide:

* Today
* Tomorrow
* Calendar

Do not allow booking in the past.

Do not show unavailable dates as if they contain bookable slots.

The backend must always validate the date.

---

# 18. BOOKING FLOW

When a customer clicks an available slot:

Open a confirmation form.

```text
Confirm Appointment

Date
28 September 2026

Time
11:30 AM

Name
[________________]

Mobile Number
[________________]

Notes (optional)
[________________]

[Confirm Appointment]
```

After submission:

```text
Booking confirmed successfully.
```

Display:

```text
Rahul Barber

28 September 2026
11:30 AM

Booking ID:
RB-1042

Customer:
Tarang

Phone:
98XXXXXXXX
```

---

# 19. NO CUSTOMER ACCOUNT REQUIRED

Customers should NOT need to register.

The primary booking experience must be:

```text
Click link
→ Select slot
→ Enter name
→ Enter phone
→ Book
```

Keep it under a few steps.

This is a core product requirement.

---

# 20. DOUBLE BOOKING PREVENTION

This is critical.

Two customers may attempt to book the same slot simultaneously.

Example:

```text
Customer A → 11:30 AM
Customer B → 11:30 AM
```

Only one request may succeed.

The backend must atomically reserve the slot.

Do NOT rely only on frontend availability.

Before creating a booking:

1. Verify the slot exists.
2. Verify the slot belongs to the requested barber.
3. Verify the slot is AVAILABLE.
4. Atomically update the slot to BOOKED.
5. Create the booking.
6. Associate the booking with the slot.

If another request has already booked the slot:

Return:

```text
SLOT_ALREADY_BOOKED
```

Frontend message:

```text
Sorry, this slot was just booked.
Please choose another time.
```

Use MongoDB transaction/atomic update mechanisms where appropriate.

---

# 21. BOOKING CANCELLATION

Barber can cancel a booking.

When cancelled:

```text
Booking status:
CANCELLED
```

The slot should become:

```text
AVAILABLE
```

unless the barber chooses to block it.

Do not permanently delete historical bookings.

---

# 22. COMPLETING APPOINTMENT

Barber can mark an appointment:

```text
COMPLETED
```

Example:

```text
Customer
Tarang

11:30 AM

[Mark Completed]
```

Once completed, preserve the booking in history.

---

# 23. NO-SHOW

Allow barber to mark:

```text
NO_SHOW
```

This allows future analytics.

---

# 24. APPOINTMENT HISTORY

Create:

```text
/dashboard/appointments
```

Tabs:

```text
Upcoming
Today
Completed
Cancelled
No Show
All
```

Display:

```text
Customer
Phone
Date
Time
Status
Booking ID
```

Provide search by customer name or phone.

---

# 25. CUSTOMER HISTORY

The barber should be able to see customers who have previously booked.

Customer details:

```text
Name
Phone
Total appointments
Completed appointments
Cancelled appointments
Last appointment
Upcoming appointment
```

Keep this simple.

---

# 26. PUBLIC BOOKING LINK

Every barber gets a unique booking URL.

Example:

```text
yourapp.com/b/rahul-barber
```

On dashboard:

```text
Your Booking Link

yourapp.com/b/rahul-barber

[Copy Link]
[Share]
[QR Code]
```

The Copy button must provide immediate feedback.

Example:

```text
✓ Link copied
```

---

# 27. QR CODE

Generate a QR code for each barber's public booking page.

Display:

```text
Scan to Book

[QR CODE]

Rahul Barber
```

Allow downloading/printing the QR code.

This is useful for:

* Barber shop counter
* Mirror
* Business card
* Instagram
* WhatsApp
* Flyers

---

# 28. SHARE FUNCTIONALITY

Provide:

```text
Copy Link
WhatsApp
Share
QR Code
```

Use the native Web Share API where supported.

Do not require a complicated social integration.

---

# 29. NOTIFICATIONS

Build notification architecture so it can support:

* Email
* WhatsApp
* SMS

Initially implement a clean abstraction.

For example:

```text
NotificationService
├── EmailProvider
├── WhatsAppProvider
└── SMSProvider
```

Do not make WhatsApp/SMS mandatory for the MVP.

---

# 30. BOOKING CONFIRMATION

After successful booking, show a professional confirmation page.

Example:

```text
✓ Appointment Confirmed

Rahul Barber

Monday
28 September 2026

11:30 AM

Booking ID
RB-1042

Please arrive a few minutes before your appointment.

[Done]
```

Provide an option to add the appointment to a calendar if practical.

---

# 31. AUTHENTICATION

Barbers require authentication using their auto-generated `barberCode` (e.g., b001).
Email is no longer used for login.

Implement:

```text
Register (Auto-generates sequential barberCode)
Login (Requires barberCode and password)
Logout
Forgot Password
Reset Password
```

Use secure password hashing.

Never store plaintext passwords.

Customers do not need authentication for MVP booking.

---

# 32. AUTHORIZATION

Every protected request must verify:

```text
authenticated user
+
role
+
resource ownership
```

Example:

Barber A must NEVER be able to access:

```text
Barber B's slots
Barber B's bookings
Barber B's customers
```

Even if Barber A manually changes an ID in the API request.

Always verify ownership server-side.

---

# 33. MULTI-BARBER ARCHITECTURE

This is mandatory.

The application must support unlimited independent barber accounts, subject to the SaaS plan.

Example:

```text
Barber A
├── Slots
├── Bookings
├── Customers
└── Profile

Barber B
├── Slots
├── Bookings
├── Customers
└── Profile

Barber C
├── Slots
├── Bookings
├── Customers
└── Profile
```

Data must never leak between barbers.

Every slot and booking must contain:

```text
barberId
```

---

# 34. ADMIN PANEL

Create a minimal admin panel.

Route:

```text
/admin
```

Admin can view:

```text
Total Barbers
Total Bookings
Active Barbers
Today's Bookings
```

Admin can:

* View barbers
* Activate/deactivate barber accounts
* View platform bookings
* View basic statistics

Do not overbuild the admin panel.

---

# 35. DASHBOARD ANALYTICS

Provide simple statistics:

```text
Today's bookings
This week's bookings
This month's bookings
Completed appointments
Cancelled appointments
No-shows
```

Optional revenue should NOT be implemented unless a payment/price system is added later.

The initial product is appointment scheduling, not payment processing.

---

# 36. UI/UX REQUIREMENTS

The UI must feel like a real commercial SaaS.

Design principles:

* Minimal
* Professional
* Fast
* Clean
* Mobile-first
* Accessible
* Modern

Reference design quality:

* Linear
* Vercel
* Stripe
* Calendly

Do not copy their branding.

Use the design principles only as inspiration.

---

# 37. COLOR SYSTEM

Use a restrained professional color system.

Primary:

* Dark/black
* White
* Neutral gray

Use status colors carefully:

```text
Available → positive/green
Booked → warning/error/red
Blocked → neutral gray
```

Do not create an overly colorful UI.

---

# 38. RESPONSIVE DESIGN

The customer booking page must be excellent on mobile.

The barber dashboard must work on:

```text
Mobile
Tablet
Desktop
```

Mobile booking experience is a priority.

Do not create a desktop-only application.

---

# 39. ACCESSIBILITY

Implement:

* Semantic HTML
* Keyboard navigation
* Proper labels
* Focus states
* Accessible dialogs
* Accessible buttons
* Screen-reader-friendly status information

Do not communicate state using color alone.

---

# 40. VALIDATION

Use Zod for request validation.

Validate:

* Name
* Phone
* Email
* Dates
* Times
* Slot IDs
* Barber IDs
* Booking IDs

Never trust values coming from the frontend.

---

# 41. SECURITY

Implement:

* Secure authentication
* Password hashing
* Authorization
* Input validation
* Rate limiting where appropriate
* Secure cookies/tokens
* Protection against injection
* Server-side ownership checks
* No secrets in client-side code

Never expose:

```text
MONGODB_URI
JWT_SECRET
password hashes
private configuration
```

---

# 42. API DESIGN

Create clean APIs.

Authentication:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

Barber:

```text
GET    /api/barber/profile
PATCH  /api/barber/profile
GET    /api/barber/schedule
PATCH  /api/barber/working-hours
```

Slots:

```text
GET    /api/slots
POST   /api/slots
POST   /api/slots/generate
PATCH  /api/slots/:id
POST   /api/slots/:id/block
POST   /api/slots/:id/unblock
```

Public booking:

```text
GET  /api/public/barbers/:slug
GET  /api/public/barbers/:slug/slots
POST /api/public/bookings
```

Bookings:

```text
GET   /api/bookings
GET   /api/bookings/:id
POST  /api/bookings/:id/cancel
POST  /api/bookings/:id/complete
POST  /api/bookings/:id/no-show
```

Admin:

```text
GET /api/admin/barbers
GET /api/admin/bookings
GET /api/admin/statistics
```

Adjust the exact endpoint structure if necessary to follow Next.js conventions.

---

# 43. API RESPONSE FORMAT

Use consistent responses.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "SLOT_ALREADY_BOOKED",
    "message": "This slot is no longer available."
  }
}
```

---

# 44. DATABASE INDEXES

Create indexes for:

```text
users.email
users.slug

slots.barberId
slots.date
slots.status

bookings.bookingNumber
bookings.barberId
bookings.slotId
bookings.customerId
bookings.date
bookings.status

customers.phone
```

Optimize queries for the public booking page.

---

# 45. TIMEZONE

Appointment times must be timezone-aware.

Default timezone:

```text
Asia/Kolkata
```

Allow the barber's timezone to be stored in their profile.

Never rely blindly on the server's timezone.

Store dates/times consistently and display them in the barber's configured timezone.

---

# 46. DATE/TIME RULES

The system must:

* Prevent past bookings
* Prevent booking unavailable slots
* Prevent duplicate slots
* Prevent overlapping slots
* Prevent double booking
* Correctly handle date boundaries
* Correctly display local time

Use a reliable date/time library if necessary.

---

# 47. SEO

Public barber pages should be indexable.

Example:

```text
yourapp.com/b/rahul-barber
```

Generate metadata dynamically:

```text
Rahul Barber — Book an Appointment
```

Include:

* Title
* Description
* Open Graph metadata
* Canonical URL

---

# 48. ERROR STATES

Create proper UI for:

```text
404 Barber Not Found

No slots available

Slot already booked

Booking failed

Network error

Invalid date

Invalid booking link
```

Never display raw backend errors to users.

---

# 49. LOADING STATES

Use:

* Skeletons
* Loading buttons
* Disabled states
* Spinners where appropriate

Example:

```text
Confirming booking...
```

Do not allow duplicate form submission.

---

# 50. EMPTY STATES

Examples:

```text
No appointments today.

No available slots for this date.

You haven't created any slots yet.

Create your first schedule to start accepting bookings.
```

Each empty state should have an appropriate CTA.

---

# 51. PROJECT STRUCTURE

Use a clean structure similar to:

```text
barber-booking/
│
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   ├── (auth)/
│   │   ├── dashboard/
│   │   ├── admin/
│   │   ├── b/
│   │   │   └── [slug]/
│   │   └── api/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── dashboard/
│   │   ├── booking/
│   │   ├── slots/
│   │   └── shared/
│   │
│   ├── models/
│   │   ├── User.ts
│   │   ├── Slot.ts
│   │   ├── Customer.ts
│   │   └── Booking.ts
│   │
│   ├── services/
│   │   ├── booking.service.ts
│   │   ├── slot.service.ts
│   │   └── customer.service.ts
│   │
│   ├── lib/
│   │   ├── mongodb.ts
│   │   ├── auth.ts
│   │   └── utils.ts
│   │
│   ├── validations/
│   ├── types/
│   └── middleware.ts
│
├── public/
├── scripts/
│   └── seed.ts
│
├── .env.local.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

# 52. ENVIRONMENT VARIABLES

Create:

```text
.env.local.example
```

Include:

```env
MONGODB_URI=
AUTH_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Add other variables only when actually required.

Never commit `.env.local`.

---

# 53. MONGODB CONNECTION

Create a reusable MongoDB connection utility.

It must:

* Reuse connections during development
* Avoid creating a new connection for every request
* Handle connection errors properly
* Work with Vercel serverless deployment

Use MongoDB Atlas in production.

---

# 54. VERCEL DEPLOYMENT

The final application must deploy successfully to Vercel.

Architecture:

```text
Customer / Barber
       ↓
     Vercel
       ↓
Next.js Application
       ↓
MongoDB Atlas
```

Configure production environment variables in Vercel.

The application must work without relying on local filesystem persistence.

Do not use local files as a database.

---

# 55. SEED DATA

Create a development seed script.

Seed:

```text
3 barber accounts
Sample slots
Sample customers
Sample bookings
```

Example:

```text
Rahul Barber
rahul-barber

Amit Barber
amit-barber

Vijay Barber
vijay-barber
```

Clearly document development credentials.

Never use weak/default passwords in production.

---

# 56. TESTING

Test critical functionality.

### Authentication

Test:

```text
Register
Login
Logout
Invalid password
Unauthorized access
```

### Slots

Test:

```text
Create slot
Generate slots
Block slot
Unblock slot
Prevent duplicate slot
```

### Booking

Test:

```text
Book available slot
Prevent booking blocked slot
Prevent booking booked slot
Prevent past booking
```

### Race condition

Test two simultaneous booking requests against the same slot.

Expected result:

```text
Request A → SUCCESS
Request B → SLOT_ALREADY_BOOKED
```

### Authorization

Test that:

```text
Barber A cannot access Barber B's slots.
Barber A cannot access Barber B's bookings.
Barber A cannot modify Barber B's profile.
```

---

# 57. PERFORMANCE

Optimize the public booking page.

It should load quickly.

Avoid unnecessary database queries.

Only retrieve slots required for the selected date.

Use indexes.

Do not fetch every booking in the database when only one day's schedule is needed.

---

# 58. MVP BOUNDARY

Do NOT add unnecessary features during the initial build.

Do NOT implement:

* Payments
* Maps
* Marketplace
* Shop discovery
* Reviews
* Complex CRM
* Inventory
* Product sales
* Subscription billing
* Loyalty programs
* AI chatbot

These may be added later.

The MVP should focus entirely on:

```text
Barber
+
Slots
+
Customers
+
Bookings
```

---

# 59. FUTURE SaaS FEATURES

Design the architecture so these can be added later:

```text
Subscription plans
Online payments
WhatsApp reminders
SMS reminders
Email reminders
Custom domains
Multiple staff
Analytics
Customer loyalty
Recurring appointments
Google Calendar integration
Apple Calendar integration
```

Do not implement these unless specifically requested.

---

# 60. LANDING PAGE

Create a professional landing page explaining the product.

Hero:

```text
Stop managing barber appointments on WhatsApp.

Create your slots.
Share your booking link.
Let customers book instantly.
```

CTA:

```text
Get Started Free
```

Secondary CTA:

```text
See How It Works
```

Sections:

```text
How it works
For barbers
For customers
Features
Simple pricing
FAQ
Footer
```

Keep the landing page focused on the actual product.

---

# 61. PRICING PAGE

Create a basic pricing page for future SaaS monetization.

Example:

### Free

```text
₹0/month

Basic booking page
Limited slots
Basic dashboard
```

### Pro

```text
₹199/month

Unlimited slots
Unlimited bookings
Customer history
QR code
Advanced schedule
```

### Business

```text
₹499/month

Multiple barbers
Advanced analytics
Team management
Priority features
```

Important:

Do NOT implement actual subscription/payment processing in the MVP.

The pricing UI is only a placeholder for future monetization.

---

# 62. FINAL USER EXPERIENCE

A barber should be able to do this in a few minutes:

```text
Register
   ↓
Set name
   ↓
Set working hours
   ↓
Generate today's slots
   ↓
Copy booking link
   ↓
Send link to customers
```

A customer should be able to do this in under one minute:

```text
Open link
   ↓
Choose date
   ↓
Choose available slot
   ↓
Enter name + phone
   ↓
Confirm
```

That simplicity is the core product requirement.

---

# 63. DEFINITION OF DONE

Do not consider the project complete until the following works end-to-end.

### Barber

* [ ] Register
* [ ] Login
* [ ] Logout
* [ ] Edit profile
* [ ] Set working hours
* [ ] Generate slots
* [ ] Add individual slots
* [ ] Block slots
* [ ] Unblock slots
* [ ] View schedule
* [ ] View bookings
* [ ] View customers
* [ ] Cancel booking
* [ ] Complete booking
* [ ] Mark no-show
* [ ] Copy booking link
* [ ] Generate QR code

### Customer

* [ ] Open public barber URL
* [ ] Select date
* [ ] View available slots
* [ ] View booked slots
* [ ] Select available slot
* [ ] Enter name
* [ ] Enter phone
* [ ] Confirm booking
* [ ] Receive confirmation
* [ ] Receive booking ID

### Backend

* [ ] MongoDB connection
* [ ] Authentication
* [ ] Authorization
* [ ] CRUD operations
* [ ] Slot generation
* [ ] Slot blocking
* [ ] Booking logic
* [ ] Double-booking protection
* [ ] Validation
* [ ] Error handling
* [ ] Ownership checks

### Production

* [ ] TypeScript passes
* [ ] ESLint passes
* [ ] Tests pass
* [ ] Production build passes
* [ ] MongoDB Atlas configured
* [ ] Vercel deployment works
* [ ] Environment variables documented
* [ ] README completed

---

# 64. IMPORTANT CODING INSTRUCTION

Build this as a **real production application**, not a demo.

Do not generate fake functionality.

Do not use hardcoded appointments.

Do not use fake availability.

Do not store bookings only in frontend state.

Do not use localStorage as the primary database.

All real application data must persist in MongoDB.

All important business rules must be enforced on the server.

The frontend must never be trusted for:

* Slot availability
* Barber ownership
* Booking ownership
* Booking status
* User role
* Date validation

If a feature is not implemented, clearly state that it is not implemented rather than pretending it works.

Build the application incrementally, test each major feature, and maintain a clean, scalable codebase.

The final result should be a polished SaaS product that can realistically be deployed to Vercel and used by real barbers.
