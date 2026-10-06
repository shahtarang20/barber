import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import { MediaBlob } from "@/models/MediaBlob";

export const runtime = "nodejs";

/** Serves pictures kept in MongoDB (used when cloud storage is not configured). Only this app's own barber/ files exist here. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(key)) return new NextResponse("Not found", { status: 404 });
  await connectToDatabase();
  const blob = await MediaBlob.findById(key.replace(/_/g, "/")); // not lean(): that would hand back a raw BSON Binary instead of a Buffer
  if (!blob) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(blob.data), { headers: { "Content-Type": blob.contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
}
