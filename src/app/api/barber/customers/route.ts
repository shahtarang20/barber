import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.min(Math.max(parseInt(searchParams.get("page") || "1") || 1, 1), 100000);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10") || 10, 1), 100);
    const search = (searchParams.get("search") || "").trim();
    const skip = (page - 1) * limit;

    const payload = await requireAuth(["BARBER"]);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    await connectToDatabase();
    const barberId = new mongoose.Types.ObjectId(payload.userId);

    // Aggregate unique customers from Bookings for this barber
    const customers = await Booking.aggregate([
      { $match: { barberId } },
      {
        $group: {
          _id: "$customerId",
          // A "visit" is a completed appointment — cancelled and no-show bookings aren't visits.
          totalVisits: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          lastVisit: { $max: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$date", null] } },
          // Customers whose every booking was cancelled aren't shown.
          activeBookings: { $sum: { $cond: [{ $ne: ["$status", "CANCELLED"] }, 1, 0] } },
          // Booked but not yet done — lets a brand-new customer show as "new" instead of "0 visits".
          upcoming: { $sum: { $cond: [{ $eq: ["$status", "CONFIRMED"] }, 1, 0] } },
        }
      },
      // Customers whose old bookings were cleaned up still belong in this barber's directory.
      {
        $unionWith: {
          coll: "customers",
          pipeline: [
            { $match: { "barberStats.barberId": barberId } },
            { $project: { _id: 1, totalVisits: { $literal: 0 }, lastVisit: { $literal: null }, activeBookings: { $literal: 0 }, upcoming: { $literal: 0 } } },
          ],
        },
      },
      {
        $group: {
          _id: "$_id",
          totalVisits: { $sum: "$totalVisits" },
          lastVisit: { $max: "$lastVisit" },
          activeBookings: { $sum: "$activeBookings" },
          upcoming: { $sum: "$upcoming" },
        },
      },
      {
        $lookup: {
          from: "customers", // Collection name
          localField: "_id",
          foreignField: "_id",
          as: "customerData"
        }
      },
      { $unwind: "$customerData" },
      // Fold in visits from bookings that were cleaned up long ago.
      { $addFields: { archived: { $first: { $filter: { input: { $ifNull: ["$customerData.barberStats", []] }, as: "s", cond: { $eq: ["$$s.barberId", barberId] } } } } } },
      {
        $addFields: {
          totalVisits: { $add: ["$totalVisits", { $ifNull: ["$archived.visits", 0] }] },
          lastVisit: { $max: ["$lastVisit", "$archived.lastVisit"] },
        },
      },
      // Hide customers whose every booking was cancelled (and who have no past visits).
      { $match: { $or: [{ activeBookings: { $gt: 0 } }, { "archived.visits": { $gt: 0 } }] } },
      ...(search
        ? [{
            $match: {
              $or: [
                { "customerData.name": { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
                // A phone typed as "98765-43210" or "+91 98765 43210" must still find 9876543210.
                { "customerData.phone": { $regex: (search.replace(/\D/g, "").length >= 3 && /^[\d\s+()-]+$/.test(search) ? search.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "") : search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
              ],
            },
          }]
        : []),
      {
        $project: {
          _id: 1,
          name: "$customerData.name",
          phone: "$customerData.phone",
          totalVisits: 1,
          lastVisit: 1,
          upcoming: 1,
          barberNotes: {
            $filter: {
              input: { $ifNull: ["$customerData.barberNotes", []] },
              as: "note",
              cond: { $eq: ["$$note.barberId", barberId] }
            }
          }
        }
      },
      { $sort: { lastVisit: -1, name: 1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ]);

    const result = customers[0];
    const total = result.metadata[0]?.total || 0;
    const paginatedData = result.data;

    // Format the response
    const formattedCustomers = paginatedData.map((c: any) => ({
      _id: c._id,
      name: c.name,
      phone: c.phone,
      totalVisits: c.totalVisits,
      upcoming: c.upcoming || 0,
      lastVisit: c.lastVisit,
      note: c.barberNotes && c.barberNotes.length > 0 ? c.barberNotes[0].note : ""
    }));

    return NextResponse.json({ 
      success: true, 
      data: formattedCustomers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Fetch customers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
