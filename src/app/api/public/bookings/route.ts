import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { Slot } from "@/models/Slot";
import { loadServiceForBooking } from "@/lib/cataloguePublic";
import { createConfirmedBooking } from "@/lib/createBooking";
import { Booking } from "@/models/Booking";
import { markSlotFullIfFull, releaseClaimedSeat } from "@/lib/cancelBooking";
import { z } from "zod";
import mongoose from "mongoose";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { notifyBarber } from "@/lib/realtime";
import { pushToBarberLater } from "@/lib/push";
import { heldByOthersExpr, activeHoldCount } from "@/lib/waitlistHold";
import { normalizePhone } from "@/lib/phone";
import { User } from "@/models/User";
import { minutesUntilSlot } from "@/lib/istTime";
import { barberLinkUsage, shopLinkUsage, isOverLinkLimit } from "@/lib/linkLimit";
import { admitVisitor } from "@/lib/visitorLimit";
import { Shop } from "@/models/Shop";

// Two layers: a generous per-IP ceiling that only stops an actual scripted
// flood (Indian mobile carriers commonly put hundreds of real customers
// behind one shared IP via CGNAT, so a tight per-IP limit punishes strangers
// on the same network for each other's activity), plus a tight per-phone
// limit that catches the actual repeat offender regardless of their IP.
const IP_LIMIT = 200;
const PHONE_LIMIT = 20;

