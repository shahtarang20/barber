import { cache } from "react";
import { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { loadShareInfo } from "@/lib/shareCard";
import { appIconUrl, normalizeHex } from "@/lib/brandColor";
import { memo } from "@/lib/memo";

/** The shop behind a page address: read once per request and kept a few seconds across requests. */
const getShopHead = cache((slug: string) => memo(`s-head:${slug}`, 8_000, async () => {
  await connectToDatabase();
  return Shop.findOne({ slug, isActive: true }).select("name").lean<{ _id: unknown; name: string } | null>();
}));
import { MyBookingBanner } from "@/components/MyBookingBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TemplateScope } from "@/components/catalogue/templates/TemplateScope";
import { TEMPLATE_FONT_CLASS } from "@/components/catalogue/templates/fonts";
import { loadPageStyle } from "@/lib/catalogueTemplateServer";
import { resolveTemplate } from "@/lib/catalogueTemplate";

export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params;
  const head = await getShopHead(slug);
  // The owner's brand colour (if set) colours the browser bar and the installed app's title bar.
  const brand = head ? normalizeHex((await loadPageStyle("SHOP", String(head._id))).branding.brandColor) : null;
  return { themeColor: brand ?? "#09090b" };
}

/** The preview a customer sees when a shop link is shared on WhatsApp: the shop's own name. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopHead(slug);
  const name = shop?.name || "Barber Shop";
  const brand = shop ? normalizeHex((await loadPageStyle("SHOP", String(shop._id))).branding.brandColor) : null;
  const title = `Book at ${name}`;
  const share = await loadShareInfo("SHOP", slug).catch(() => null);
  const menu = share && share.services > 0 ? `${share.services} service${share.services === 1 ? "" : "s"}${share.fromPrice !== null ? ` from ₹${share.fromPrice}` : ""}. ` : "";
  const description = `${menu}Choose your barber and book your next haircut at ${name}.`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: name, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    // Installing this page gives the customer an app named after the shop that opens the shop page.
    manifest: `/api/public/shops/${slug}/manifest`,
    icons: { apple: brand ? appIconUrl({ color: brand, name, size: 180 }) : "/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
  };
}

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShopHead(slug);
  if (!shop) notFound();
  const style = shop ? await loadPageStyle("SHOP", String(shop._id)) : null;
  const template = style?.template ?? resolveTemplate(undefined, slug);
  return (
    <>
      <MyBookingBanner />
      <TemplateScope template={template} fontClass={TEMPLATE_FONT_CLASS[template]} enabled={style?.enabled ?? false} branding={style?.branding ?? null}>{children}</TemplateScope>
      <InstallPrompt isCustomer={true} appName={shop?.name || "this shop"} />
    </>
  );
}
