import { Metadata } from "next";
import connectToDatabase from "@/lib/mongodb";
import { User } from "@/models/User";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  
  await connectToDatabase();
  const barber = await User.findOne({ slug });
  
  const storeName = barber?.storeName || "Barber Shop";
  const title = `Book ${storeName}`;
  const description = barber?.address ? `Book your next haircut at ${storeName}, located at ${barber.address}.` : `Book your next haircut at ${storeName}.`;

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
    appleWebApp: {
      capable: true,
      title: storeName,
      statusBarStyle: "black-translucent"
    }
  };
}

import { InstallPrompt } from "@/components/InstallPrompt";

export default function BarberLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallPrompt isCustomer={true} />
    </>
  );
}
