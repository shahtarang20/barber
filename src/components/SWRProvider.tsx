"use client";

import { SWRConfig } from "swr";

/**
 * Shared data-fetching defaults for the signed-in areas. Fewer repeat requests on slow phones:
 * the same request made by several components within 10 s is sent once, coming back to the app refreshes
 * at most every 30 s, and a failing request is retried only twice (not forever) with a pause between tries.
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 10_000,
        focusThrottleInterval: 30_000,
        errorRetryCount: 2,
        errorRetryInterval: 8_000,
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
