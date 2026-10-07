"use client";

import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "@/lib/i18n";
import type { CatalogueView } from "@/lib/useCatalogueView";

const TABS: { id: CatalogueView; label: "catBookTab" | "catCatalogueTab" }[] = [
  { id: "booking", label: "catBookTab" },
  { id: "catalogue", label: "catCatalogueTab" },
];

/**
 * The full-width, two-equal-halves switch at the top of every public barber / shop page:
 * "Book Appointment" | "Catalogue". It is a proper tab list (arrow keys, Home/End, screen-reader labels),
 * each half is at least 48px tall for easy tapping, and it sits in the page flow, never over the booking content.
 */
export function ViewSwitch({ view, onChange, pending }: { view: CatalogueView; onChange: (v: CatalogueView) => void; pending?: boolean }) {
  const { t } = useTranslation();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((tab) => tab.id === view);
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    onChange(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };

  return (
    <div role="tablist" aria-label={t("catSwitchLabel")} onKeyDown={onKeyDown} className="tp-switch" data-view={view} aria-busy={pending || undefined}>
      {TABS.map((tab) => {
        const active = tab.id === view;
        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[tab.id] = el; }}
            type="button"
            role="tab"
            id={`view-tab-${tab.id}`}
            aria-selected={active}
            aria-controls={`view-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            disabled={pending}
            onClick={() => onChange(tab.id)}
            className="tp-tab">
            {t(tab.label)}
          </button>
        );
      })}
    </div>
  );
}
