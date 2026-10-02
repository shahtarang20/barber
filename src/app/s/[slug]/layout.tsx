import { Metadata } from "next";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { MyBookingBanner } from "@/components/MyBookingBanner";
import { InstallPrompt } from "@/components/InstallPrompt";

/** The preview a customer sees when a shop link is shared on WhatsApp: the shop's own name. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  await connectToDatabase();
  const shop = await Shop.findOne({ slug, isActive: true }).select("name").lean<{ name: string } | null>();
  const name = shop?.name || "Barber Shop";
  const title = `Book at ${name}`;
  const description = `Choose your barber and book your next haircut at ${name}.`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: name, type: "website" },
    twitter: { card: "summary", title, description },
    // Installing this page gives the customer an app named after the shop that opens the shop page.
    manifest: `/api/public/shops/${slug}/manifest`,
    icons: { apple: "/icon-192.png" },
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
  };
}

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connectToDatabase();
  const shop = await Shop.findOne({ slug, isActive: true }).select("name").lean<{ name: string } | null>();
  return (
    <>
      <MyBookingBanner />
      {children}
      <InstallPrompt isCustomer={true} appName={shop?.name || "this shop"} />
    </>
  );
}
