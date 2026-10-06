import { loadShareInfo, renderShareCard, shareCardSize } from "@/lib/shareCard";

export const alt = "Book online";
export const size = shareCardSize;
export const contentType = "image/png";

/** The picture WhatsApp / Facebook show when this link is shared. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderShareCard(await loadShareInfo("BARBER", slug).catch(() => null));
}
