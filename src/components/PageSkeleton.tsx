/** Neutral grey placeholder shown while a route's code or data is loading. */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4" role="status" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-1/2 animate-pulse rounded-lg bg-zinc-200" />
      <div className="h-24 animate-pulse rounded-xl bg-zinc-200" />
      <div className="h-24 animate-pulse rounded-xl bg-zinc-200" />
      <div className="h-24 animate-pulse rounded-xl bg-zinc-200" />
    </div>
  );
}
