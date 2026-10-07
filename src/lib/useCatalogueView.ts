"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import type { PublicCatalogue, PublicService } from "@/lib/cataloguePublic";

export type CatalogueView = "booking" | "catalogue";
export type CatalogueKind = "barber" | "shop";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * One place for the public page's Booking / Catalogue switch:
 *  - loads the published catalogue (so the switch is only offered when there is something to show),
 *  - keeps the active view in the page address (`?view=catalogue`) without reloading, so a catalogue link can be shared,
 *  - remembers the service the customer chose with "Book this service" until the booking is made.
 * Existing booking links (no `?view=`) keep opening the booking view exactly as before.
 */
export function useCatalogueView(kind: CatalogueKind, slug: string | undefined) {
  const { data, isLoading } = useSWR<{ success: boolean; data: PublicCatalogue }>(
    slug ? `/api/public/${kind === "barber" ? "barbers" : "shops"}/${slug}/catalogue` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 15_000 }
  );
  const catalogue = data?.success ? data.data : null;
  const available = !!catalogue?.available;

  // Opened from a shared catalogue link? (Read once; what is drawn still waits for the catalogue to load, so the first paint is identical on server and phone.)
  const [view, setViewState] = useState<CatalogueView>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "catalogue" ? "catalogue" : "booking"));
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);

  const setView = useCallback((next: CatalogueView) => {
    setViewState(next);
    // Instant, no reload: only the address changes, so the link stays shareable and Back is not polluted.
    const url = new URL(window.location.href);
    if (next === "catalogue") url.searchParams.set("view", "catalogue");
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  /** "Book this service": remember it and go to the booking view. */
  const bookService = useCallback((service: PublicService) => {
    setSelectedService(service);
    setView("booking");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setView]);

  const clearService = useCallback(() => setSelectedService(null), []);

  // A service the owner unpublished meanwhile must not stay selected: derived, so it disappears the moment the catalogue says so.
  const stillPublished = !!selectedService && !!catalogue && catalogue.categories.some((c) => c.services.some((s) => s.id === selectedService.id));
  const activeService = stillPublished ? selectedService : null;

  return { catalogue, available, loading: isLoading, view: available ? view : "booking" as CatalogueView, /** what the address asked for, even before the catalogue has loaded (so the header can be drawn right at once) */ intendedView: view, setView, selectedService: activeService, bookService, clearService };
}
