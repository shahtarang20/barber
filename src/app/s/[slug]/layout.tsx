import { Metadata } from "next";
import connectToDatabase from "@/lib/mongodb";
import { Shop } from "@/models/Shop";
import { MyBookingBanner } from "@/components/MyBookingBanner";

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
  };
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MyBookingBanner />
      {children}
    </>
  );
}
