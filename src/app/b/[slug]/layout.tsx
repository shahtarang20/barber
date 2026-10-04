import { Metadata } from "next";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  
  await connectToDatabase();
  const barber = await User.findOne({ slug });

  const storeName = barber?.name || "Barber Shop";
  const title = `Book ${storeName}`;
  const description = barber?.bio || `Book your next haircut at ${storeName}.`;

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
    themeColor: "#09090b",
    icons: { apple: "/apple-touch-icon.png" },
    appleWebApp: {
      capable: true,
      title: storeName,
      statusBarStyle: "black-translucent"
    }
  };
}

import { InstallPrompt } from "@/components/InstallPrompt";
import { MyBookingBanner } from "@/components/MyBookingBanner";

export default async function BarberLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  await connectToDatabase();
  const barber = await User.findOne({ slug }).select("name").lean();

  return (
    <>
      <MyBookingBanner />
      {children}
      <InstallPrompt isCustomer={true} appName={barber?.name || "this barber"} />
    </>
  );
}
