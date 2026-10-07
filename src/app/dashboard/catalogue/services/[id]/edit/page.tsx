"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ServiceForm } from "@/components/catalogue/owner/ServiceForm";
import { useOwnerCatalogue, useShopOwnership } from "@/lib/catalogueClient";
import { useCatalogueScope } from "@/lib/useCatalogueScope";
import { useTranslation } from "@/lib/i18n";

export default function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useTranslation();
  const { id } = use(params);
  const { canManageShop: isShopOwner, shop } = useShopOwnership();
  const [scope] = useCatalogueScope(isShopOwner);
  const { categories, services, settings, loading } = useOwnerCatalogue(scope);
  const back = `/dashboard/catalogue${scope === "shop" ? "?scope=shop" : ""}`;
  const existing = services.data?.find((s) => s._id === id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <Link href={back} className="inline-flex min-h-11 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="h-4 w-4" /> {t("ownCatalogue")}</Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t("svcEditTitle")}</h1>
      </div>
      {loading || !settings.data || !categories.data || !services.data ? <p className="animate-pulse text-zinc-400">{t("ownLoading")}</p> : !existing ? (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{t("svcNotFound")}</p>
      ) : (
        <ServiceForm key={existing._id} scope={scope} categories={categories.data} plan={settings.data.plan} members={shop?.members ?? []} existing={existing} backTo={back} />
      )}
    </div>
  );
}
