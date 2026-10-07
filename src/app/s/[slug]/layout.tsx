import { Metadata } from "next";
import { notFound } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { loadShareInfo } from "@/lib/shareCard";
import { MyBookingBanner } from "@/components/MyBookingBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TemplateScope } from "@/components/catalogue/templates/TemplateScope";
import { TEMPLATE_FONT_CLASS } from "@/components/catalogue/templates/fonts";
import { loadPageStyle } from "@/lib/catalogueTemplateServer";
import { resolveTemplate } from "@/lib/catalogueTemplate";

/** The preview a customer sees when a shop link is shared on WhatsApp: the shop's own name. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  await connectToDatabase();
  const shop = await Shop.findOne({ slug, isActive: true }).select("name").lean<{ name: string } | null>();
  const name = shop?.name || "Barber Shop";
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
    icons: { apple: "/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
  };
}

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connectToDatabase();
  const shop = await Shop.findOne({ slug, isActive: true }).select("name").lean<{ _id: unknown; name: string } | null>();
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
