import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { User } from "@/models/User";
import { eligibleFilter, getRetentionConfig } from "@/lib/retention";

export const maxDuration = 60;
const MAX_ROWS = 100_000;

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Downloads the bookings that the cleanup would remove, as a CSV file, so a copy can be kept. */
export async function GET() {
  const payload = await requireAuth(["ADMIN"]);
  if (!payload) return new Response(JSON.stringify({ success: false, error: { message: "Unauthorized: Admins only" } }), { status: 401, headers: { "Content-Type": "application/json" } });

  await connectToDatabase();
  const { months } = await getRetentionConfig();
  const rows = await Booking.find(eligibleFilter(months)).sort({ date: 1 }).limit(MAX_ROWS).lean();

  const [customers, barbers] = await Promise.all([
    Customer.find({ _id: { $in: [...new Set(rows.map((r) => String(r.customerId)))] } }).select("name phone").lean(),
    User.find({ _id: { $in: [...new Set(rows.map((r) => String(r.barberId)))] } }).select("name barberCode").lean(),
  ]);
  const cMap = new Map(customers.map((c) => [String(c._id), c]));
  const bMap = new Map(barbers.map((b) => [String(b._id), b]));

  const lines = ["booking_number,date,start_time,end_time,status,barber,barber_code,customer,phone,notes"];
  for (const r of rows) {
    const c = cMap.get(String(r.customerId)) as { name?: string; phone?: string } | undefined;
    const b = bMap.get(String(r.barberId)) as { name?: string; barberCode?: string } | undefined;
    lines.push([r.bookingNumber, r.date, r.startTime, r.endTime, r.status, b?.name, b?.barberCode, c?.name, c?.phone, r.notes].map(csv).join(","));
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="old-bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
