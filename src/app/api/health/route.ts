import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const DB_TIMEOUT_MS = 4000;

/** Uptime probe: `200 {ok:true}` when the database answers a ping in time, else `503`. Reveals nothing about the setup. */
export async function GET() {
  const started = Date.now();
  let dbOk = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        await connectToDatabase();
        await mongoose.connection.db?.admin().ping();
        dbOk = true;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS); }),
    ]);
  } catch {
    dbOk = false;
  } finally {
    if (timer) clearTimeout(timer);
  }
  return NextResponse.json(
    { ok: dbOk, db: dbOk ? "up" : "down", ms: Date.now() - started },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
