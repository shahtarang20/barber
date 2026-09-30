import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { Booking } from "@/models/Booking";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The shop owner's view of every customer who has booked with ANY barber of the shop — visits
 * added up across barbers, which barbers they've seen, and repeat customers. Barbers' private notes
 * are deliberately NOT included.
 */
export async function GET(req: Request) {
  try {
    const payload = await requireAuth(["BARBER"]);
    if (!payload) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
    const search = (searchParams.get("search") || "").trim().slice(0, 60);
    const repeatOnly = searchParams.get("repeat") === "1";

    await connectToDatabase();
    const owner = await User.findById(payload.userId).select("shopId");
    const shop = owner?.shopId ? await Shop.findById(owner.shopId) : null;
    if (!shop || shop.ownerId.toString() !== payload.userId) {
      return NextResponse.json({ success: false, error: { message: "Only the shop owner can see the shop's customers." } }, { status: 403 });
    }

    const members = await User.find({ shopId: shop._id }).select("name");
    const ids = members.map((m) => m._id);
    const nameOf = new Map(members.map((m) => [String(m._id), m.name as string]));

    const rows = await Booking.aggregate([
      { $match: { barberId: { $in: ids } } },
      {
        $group: {
          _id: "$customerId",
          visits: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          upcoming: { $sum: { $cond: [{ $eq: ["$status", "CONFIRMED"] }, 1, 0] } },
          active: { $sum: { $cond: [{ $ne: ["$status", "CANCELLED"] }, 1, 0] } },
          lastVisit: { $max: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$date", null] } },
          barberIds: { $addToSet: { $cond: [{ $ne: ["$status", "CANCELLED"] }, "$barberId", null] } },
        },
      },
      // Customers whose old bookings were cleaned up still count.
      {
        $unionWith: {
          coll: "customers",
          pipeline: [
            { $match: { "barberStats.barberId": { $in: ids } } },
            { $project: { _id: 1, visits: { $literal: 0 }, upcoming: { $literal: 0 }, active: { $literal: 0 }, lastVisit: { $literal: null }, barberIds: { $literal: [] } } },
          ],
        },
      },
      {
        $group: {
          _id: "$_id",
          visits: { $sum: "$visits" },
          upcoming: { $sum: "$upcoming" },
          active: { $sum: "$active" },
          lastVisit: { $max: "$lastVisit" },
          barberIdLists: { $push: "$barberIds" },
        },
      },
      { $lookup: { from: "customers", localField: "_id", foreignField: "_id", as: "c" } },
      { $unwind: "$c" },
      {
        $addFields: {
          archived: { $filter: { input: { $ifNull: ["$c.barberStats", []] }, as: "s", cond: { $in: ["$$s.barberId", ids] } } },
        },
      },
      {
        $addFields: {
          archivedVisits: { $sum: "$archived.visits" },
          allBarbers: {
            $setDifference: [
              { $setUnion: [{ $reduce: { input: "$barberIdLists", initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } }, "$archived.barberId"] },
              [null],
            ],
          },
        },
      },
      {
        $addFields: {
          visits: { $add: ["$visits", "$archivedVisits"] },
          lastVisit: { $max: ["$lastVisit", { $max: "$archived.lastVisit" }] },
        },
      },
      { $match: { $or: [{ active: { $gt: 0 } }, { archivedVisits: { $gt: 0 } }] } },
      ...(search ? [{ $match: { $or: [{ "c.name": { $regex: esc(search), $options: "i" } }, { "c.phone": { $regex: esc(search), $options: "i" } }] } }] : []),
      { $addFields: { barberCount: { $size: "$allBarbers" } } },
      ...(repeatOnly ? [{ $match: { barberCount: { $gte: 2 } } }] : []),
      { $project: { name: "$c.name", phone: "$c.phone", visits: 1, upcoming: 1, lastVisit: 1, allBarbers: 1, barberCount: 1 } },
      { $sort: { barberCount: -1, visits: -1, name: 1 } },
      { $facet: { meta: [{ $count: "total" }], data: [{ $skip: (page - 1) * limit }, { $limit: limit }] } },
    ]);

    const total = rows[0]?.meta[0]?.total || 0;
    const data = (rows[0]?.data || []).map((r: { _id: unknown; name: string; phone: string; visits: number; upcoming: number; lastVisit: string | null; allBarbers: mongoose.Types.ObjectId[]; barberCount: number }) => ({
      _id: r._id,
      name: r.name,
      phone: r.phone,
      visits: r.visits,
      upcoming: r.upcoming,
      lastVisit: r.lastVisit,
      barberCount: r.barberCount,
      barbers: r.allBarbers.map((b) => nameOf.get(String(b)) || "—"),
    }));
    return NextResponse.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Shop customers error:", error);
    return NextResponse.json({ success: false, error: { message: "Internal server error" } }, { status: 500 });
  }
}