const bookingSchema = z.object({
  slotId: z.string().min(1, "Slot is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(80, "Name must be 80 characters or fewer"),
  phone: z.string().min(10, "Valid phone number is required").refine((p) => p.replace(/\D/g, "").length >= 10, "Valid phone number is required"),
  notes: z.string().max(500, "Notes must be 500 characters or fewer").optional(),
  // Set by the shop page, so the booking counts against the shop link's monthly limit.
  shopSlug: z.string().max(80).optional(),
  // A catalogue service the customer chose ("Book this service"). Checked again here and saved with the booking.
  serviceId: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!(await rateLimit(`public-booking:${ip}`, IP_LIMIT, 60_000))) {
      return NextResponse.json({ success: false, error: { message: "Too many requests from your network. Please try again shortly." } }, { status: 429 });
    }

    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const result = bookingSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ success: false, error: { message: result.error.issues[0].message } }, { status: 400 });
    }

    const { slotId, name, phone, notes, shopSlug, serviceId } = result.data;
    if (!mongoose.isValidObjectId(slotId)) {
      return NextResponse.json({ success: false, error: { code: "SLOT_ALREADY_BOOKED", message: "Sorry, this slot is fully booked or unavailable. Please choose another time." } }, { status: 409 });
    }

    if (!(await rateLimit(`public-booking-phone:${normalizePhone(phone)}`, PHONE_LIMIT, 60_000))) {
      return NextResponse.json({ success: false, error: { message: "Too many booking attempts with this phone number. Please try again in a minute." } }, { status: 429 });
    }

    // The admin's monthly cap on bookings coming in through a link (barber link and, if used, the shop link).
    const slotOwner = await Slot.findById(slotId).select("barberId").lean<{ barberId: unknown } | null>();
    let viaShopId: unknown;
    if (slotOwner) {
      const linkClosedResponse = NextResponse.json({
        success: false,
        error: { code: "LINK_LIMIT", message: "Online booking is closed for now. Please contact the barber directly." },
      }, { status: 403 });
      if ((await barberLinkUsage(slotOwner.barberId)).closed) return linkClosedResponse;
      // The admin's cap on unique visitors: a visitor already counted this month is let through; a new one beyond the cap is not.
      const visitorClosedResponse = NextResponse.json({ success: false, error: { code: "VISITOR_LIMIT", message: "This page is not available right now. Please contact the barber directly." } }, { status: 403 });
      if (shopSlug) {
        const shop = await Shop.findOne({ slug: shopSlug, isActive: true, barberIds: slotOwner.barberId }).select("_id visitorLimit").lean<{ _id: unknown; visitorLimit?: number } | null>();
        if (shop) {
          if ((await shopLinkUsage(shop._id)).closed) return linkClosedResponse;
          if (!(await admitVisitor(req, "SHOP", shop._id, shop.visitorLimit ?? null)).allowed) return visitorClosedResponse;
          viaShopId = shop._id;
        }
      } else {
        const b = await User.findById(slotOwner.barberId).select("visitorLimit").lean<{ visitorLimit?: number } | null>();
        if (!(await admitVisitor(req, "BARBER", slotOwner.barberId, b?.visitorLimit ?? null)).allowed) return visitorClosedResponse;
      }
    }

    // The chosen catalogue service must still be valid for this barber (checked BEFORE a seat is taken, so nothing needs undoing).
    let service: Awaited<ReturnType<typeof loadServiceForBooking>> = null;
    if (serviceId && slotOwner) {
      service = await loadServiceForBooking(serviceId, slotOwner.barberId, viaShopId);
      if (!service) {
        return NextResponse.json({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "This service is no longer available. Please choose another service or book without one." } }, { status: 409 });
      }
    }

    // ATOMIC OPERATION: Check if bookingsCount < capacity and increment in one step.
    const normalizedPhone = normalizePhone(phone);
    const now = new Date();
    // Claim a seat — but never one that's being held for a waitlisted customer (unless this IS that customer).
    const slot = await Slot.findOneAndUpdate(
      {
        _id: slotId,
        status: "AVAILABLE",
        $expr: { $lt: ["$bookingsCount", { $subtract: ["$capacity", heldByOthersExpr(normalizedPhone, now)] }] },
      },
      { $inc: { bookingsCount: 1 }, $pull: { holds: { phone: normalizedPhone } } },
      { new: true }
    );

    if (!slot) {
      const probe = await Slot.findById(slotId).select("status bookingsCount capacity holds");
      const heldForOthers = !!probe && probe.status === "AVAILABLE" && probe.bookingsCount < probe.capacity && activeHoldCount(probe, now) > 0;
      if (heldForOthers) {
        return NextResponse.json({
          success: false,
          error: { code: "SEAT_HELD", message: "This last seat is being held for someone on the waitlist for a few minutes. Please pick another time or try again shortly." },
        }, { status: 409 });
      }
      return NextResponse.json({
        success: false,
        error: { code: "SLOT_ALREADY_BOOKED", message: "Sorry, this slot is fully booked or unavailable. Please choose another time." }
      }, { status: 409 });
    }

    // A slot can outlive the barber being deactivated after it was
    // generated — don't let a booking complete against a suspended barber.
    const barber = await User.findById(slot.barberId).select("isActive").lean();
    if (!barber || barber.isActive === false) {
      await releaseClaimedSeat(slot._id);
      return NextResponse.json({
        success: false,
        error: { message: "This barber is no longer accepting bookings." },
      }, { status: 410 });
    }

    // Reject booking a slot that's already started — always judged against a
    // fixed IST "now", not the server's or customer's ambient local clock,
    // so a customer whose browser timezone disagrees with India can't book
    // (or appear to book) a slot that's actually already in the past.
    if (minutesUntilSlot(slot.date, slot.startTime) < 0) {
      await releaseClaimedSeat(slot._id);
      return NextResponse.json({
        success: false,
        error: { message: "This slot has already passed. Please choose another time." },
      }, { status: 410 });
    }

    // If we just hit capacity, mark it as BOOKED so it doesn't show in UI
    if (slot.bookingsCount >= slot.capacity) {
      await markSlotFullIfFull(slot._id);
    }

    try {
      const { booking: newBooking, customer } = await createConfirmedBooking(slot, name, phone, notes, { viaLink: true, viaShopId }, service ?? undefined);

      // Customers booking at the very same moment can slip past the check above; settle it by order.
      if (await isOverLinkLimit(newBooking._id, slot.barberId, viaShopId)) {
        await Booking.findByIdAndUpdate(newBooking._id, { $set: { status: "CANCELLED" } });
        await releaseClaimedSeat(slot._id);
        return NextResponse.json({
          success: false,
          error: { code: "LINK_LIMIT", message: "Online booking is closed for now. Please contact the barber directly." },
        }, { status: 403 });
      }

      notifyBarber(slot.barberId.toString(), "BOOKINGS_UPDATED");
      pushToBarberLater(slot.barberId.toString(), {
        title: "New booking",
        body: `${customer.name} booked ${newBooking.startTime} on ${newBooking.date}${service ? ` for ${service.name}` : ""}`,
      });

      // First-come position within this time slot (cancelled bookings don't count).
      const queueNumber = await Booking.countDocuments({
        slotId: slot._id,
        status: { $in: ["CONFIRMED", "COMPLETED"] },
        createdAt: { $lte: newBooking.createdAt },
      });

      return NextResponse.json({
        success: true, 
        data: { 
          queueNumber,
          bookingNumber: newBooking.bookingNumber,
          date: newBooking.date,
          startTime: newBooking.startTime,
          customerName: customer.name,
          ...(service ? { serviceName: service.name, servicePrice: service.price } : {}),
        } 
      }, { status: 201 });

    } catch (bookingError) {
      // ROLLBACK: If creating the booking fails, we MUST release the slot back to AVAILABLE
      await releaseClaimedSeat(slot._id);
      console.error("Booking creation failed, rolled back slot:", bookingError);
      return NextResponse.json({ success: false, error: { message: "Failed to create booking. Slot has been released." } }, { status: 500 });
    }
    
  } catch (error) {
    console.error("Public booking error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
