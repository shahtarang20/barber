"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScopeSwitch } from "@/components/catalogue/owner/ScopeSwitch";
import { ServiceForm } from "@/components/catalogue/owner/ServiceForm";
import { useOwnerCatalogue, useShopOwnership } from "@/lib/catalogueClient";
import { useCatalogueScope } from "@/lib/useCatalogueScope";
import { useTranslation } from "@/lib/i18n";

export default function NewServicePage() {
  const { t } = useTranslation();
  const { canManageShop: isShopOwner, shop } = useShopOwnership();
  const [scope, setScope] = useCatalogueScope(isShopOwner);
  const { categories, settings, loading } = useOwnerCatalogue(scope);
  const back = `/dashboard/catalogue${scope === "shop" ? "?scope=shop" : ""}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <Link href={back} className="inline-flex min-h-11 items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"><ArrowLeft className="h-4 w-4" /> {t("ownCatalogue")}</Link>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t("svcAddTitle")}</h1>
      </div>
      {isShopOwner && shop && <ScopeSwitch scope={scope} onChange={setScope} shopName={shop.name} />}
      {loading || !settings.data || !categories.data ? <p className="animate-pulse text-zinc-400">{t("ownLoading")}</p> : categories.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
          <p className="mb-3 text-zinc-600">{t("svcCreateCatFirst")}</p>
          <Link href={`/dashboard/catalogue/categories${scope === "shop" ? "?scope=shop" : ""}`} className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white">{t("ownCreateCat")}</Link>
        </div>
      ) : (
        <ServiceForm key={scope} scope={scope} categories={categories.data} plan={settings.data.plan} members={shop?.members ?? []} backTo={back} />
      )}
    </div>
  );
}
