"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const InstallPrompt = dynamic(() => import("@/components/InstallPrompt").then((m) => m.InstallPrompt), { ssr: false });

/** The "install this app" banner is not needed to use the page, so its code is fetched a moment after the page is up. */
export function InstallPromptLazy(props: { isCustomer?: boolean; appName?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOn(true), 1500);
    return () => clearTimeout(id);
  }, []);
  return on ? <InstallPrompt {...props} /> : null;
}
