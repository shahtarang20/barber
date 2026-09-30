"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Share2, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useTranslation } from "@/lib/i18n";

export default function PublicLinkPage() {
  const { t } = useTranslation();
  const [slugText, setSlugText] = useState("");
  const [savingSlug, setSavingSlug] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/barber/profile");
      const data = await res.json();
      if (data.success) {
        setProfile(data.data);
        setSlugText(data.data.slug);
      }
    } catch (error) {
      console.error("Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-zinc-500">Loading...</div>;
  }

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/b/${profile?.slug}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Book an appointment with ${profile?.name}`,
          text: 'Book your slot now!',
          url: publicUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      handleCopy();
    }
  };

  const downloadQR = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      if (!response.ok) {
        throw new Error(`QR service returned ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${profile?.slug}-qrcode.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download QR code", error);
      toast.add({ title: "Error", description: "Couldn't download the QR code right now. Please try again.", type: "error" });
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Public Booking Link</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Share this link with your customers so they can book appointments.
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Your Link</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input readOnly value={publicUrl} className="h-12 text-base bg-zinc-50 dark:bg-zinc-950 font-medium" />
          <Button onClick={handleCopy} className="h-12 w-full sm:w-auto shrink-0">
            {copied ? "✓ Copied" : <><Copy className="w-4 h-4 mr-2" /> Copy Link</>}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => window.open(publicUrl, "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" /> Open in new tab
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col items-center">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2 w-full text-left">Your QR Code</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 w-full text-left">
          Print this code and place it in your shop. Customers can scan it to book instantly.
        </p>
        
        <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-sm mb-6">
          <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 sm:w-64 sm:h-64" />
        </div>
        
        <Button variant="outline" onClick={downloadQR} className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" /> Download QR Code
        </Button>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('linkEditTitle')}</h2>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="whitespace-nowrap">/b/</span>
          <Input value={slugText} onChange={(e) => setSlugText(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} className="h-11" />
        </div>
        <p className="text-xs text-zinc-500">{t('linkEditHint')}</p>
        <Button
          className="h-11"
          disabled={savingSlug || slugText === profile?.slug || slugText.length < 3}
          onClick={async () => {
            setSavingSlug(true);
            try {
              const res = await fetch("/api/barber/slug", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: slugText }) });
              const r = await res.json();
              if (r.success) {
                setProfile({ ...profile, slug: r.data.slug });
                toast.add({ title: t('linkSaved'), description: `/b/${r.data.slug}`, type: "success" });
              } else {
                toast.add({ title: t('error'), description: r.error?.code === "SLUG_TAKEN" ? t('linkTaken') : r.error?.message || t('genericError'), type: "error" });
              }
            } catch {
              toast.add({ title: t('error'), description: t('genericError'), type: "error" });
            } finally {
              setSavingSlug(false);
            }
          }}
        >
          {t('linkSave')}
        </Button>
      </div>
    </div>
  );
}
