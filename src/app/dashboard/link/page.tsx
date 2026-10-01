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
    return <div className="p-12 text-center text-zinc-500">{t('loading')}</div>;
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
          title: t('linkShareTitle').replace('{name}', profile?.name || ''),
          text: t('linkShareText'),
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
      toast.add({ title: t('error'), description: t('linkQrError'), type: "error" });
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('linkTitle')}</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          {t('linkSubtitle')}
        </p>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">{t('linkYourLink')}</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input readOnly value={publicUrl} className="h-12 text-base bg-zinc-50 dark:bg-zinc-950 font-medium" />
          <Button onClick={handleCopy} className="h-12 w-full sm:w-auto shrink-0">
            {copied ? t('linkCopied') : <><Copy className="w-4 h-4 mr-2" /> {t('linkCopy')}</>}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => window.open(publicUrl, "_blank")}>
            <ExternalLink className="w-4 h-4 mr-2" /> {t('linkOpen')}
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" /> {t('linkShare')}
          </Button>
          <Button variant="outline" className="text-green-700 border-green-200" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(t('linkWhatsAppText') + " " + publicUrl)}`, "_blank")}>
            {t('linkWhatsApp')}
          </Button>
        </div>
      </div>

      {profile?.linkUsage && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('linkUsageTitle')}</h2>
          <p className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {profile.linkUsage.limit > 0
              ? t('linkUsageOf').replace('{used}', String(profile.linkUsage.used)).replace('{limit}', String(profile.linkUsage.limit))
              : t('linkUsageUnlimited').replace('{used}', String(profile.linkUsage.used))}
          </p>
          {profile.linkUsage.limit > 0 && (
            <div className="mt-3 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div className={`h-full ${profile.linkUsage.used / profile.linkUsage.limit >= 0.8 ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${Math.min(100, (profile.linkUsage.used / profile.linkUsage.limit) * 100)}%` }} />
            </div>
          )}
          {profile.linkUsage.limit > 0 && profile.linkUsage.used / profile.linkUsage.limit >= 0.8 && (
            <p className="mt-3 text-sm text-red-600">{t('linkNearLimit')}</p>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col items-center">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2 w-full text-left">{t('linkQrTitle')}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8 w-full text-left">
          {t('linkQrDesc')}
        </p>
        
        <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-sm mb-6">
          <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 sm:w-64 sm:h-64" />
        </div>
        
        <Button variant="outline" onClick={downloadQR} className="w-full sm:w-auto">
          <Download className="w-4 h-4 mr-2" /> {t('linkQrDownload')}
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
