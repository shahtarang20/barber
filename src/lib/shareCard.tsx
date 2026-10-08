import { ImageResponse } from "next/og";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { Shop } from "@/models/Shop";
import { memo } from "@/lib/memo";
import { r2Config } from "@/lib/mediaConfig";
import { loadPublicCatalogue } from "@/lib/cataloguePublic";
import type { OwnerType } from "@/lib/catalogue";

export const shareCardSize = { width: 1200, height: 630 };
const ACCENT: Record<string, string> = { indigo: "#4f46e5", emerald: "#059669", rose: "#e11d48", amber: "#d97706", sky: "#0284c7", zinc: "#18181b" };

export interface ShareInfo { name: string; accent: string; cover: string; services: number; fromPrice: number | null; examples: string[] }

/** What the WhatsApp preview shows: the name and, when the premium catalogue is on, a summary of what is offered. */
export function loadShareInfo(ownerType: OwnerType, slug: string): Promise<ShareInfo | null> {
  return memo(`share:${ownerType}:${slug}`, 15_000, () => loadShareInfoFresh(ownerType, slug));
}

async function loadShareInfoFresh(ownerType: OwnerType, slug: string): Promise<ShareInfo | null> {
  await connectToDatabase();
  const owner = ownerType === "SHOP"
    ? await Shop.findOne({ slug, isActive: true }).select("name").lean<{ _id: unknown; name: string } | null>()
    : await User.findOne({ slug, role: "BARBER", isActive: true }).select("name").lean<{ _id: unknown; name: string } | null>();
  if (!owner) return null;
  const cat = await loadPublicCatalogue(ownerType, owner._id as never, owner.name);
  const services = cat.available ? cat.categories.flatMap((c) => c.services) : [];
  const prices = services.map((s) => s.finalPrice).filter((p): p is number => typeof p === "number");
  return {
    name: owner.name,
    accent: cat.branding.accent,
    // Only a cover stored in OUR bucket is drawn into the card (the renderer fetches it from the server, so it must never be an arbitrary address).
    cover: cat.available && (r2Config() !== null && cat.branding.coverUrl.startsWith(`${r2Config()!.publicBaseUrl}/`)) ? cat.branding.coverUrl : "",
    services: services.length,
    fromPrice: prices.length ? Math.min(...prices) : null,
    examples: services.slice(0, 3).map((s) => s.name),
  };
}

// The built-in card font has no Indic letters, so text that cannot be drawn is replaced by a plain line rather than boxes.
const drawable = (t: string) => (/^[\x20-\x7E -ɏ₹]+$/.test(t) ? t : "");

export function renderShareCard(info: ShareInfo | null) {
  const name = drawable(info?.name ?? "") || "Book your slot";
  const color = ACCENT[info?.accent ?? "indigo"] || ACCENT.indigo;
  const lines = [
    info && info.services > 0 ? `${info.services} service${info.services === 1 ? "" : "s"}${info.fromPrice !== null ? `  |  from ₹${info.fromPrice}` : ""}` : "Book your haircut online",
    ...(info?.examples.map(drawable).filter(Boolean).slice(0, 3).map((e) => e) ?? []),
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: color, color: "white", fontFamily: "sans-serif" }}>
        {/* eslint-disable @next/next/no-img-element -- ImageResponse cannot use next/image */}
        {info?.cover ? <img src={info.cover} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", opacity: 0.35 }} /> : null}
        {/* eslint-enable @next/next/no-img-element */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, gap: 24, position: "relative" }}>
          <div style={{ fontSize: 30, letterSpacing: 4, textTransform: "uppercase", opacity: 0.85 }}>Book online</div>
          <div style={{ fontSize: name.length > 22 ? 72 : 96, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
          <div style={{ fontSize: 40, fontWeight: 600 }}>{lines[0]}</div>
          {lines.length > 1 && <div style={{ fontSize: 30, opacity: 0.9 }}>{lines.slice(1).join("  •  ")}</div>}
        </div>
      </div>
    ),
    shareCardSize
  );
}
