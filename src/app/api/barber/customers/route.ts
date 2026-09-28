import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "BARBER") {
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
      { $sort: { lastVisit: -1 } }
    ]);

    // Format the response
    const formattedCustomers = customers.map(c => ({
      _id: c._id,
      name: c.name,
      phone: c.phone,
      totalVisits: c.totalVisits,
      lastVisit: c.lastVisit,
      note: c.barberNotes && c.barberNotes.length > 0 ? c.barberNotes[0].note : ""
    }));

    return NextResponse.json({ success: true, data: formattedCustomers });
  } catch (error) {
    console.error("Fetch customers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
