"use client";

import { ErrorScreen } from "@/components/ErrorScreen";

// Replaces the root layout when it itself fails, so it must render its own <html> and <body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error);
  return (
    <html lang="en">
      <body>
        <ErrorScreen kind="error" onRetry={reset} />
      </body>
    </html>
  );
}
