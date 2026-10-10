import { ImageResponse } from "next/og";
import { DEFAULT_BRAND, darken, normalizeHex, readableInk } from "@/lib/brandColor";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const SIZES = new Set([180, 192, 512]);

/**
 * The installed app's icon for a shop / barber with a brand colour: a brand-colour gradient, a ring and the initials in
 * readable ink. Every input is validated (size from a short list, colour as plain hex, up to two letters/digits), so nothing
 * can be injected, and the answer is cached for an hour. `m=1` is the "maskable" version with the extra padding Android crops into.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const size = Number(url.searchParams.get("s"));
  if (!SIZES.has(size)) return new Response("Bad size", { status: 400 });
  // Per-server memory only (a cheap guard for the image renderer, not worth a Redis command).
  if (!(await rateLimit(`app-icon:${getClientIp(req)}`, 120, 60_000, { local: true }))) return new Response("Too Many Requests", { status: 429 });

  const color = normalizeHex(`#${url.searchParams.get("c") ?? ""}`) ?? DEFAULT_BRAND;
  const raw = url.searchParams.get("t") ?? "";
  const text = /^[A-Za-z0-9]{1,2}$/.test(raw) ? raw.toUpperCase() : "B";
  const maskable = url.searchParams.get("m") === "1";
  const ink = readableInk(color);
  const pad = maskable ? Math.round(size * 0.18) : 0; // Android keeps only the centre ~66% of a maskable icon
  const ring = Math.max(3, Math.round(size * 0.018));
  const inner = size - pad * 2;
  // iOS paints transparent pixels of the home-screen icon black and rounds the corners itself, so the 180 px icon is a full opaque square.
  const opaque = maskable || size === 180;

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: opaque ? color : "transparent" }}>
        <div
          style={{
            width: inner, height: inner, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: maskable ? Math.round(inner * 0.5) : size === 180 ? 0 : Math.round(inner * 0.22),
            background: `linear-gradient(135deg, ${color}, ${darken(color, 0.45)})`,
          }}
        >
          <div
            style={{
              width: Math.round(inner * 0.72), height: Math.round(inner * 0.72), display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "50%", border: `${ring}px solid ${ink === "#ffffff" ? "rgba(255,255,255,0.85)" : "rgba(17,17,17,0.8)"}`,
              color: ink, fontSize: Math.round(inner * (text.length > 1 ? 0.3 : 0.38)), fontWeight: 700, letterSpacing: text.length > 1 ? 2 : 0,
            }}
          >
            {text}
          </div>
        </div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" } }
  );
}
