import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
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
          totalVisits: { $sum: 1 },
          lastVisit: { $max: "$date" }
        }
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
      ...(search
        ? [{
            $match: {
              $or: [
                { "customerData.name": { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
                { "customerData.phone": { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
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
          barberNotes: {
            $filter: {
              input: { $ifNull: ["$customerData.barberNotes", []] },
              as: "note",
              cond: { $eq: ["$$note.barberId", barberId] }
            }
          }
        }
      },
      { $sort: { lastVisit: -1 } },
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
