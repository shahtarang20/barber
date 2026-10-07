"use client";

import { useEffect, useState } from "react";
import { TEMPLATE_NAMES, type TemplateId } from "@/lib/catalogueTemplate";

type Info = { template: number | null; effective: number };
// Rows on one screen ask together: ids requested within the same moment go out as a single request.
const pending = new Map<string, Map<string, ((i: Info) => void)[]>>();
let timer: ReturnType<typeof setTimeout> | null = null;
function lookup(ownerType: string, id: string): Promise<Info> {
  return new Promise((resolve) => {
    const byType = pending.get(ownerType) ?? new Map();
    pending.set(ownerType, byType);
    byType.set(id, [...(byType.get(id) ?? []), resolve]);
    if (timer) return;
    timer = setTimeout(async () => {
      timer = null;
      const batches = [...pending.entries()];
      pending.clear();
      for (const [type, ids] of batches) {
        const res = await fetch(`/api/admin/catalogue-template?ownerType=${type}&ids=${[...ids.keys()].join(",")}`).then((r) => r.json()).catch(() => null);
        for (const [rid, resolvers] of ids) resolvers.forEach((fn) => fn(res?.success ? res.data[rid] : { template: null, effective: 1 }));
      }
    }, 30);
  });
}

/** One small control for the admin: which look the customer page of this shop / barber has (Auto or 1-5). */
export function CustomerStyleSelect({ ownerType, ownerId, name }: { ownerType: "SHOP" | "BARBER"; ownerId: string; name: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let alive = true; lookup(ownerType, ownerId).then((i) => alive && setInfo(i)); return () => { alive = false; }; }, [ownerType, ownerId]);

  const change = async (value: string) => {
    setBusy(true); setError("");
    const template = value === "auto" ? null : Number(value);
    const res = await fetch("/api/admin/catalogue-template", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerType, ownerId, template }) }).then((r) => r.json()).catch(() => null);
    if (res?.success) setInfo({ template: res.data.template, effective: res.data.effective }); else setError(res?.error?.message || "Could not save");
    setBusy(false);
  };

  return (
    <label className="inline-flex flex-col gap-1 text-xs text-zinc-500" onClick={(e) => e.stopPropagation()}>
      Customer page style
      <select
        aria-label={`Customer page style for ${name}`}
        disabled={!info || busy}
        value={info?.template ? String(info.template) : "auto"}
        onChange={(e) => change(e.target.value)}
        className="min-h-11 rounded-md border border-zinc-200 bg-transparent px-2 text-sm text-zinc-900 dark:text-zinc-100"
      >
        <option value="auto">{info ? `Auto (${TEMPLATE_NAMES[info.effective as TemplateId]})` : "Auto"}</option>
        {([1, 2, 3, 4, 5] as const).map((n) => <option key={n} value={n}>{n} · {TEMPLATE_NAMES[n]}</option>)}
      </select>
      {error && <span role="alert" className="text-red-600">{error}</span>}
    </label>
  );
}
