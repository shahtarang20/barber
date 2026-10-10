import { cache } from "react";
import { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";
import { loadShareInfo } from "@/lib/shareCard";
import { appIconUrl, normalizeHex } from "@/lib/brandColor";
import { memo } from "@/lib/memo";

/** The barber behind a page address: read once per request (metadata + layout share it) and kept a few seconds across requests. */
const getBarberHead = cache((slug: string) => memo(`b-head:${slug}`, 8_000, async () => {
  await connectToDatabase();
  return User.findOne({ slug }).select("name bio isActive role").lean<{ _id: unknown; name?: string; bio?: string; isActive?: boolean; role?: string } | null>();
}));

/** The browser bar colour belongs in the viewport export (Next.js 16 warns when it is in the metadata). */
export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params;
  const head = await getBarberHead(slug);
  // The owner's brand colour (if set) colours the browser bar and the installed app's title bar.
  const brand = head ? normalizeHex((await loadPageStyle("BARBER", String(head._id))).branding.brandColor) : null;
  return { themeColor: brand ?? "#09090b" };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  
  const barber = await getBarberHead(slug);

  const storeName = barber?.name || "Barber Shop";
  const brand = barber ? normalizeHex((await loadPageStyle("BARBER", String(barber._id))).branding.brandColor) : null;
  const title = `Book ${storeName}`;
  const share = await loadShareInfo("BARBER", slug).catch(() => null);
  const menu = share && share.services > 0 ? `${share.services} service${share.services === 1 ? "" : "s"}${share.fromPrice !== null ? ` from ₹${share.fromPrice}` : ""}. ` : "";
  const description = `${menu}${barber?.bio || `Book your next haircut at ${storeName}.`}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: storeName,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    manifest: `/api/public/barbers/${slug}/manifest`,
    icons: { apple: brand ? appIconUrl({ color: brand, name: storeName, size: 180 }) : "/apple-touch-icon.png" },
    appleWebApp: {
      capable: true,
      title: storeName,
      statusBarStyle: "black-translucent"
    }
  };
}

import { InstallPrompt } from "@/components/InstallPrompt";
import { MyBookingBanner } from "@/components/MyBookingBanner";
import { TemplateScope } from "@/components/catalogue/templates/TemplateScope";
import { TEMPLATE_FONT_CLASS } from "@/components/catalogue/templates/fonts";
import { loadPageStyle } from "@/lib/catalogueTemplateServer";
import { resolveTemplate } from "@/lib/catalogueTemplate";

export default async function BarberLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const barber = await getBarberHead(slug);
  // A suspended barber (or a slug that is not a barber) is a plain "not found", not a page that offers to install a dead app.
  if (!barber || barber.isActive === false || barber.role !== "BARBER") notFound();
  const style = barber ? await loadPageStyle("BARBER", String(barber._id)) : null;
  const template = style?.template ?? resolveTemplate(undefined, slug);

  return (
    <>
      <MyBookingBanner />
      <TemplateScope template={template} fontClass={TEMPLATE_FONT_CLASS[template]} enabled={style?.enabled ?? false} branding={style?.branding ?? null}>{children}</TemplateScope>
      <InstallPrompt isCustomer={true} appName={barber?.name || "this barber"} />
    </>
  );
}
