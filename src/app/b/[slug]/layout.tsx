import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Booking",
    manifest: `/api/public/barbers/${slug}/manifest`,
    themeColor: "#4f46e5",
    appleWebApp: {
      capable: true,
      title: "Booking",
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
