import mongoose from "mongoose";
import { User } from "@/models/User";
import { Booking } from "@/models/Booking";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface ShopCustomerRow { _id: unknown; name: string; phone: string; visits: number; upcoming: number; lastVisit: string | null; barberCount: number; barbers: string[] }

/**
 * Every customer who has booked with ANY current barber of one shop: visits added up across the shop's barbers, which
 * barbers they saw, and repeat customers. Barbers' private notes are deliberately NOT included.
 * One function, used by the shop's own barbers AND by the admin, so both always see exactly the same list.
 */
export async function loadShopCustomers(shopId: unknown, opts: { page: number; limit: number; search: string; repeatOnly: boolean }): Promise<{ data: ShopCustomerRow[]; total: number }> {
  const { limit, search, repeatOnly } = opts;
  const page = Math.min(Math.max(1, opts.page), 100_000); // a huge page number must not reach the database as an out-of-range skip
    const members = await User.find({ shopId }).select("name");
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
  return { data, total };
}
