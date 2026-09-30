"use client";

import { useEffect, useState } from "react";

/**
 * False until the page's JavaScript has loaded. On a slow phone a person can tap a form's button
 * before that — the browser then submits the form the old way, putting what they typed (even a
 * password) into the address bar. Keep submit buttons off until this is true.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
