"use client";

import { useCallback, useState } from "react";
import type { CatalogueScope } from "@/lib/catalogueClient";

/**
 * Which catalogue the owner is editing ("me" or, for a shop owner, "shop"). It lives in the page address (?scope=shop)
 * so a refresh or a shared screen keeps the same view. A barber who does not own a shop is always on "me".
 */
export function useCatalogueScope(isShopOwner: boolean): [CatalogueScope, (next: CatalogueScope) => void] {
  const [requested, setRequested] = useState<CatalogueScope>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("scope") === "shop" ? "shop" : "me"));
  const set = useCallback((next: CatalogueScope) => {
    setRequested(next);
    const url = new URL(window.location.href);
    if (next === "shop") url.searchParams.set("scope", "shop"); else url.searchParams.delete("scope");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  return [isShopOwner ? requested : "me", set];
}
