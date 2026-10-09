import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { getTodayISTString, minutesUntilSlotEnd } from "@/lib/istTime";
import { autoCompleteStaleBookings } from "@/lib/bookingMaintenance";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10") || 10, 1), 100);
    const skip = (page - 1) * limit;

    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();
    
    const todayStr = getTodayISTString();

    await autoCompleteStaleBookings(payload.userId);

    // Filtering happens here, not in the browser, so every tab pages correctly
    // and history (completed / cancelled / no-show from past days) is reachable.
    const filter = (searchParams.get("filter") || "ALL").toUpperCase();
    const base = { barberId: payload.userId };
    let query: Record<string, unknown>;
    switch (filter) {
      case "TODAY":
        query = { ...base, status: "CONFIRMED", date: todayStr };
        break;
      case "DATE": {
        // One day's bookings (confirmed, completed and no-show, so a no-show stays visible and can be undone) — used by the Schedule page.
        const date = searchParams.get("date") || "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return NextResponse.json({ success: false, error: { message: "A valid date is required." } }, { status: 400 });
        }
        query = { ...base, date, status: { $in: ["CONFIRMED", "COMPLETED", "NO_SHOW"] } };
        break;
      }
      case "UPCOMING":
        query = { ...base, status: "CONFIRMED", date: { $gte: todayStr } };
        break;
      case "COMPLETED":
      case "CANCELLED":
      case "NO_SHOW":
        query = { ...base, status: filter };
        break;
      default:
        // All = upcoming bookings plus any past ones still awaiting Done / No Show.
        query = { ...base, $or: [{ date: { $gte: todayStr } }, { status: "CONFIRMED" }] };
    }

    // How many confirmed bookings have already ended and still need Done / No Show.
    const pastConfirmed = await Booking.find({ ...base, status: "CONFIRMED", date: { $lte: todayStr } }).select("date endTime").lean();
    const needsAction = pastConfirmed.filter((b) => minutesUntilSlotEnd(b.date, b.endTime) < 0).length;

    // Coming-up views read chronologically (date, then real time of day); history reads newest day first.
    const historyView = ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(filter);
    const sort: Record<string, 1 | -1> = historyView
      ? { date: -1, startMinutes: 1, createdAt: 1 }
      : { date: 1, startMinutes: 1, createdAt: 1 };

    const total = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .populate({ path: 'customerId', model: Customer, select: 'name phone' })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({ 
      success: true, 
      data: bookings,
      meta: { needsAction },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Fetch bookings error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
