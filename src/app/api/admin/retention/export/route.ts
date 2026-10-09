import { requireAuth } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Customer } from "@/models/Customer";
import { User } from "@/models/User";
import { eligibleFilter, getRetentionConfig } from "@/lib/retention";

export const maxDuration = 60;
const BATCH = 2_000;
const TIME_BUDGET_MS = 50_000;

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const HEADER = "booking_number,date,start_time,end_time,status,barber,barber_code,customer,phone,notes";

/**
 * Downloads the bookings that the cleanup would remove, as a CSV file, so a copy can be kept.
 * The file is streamed in batches, so there is no row limit. If the time allowed for one download runs out first
 * (a very large backlog), the file ends with a clear "INCOMPLETE" line instead of just stopping.
 */
export async function GET() {
  const payload = await requireAuth(["ADMIN"]);
  if (!payload) return new Response(JSON.stringify({ success: false, error: { message: "Unauthorized: Admins only" } }), { status: 401, headers: { "Content-Type": "application/json" } });

  await connectToDatabase();
  const { months } = await getRetentionConfig();
  const started = Date.now();
  const cursor = Booking.find(eligibleFilter(months)).sort({ date: 1, _id: 1 }).lean().cursor({ batchSize: BATCH });
  const enc = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(enc.encode(HEADER + "\n"));
      let written = 0;
      let batch: Awaited<ReturnType<typeof Booking.find>>[number][] = [];
      const flush = async () => {
        if (batch.length === 0) return;
        const [customers, barbers] = await Promise.all([
          Customer.find({ _id: { $in: [...new Set(batch.map((r) => String(r.customerId)))] } }).select("name phone").lean(),
          User.find({ _id: { $in: [...new Set(batch.map((r) => String(r.barberId)))] } }).select("name barberCode").lean(),
        ]);
        const cMap = new Map(customers.map((c) => [String(c._id), c]));
        const bMap = new Map(barbers.map((b) => [String(b._id), b]));
        const lines = batch.map((r) => {
          const c = cMap.get(String(r.customerId)) as { name?: string; phone?: string } | undefined;
          const b = bMap.get(String(r.barberId)) as { name?: string; barberCode?: string } | undefined;
          return [r.bookingNumber, r.date, r.startTime, r.endTime, r.status, b?.name, b?.barberCode, c?.name, c?.phone, r.notes].map(csv).join(",");
        });
        controller.enqueue(enc.encode(lines.join("\n") + "\n"));
        written += batch.length;
        batch = [];
      };
      try {
        for await (const doc of cursor) {
          batch.push(doc as never);
          if (batch.length >= BATCH) {
            await flush();
            if (Date.now() - started > TIME_BUDGET_MS) {
              controller.enqueue(enc.encode(`${csv("INCOMPLETE")},${csv(`This download stopped after ${written} rows because of the time limit. More old bookings remain: run the cleanup, then download again.`)}\n`));
              await cursor.close();
              controller.close();
              return;
            }
          }
        }
        await flush();
        controller.close();
      } catch (err) {
        console.error("Retention export failed:", err);
        controller.enqueue(enc.encode(`${csv("INCOMPLETE")},${csv(`The download failed after ${written} rows. Please try again.`)}\n`));
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="old-bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
