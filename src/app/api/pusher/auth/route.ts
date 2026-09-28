import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPusherServer, barberChannel } from "@/lib/realtime";

export async function POST(req: Request) {
  const payload = await requireAuth();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json({ error: "Realtime not configured" }, { status: 503 });
  }

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
  }

  // A barber may only subscribe to their own private channel — never someone else's.
  if (channelName !== barberChannel(payload.userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const authResponse = pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
